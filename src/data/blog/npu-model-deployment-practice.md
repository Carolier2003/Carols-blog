---
title: 华为昇腾 NPU 大模型部署实战：从踩坑到量产
description: 记录本周在华为昇腾 910B NPU 上部署 Qwen3-4B、QED-Nano、GLM-OCR 等模型的完整过程，分享 vLLM 部署、内存优化、设备映射、流式输出等关键技术要点与踩坑经验
pubDatetime: 2026-02-26
featured: true
ogImage: https://r2.kon-carol.xyz/20260226221612007.png
tags:
  - NPU
  - 华为昇腾
  - vLLM
  - 模型部署
  - Docker
  - LLM
---

凌晨两点，我盯着屏幕上那行刺眼的红色报错：

```
ValueError: No available memory for the cache blocks.
Try increasing gpu_memory_utilization or decreasing max_model_len.
```

这是我本周第三次尝试启动 Qwen3-4B。模型明明只有 4B 参数，却连华为昇腾 910B 的 32GB 显存都撑爆了。

一周前，老板扔给我五个模型，要求全部部署到公司的 NPU 集群上。我拍着胸脯说："没问题，vLLM 一行命令就搞定。"

现在，我被现实狠狠教育了。

## NPU 部署全景图

在展开那些血泪故事之前，先给你一个完整的部署流程概览。如果你正准备开始 NPU 部署，这张图能帮你建立全局视角：

