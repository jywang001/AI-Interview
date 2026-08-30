# 2026-08-30 项目挑战提交清单

截止时间：2026-08-30 24:00，以邮件发送服务器时间戳为准。截止后不要再构建或部署。

收件人：`mlic@pku.edu.cn`

## 必交材料

- [ ] 3 分钟以内 Demo 视频：本地文件或无需登录的分享链接。
- [x] 公网产品：<https://ai-interview.site>
- [x] 服务器已安装挑战说明指定的两把主办方 SSH 公钥；登录用户为 `ubuntu`。
- [x] Product Memo：仓库外邮件附件 `AI-Interview-Product-Memo.pdf`
- [x] 公开 GitHub：<https://github.com/jywang001/AI-Interview>
- [ ] 确认 GitHub 已包含最终 Memo 源稿、Docker 修复、README 与最新 commit history。

## 邮件正文模板

主题：`AI 模拟面试官项目挑战提交 — AI Interview — <你的姓名>`

```text
老师您好，

这是我的 2026-08-30 AI 模拟面试官项目挑战提交：

1. Demo 视频：<填写无需登录的视频链接，或说明见附件>
2. 公网产品：https://ai-interview.site
3. GitHub：https://github.com/jywang001/AI-Interview
4. Product Memo：见附件 AI-Interview-Product-Memo.pdf

服务器信息：
- 公网 IP：43.161.215.223
- SSH 用户：ubuntu
- 挑战说明中的两把公钥均已添加

运行说明：
- 无需登录即可使用
- 真实材料分析、面试与报告依赖模型 API；语音依赖豆包 ASR/TTS
- 若外部服务临时超时，页面保留文字输入与明确标注的脱敏演示路径
- 测试请使用脱敏简历或仓库中的虚构演示材料

谢谢！
<你的姓名>
```

## 截止前最终冻结

```sh
git rev-parse HEAD
git log -1 --format='%H %cI %s'
curl -fsS https://ai-interview.site/api/health
docker compose ps
```

- [ ] 把输出和当前时间截图保存。
- [ ] 检查公网链接使用另一网络可以打开。
- [ ] 确认容器为 `healthy`，HTTPS 证书正常。
- [ ] 记录最终 commit SHA，并在邮件发送后停止部署和构建。
- [ ] 保存云服务器、模型和语音服务的消费截图或发票，报销上限 ¥150。
