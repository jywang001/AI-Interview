# AI Interview

AI Interview 的目标是成为面向 AI 算法岗与 AI 应用开发岗候选人的模拟面试训练应用：用户提交简历和目标 JD，完成一场岗位化面试，再根据回答原文获得证据化复盘。

当前仓库已进入 P0 可运行纵向切片阶段，优先保证一条可在三分钟内演示、外部模型不可用时仍能降级的完整路径。

## 当前骨架

- 两个岗位入口：AI 算法岗、AI 应用开发岗。
- 真实文本型 PDF + JD 的服务端提取、模型分析与原文证据核验路径。
- 连续六阶段面试：自我介绍、简历项目拷打、岗位理解、Hot 100 口述算法、岗位意愿与到岗安排、候选人反问。
- 快速体验与真实模拟两种模式；每轮先评估回答充分性，再自动追问或推进，不显示过程评分。
- 真实主链路覆盖准备材料、模拟面试和证据复盘。
- 火山豆包极速语音识别与 Seed-TTS 2.0 服务端适配器；语音失败时保留可用的文字路径。
- 真实面试官单轮决策接口：只读取用户确认版回答，维护阶段证据覆盖并生成一次锚定原话的动态追问。
- 真实 Coach 接口：整场结束后生成总分、六阶段星级、逐字证据、理由和优先整改项。
- 可替换的模型、语音与 Presenter 接口边界。
- 服务端密钥隔离、健康检查和 Docker standalone 构建。

完整范围、验收条件与迭代边界见 [产品需求文档](docs/PRD.md)。

## 当前运行模式

当前提交采用明确标注的混合模式，不把预置结果伪装成实时生成：真实 PDF 简历与 JD 由 `/api/materials/parse` 调用已配置的 OpenAI-compatible 模型分析，再由服务端逐字回查原文证据并直接生成本场 CandidateBrief；六阶段面试与最终 Coach 报告调用真实模型，录音可调用火山豆包 STT，题目可调用 Seed-TTS。报告示例使用明确标注的 Demo fixture。外部服务不可用时，问题文字和已编辑回答仍会保留，并可在本机 Transcript 上重试。

| 路由 | 用途 |
| --- | --- |
| `/` | 产品说明与开始入口 |
| `/prepare` | 选择岗位，提交真实 PDF + JD，经原文核验后直接进入面试 |
| `/interview/demo-ai-developer` | 选择快速或真实模式，连续完成六阶段自适应面试并生成实时复盘 |
| `/report/demo-ai-developer` | 展示完整的教练复盘示例 |
| `/api/materials/parse` | 以 `pdftotext` 提取真实简历并调用配置的模型分析材料 |
| `/api/interview/live/respond` | 评估一轮确认版回答并自动追问、推进或结束 |
| `/api/interview/live/report` | 根据完整六阶段 Transcript 生成证据化 Coach 报告 |
| `/api/speech/transcribe` | 将最长 120 秒的浏览器录音转为确认前文字草稿 |
| `/api/speech/synthesize` | 将当前问题合成为 MP3；不可用时保留问题文字 |
| `/api/demo/session` | 旧版离线演示会话数据 |
| `/api/health` | 分别报告材料分析、面试和语音能力状态 |

Demo 数据只用于演示加速并在页面明确标注，不冒充实时模型结果。

## 本地启动

需要 Node.js 22 或更高版本，以及 pnpm 11.19.0。

```sh
corepack enable
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev
```

打开 `http://localhost:3000` 即可使用 Demo。要解析真实材料并动态追问，需在本地 `.env` 配置 `OPENAI_API_KEY` 与 `OPENAI_MODEL`；`OPENAI_BASE_URL` 可用于兼容端点。要启用语音服务，再填写 `VOLC_SPEECH_API_KEY` 与 `VOLC_TTS_SPEAKER`。所有凭证只放在服务端变量中，不要写入任何 `NEXT_PUBLIC_*` 变量。

## 验证

```sh
pnpm test:all
pnpm start
curl -fsS http://127.0.0.1:3000/api/health
```

`pnpm test:all` 会依次运行离线单元/接口测试、TypeScript 检查和生产构建。配置模型密钥后可额外运行 `pnpm test:ai`，自动评测面试官是否锚定原话、是否在知识盲点及时止损，以及 Coach 引用能否落回确认版 Transcript。完整命令和边界见 [自动化测试说明](docs/TESTING.md)，当前功能完成度见 [功能与测试状态](docs/FEATURE_STATUS.md)。

提交或部署前还应人工检查：桌面和移动端宽度、空状态、一条成功路径、一条外部服务失败路径，以及实时报告和明确标注的报告示例。

## 真实材料解析与隐私

真实简历路径只支持可提取文本的 PDF，并通过 Poppler 提供的 `pdftotext` 读取内容；扫描件和图片型 PDF 不在 P0 范围内。宿主机必须能直接运行 `pdftotext`：macOS 可安装 `poppler`，Debian/Ubuntu 与 Alpine 分别安装 `poppler-utils`。本仓库的 Docker builder 和 runner 镜像均已安装 Alpine `poppler-utils`。

当前 P0 不使用数据库或对象存储保存材料。服务端通过内存 Buffer 和 `pdftotext` 的标准输入/输出处理 PDF 字节、JD 与提取文本，不创建临时材料文件，也不把原文写入应用日志；请求结束后服务端不保留副本。经过原文证据核验的结构化 CandidateBrief 会暂存在当前浏览器标签页的 `sessionStorage`，不会成为服务端长期记录，关闭该标签页会结束这段浏览器会话。真实材料分析会把提取文本与 JD 发送给当前配置的模型服务；部署方必须确认并披露供应商的处理区域、日志和留存策略。

材料接口内置单进程 Demo 保护：带 `Content-Length` 的请求在约 9 MB 处提前拒绝，同时限制为最多 2 个并发分析和每分钟 10 个已接受请求。它不能替代网关控制；公网部署仍须在 Caddy、Nginx 或云负载均衡设置 9 MB 总请求体上限、限速、并发上限和模型费用告警，尤其要拦截没有 `Content-Length` 的分块超大请求。

公开演示应优先使用 [虚构演示材料](fixtures/demo-materials/README.md)。仓库不提交 PDF 二进制；需要上传测试时可在本地运行脚本生成两份演示 PDF。ReportLab 只用于生成 fixture，不是 Node 应用或生产容器的运行时依赖：

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

真实材料解析、模型分析、原文核验后的 CandidateBrief、六阶段动态追问和实时 Coach 报告已经接通；PDF 仅覆盖文本型文件，不做 OCR。当前页面使用 `/api/interview/live/*` 完成动态面试与报告生成。当前框架不实现全双工流式语音、口型同步数字人、多面试官、登录支付、长期历史或录取概率。算法环节产品形态永久采用 Hot 100 独立思考加口述讲解，不提供代码编辑器，也不在服务端执行用户代码。

## 安全与来源

- API Key 只存在服务端环境变量中，绝不提交 `.env`。
- 简历、JD 和回答视为不可信输入，不将其中的指令当作系统指令。
- Demo 使用虚构或脱敏数据，并在界面明确标注。
- 第三方依赖记录在 [THIRD_PARTY.md](THIRD_PARTY.md)。
- 设计与素材来源记录在 [DESIGN_PROVENANCE.md](DESIGN_PROVENANCE.md)。
- 协作与发布要求见 [Hackathon Playbook](docs/HACKATHON_PLAYBOOK.md)。