```
┌─────────────────────────────────────────────────────────────────┐
│                     NPU 模型部署流程                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 环境准备                                                     │
│     ├── 确认 CANN 版本（建议 8.0 RC1+）                          │
│     ├── 安装 Ascend Docker Runtime                              │
│     └── 检查 NPU 设备可见性（npu-smi info）                      │
│                          ↓                                      │
│  2. 镜像选择                                                     │
│     ├── Qwen3 架构 → v0.14.0rc1+                                │
│     ├── 其他模型 → v0.11.0rc0+                                  │
│     └── 自定义镜像 → 基于 ascend/pytorch 构建                   │
│                          ↓                                      │
│  3. 模型评估                                                     │
│     ├── 架构是否被 vLLM 支持？                                   │
│     │   ├── ✅ 是 → 走 vLLM 方案（高性能）                      │
│     │   └── ❌ 否 → 走 Transformers 方案（更稳定）              │
│     └── 上下文长度 vs NPU 显存估算                               │
│         └── 262k 上下文可能需要限制到 8k                         │
│                          ↓                                      │
│  4. 容器配置                                                     │
│     ├── 设备映射：-v /dev/davinciX                               │
│     ├── 驱动挂载：driver + fwkacllib（缺一不可）                │
│     ├── 环境变量：ASCEND_RT_VISIBLE_DEVICES=0                   │
│     └── 端口映射：-p 宿主机端口:容器端口                         │
│                          ↓                                      │
│  5. 服务启动                                                     │
│     ├── vLLM：vllm serve + 参数调优                             │
│     └── Transformers：Flask + Gunicorn (gthread)                │
│                          ↓                                      │
│  6. 验证测试                                                     │
│     ├── 健康检查：/v1/models 或 /health                         │
│     ├── 功能测试：对话/推理是否正常                              │
│     └── 性能测试：并发、延迟、显存占用                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**两个关键决策点：**

| 决策点 | 选项 A | 选项 B |
| ------ | ------ | ------ |
| **部署框架** | vLLM（高性能、高并发） | Transformers（稳定、兼容性好） |
| **上下文长度** | 按模型默认（可能 OOM） | 限制 4k-8k（推荐） |

看起来简单对吧？但魔鬼藏在细节里。接下来，让我告诉你这六个步骤里，我是怎么一步步掉进坑里的。

## 为什么是 NPU？

公司之前用 A100，但懂的都懂——**买不到、买不起、不敢买**。

华为昇腾 910B 是国产替代方案，理论上性能对标 A100。老板拍板："就它了，先上一台试试。"

第一次拿到 NPU 服务器时，我还带着 CUDA 的思维定势：

```bash
# 我的第一反应
docker run --runtime=nvidia ...  # 报错：没有这个 runtime
export CUDA_VISIBLE_DEVICES=0    # 毫无反应
model.to("cuda")                 # RuntimeError: Invalid device
```

我花了整整两天才意识到：**NPU 不是"国产 CUDA"，它是完全不同的生态。**

有自己的驱动（CANN）、自己的容器运行时、自己的 PyTorch 分支。文档散落在各种内部 Wiki 和GitCode 仓库里，Stack Overflow 上几乎搜不到答案。

但这周的经历让我明白：**越早踩坑，越早自由。**

## 部署概览

| 模型 | 参数 | 架构 | 部署方式 | NPU 设备 | 端口 | 耗时 |
| ---- | ---- | ---- | -------- | -------- | ---- | ---- |
| **Qwen3-4B-Instruct** | 4B | Qwen3ForCausalLM | vLLM | davinci6 | 18006 | 半天 |
| **QED-Nano** | 2.5B | Qwen3ForCausalLM | vLLM | davinci5 | 18005 | 2 小时 |
| **Nanbeige4.1-3B** | 3B | - | vLLM | davinci3 | 18003 | 1 小时 |
| **Eva-4B-V2** | 4B | Qwen3ForCausalLM | Transformers | davinci6 | 18006 | 2 天 |
| **GLM-OCR** | 1.3B | GlmOcrForConditionalGeneration | Transformers | davinci4 | 18004 | 3 天 |

从表格能看出来：**越往后越难**。前三个用 vLLM 顺风顺水，后两个差点让我怀疑人生。

## 第一阶段：Qwen3-4B —— 入门即踩坑

第一个模型选了 Qwen3-4B，理由很简单：**模型小、文档全、社区活跃**。想着先跑通一个，建立信心。

结果第一步就栽了。

### 血的教训：不要用 v0.11.0rc0

我按照官方文档，拉了这个镜像：

```dockerfile
FROM quay.io/ascend/vllm-ascend:v0.11.0rc0
```

构建、启动，然后报错：

```
ValueError: The model architectures ['Qwen3ForCausalLM'] are not supported
```

我以为是模型下载错了，检查了好几遍 `config.json`。又怀疑是 transformers 版本问题，升级降级试了一圈。

**真正原因：** v0.11.0rc0 的 transformers 版本太老，根本不认识 Qwen3 架构。

解决方法简单到离谱：

```dockerfile
# ✅ 正确
FROM quay.io/ascend/vllm-ascend:v0.14.0rc1
```

就改个版本号，折腾了我三个小时。后来我把这个写进了 Dockerfile 注释：

```dockerfile
# ⚠️ 警告：Qwen3 架构必须使用 v0.14.0rc1+，否则无法识别
# 作者：凌晨两点被坑惨的某人
```

## 第二阶段：QED-Nano —— 长上下文的真实代价

Qwen3-4B 跑通后，我信心满满地开始部署 QED-Nano。2.5B 参数，比 Qwen3-4B 还小，应该很快吧？

然后我看到了它的上下文长度：**262k**。

我直接复制了 Qwen3-4B 的启动参数：

```bash
vllm serve /data/model/QED-Nano \
  --port 8000 \
  --dtype bfloat16 \
  --gpu-memory-utilization 0.9
```

启动，报错：

```
ValueError: No available memory for the cache blocks.
Try increasing gpu_memory_utilization or decreasing max_model_len.
```

这下我知道凌晨两点的那个报错从哪来的了。

### 为什么 2.5B 模型比 4B 还吃显存？

vLLM 使用 PagedAttention 管理 KV Cache。上下文越长，KV Cache 占用的显存就越多。

计算公式大概是这样的：

```
KV Cache = 2 × num_layers × num_heads × head_dim × seq_len × batch_size × sizeof(dtype)
```

对于 QED-Nano 的 262k 上下文，光是 KV Cache 就要吃掉几十 GB。910B 的 32GB 显存？塞不下。

### 解决方案：砍上下文长度

```bash
vllm serve /data/model/QED-Nano \
  --port 8000 \
  --dtype bfloat16 \
  --max-model-len 8192 \          # 从 262k 砍到 8k
  --gpu-memory-utilization 0.95   # 再压榨一下显存
