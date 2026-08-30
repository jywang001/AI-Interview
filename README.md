# AI Interview

AI Interview 的目标是成为面向 AI 算法岗与 AI 应用开发岗候选人的模拟面试训练应用：用户提交简历和目标 JD，完成一场岗位化面试，再根据回答原文获得证据化复盘并立即重练薄弱问题。

当前仓库处于 P0 工程骨架阶段，优先保证一条可在三分钟内演示、外部模型不可用时仍能运行的完整路径。

## 当前骨架

- 两个岗位入口：AI 算法岗、AI 应用开发岗。
- 真实文本型 PDF + JD 的服务端提取、模型分析与事实确认路径。
- 固定的快速面试契约：4 个考察目标、5 个问答轮次，其中包含 1 次项目追问。
- 五个核心页面骨架：准备材料、确认材料、模拟面试、证据复盘、定向重练。
- 与实时数据使用相同 Schema 的离线 Demo fixtures。
- 可替换的模型、语音转写和 Presenter 接口边界。
- 服务端密钥隔离、健康检查和 Docker standalone 构建。

完整范围、验收条件与迭代边界见 [产品需求文档](docs/PRD.md)。

## 当前运行模式

当前提交采用明确标注的混合模式，不把预置结果伪装成实时生成：真实 PDF 简历与 JD 会由 `/api/materials/parse` 调用已配置的 OpenAI-compatible 模型生成待确认草稿；面试提问、追问、报告、重练和语音转写仍使用 Demo fixtures / adapters。即使外部模型未配置或暂不可用，Offline Demo 面试路径仍可完整演示。

| 路由 | 用途 |
| --- | --- |
| `/` | 产品说明与开始入口 |
| `/prepare` | 选择岗位；可提交真实 PDF + JD，或进入虚构 Demo |
| `/prepare/confirm` | 核对真实模型解析草稿，或查看 Demo 材料范围 |
| `/interview/demo-ai-developer` | 展示五轮 fixture 中的一轮代表性交互骨架 |
| `/report/demo-ai-developer` | 展示预置五轮记录的教练复盘与简历建议 |
| `/drill/demo-ai-developer` | 单题重练与前后对比 |
| `/api/materials/parse` | 以 `pdftotext` 提取真实简历并调用配置的模型分析材料 |
| `/api/demo/session` | 与实时路径同 Schema 的演示会话数据 |
| `/api/health` | 分别报告材料分析、面试和语音能力状态 |

Demo 数据只用于故障恢复和演示加速；真实路径与 Demo 路径必须保持同一数据契约。

## 本地启动

需要 Node.js 22 或更高版本，以及 pnpm 11.19.0。

```sh
corepack enable
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev
```

打开 `http://localhost:3000` 即可使用 Offline Demo。要解析真实材料，还需在本地 `.env` 配置 `OPENAI_API_KEY` 与 `OPENAI_MODEL`；`OPENAI_BASE_URL` 可用于兼容端点。所有凭证只放在服务端变量中，不要写入任何 `NEXT_PUBLIC_*` 变量。

## 验证

```sh
pnpm typecheck
pnpm build
pnpm start
curl -fsS http://127.0.0.1:3000/api/health
```

提交或部署前还应人工检查：桌面和移动端宽度、空状态、一条成功路径、一条外部服务失败路径，以及从报告进入重练的完整跳转。

## 真实材料解析与隐私

真实简历路径只支持可提取文本的 PDF，并通过 Poppler 提供的 `pdftotext` 读取内容；扫描件和图片型 PDF 不在 P0 范围内。宿主机必须能直接运行 `pdftotext`：macOS 可安装 `poppler`，Debian/Ubuntu 与 Alpine 分别安装 `poppler-utils`。本仓库的 Docker builder 和 runner 镜像均已安装 Alpine `poppler-utils`。

当前 P0 不使用数据库或对象存储保存材料。服务端通过内存 Buffer 和 `pdftotext` 的标准输入/输出处理 PDF 字节、JD 与提取文本，不创建临时材料文件，也不把原文写入应用日志；请求结束后服务端不保留副本。为完成事实确认，返回的结构化草稿（含必要的原文摘录）会暂存在当前浏览器标签页的 `sessionStorage`，不会成为服务端长期记录，关闭该标签页会结束这段浏览器会话。真实材料分析会把提取文本与 JD 发送给当前配置的模型服务；部署方必须确认并披露供应商的处理区域、日志和留存策略，并在界面取得用户同意。

材料接口内置单进程 Demo 保护：带 `Content-Length` 的请求在约 9 MB 处提前拒绝，同时限制为最多 2 个并发分析和每分钟 10 个已接受请求。它不能替代网关控制；公网部署仍须在 Caddy、Nginx 或云负载均衡设置 9 MB 总请求体上限、限速、并发上限和模型费用告警，尤其要拦截没有 `Content-Length` 的分块超大请求。

公开演示应优先使用 [虚构演示材料](fixtures/demo-materials/README.md)。两份演示 PDF 可用开发期脚本重新生成；ReportLab 只用于生成 fixture，不是 Node 应用或生产容器的运行时依赖：

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install "reportlab==4.4.9"
python scripts/build_demo_resumes.py
```

## Docker 部署

服务器安装 Docker 后，克隆仓库并从 `.env.example` 创建本地 `.env`：

```sh
cp .env.example .env
docker compose up -d --build
curl -fsS http://127.0.0.1:3000/api/health
```

应用容器监听 `3000` 端口，Compose 默认只绑定宿主机 `127.0.0.1:3000`。公开部署必须在前面配置 Caddy、Nginx 或云平台 HTTPS；浏览器麦克风在非本机环境下需要安全上下文。

如需给队友或评委开放 SSH，先在本地创建不提交仓库的 `ops/authorized_keys.judges`，确认每一把公钥后再显式运行 `./scripts/setup-server.sh ops/authorized_keys.judges`。该步骤与应用部署相互独立。

## P0 边界

真实材料解析与模型分析已接通，但仅覆盖文本型 PDF，不做 OCR。面试规划、提问追问、报告、重练与 STT 仍为 Demo，不应宣称已实时生成。当前框架不实现实时数字人、多面试官、登录支付、长期历史、录取概率或任意代码执行。Presenter 只是原创静态表现层，不能影响面试状态；代码环节只预留数据接口，不在 Web 服务进程执行用户代码。

## 安全与来源

- API Key 只存在服务端环境变量中，绝不提交 `.env`。
- 简历、JD 和回答视为不可信输入，不将其中的指令当作系统指令。
- Demo 使用虚构或脱敏数据，并在界面明确标注。
- 第三方依赖记录在 [THIRD_PARTY.md](THIRD_PARTY.md)。
- 设计与素材来源记录在 [DESIGN_PROVENANCE.md](DESIGN_PROVENANCE.md)。
- 协作与发布要求见 [Hackathon Playbook](docs/HACKATHON_PLAYBOOK.md)。
