---
title: 华为昇腾 NPU 大模型部署实战：从踩坑到量产
description: 记录本周在华为昇腾 910B NPU 上部署 Qwen3-4B、QED-Nano、GLM-OCR 等模型的完整过程，分享 vLLM 部署、内存优化、设备映射、流式输出等关键技术要点与踩坑经验
pubDatetime: 2026-02-26
tags:
  - NPU
  - 华为昇腾
  - vLLM
  - 模型部署
  - Docker
  - LLM
---

这周密集部署了三个大模型到华为昇腾 NPU，从 Qwen3-4B 的顺利部署到 GLM-OCR 的艰难适配，踩了不少坑。这篇博文记录完整的实战经验，希望能帮到正在做 NPU 部署的同学。

## 部署概览

| 模型 | 参数 | 架构 | 部署方式 | NPU 设备 | 端口 |
|------|------|------|----------|----------|------|
| **Qwen3-4B-Instruct** | 4B | Qwen3ForCausalLM | vLLM Direct | davinci6 | 18006 |
| **QED-Nano** | 2.5B | Qwen3ForCausalLM | vLLM Direct | davinci5 | 18005 |
| **GLM-OCR** | 1.3B | GlmOcrForConditionalGeneration | Transformers 原生 | davinci4 | 18004 |

## 基础镜像选择：版本决定成败

**血的教训：不要用 v0.11.0rc0！**

Qwen3 架构的模型必须使用 `v0.14.0rc1` 及以上版本的基础镜像：

```dockerfile
# ✅ 正确
FROM quay.io/ascend/vllm-ascend:v0.14.0rc1

# ❌ 错误 - 无法识别 Qwen3 架构
FROM quay.io/ascend/vllm-ascend:v0.11.0rc0
```

旧版本会报这个错：

```
ValueError: The model architectures ['Qwen3ForCausalLM'] are not supported
```

## 长上下文模型的内存陷阱

Qwen3-4B 支持 128k 上下文，QED-Nano 更是支持 262k，但 NPU 910B 的内存根本撑不住。

**首次启动报错：**

```
ValueError: No available memory for the cache blocks.
Try increasing gpu_memory_utilization or decreasing max_model_len.
```

**解决方案：**

```bash
vllm serve /data/model/Qwen3-4B-Instruct-2507 \
  --port 8000 \
  --served-model-name qwen3-4b-instruct \
  --dtype bfloat16 \
  --max-model-len 8192 \          # 限制为 8k
  --gpu-memory-utilization 0.95   # 提高内存利用率
```

| 参数 | 模型支持 | 实际部署 | 原因 |
|------|---------|---------|------|
| max-model-len | 128k/262k | 8k | NPU 内存限制 |
| gpu-memory-utilization | 0.9 | 0.95 | 提高内存使用效率 |

**经验：** 长上下文模型必须限制 `max-model-len`，根据 NPU 内存和模型大小调整，推荐 8k-16k。

## 容器内 NPU 设备 ID 设置：最容易踩的坑

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

## 驱动库挂载完整性

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

## 端口映射：避开 host 网络模式

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

## GLM-OCR：当 vLLM 不支持时的备选方案

GLM-OCR 的部署是最艰难的，因为 vLLM-ascend 根本不支持 `GlmOcrForConditionalGeneration` 架构。

**报错：**

```
ValueError: The model architectures ['GlmOcrForConditionalGeneration'] are not supported
```

**根因：** GLM-OCR 包含 Multi-Token Prediction (MTP) 层，vLLM 的 `TransformersMultiModalForCausalLM` 回退路径无法处理 MTP 层的权重。

**最终方案：** 完全绕开 vLLM，使用 HuggingFace Transformers 原生推理 + Flask 提供 OpenAI 兼容 API。

```python
# transformers_server.py
from transformers import AutoModel, AutoProcessor
import torch

model = AutoModel.from_pretrained(
    MODEL_PATH,
    dtype=torch.bfloat16,
    trust_remote_code=True,
    device_map="auto"
)
```

### GLM-OCR 流式输出的坑

使用 `TextIteratorStreamer` 实现流式输出时，遇到两个难题：

**1. Gunicorn worker 选择**

| Worker 类型 | 结果 | 原因 |
|------------|------|------|
| sync | ❌ 无法流式 | 阻塞式处理 |
| gevent | ❌ CANN 报错 | 与 TBE 编译器的 multiprocessing 冲突 |
| **gthread** | ✅ 正常工作 | 线程模式，兼容 CANN |

```bash
# ✅ 正确配置
gunicorn \
  --worker-class gthread \
  --workers 1 \
  --threads 4 \
  --bind 0.0.0.0:8000 \
  --timeout 600 \
  transformers_server:app
```

**2. 模型无限重复生成**

GLM-OCR 在生成正常内容后会进入重复循环，需要三层防护：

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

## 最终部署架构

### vLLM 方案（Qwen3-4B / QED-Nano）

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

### Transformers 原生方案（GLM-OCR）

```
Client Request → Gunicorn (gthread, 4线程) → Flask App → TextIteratorStreamer
                                                       ↓
                                                  NPU (davinci4)
                                                       ↓
Client ← SSE Stream ← Thread-safe Queue ← Model.generate()
```

## 经验总结

1. **基础镜像版本**：Qwen3 架构需要 `v0.14.0rc1+`，旧版本无法识别
2. **长上下文必须限制**：`max-model-len` 根据 NPU 内存调整，推荐 8k
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

部署代码已开源：[GitHub - models_inference](https://github.com/Carolier2003/models_inference)