```

| 参数 | 模型支持 | 实际部署 | 原因 |
|------|---------|---------|------|
| max-model-len | 262k | 8k | NPU 内存限制 |
| gpu-memory-utilization | 0.9 | 0.95 | 提高内存使用效率 |

**经验：** 长上下文模型必须限制 `max-model-len`，根据 NPU 内存和模型大小调整。推荐 4k-8k，既能满足大部分场景，又不会 OOM。

## 第三阶段：Eva-4B-V2 —— 当 vLLM 背叛了你

前两个模型用 vLLM 部署得挺顺利，Eva-4B-V2 应该也没问题吧？

结果启动时报了一个极其诡异的错误：

```
libatb.so: undefined symbol
```

Google 了一圈，相关信息寥寥无几。最后在华为内部论坛找到一条回复：**NNAL（Neural Network Acceleration Library）版本不匹配**。

### NNAL 是什么鬼？

NNAL 是华为昇腾的神经网络加速库，vLLM-ascend 底层依赖它。但 NNAL 的版本与驱动版本、固件版本、vLLM-ascend 版本都有严格的对应关系。

我们的服务器装的是 CANN 8.0 RC1，但 vLLM-ascend v0.14.0rc1 镜像用的是 NNAL 8.0 的某个中间版本。两个版本 ABI 不兼容，导致 `libatb.so` 找不到符号。

### 方案选择

我面临两个选择：

| 方案 | 优点 | 缺点 | 风险 |
| ---- | ---- | ---- | ---- |
| 升级服务器 NNAL | 保持 vLLM 高性能 | 需要运维介入，可能影响其他服务 | 高 |
| **改用 Transformers** | **稳定，无额外依赖** | 并发能力较弱 | **低** |

Eva-4B-V2 是一个**财务电话会议 Q&A 回避性回答检测模型**，本质上是分类任务，不需要高并发生成。Transformers 完全够用。

```python
from transformers import AutoModel, AutoProcessor

model = AutoModel.from_pretrained(
    MODEL_PATH,
    dtype=torch.bfloat16,
    trust_remote_code=True,
    device_map="auto"
)
```

用 Flask 包装一下，Gunicorn 跑起来，搞定。

**这次的经验是：** vLLM 不是银弹。当底层依赖出现兼容性问题时，回归最简单的方案往往是最靠谱的。

## 第四阶段：GLM-OCR —— 架构不兼容的噩梦

GLM-OCR 的部署，是我这周踩过最深的坑。

报错看起来和第一阶段差不多：

```
ValueError: The model architectures ['GlmOcrForConditionalGeneration'] are not supported
```

我以为又是镜像版本问题，升级到最新版——没用。

### 排查过程：从表层到内核

#### 第一步：怀疑 transformers 版本

GLM-OCR 是最新发布的模型，可能 transformers 稳定版还不支持。我尝试从源码安装：

```bash
pip install git+https://github.com/huggingface/transformers.git
```

网络超时。换 GitCode 镜像：

```bash
pip install git+https://gitcode.com/GitHub_Trending/tra/transformers.git
```

装上了，但还是报错。

#### 第二步：怀疑 vLLM 的架构支持

查 vLLM-ascend 的源码，发现它确实没有 `GlmOcrForConditionalGeneration` 的实现。那它会走通用回退路径 `TransformersMultiModalForCausalLM`。

理论上应该能跑，为什么报错？

#### 第三步：深入 weight loader

我在 vLLM 的 `weight_loader` 里加了日志，追踪模型加载过程。然后发现了关键线索：

```
ValueError: There is no module or parameter named 'model.language_model.layers.16'
in TransformersMultiModalForConditionalGeneration
```

等等，GLM-OCR 的配置里明明写的是 `num_hidden_layers=16`，为什么会有第 17 层（layers.16）？

#### 第四步：发现 MTP 层

查了半天 GLM-4 的技术文档，终于搞明白：

GLM-4 系列有 **Multi-Token Prediction (MTP)** 机制。除了标准的 16 层 Transformer，还有一个 MTP 预测层，权重保存在 `layers.16`。

vLLM 的通用回退路径只创建了标准的 16 层网络，遇到 safetensors 里 MTP 层的权重就崩溃了。

### 最终方案：完全绕开 vLLM

和 Eva-4B-V2 一样，用 Transformers 原生加载：

```python
from transformers import AutoModel, AutoProcessor

