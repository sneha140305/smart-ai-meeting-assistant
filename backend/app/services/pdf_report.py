import json
import os
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)


REPORT_DIRECTORY = "reports"

os.makedirs(
    REPORT_DIRECTORY,
    exist_ok=True
)


def safe_json(value, default=None):
    if not value:
        return default if default is not None else []

    if isinstance(value, (list, dict)):
        return value

    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return default if default is not None else []


def format_duration(seconds):
    if not seconds:
        return "Not available"

    seconds = int(seconds)

    minutes = seconds // 60
    remaining_seconds = seconds % 60

    return f"{minutes}m {remaining_seconds}s"


def generate_meeting_pdf(
    meeting,
    transcript,
    action_items,
    speaker_analytics,
):
    file_path = os.path.join(
        REPORT_DIRECTORY,
        f"meeting_report_{meeting.id}.pdf"
    )

    document = SimpleDocTemplate(
        file_path,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Meeting Report - {meeting.title}",
        author="Smart AI Meeting Assistant",
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontSize=24,
        leading=30,
        alignment=TA_CENTER,
        spaceAfter=10,
    )

    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        alignment=TA_CENTER,
        textColor=colors.grey,
        spaceAfter=20,
    )

    section_style = ParagraphStyle(
        "Section",
        parent=styles["Heading2"],
        fontSize=16,
        leading=20,
        spaceBefore=14,
        spaceAfter=8,
    )

    body_style = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontSize=10,
        leading=15,
        spaceAfter=6,
    )

    small_style = ParagraphStyle(
        "Small",
        parent=styles["BodyText"],
        fontSize=8.5,
        leading=12,
        textColor=colors.grey,
    )

    bullet_style = ParagraphStyle(
        "Bullet",
        parent=body_style,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=5,
    )

    story = []

    story.append(
        Paragraph(
            "Smart AI Meeting Assistant",
            title_style
        )
    )

    story.append(
        Paragraph(
            "Meeting Intelligence Report",
            subtitle_style
        )
    )

    story.append(
        Paragraph(
            meeting.title or "Untitled Meeting",
            styles["Heading1"]
        )
    )

    story.append(Spacer(1, 8))

    # ---------------------------------
    # Meeting Information
    # ---------------------------------

    story.append(
        Paragraph(
            "Meeting Information",
            section_style
        )
    )

    created_at = (
        meeting.created_at.strftime(
            "%d %b %Y, %I:%M %p"
        )
        if meeting.created_at
        else "Not available"
    )

    metadata = [
        ["File", meeting.file_name or "Not available"],
        ["Date", created_at],
        [
            "Duration",
            format_duration(meeting.duration),
        ],
        [
            "Speakers",
            str(meeting.speaker_count or 0),
        ],
        [
            "Total Words",
            str(meeting.total_words or 0),
        ],
    ]

    metadata_table = Table(
        metadata,
        colWidths=[40 * mm, 125 * mm],
    )

    metadata_table.setStyle(
        TableStyle([
            (
                "BACKGROUND",
                (0, 0),
                (0, -1),
                colors.whitesmoke
            ),
            (
                "BOX",
                (0, 0),
                (-1, -1),
                0.5,
                colors.lightgrey
            ),
            (
                "INNERGRID",
                (0, 0),
                (-1, -1),
                0.25,
                colors.lightgrey
            ),
            (
                "FONTNAME",
                (0, 0),
                (0, -1),
                "Helvetica-Bold"
            ),
            (
                "FONTNAME",
                (1, 0),
                (1, -1),
                "Helvetica"
            ),
            (
                "FONTSIZE",
                (0, 0),
                (-1, -1),
                9
            ),
            (
                "VALIGN",
                (0, 0),
                (-1, -1),
                "TOP"
            ),
            (
                "LEFTPADDING",
                (0, 0),
                (-1, -1),
                7
            ),
            (
                "RIGHTPADDING",
                (0, 0),
                (-1, -1),
                7
            ),
            (
                "TOPPADDING",
                (0, 0),
                (-1, -1),
                7
            ),
            (
                "BOTTOMPADDING",
                (0, 0),
                (-1, -1),
                7
            ),
        ])
    )

    story.append(metadata_table)

    if meeting.effectiveness_score is not None:

        story.append(
            Paragraph(
                "Meeting Effectiveness",
                section_style
            )
        )

        score_data = [
            [
                "Score",
                f"{meeting.effectiveness_score}/100"
            ],
            [
                "Rating",
                meeting.effectiveness_rating
                or "Not available"
            ],
        ]

        score_table = Table(
            score_data,
            colWidths=[40 * mm, 125 * mm],
        )

        score_table.setStyle(
            TableStyle([
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.5,
                    colors.lightgrey
                ),
                (
                    "INNERGRID",
                    (0, 0),
                    (-1, -1),
                    0.25,
                    colors.lightgrey
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (0, -1),
                    "Helvetica-Bold"
                ),
                (
                    "FONTSIZE",
                    (0, 0),
                    (-1, -1),
                    10
                ),
                (
                    "ALIGN",
                    (1, 0),
                    (1, -1),
                    "CENTER"
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE"
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    8
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    8
                ),
            ])
        )

        story.append(score_table)

    story.append(
        Paragraph(
            "Executive Summary",
            section_style
        )
    )

    story.append(
        Paragraph(
            meeting.summary
            or "No summary available.",
            body_style
        )
    )

    key_points = safe_json(
        meeting.key_points
    )

    if key_points:

        story.append(
            Paragraph(
                "Key Points",
                section_style
            )
        )

        for point in key_points:
            story.append(
                Paragraph(
                    f"• {point}",
                    bullet_style
                )
            )

    decisions = safe_json(
        meeting.decisions
    )

    if decisions:

        story.append(
            Paragraph(
                "Decisions",
                section_style
            )
        )

        for decision in decisions:
            story.append(
                Paragraph(
                    f"• {decision}",
                    bullet_style
                )
            )

    if action_items:

        story.append(
            Paragraph(
                "Action Items",
                section_style
            )
        )

        action_data = [
            [
                "Task",
                "Assignee",
                "Deadline",
                "Priority",
                "Status",
            ]
        ]

        for item in action_items:

            action_data.append([
                item.task or "",
                item.assigned_to
                or "Unknown",
                item.deadline
                or "Not mentioned",
                item.priority
                or "medium",
                item.status
                or "pending",
            ])

        action_table = Table(
            action_data,
            colWidths=[
                58 * mm,
                27 * mm,
                30 * mm,
                22 * mm,
                28 * mm,
            ],
            repeatRows=1,
        )

        action_table.setStyle(
            TableStyle([
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.whitesmoke
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (-1, 0),
                    "Helvetica-Bold"
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.4,
                    colors.lightgrey
                ),
                (
                    "FONTSIZE",
                    (0, 0),
                    (-1, -1),
                    7.5
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP"
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    5
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    5
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    5
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    5
                ),
            ])
        )

        story.append(action_table)

    if speaker_analytics:

        story.append(
            PageBreak()
        )

        story.append(
            Paragraph(
                "Speaker Analytics",
                section_style
            )
        )

        speaker_data = [
            [
                "Speaker",
                "Speaking Time",
                "Word Count",
            ]
        ]

        for speaker in speaker_analytics:

            speaker_data.append([
                speaker.speaker,
                format_duration(
                    speaker.speaking_time
                ),
                str(
                    speaker.word_count or 0
                ),
            ])

        speaker_table = Table(
            speaker_data,
            colWidths=[
                65 * mm,
                50 * mm,
                50 * mm,
            ],
            repeatRows=1,
        )

        speaker_table.setStyle(
            TableStyle([
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.whitesmoke
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (-1, 0),
                    "Helvetica-Bold"
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.4,
                    colors.lightgrey
                ),
                (
                    "FONTSIZE",
                    (0, 0),
                    (-1, -1),
                    9
                ),
                (
                    "ALIGN",
                    (1, 1),
                    (-1, -1),
                    "CENTER"
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE"
                ),
            ])
        )

        story.append(speaker_table)

    story.append(
        Paragraph(
            "Sentiment Overview",
            section_style
        )
    )

    sentiment_data = [
        ["Positive", str(
            meeting.positive_sentiment or 0
        )],
        ["Negative", str(
            meeting.negative_sentiment or 0
        )],
        ["Neutral", str(
            meeting.neutral_sentiment or 0
        )],
    ]

    sentiment_table = Table(
        sentiment_data,
        colWidths=[
            80 * mm,
            80 * mm,
        ],
    )

    sentiment_table.setStyle(
        TableStyle([
            (
                "GRID",
                (0, 0),
                (-1, -1),
                0.4,
                colors.lightgrey
            ),
            (
                "FONTNAME",
                (0, 0),
                (0, -1),
                "Helvetica-Bold"
            ),
            (
                "ALIGN",
                (1, 0),
                (1, -1),
                "CENTER"
            ),
            (
                "FONTSIZE",
                (0, 0),
                (-1, -1),
                9
            ),
            (
                "TOPPADDING",
                (0, 0),
                (-1, -1),
                7
            ),
            (
                "BOTTOMPADDING",
                (0, 0),
                (-1, -1),
                7
            ),
        ])
    )

    story.append(sentiment_table)

    insights = safe_json(
        meeting.meeting_insights
    )

    if insights:

        story.append(
            Paragraph(
                "AI Meeting Insights",
                section_style
            )
        )

        for insight in insights:

            title = insight.get(
                "title",
                "Insight"
            )

            description = insight.get(
                "description",
                ""
            )

            story.append(
                Paragraph(
                    f"<b>{title}</b>: {description}",
                    body_style
                )
            )

    recommendations = safe_json(
        meeting.meeting_recommendations
    )

    if recommendations:

        story.append(
            Paragraph(
                "AI Recommendations",
                section_style
            )
        )

        for recommendation in recommendations:
            story.append(
                Paragraph(
                    f"• {recommendation}",
                    bullet_style
                )
            )

    story.append(Spacer(1, 20))

    story.append(
        Paragraph(
            "Generated by Smart AI Meeting Assistant",
            small_style
        )
    )

    document.build(story)

    return file_path