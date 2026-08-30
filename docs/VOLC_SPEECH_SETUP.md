# 火山豆包语音 P0 配置

当前 Demo 采用“录完一轮再识别”的稳定链路：浏览器录音 → 本地转 16 kHz 单声道 WAV → 服务端通过 ASR 2.0 单流 WebSocket 转写 → 用户编辑确认 → 面试官模型。题目朗读走 Seed-TTS 2.0；失败时问题文字仍保持可见，不阻塞面试流程。

## 1. 控制台开通

1. 按[新控制台快速入门](https://www.volcengine.com/docs/6561/2119699?lang=zh)进入豆包语音控制台并创建 API Key。
2. 开通豆包流式语音识别模型 2.0 小时版与 Seed-TTS 2.0，并确认账号有试用额度或可用余额。
3. 在音色列表选择可用音色并复制 Speaker ID；示例默认值为 `zh_male_m191_uranus_bigtts`。

用户发来的[产品动态](https://www.volcengine.com/docs/6561/162929?lang=zh)是更新日志，不是请求参数文档。实现以[大模型流式语音识别 API](https://www.volcengine.com/docs/6561/1354869?lang=zh)和[TTS V3 单向流式 HTTP API](https://www.volcengine.com/docs/6561/1598757?lang=zh)为准。

## 2. 本地变量

复制 `.env.example` 为 `.env`，至少填写：

```dotenv
VOLC_SPEECH_API_KEY=你的服务端APIKey
VOLC_TTS_SPEAKER=你的SpeakerID
```

其余变量已有 P0 默认值：

```dotenv
VOLC_STT_ENDPOINT=wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream
VOLC_STT_RESOURCE_ID=volc.seedasr.sauc.duration
VOLC_TTS_RESOURCE_ID=seed-tts-2.0
VOLC_TTS_FORMAT=mp3
VOLC_TTS_SAMPLE_RATE=24000
```

API Key 只允许放在服务端 `.env`，不要使用 `NEXT_PUBLIC_*`，也不要提交 `.env`。

## 3. 验证

```sh
pnpm dev
curl -fsS http://127.0.0.1:3000/api/health
```

打开 `/interview/demo-ai-developer`：

- 点击“播放问题”，成功时播放服务端 MP3；失败时保留问题文字并允许重试。
- 点击“开始语音回答”，停止后等待转写；必须核对并点击确认，原始 STT 草稿不会直接进入面试官。
- 公网部署必须使用 HTTPS，否则浏览器通常不会开放麦克风权限。

P0 已使用 WebSocket 单流接口，但仍保持“录完再转写”的交互以降低演示风险。边说边显示的增量字幕和可打断语音列为 P1。
