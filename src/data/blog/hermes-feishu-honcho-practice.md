---
author: Carol
pubDatetime: 2026-06-24T22:00:00Z
title: 飞书 + Hermes + Honcho：构建多用户 AI 助手全链路实践
description: 从零开始，将 Hermes Agent 接入飞书，并用 Honcho 实现多用户记忆隔离的全流程记录，包含架构设计、部署踩坑和记忆降噪实战经验。
draft: false
featured: true
tags:
  - 飞书
  - Hermes
  - Honcho
  - AI
  - 架构
---

## 一、背景

随着公司全面使用飞书作为办公协作平台，团队成员日常已在飞书端完成身份认证。但后台管理系统仍采用独立账号体系，员工需要额外记忆密码，体验割裂。

为了提升效率，我们决定将 **Hermes Agent**（一个开源 AI 智能体框架）接入飞书，让团队成员可以通过飞书直接与 AI 助手交互，完成代码审查、文档查询、自动化任务等操作。

然而，多用户场景下很快就遇到了两个核心问题：

1. **对话混乱** — 多人在群聊中 @ 机器人，上下文互相干扰
2. **记忆混在一起** — AI 助手记住的用户偏好、项目信息在不同用户间串了

本文将完整记录如何通过 **Hermes + Honcho** 的组合方案解决这些问题。

---

## 二、飞书接入 Hermes

### 2.1 Hermes 是什么