model = AutoModel.from_pretrained(
    MODEL_PATH,
    dtype=torch.bfloat16,
    trust_remote_code=True,
    device_map="auto"
)
```

但这次更复杂——GLM-OCR 需要流式输出。

### GLM-OCR 流式输出的坑

使用 `TextIteratorStreamer` 实现流式输出时，遇到两个难题：

**1. Gunicorn worker 选择**

| Worker 类型 | 结果 | 原因 |
| ----------- | ---- | ---- |
| sync | ❌ 无法流式 | 阻塞式处理 |
| gevent | ❌ CANN 报错 | 与 TBE 编译器的 multiprocessing 冲突 |
| **gthread** | ✅ 正常工作 | 线程模式，兼容 CANN |

```bash
gunicorn \
  --worker-class gthread \
  --workers 1 \
  --threads 4 \
  --bind 0.0.0.0:8000 \
  --timeout 600 \
  transformers_server:app
```

**2. 模型无限重复生成**

GLM-OCR 在生成正常内容后会进入重复循环，持续输出相同内容不停止。

我用了三层防护来解决：

```python
# 层1: 生成层 - 从模型层面降低重复概率
generation_config.repetition_penalty = 1.2

# 层2: token 层 - 连续相同 token 检测
if new_text == last_text:
    repeat_count += 1
    if repeat_count > 10:
        break

# 层3: 段落层 - 检测文本末尾是否在重复前文
if check_block_repeat(accumulated_text):
    break
```

这个三层防护的灵感来自 HunyuanOCR 的 `clean_repeated_substrings` 实现。

## 第五阶段：Nanbeige4.1-3B —— 轻车熟路

到第五个模型时，我已经形成了一套标准流程：

1. 检查模型架构是否被 vLLM-ascend 支持
2. 检查上下文长度，预估显存需求
3. 选择部署方案（vLLM vs Transformers）
4. 复制之前的 deploy.sh，改改参数

Nanbeige4.1-3B 是个 3B 参数的中文基础模型，架构普通、上下文不长，用 vLLM 半小时部署完成。

**这次的经验是：** 形成可复用的脚本和检查清单，比逐个解决问题更高效。

## 那些藏在细节里的坑

### 容器内 NPU 设备 ID 设置

这个坑我踩了两次。最初的 deploy.sh 是这样写的：

```bash
# ❌ 错误！
NPU_DEVICE_ID=$(echo ${NPU_DEVICE} | sed 's/davinci//')
# 结果：davinci6 → 6
```

容器启动后报错：

```
set ASCEND_RT_VISIBLE_DEVICES:6 error, input data rang[0-0])
```

**原因：** 宿主机映射 `/dev/davinci6` 到容器后，容器内只看到这一个设备，编号为 0。设置设备 ID 为 6 超出范围。

**正确做法：**

```bash
# ✅ 无论映射哪个物理 NPU，容器内始终使用设备 ID 0
docker run \
  -e NPU_VISIBLE_DEVICES=0 \
  -e ASCEND_RT_VISIBLE_DEVICES=0 \
  -e ASCEND_DEVICE_ID=0 \
  -e DEVICE_ID=0 \
  ...
```

| 物理 NPU | 宿主机设备 | 容器内设备 ID | 环境变量值 |
|---------|-----------|--------------|-----------|
| davinci6 | /dev/davinci6 | 0 | 0 |
| davinci5 | /dev/davinci5 | 0 | 0 |
| davinci4 | /dev/davinci4 | 0 | 0 |

### 驱动库挂载完整性

漏挂 `fwkacllib` 会导致 NPU 初始化失败：

```
RuntimeError: Initialize:... NPU function error: aclInit, error code is 107001
[Error]: Invalid device ID.
```

**必须挂载的驱动路径：**

```bash
docker run \
  -v /usr/local/Ascend/driver:/usr/local/Ascend/driver:ro \
  -v /usr/local/Ascend/driver/lib64:/usr/local/Ascend/driver/lib64:ro \
  -v /usr/local/Ascend/fwkacllib:/usr/local/Ascend/fwkacllib:ro \      # 容易遗漏！
  -v /usr/local/Ascend/driver/version.info:/usr/local/Ascend/driver/version.info:ro \
  -v /etc/ascend_install.info:/etc/ascend_install.info:ro \
  -v /usr/local/dcmi:/usr/local/dcmi \
  -e LD_LIBRARY_PATH=/usr/local/Ascend/driver/lib64:/usr/local/Ascend/fwkacllib/lib64:$LD_LIBRARY_PATH \
  ...
