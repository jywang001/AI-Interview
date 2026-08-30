#!/usr/bin/env python3
"""Build the two-page challenge Product Memo from docs/PRODUCT_MEMO.md."""

from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "PRODUCT_MEMO.md"
OUTPUT = ROOT / "output" / "pdf" / "AI-Interview-Product-Memo.pdf"

INK = colors.HexColor("#172033")
MUTED = colors.HexColor("#59657A")
ACCENT = colors.HexColor("#2A55D4")
PALE = colors.HexColor("#EEF3FF")
LINE = colors.HexColor("#D8DFEC")


def inline_markup(value: str) -> str:
    escaped = html.escape(value.strip())
    escaped = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"\1", escaped)
    escaped = re.sub(
        r"&lt;(https?://[^&]+)&gt;",
        r'<link href="\1" color="#2A55D4">\1</link>',
        escaped,
    )
    return escaped


def footer(canvas, document) -> None:
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(14 * mm, 12 * mm, A4[0] - 14 * mm, 12 * mm)
    canvas.setFont("STSong-Light", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(14 * mm, 7.5 * mm, "AI Interview | Product Memo | 2026-08-30")
    canvas.drawRightString(A4[0] - 14 * mm, 7.5 * mm, f"{document.page}")
    canvas.restoreState()


def styles():
    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "MemoTitle",
            parent=base["Title"],
            fontName="STSong-Light",
            fontSize=24,
            leading=29,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=4 * mm,
        ),
        "meta": ParagraphStyle(
            "MemoMeta",
            parent=base["BodyText"],
            fontName="STSong-Light",
            fontSize=8.7,
            leading=11.8,
            textColor=MUTED,
            spaceAfter=3 * mm,
        ),
        "lead": ParagraphStyle(
            "MemoLead",
            parent=base["BodyText"],
            fontName="STSong-Light",
            fontSize=11.1,
            leading=15.9,
            textColor=INK,
            backColor=PALE,
            borderColor=colors.HexColor("#ADC0F7"),
            borderWidth=0.6,
            borderPadding=(7, 9, 7, 9),
            spaceAfter=4 * mm,
        ),
        "h2": ParagraphStyle(
            "MemoH2",
            parent=base["Heading2"],
            fontName="STSong-Light",
            fontSize=14.6,
            leading=18.2,
            textColor=ACCENT,
            spaceBefore=2.5 * mm,
            spaceAfter=1.5 * mm,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "MemoBody",
            parent=base["BodyText"],
            fontName="STSong-Light",
            fontSize=10.0,
            leading=14.4,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=1.7 * mm,
            wordWrap="CJK",
        ),
        "bullet": ParagraphStyle(
            "MemoBullet",
            parent=base["BodyText"],
            fontName="STSong-Light",
            fontSize=9.45,
            leading=13.2,
            textColor=INK,
            leftIndent=4.2 * mm,
            firstLineIndent=-3.2 * mm,
            bulletIndent=0,
            spaceAfter=1.0 * mm,
            wordWrap="CJK",
        ),
        "table": ParagraphStyle(
            "MemoTable",
            parent=base["BodyText"],
            fontName="STSong-Light",
            fontSize=8.0,
            leading=10.2,
            textColor=INK,
            wordWrap="CJK",
        ),
    }


def build() -> None:
    style = styles()
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    story = []
    index = 0
    while index < len(lines):
        raw = lines[index].strip()
        if not raw:
            index += 1
            continue
        if raw.startswith("# "):
            story.append(Paragraph(inline_markup(raw[2:]), style["title"]))
        elif raw.startswith("## "):
            if raw.startswith("## 3."):
                story.append(PageBreak())
            story.append(Paragraph(inline_markup(raw[3:]), style["h2"]))
        elif raw.startswith("> "):
            story.append(Paragraph(inline_markup(raw[2:]), style["lead"]))
        elif raw.startswith("|"):
            table_lines = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                table_lines.append(lines[index].strip())
                index += 1
            index -= 1
            rows = []
            for table_index, table_line in enumerate(table_lines):
                cells = [cell.strip() for cell in table_line.strip("|").split("|")]
                if table_index == 1 and all(re.fullmatch(r":?-+:?", cell) for cell in cells):
                    continue
                rows.append([Paragraph(inline_markup(cell), style["table"]) for cell in cells])
            table = Table(rows, colWidths=[26 * mm, 48 * mm, 93 * mm], repeatRows=1)
            table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFE")]),
                    ]
                )
            )
            story.extend([Spacer(1, 1 * mm), table, Spacer(1, 1.8 * mm)])
        elif re.match(r"^\d+\.\s", raw):
            number, value = raw.split(".", 1)
            story.append(
                Paragraph(inline_markup(value), style["bullet"], bulletText=f"{number}.")
            )
        elif raw.startswith("- "):
            story.append(
                Paragraph(inline_markup(raw[2:]), style["bullet"], bulletText="•")
            )
        else:
            target_style = "meta" if raw.startswith("**提交版本") else "body"
            story.append(Paragraph(inline_markup(raw), style[target_style]))
        index += 1

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=12 * mm,
        bottomMargin=16 * mm,
        title="AI Interview Product Memo",
        author="AI Interview",
        subject="2026-08-30 AI 模拟面试官项目挑战提交材料",
    )
    document.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUTPUT)


if __name__ == "__main__":
    build()