[Hermes Agent](https://hermes-agent.nousresearch.com/) 是由 Nous Research 开发的开源 AI 智能体框架，支持通过飞书、Telegram、Discord 等多种即时通讯平台交互。它可以执行代码、操作文件、搜索网页、生成图片等，是一个"能行动的 AI"。

### 2.2 配置飞书平台

首先需要在[飞书开放平台](https://open.feishu.cn/)创建企业自建应用：

1. 创建应用，获取 **App ID** 和 **App Secret**
2. 开启 **机器人** 能力
3. 配置事件订阅（使用 WebSocket 或 Webhook 方式）

### 2.3 部署 Hermes 网关

在服务器上安装并配置 Hermes：

```bash
# 安装 Hermes
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash

# 配置飞书凭证
# 编辑 ~/.hermes/.env
FEISHU_APP_ID=cli_xxxxxxxxxxxx
FEISHU_APP_SECRET=your_app_secret
FEISHU_DOMAIN=feishu
FEISHU_CONNECTION_MODE=websocket

# 启动网关
hermes gateway run
```

### 2.4 群聊配置

为了同时支持私聊和群聊 @ 回复，配置如下环境变量：

```bash
# 允许所有用户使用（开发阶段）
FEISHU_ALLOW_ALL_USERS=true
FEISHU_GROUP_POLICY=open
```

并在 `~/.hermes/config.yaml` 中设置群聊上下文按用户隔离：

```yaml
group_sessions_per_user: false  # 群聊内所有人共享上下文
```

---

## 三、多人场景下的挑战

### 3.1 会话隔离

Hermes 默认每个用户的私聊会话是独立隔离的，互不可见。但在群聊场景下，需要决定多人的 @ 回复是各自独立上下文还是共享上下文。

```yaml
# config.yaml 配置
group_sessions_per_user: true   # 每人独立上下文（默认）
# group_sessions_per_user: false  # 群聊共享上下文
```

根据团队协作需求灵活选择即可。

### 3.2 记忆隔离问题

更大的挑战在于 **长期记忆**。

Hermes 内置了基于文件的记忆系统（`MEMORY.md` + `USER.md`），用于记住用户的偏好、工作目录、配置信息等。但问题是：

> **内置记忆是全局共享的。** 所有用户的记忆混在同一个文件中。

这就导致：
- A 用户的 GitHub 账号信息，B 用户查询时也可能被引用
- 非中文用户的沟通偏好固化到了全局配置中
- 不同项目的配置信息互相污染

---

## 四、引入 Honcho 实现记忆隔离

### 4.1 为什么选 Honcho

[Hongcho](https://github.com/plastic-labs/honcho) 是一个 AI 原生记忆后端，核心特性包括：

| 特性 | 说明 |
|------|------|
| **多用户隔离** | 每个用户有独立的 peer 空间，记忆互不可见 |
| **自动学习** | 后台 Deriver 自动从对话中提取用户画像 |
| **语义搜索** | 支持向量检索，自然语言查询记忆 |
| **可自托管** | 支持 Docker 部署，数据完全自主可控 |

对比其他方案（如 Mem0、OpenViking），Honcho 是唯一**原生支持多 peer 隔离**的选项。

### 4.2 自托管部署

#### 架构设计

```
┌─────────────────────┐         ┌──────────────────────┐
│   Hermes 服务器      │  HTTP   │   Honcho 服务          │
│  7.6G RAM / 103G     │◄────────│  16G RAM / 大存储      │
│                      │         │                       │
│  Hermes 网关          │         │  PostgreSQL + pgvector │
│  飞书机器人            │         │  Redis                 │
│  lark-cli             │         │  Honcho API (8000)     │
│  项目代码              │         │  Deriver 推理引擎       │
└─────────────────────┘         └──────────────────────┘
        内网通信，速度飞快，数据不出网
```

#### 部署步骤

使用社区一键脚本快速部署：

```bash
curl -sL https://raw.githubusercontent.com/elkimek/honcho-self-hosted/main/setup.sh | bash
```

脚本会自动安装 Docker、克隆 Honcho 源码、配置 LLM 提供商并启动 4 个核心服务。

如果你在中国大陆部署，可能会遇到 Docker Hub 拉取限流的问题，配置国内镜像即可解决：

```json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com"
  ]
}
```

#### Embedding 模型配置

由于 OpenAI 的 `text-embedding-3-small` 在国内访问不稳定，我们改用[硅基流动（SiliconFlow）](https://cloud.siliconflow.cn)提供的 `BAAI/bge-m3` 作为 embedding 模型：

```bash
# Honcho .env 配置
LLM_EMBEDDING_API_KEY=sk-xxxx
LLM_EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
LLM_EMBEDDING_MODEL=BAAI/bge-m3
```

### 4.3 配置 Hermes 连接 Honcho

```bash
# 安装 Honcho 插件
pip install honcho-ai

# 切换记忆提供者
hermes config set memory.provider honcho

# 配置连接
mkdir -p ~/.honcho
cat > ~/.honcho/config.json << 'EOF'
{
  "baseUrl": "http://localhost:8000",
  "hosts": {
    "hermes": {
      "enabled": true,
      "aiPeer": "hermes",
      "workspace": "hermes",
      "pinUserPeer": false,
      "observationMode": "unified",
      "writeFrequency": "async",
      "contextCadence": 1,
      "contextTokens": 1200,
      "dialecticCadence": 3,
      "dialecticReasoningLevel": "minimal",
      "dialecticDynamic": false,
      "saveMessages": true
    }
  }
}
EOF

# 重启生效
hermes gateway restart
```

> **关键配置解读：**
> - `pinUserPeer: false` — 不锁定用户，每个飞书用户自动分配独立 peer
> - `observationMode: unified` — 统一观察模式，避免用户与 AI 双重视角导致重复记忆
> - `dialecticCadence: 3` — 每 3 轮对话触发一次推理，降低频繁推理带来的噪音
> - `dialecticReasoningLevel: minimal` — 最低推理强度，只提取最明确的事实

---

## 五、记忆降噪实战

### 5.1 噪音从哪来

Honcho 的 Deriver 后台进程**对所有对话消息进行推理**，提取"结论"存入长期记忆。这本来是个好设计，但问题在于：

> **Deriver 不知道对话中哪些是"长期偏好"、哪些是"临时操作"。**

结果就是：
- OAuth 授权链接 → 被提取为"用户授权了某请求"
- 配置修改命令 → 被提取为"用户设置了 xxx"
- "问你话呢"这种随口话 → 也被提取了

### 5.2 第一轮清理：52 条 → 7 条

手动检查 Honcho 后发现，短短几轮对话已经产生了 52 条结论，其中有效信息只有 7 条：

**保留的 7 条核心记忆：**
```
Carol communicates in Chinese.
Carol is Carolier2003 on GitHub.
Git commits use author name Hermes and email ...
Carol has her workspace at ~/workspace/.
Carol runs Carols-blog at kon-carol.xyz using AstroPaper.
Carol prefers warm-toned beige/tan Mermaid colors.
lark-cli is installed and bound to Hermes.
```

**被删除的 45 条噪音包括：**
- "用户授权了请求" — OAuth 流程记录
- "用户设置了 dialecticCadence = 3" — 配置操作
- "用户询问如何验证配置" — 临时对话
- "用户表示喜欢紫色" 的重复视角 — 同一内容被 AI 和用户自己各记一遍

### 5.3 Deriver 自定义指令（终极方案）

Honcho 支持通过 Workspace API 为 Deriver 设置**自定义推理指令**，从源头控制什么该记、什么不该记：

```bash
curl -X PUT "http://localhost:8000/v3/workspaces/hermes" \
  -H "Content-Type: application/json" \
  -d '{
    "configuration": {
      "reasoning": {
        "enabled": true,
        "custom_instructions": "Only extract permanent user facts. IGNORE: config discussions, commands, auth flows, one-time decisions, questions, verification steps."
      }
    }
  }'
```

这条指令告诉 Deriver：
- ✅ **记**：用户偏好、项目配置、工具链、账号信息
- ❌ **不记**：配置讨论、命令执行、授权流程、一次性决策、对话中的问题

### 5.4 降噪效果对比

| 指标 | 优化前 | 优化后 |
|------|:-----:|:-----:|
| 对话轮次 | ~20 轮 | ~20 轮 |
| 产生结论 | **52 条** | **8 条** |
| 噪音率 | ~86% | ~0% |
| 有效记忆 | 7 条 | 8 条（新增自动学习的偏好） |

值得一提的是，优化后 Honcho 仍然成功自动捕捉到了"Carol likes purple"这个偏好，说明**降噪配置没有影响到 Honcho 的核心学习能力**。

---

## 六、踩坑记录 🕳️

### 🕳️ 坑 1：Docker Hub 国内限流

部署 Honcho 时，Docker 拉取 `pgvector/pgvector:pg15` 和 `redis:8.2` 镜像时频繁遇到 `toomanyrequests` 错误。

**解决**：配置国内镜像加速器，或直接使用官方手动部署方式（`uv sync + fastapi dev`）。

### 🕳️ 坑 2：Embedding 模型不兼容

默认配置使用 OpenAI 的 `text-embedding-3-small`，但该模型需要直接访问 OpenAI API，在国内网络下经常超时或 401。

**解决**：改用硅基流动的 `BAAI/bge-m3`，注意向量维度需配置为 `1024`（BGE-M3 的输出维度）。

### 🕳️ 坑 3：Deriver 意外停服

手动停止 Deriver 进行调试后，积压了大量未处理消息。重新启动后，Deriver 一次性处理了所有积压对话，产生了大量过程性噪音。

**解决**：停止 Deriver 前先清空队列，或做好心理准备后续需要清理。

### 🕳️ 坑 4：Deriver 端口映射问题

在某次 Docker Compose 重建后，宿主机 `localhost:8000` 连接 Honcho API 时出现 `Connection reset by peer`，但容器内网 IP 直连正常。

**解决**：检查 Docker 网络配置，确保端口映射正确。临时使用容器内网 IP 访问。

### 🕳️ 坑 5：双重观察视角

默认配置下，Honcho 同时创建了 `AI→用户` 和 `用户→用户` 两个观察方向，导致同一内容被重复存储。

**解决**：设置 `observationMode: unified` 统一观察视角，只保留 `AI→用户` 方向。

---

## 七、最终架构

```
用户 A (@飞书) ──┐
用户 B (@飞书) ──┤
用户 C (@飞书) ──┤
                 ▼
        ┌────────────────────┐
        │   飞书开放平台       │
        │   WebSocket 网关     │
        └────────┬───────────┘
                 │
        ┌────────▼───────────┐
        │   Hermes 网关       │
        │   ~/.hermes/        │
        │   ├── config.yaml   │
        │   ├── .env          │
        │   └── memories/     │ ← 内置记忆（全局共享）
        └────────┬───────────┘
                 │ HTTP
        ┌────────▼───────────┐
        │   Honcho (自托管)    │
        │   ├── API (8000)    │
        │   ├── Deriver       │ ← 后台推理引擎
        │   ├── PostgreSQL    │
        │   └── Redis         │
        │                     │
        │   Peer A ─ 用户A的记忆│ 🔒
        │   Peer B ─ 用户B的记忆│ 🔒
        │   Peer C ─ 用户C的记忆│ 🔒
        └────────────────────┘
```

## 八、总结

通过 **Hermes + Honcho** 的组合，我们实现了：

1. ✅ 飞书私聊 + 群聊 @ 回复
2. ✅ 多用户对话上下文隔离
3. ✅ 多用户长期记忆完全隔离（每人独立 Peer）
4. ✅ 自动从对话中学习用户偏好
5. ✅ 有效的记忆降噪机制

最关键的几点经验：
- **Honcho 的自定义指令是降噪的关键**，比调整所有配置参数都有效
- **自托管让数据完全自主可控**，适合企业对隐私有要求的场景
- **降噪需要持续迭代**，没有一劳永逸的方案

如果你也在用飞书 + AI 助手，希望这篇文章对你有所帮助！

---

## 参考资料

- [Hermes Agent 官方文档](https://hermes-agent.nousresearch.com/docs/)
- [Honcho 官方文档](https://honcho.dev/docs/v3/documentation/introduction/quickstart)
- [Honcho 自托管部署指南](https://github.com/elkimek/honcho-self-hosted)
- [飞书开放平台](https://open.feishu.cn/)
- [硅基流动 SiliconFlow](https://cloud.siliconflow.cn)