```

### 端口映射：避开 host 网络模式

最初尝试用 `--network=host`，但发现与 `-p` 端口映射冲突：

```bash
# ❌ 错误：-p 在 host 模式下失效
docker run --network=host -p 18006:8000 ...
```

**推荐方案：** 使用 bridge 模式 + `-p` 映射

```bash
# vllm-start.sh - 容器内保持默认 8000
vllm serve ... --port 8000

# deploy.sh - 使用 -p 映射端口
docker run -p 18006:8000 ...
```

## 最终部署架构

### vLLM 方案（Qwen3-4B / QED-Nano / Nanbeige4.1-3B）

```
┌─────────────────────────────────────────────────────────────┐
│                      宿主机 (Host)                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  物理 NPU   │    │  端口映射   │    │  模型文件   │     │
│  │  davinci6   │───▶│  18006:8000 │◀───│ /data1/...  │     │
│  └─────────────┘    └──────┬──────┘    └─────────────┘     │
│                            │                                │
│  ┌─────────────────────────┼─────────────────────────┐     │
│  │                   Docker 容器                      │     │
│  │  ┌──────────────────────┼─────────────────────┐   │     │
│  │  │                 vLLM Service                 │   │     │
│  │  │            (port 8000, device 0)             │   │     │
│  │  └──────────────────────┼─────────────────────┘   │     │
│  │                         │                        │     │
│  │  ┌──────────────────────┼─────────────────────┐   │     │
│  │  │              NPU Runtime (CANN)             │   │     │
│  │  │  NPU_VISIBLE_DEVICES=0, ASCEND_RT_VISIBLE_DEVICES=0  │
│  │  └──────────────────────┼─────────────────────┘   │     │
│  └─────────────────────────┼─────────────────────────┘     │
└────────────────────────────┼───────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   NPU davinci6  │
                    │   (物理设备)    │
                    └─────────────────┘
```

### Transformers 原生方案（Eva-4B-V2 / GLM-OCR）

```
Client Request → Gunicorn (gthread, 4线程) → Flask App → TextIteratorStreamer
                                                       ↓
                                                  NPU (davinci4)
                                                       ↓
Client ← SSE Stream ← Thread-safe Queue ← Model.generate()
```

## 写在最后

一周后，五个模型全部上线。

回头看这周的踩坑历程，最大的收获不是这些具体的技术细节，而是心态的转变：

**从"CUDA 思维"到"NPU 思维"。**

NPU 生态还在快速发展，文档不完善、工具链不成熟是常态。但这恰恰是机会——你现在踩的每一个坑，记录下来，就是后来者的路标。

如果你也正在做 NPU 部署，希望这篇文章能帮你少走一些弯路。但更重要的是，**不要害怕报错信息，它们是指向真相的线索**。

从凌晨两点那个 "No available memory" 的报错，到最终五个模型稳定运行，我学到的最重要一课是：

> 国产 AI 芯片的道路注定不平坦，但总得有人走。

## 经验速查表

1. **基础镜像版本**：Qwen3 架构需要 `v0.14.0rc1+`，旧版本无法识别
2. **长上下文必须限制**：`max-model-len` 根据 NPU 内存调整，推荐 4k-8k
3. **容器内设备 ID**：无论物理 NPU 编号多少，始终设为 0
4. **驱动挂载完整**：必须包含 `fwkacllib`，否则初始化失败
5. **端口映射**：使用 bridge 模式 + `-p`，避免 `--network=host`
6. **vLLM 不支持时的备选**：Transformers 原生 + Flask 是最稳的方案
7. **Gunicorn worker**：不能用 gevent（与 CANN 冲突），用 gthread
8. **模型重复生成**：三层防护（repetition_penalty + token检测 + 段落检测）

## 参考

- [vLLM Documentation](https://docs.vllm.ai/)
- [Ascend vLLM Adapter](https://gitee.com/ascend/vllm-ascend)
- [ModelScope - Qwen3-4B](https://modelscope.cn/models/Qwen/Qwen3-4B-Instruct-2507)
- [HuggingFace Transformers](https://huggingface.co/docs/transformers/)

---

如果你在 NPU 部署中遇到问题，欢迎交流讨论。
