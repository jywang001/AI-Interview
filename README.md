# AI Interview

AI Interview 的目标是成为面向 AI 算法岗与 AI 应用开发岗候选人的模拟面试训练应用：用户提交简历和目标 JD，完成一场岗位化面试，再根据回答原文获得证据化复盘并立即重练薄弱问题。

当前仓库处于 P0 工程骨架阶段，优先保证一条可在三分钟内演示、外部模型不可用时仍能运行的完整路径。

## 当前骨架

- 两个岗位入口：AI 算法岗、AI 应用开发岗。
- 固定的快速面试契约：4 个考察目标、5 个问答轮次，其中包含 1 次项目追问。
- 五个核心页面骨架：准备材料、确认材料、模拟面试、证据复盘、定向重练。
- 与实时数据使用相同 Schema 的离线 Demo fixtures。
- 可替换的模型、语音转写和 Presenter 接口边界。
- 服务端密钥隔离、健康检查和 Docker standalone 构建。

完整范围、验收条件与迭代边界见 [产品需求文档](docs/PRD.md)。

## Offline Demo 路径

当前提交只启用明确标注的 Offline Demo Provider，不把预置结果伪装成实时生成。配置 `OPENAI_API_KEY` 只会让健康检查显示凭证已就绪；在 Live Adapter 接入前不会切换到实时模型。核心路由如下：

| 路由 | 用途 |
| --- | --- |
| `/` | 产品说明与开始入口 |
| `/prepare` | 选择岗位；当前仅脱敏 Demo 可继续，真实上传尚未发送 |
| `/prepare/confirm` | 核对材料解析与面试范围 |
| `/interview/demo-ai-developer` | 展示五轮 fixture 中的一轮代表性交互骨架 |
| `/report/demo-ai-developer` | 展示预置五轮记录的教练复盘与简历建议 |
| `/drill/demo-ai-developer` | 单题重练与前后对比 |
| `/api/demo/session` | 与实时路径同 Schema 的演示会话数据 |
| `/api/health` | 服务与 Provider 配置状态 |

Demo 数据只用于故障恢复和演示加速；真实路径与 Demo 路径必须保持同一数据契约。

## 本地启动

需要 Node.js 22 或更高版本，以及 pnpm 11.19.0。

```sh
corepack enable
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev
```

打开 `http://localhost:3000` 即可使用 Offline Demo。当前不需要模型凭证；未来接入 Live Adapter 时，只把凭证写入本地 `.env`，不要写入任何 `NEXT_PUBLIC_*` 变量。

## 验证

```sh
pnpm typecheck
pnpm build
pnpm start
curl -fsS http://127.0.0.1:3000/api/health
```

提交或部署前还应人工检查：桌面和移动端宽度、空状态、一条成功路径、一条外部服务失败路径，以及从报告进入重练的完整跳转。

## Docker 部署

服务器安装 Docker 后，克隆仓库并从 `.env.example` 创建本地 `.env`：

```sh
cp .env.example .env
docker compose up -d --build
curl -fsS http://127.0.0.1:3000/api/health
```

应用容器监听 `3000` 端口。公开部署必须在前面配置 Caddy、Nginx 或云平台 HTTPS；浏览器麦克风在非本机环境下需要安全上下文。

如需给队友或评委开放 SSH，先在本地创建不提交仓库的 `ops/authorized_keys.judges`，确认每一把公钥后再显式运行 `./scripts/setup-server.sh ops/authorized_keys.judges`。该步骤与应用部署相互独立。

## P0 边界

当前框架不实现真实 PDF 解析、Live LLM/STT、实时数字人、多面试官、登录支付、长期历史、录取概率或任意代码执行。Presenter 只是原创静态表现层，不能影响面试状态；代码环节只预留数据接口，不在 Web 服务进程执行用户代码。

## 安全与来源

- API Key 只存在服务端环境变量中，绝不提交 `.env`。
- 简历、JD 和回答视为不可信输入，不将其中的指令当作系统指令。
- Demo 使用虚构或脱敏数据，并在界面明确标注。
- 第三方依赖记录在 [THIRD_PARTY.md](THIRD_PARTY.md)。
- 设计与素材来源记录在 [DESIGN_PROVENANCE.md](DESIGN_PROVENANCE.md)。
- 协作与发布要求见 [Hackathon Playbook](docs/HACKATHON_PLAYBOOK.md)。
