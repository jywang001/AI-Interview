from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
CJK_FONT_NAME = "STSong-Light"


RESUMES = [
    {
        "filename": "ai-algorithm-resume-demo.pdf",
        "name": "林澈",
        "target": "AI 算法工程师",
        "summary": "关注数据质量、可信评估、误差分析与推理优化的应届候选人",
        "education": [
            "华东某大学｜计算机科学与技术｜本科｜2022.09-2026.06",
            "GPA 3.72/4.00，专业前 12%；核心课程：机器学习、深度学习、概率统计、计算机视觉。",
        ],
        "projects": [
            {
                "title": "长尾中文意图识别与轻量化部署｜算法负责人｜2025.03-2025.08",
                "bullets": [
                    "面向 38 类客服意图整理 12 万条脱敏样本，按会话维度划分训练、验证和测试集，避免同一会话跨集合泄漏。",
                    "以 MacBERT 为基线，引入 class-balanced focal loss、困难负样本挖掘和分层采样，Macro-F1 从 0.842 提升至 0.881。",
                    "对 420 条易混淆样本做错误归因；修订标注规范后，重复标注一致率由 86.4% 提升至 92.1%。",
                    "使用 ONNX Runtime 完成 INT8 动态量化，CPU 单条 P95 延迟从 38ms 降至 17ms，Macro-F1 下降 0.3 个百分点。",
                    "个人负责数据切分、损失函数实验、消融分析和部署验证；数据脱敏脚本由队员实现。",
                ],
            },
            {
                "title": "小样本工业表面缺陷检测｜核心成员｜2024.09-2025.01",
                "bullets": [
                    "使用 8,600 张脱敏图像构建 6 类数据集，比较数据增强与类别重采样，mAP@0.5 从 0.873 提升至 0.910。",
                    "将随机切分改为按产线切分后 mAP@0.5 降至 0.842，据此补充域偏移实验并披露泛化限制。",
                ],
            },
        ],
        "experience": [
            "某智能软件实验室｜算法实习生｜2025.09-2026.01",
            "维护训练与评估脚本，记录数据版本、随机种子、参数和指标；构建标签混淆复盘工具，未直接上线生产。",
        ],
        "skills": "Python、PyTorch、Transformers、scikit-learn、ONNX Runtime、Docker、Git、Linux；熟悉数据划分、消融实验与误差分析。",
    },
    {
        "filename": "ai-application-resume-demo.pdf",
        "name": "陈默",
        "target": "AI 应用开发工程师",
        "summary": "有 LLM 应用、后端服务、离线评估与可靠性实践的应届开发者",
        "education": [
            "华南某大学｜软件工程｜本科｜2022.09-2026.06",
            "GPA 3.65/4.00，专业前 15%；核心课程：软件工程、数据库系统、计算机网络、分布式系统。",
        ],
        "projects": [
            {
                "title": "带引用的智能知识助手｜项目负责人｜2025.04-2025.09",
                "bullets": [
                    "设计 REST API 与检索生成链路，组合关键词召回、向量召回、重排和带来源编号的上下文拼装。",
                    "负责 API、混合检索、离线评估脚本和降级策略；前端页面由另一名队员实现。",
                    "整理 200 条脱敏回放请求，按问题类别分层并保证同一会话不跨集合，记录错引、无答案和检索遗漏。",
                    "通过并行检索、语义缓存和减少无效候选，将 P95 端到端延迟从 4.8 秒降至 2.6 秒。",
                    "为检索、重排和生成分别设超时；生成失败返回带引用的提取式结果，并监控阶段 P95、降级率与引用为空率。",
                ],
            },
            {
                "title": "面向技术文档的 RAG 评估工具｜独立项目｜2024.11-2025.02",
                "bullets": [
                    "使用 TypeScript 和 Python 对比切分大小、召回数量与重排策略，结果保存为结构化 JSON。",
                    "实现模型超时、格式错误和无引用结果的显式错误处理；未接入账户和长期存储。",
                ],
            },
        ],
        "experience": [
            "某企业软件团队｜后端开发实习生｜2025.10-2026.01",
            "参与内部 API 网关开发，为模型服务增加超时、重试、请求追踪和错误分类；编写 Docker 部署说明与健康检查。",
        ],
        "skills": "TypeScript、Python、Next.js、Node.js、REST API、PostgreSQL、Docker、RAG、LLM API、Zod；熟悉缓存、超时、降级与回放评估。",
    },
]


def register_fonts() -> None:
    try:
        # ReportLab maps this standard CJK CID font without bundling or embedding
        # a platform-specific font file in the generated public fixture PDFs.
        pdfmetrics.registerFont(UnicodeCIDFont(CJK_FONT_NAME))
    except Exception as error:
        raise RuntimeError(
            f"ReportLab could not register its built-in {CJK_FONT_NAME} CID font."
        ) from error


