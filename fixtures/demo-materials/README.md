# AI Interview 虚构演示材料

本目录中的姓名、学校、公司、项目、指标和经历均为虚构，仅用于 AI Interview 的开发、测试与公开演示。不得作为真实候选人材料使用。

2026-08-30 已完成公开发布核验：材料由项目团队为本仓库原创编写，未使用真实简历、招聘 JD、竞品题库或外部参考文件；不含真实姓名、联系方式、证件号、住址、账号或机密业务数据。名称若与现实人物或机构巧合，不表示任何关联。

## 材料清单

- `ai-algorithm/resume.md`：AI 算法岗简历源文本。
- `ai-algorithm/jd.md`：AI 算法岗目标 JD。
- `ai-application/resume.md`：AI 应用开发岗简历源文本。
- `ai-application/jd.md`：AI 应用开发岗目标 JD。
- `technical-term-voice-test.md`：中文技术词语音转写测试稿。

对应的文本型 PDF 输出在 `output/pdf/`：

- `ai-algorithm-resume-demo.pdf`
- `ai-application-resume-demo.pdf`

PDF 于 2026-08-30 由 `scripts/build_demo_resumes.py`、Python 3.12.13 与 ReportLab 4.4.9 从同一套虚构内容生成。生成脚本使用 ReportLab 内建的非嵌入式 `STSong-Light` CID 字体映射，不复制或分发本机字体文件；两页输出均已通过 Poppler 文本提取与逐页渲染检查。详细记录见 [DESIGN_PROVENANCE.md](../../DESIGN_PROVENANCE.md) 与 [THIRD_PARTY.md](../../THIRD_PARTY.md)。

## 使用约束

- 页面和报告中应显示“虚构演示数据”标识。
- Demo fixture 不得伪装成现场实时模型结果。
- 若替换为真实材料，应先获得授权，并删除姓名、电话、邮箱、证件号等不必要信息。