def make_styles():
    base = getSampleStyleSheet()
    return {
        "name": ParagraphStyle(
            "Name",
            parent=base["Title"],
            fontName=CJK_FONT_NAME,
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#102A43"),
            alignment=TA_LEFT,
            spaceAfter=2,
        ),
        "target": ParagraphStyle(
            "Target",
            parent=base["Normal"],
            fontName=CJK_FONT_NAME,
            fontSize=11,
            leading=15,
            textColor=colors.HexColor("#486581"),
            spaceAfter=6,
        ),
        "summary": ParagraphStyle(
            "Summary",
            parent=base["Normal"],
            fontName=CJK_FONT_NAME,
            fontSize=9.3,
            leading=14,
            textColor=colors.HexColor("#243B53"),
            backColor=colors.HexColor("#F0F7FF"),
            borderColor=colors.HexColor("#B3D4FC"),
            borderWidth=0.5,
            borderPadding=6,
            spaceAfter=8,
        ),
        "section": ParagraphStyle(
            "Section",
            parent=base["Heading2"],
            fontName=CJK_FONT_NAME,
            fontSize=11.5,
            leading=15,
            textColor=colors.HexColor("#0B7285"),
            spaceBefore=4,
            spaceAfter=4,
        ),
        "item_title": ParagraphStyle(
            "ItemTitle",
            parent=base["Normal"],
            fontName=CJK_FONT_NAME,
            fontSize=9.7,
            leading=13,
            textColor=colors.HexColor("#102A43"),
            spaceAfter=2,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontName=CJK_FONT_NAME,
            fontSize=8.8,
            leading=13,
            textColor=colors.HexColor("#334E68"),
            spaceAfter=2,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["Normal"],
            fontName=CJK_FONT_NAME,
            fontSize=8.5,
            leading=12.2,
            leftIndent=9,
            firstLineIndent=-7,
            textColor=colors.HexColor("#334E68"),
            spaceAfter=1.4,
        ),
        "banner": ParagraphStyle(
            "Banner",
            parent=base["Normal"],
            fontName=CJK_FONT_NAME,
            fontSize=8,
            leading=10,
            textColor=colors.white,
            alignment=TA_CENTER,
        ),
        "footer": ParagraphStyle(
            "Footer",
            parent=base["Normal"],
            fontName=CJK_FONT_NAME,
            fontSize=7.5,
            leading=9,
            textColor=colors.HexColor("#7B8794"),
            alignment=TA_CENTER,
        ),
    }


def build_resume(data: dict, styles: dict) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output = OUTPUT_DIR / data["filename"]

    doc = BaseDocTemplate(
        str(output),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=f"{data['name']} - {data['target']} - 虚构演示简历",
        author="AI Interview Demo",
        subject="Fictional resume fixture for product testing",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")

    def draw_page(canvas, document):
        canvas.saveState()
        canvas.setFillColor(colors.HexColor("#0B7285"))
        canvas.rect(0, A4[1] - 8 * mm, A4[0], 8 * mm, stroke=0, fill=1)
        canvas.setFont(CJK_FONT_NAME, 7.5)
        canvas.setFillColor(colors.white)
        canvas.drawCentredString(A4[0] / 2, A4[1] - 5.5 * mm, "虚构演示数据｜所有人物、机构、经历和指标均为虚构")
        canvas.setStrokeColor(colors.HexColor("#D9E2EC"))
        canvas.line(16 * mm, 11 * mm, A4[0] - 16 * mm, 11 * mm)
        canvas.setFillColor(colors.HexColor("#7B8794"))
        canvas.setFont(CJK_FONT_NAME, 7)
        canvas.drawCentredString(A4[0] / 2, 7 * mm, f"AI Interview Demo Fixture  |  第 {document.page} 页")
        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id="resume", frames=frame, onPage=draw_page)])

    story = [
        Spacer(1, 2 * mm),
        Paragraph(data["name"], styles["name"]),
        Paragraph(data["target"], styles["target"]),
        Paragraph(data["summary"], styles["summary"]),
        Paragraph("教育背景", styles["section"]),
        Paragraph(data["education"][0], styles["item_title"]),
        Paragraph(data["education"][1], styles["body"]),
        Paragraph("项目经历", styles["section"]),
    ]

    for project in data["projects"]:
        story.append(Paragraph(project["title"], styles["item_title"]))
        for bullet in project["bullets"]:
            # Keep the marker inside the standard CID font's reliable glyph set.
            story.append(Paragraph(f"- {bullet}", styles["bullet"]))
        story.append(Spacer(1, 2))

    story.extend(
        [
            Paragraph("实习经历", styles["section"]),
            Paragraph(data["experience"][0], styles["item_title"]),
            Paragraph(data["experience"][1], styles["body"]),
            Paragraph("技能", styles["section"]),
            Paragraph(data["skills"], styles["body"]),
            Spacer(1, 5),
            Table(
                [[Paragraph("声明：本简历仅用于 AI Interview 的公开演示和自动化测试，不对应任何真实个人。", styles["footer"])]],
                colWidths=[doc.width],
                style=TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F5F7FA")),
                        ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#D9E2EC")),
                        ("LEFTPADDING", (0, 0), (-1, -1), 6),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                        ("TOPPADDING", (0, 0), (-1, -1), 5),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ]
                ),
            ),
        ]
    )

    doc.build(story)
    return output


def main() -> None:
    register_fonts()
    styles = make_styles()
    outputs = [build_resume(resume, styles) for resume in RESUMES]
    for output in outputs:
        print(output)


if __name__ == "__main__":
    main()
