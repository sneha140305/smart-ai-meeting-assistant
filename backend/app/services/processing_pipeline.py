import asyncio
import json
import traceback

from app.database.database import SessionLocal
from app.database.models import (
    Meeting,
    Transcript,
    ActionItem,
    SpeakerAnalytics,
)

from app.services.transcription import transcribe_audio
from app.services.diarization import diarize_audio
from app.services.transcript_merger import merge_transcript_with_speakers
from app.services.sentiment import analyze_sentiment
from app.services.meeting_ai import (
    analyze_meeting,
    generate_meeting_insights,
)
from app.services.analytics import calculate_meeting_analytics
from app.services.meeting_score import calculate_meeting_score
from app.services.pdf_report import generate_meeting_pdf
from app.services.websocket_manager import manager


# ============================================================
# DATABASE STATUS UPDATE
# ============================================================

def update_status(
    db,
    meeting,
    status,
    stage,
    message,
    progress,
):
    """
    Update processing information in the database.
    """

    meeting.status = status
    meeting.processing_stage = stage
    meeting.processing_message = message
    meeting.processing_progress = progress

    db.commit()
    db.refresh(meeting)


# ============================================================
# WEBSOCKET LIVE UPDATE
# ============================================================

def send_progress(
    meeting_id: int,
    status: str,
    stage: str,
    message: str,
    progress: int,
):
    """
    Send real-time processing progress to connected clients.

    The processing pipeline runs inside a synchronous
    BackgroundTask, so asyncio.run() is used to execute
    the async WebSocket broadcast.
    """

    try:
        asyncio.run(
            manager.broadcast(
                meeting_id,
                {
                    "status": status,
                    "stage": stage,
                    "message": message,
                    "progress": progress,
                },
            )
        )

    except Exception as error:
        # WebSocket failure should NEVER stop
        # the actual meeting processing.
        print(
            f"[WebSocket] Progress update failed: {error}"
        )


# ============================================================
# COMBINED STATUS + WEBSOCKET UPDATE
# ============================================================

def set_progress(
    db,
    meeting,
    status,
    stage,
    message,
    progress,
):
    """
    Update both database and connected WebSocket clients.
    """

    update_status(
        db=db,
        meeting=meeting,
        status=status,
        stage=stage,
        message=message,
        progress=progress,
    )

    send_progress(
        meeting_id=meeting.id,
        status=status,
        stage=stage,
        message=message,
        progress=progress,
    )


# ============================================================
# MAIN PROCESSING PIPELINE
# ============================================================

def process_meeting_pipeline(meeting_id: int):
    """
    Complete meeting processing pipeline.

    Flow:

    1. Transcription
    2. Speaker diarization
    3. Transcript + speaker merging
    4. Sentiment analysis
    5. AI meeting analysis
    6. Speaker analytics
    7. Meeting effectiveness score
    8. AI insights and recommendations
    9. PDF report
    10. Completed
    """

    db = SessionLocal()

    try:

        # ----------------------------------------------------
        # LOAD MEETING
        # ----------------------------------------------------

        meeting = (
            db.query(Meeting)
            .filter(Meeting.id == meeting_id)
            .first()
        )

        if not meeting:
            print(
                f"[Pipeline] Meeting {meeting_id} not found."
            )
            return

        print(
            f"[Pipeline] Starting meeting {meeting_id}"
        )

        # ----------------------------------------------------
        # INITIAL STATUS
        # ----------------------------------------------------

        set_progress(
            db,
            meeting,
            "processing",
            "initializing",
            "Preparing meeting for processing...",
            10,
        )

        # ----------------------------------------------------
        # VALIDATE AUDIO
        # ----------------------------------------------------

        if not meeting.audio_path:

            raise RuntimeError(
                "Processed audio file is not available."
            )

        # ====================================================
        # STEP 1 — TRANSCRIPTION
        # ====================================================

        set_progress(
            db,
            meeting,
            "transcribing",
            "transcription",
            "Converting speech to text...",
            25,
        )

        print(
            "[Pipeline] Starting transcription..."
        )

        transcription = transcribe_audio(
            meeting.audio_path
        )

        transcript_segments = (
            transcription.get("segments", [])
        )

        language = transcription.get(
            "language",
            "unknown",
        )

        print(
            f"[Pipeline] Transcription completed. "
            f"Segments: {len(transcript_segments)}"
        )

        # ----------------------------------------------------
        # CREATE / UPDATE TRANSCRIPT
        # ----------------------------------------------------

        transcript = (
            db.query(Transcript)
            .filter(
                Transcript.meeting_id == meeting.id
            )
            .first()
        )

        if not transcript:

            transcript = Transcript(
                meeting_id=meeting.id
            )

            db.add(transcript)

        transcript.language = language

        transcript.segments = json.dumps(
            transcript_segments
        )

        transcript.content = "\n".join(
            segment.get("text", "")
            for segment in transcript_segments
        )

        db.commit()
        db.refresh(transcript)

        # ====================================================
        # STEP 2 — SPEAKER DIARIZATION
        # ====================================================

        set_progress(
            db,
            meeting,
            "diarizing",
            "speaker_identification",
            "Identifying speakers...",
            45,
        )

        print(
            "[Pipeline] Starting speaker diarization..."
        )

        speaker_segments = diarize_audio(
            meeting.audio_path
        )

        print(
            f"[Pipeline] Diarization completed. "
            f"Speaker segments: {len(speaker_segments)}"
        )

        # ====================================================
        # STEP 3 — MERGE TRANSCRIPT + SPEAKERS
        # ====================================================

        print(
            "[Pipeline] Merging transcript with speakers..."
        )

        merged_segments = (
            merge_transcript_with_speakers(
                transcript_segments,
                speaker_segments,
            )
        )

        # Save merged segments

        transcript.segments = json.dumps(
            merged_segments
        )

        # Create readable transcript

        transcript_lines = []

        for segment in merged_segments:

            speaker = segment.get(
                "speaker",
                "Unknown",
            )

            text = segment.get(
                "text",
                "",
            )

            start = segment.get(
                "start",
                0,
            )

            transcript_lines.append(
                f"[{start:.2f}] {speaker}: {text}"
            )

        transcript.content = "\n".join(
            transcript_lines
        )

        db.commit()

        # ====================================================
        # STEP 4 — SENTIMENT ANALYSIS
        # ====================================================

        set_progress(
            db,
            meeting,
            "analyzing",
            "sentiment",
            "Analyzing meeting sentiment...",
            55,
        )

        print(
            "[Pipeline] Starting sentiment analysis..."
        )

        positive_sentiment = 0
        negative_sentiment = 0
        neutral_sentiment = 0

        for segment in merged_segments:

            text = segment.get(
                "text",
                "",
            ).strip()

            if not text:
                continue

            sentiment = analyze_sentiment(
                text
            )

            label = sentiment.get(
                "label",
                "neutral",
            ).lower()

            if label == "positive":

                positive_sentiment += 1

            elif label == "negative":

                negative_sentiment += 1

            else:

                neutral_sentiment += 1

        print(
            "[Pipeline] Sentiment analysis completed."
        )

        # ====================================================
        # STEP 5 — AI MEETING ANALYSIS
        # ====================================================

        set_progress(
            db,
            meeting,
            "analyzing",
            "ai_analysis",
            "Analyzing meeting with AI...",
            70,
        )

        print(
            "[Pipeline] Starting AI analysis..."
        )

        ai_result = analyze_meeting(
            transcript.content
        )

        # ----------------------------------------------------
        # Extract AI result
        # ----------------------------------------------------

        summary = ai_result.get(
            "summary",
            "",
        )

        key_points = ai_result.get(
            "key_points",
            [],
        )

        decisions = ai_result.get(
            "decisions",
            [],
        )

        action_items = ai_result.get(
            "action_items",
            [],
        )

        # ----------------------------------------------------
        # Save meeting AI data
        # ----------------------------------------------------

        meeting.summary = summary

        meeting.key_points = json.dumps(
            key_points
        )

        meeting.decisions = json.dumps(
            decisions
        )

        # ====================================================
        # STEP 6 — ACTION ITEMS
        # ====================================================

        print(
            "[Pipeline] Saving action items..."
        )

        # Remove previous action items

        db.query(ActionItem).filter(
            ActionItem.meeting_id == meeting.id
        ).delete(
            synchronize_session=False
        )

        db.commit()

        for item in action_items:

            task = item.get(
                "task",
                "",
            )

            assigned_to = item.get(
                "assigned_to",
                "Unknown",
            )

            deadline = item.get(
                "deadline",
                "Not mentioned",
            )

            priority = item.get(
                "priority",
                "medium",
            ).lower()

            if priority not in [
                "low",
                "medium",
                "high",
            ]:

                priority = "medium"

            action_item = ActionItem(
                task=task,
                assigned_to=assigned_to,
                deadline=deadline,
                priority=priority,
                status="pending",
                meeting_id=meeting.id,
            )

            db.add(action_item)

        db.commit()

        # ====================================================
        # STEP 7 — ANALYTICS
        # ====================================================

        set_progress(
            db,
            meeting,
            "analyzing",
            "analytics",
            "Calculating meeting analytics...",
            82,
        )

        print(
            "[Pipeline] Calculating analytics..."
        )

        analytics = calculate_meeting_analytics(
            merged_segments
        )

        # ----------------------------------------------------
        # Extract analytics
        # ----------------------------------------------------

        total_words = analytics.get(
            "total_words",
            0,
        )

        speaker_count = analytics.get(
            "speaker_count",
            0,
        )

        speaker_data = analytics.get(
            "speaker_analytics",
            [],
        )

        # ----------------------------------------------------
        # Save speaker analytics
        # ----------------------------------------------------

        db.query(SpeakerAnalytics).filter(
            SpeakerAnalytics.meeting_id
            == meeting.id
        ).delete(
            synchronize_session=False
        )

        db.commit()

        for speaker in speaker_data:

            speaker_record = SpeakerAnalytics(
                speaker=speaker.get(
                    "speaker",
                    "Unknown",
                ),
                speaking_time=speaker.get(
                    "speaking_time",
                    0,
                ),
                word_count=speaker.get(
                    "word_count",
                    0,
                ),
                meeting_id=meeting.id,
            )

            db.add(
                speaker_record
            )

        db.commit()

        # ====================================================
        # STEP 8 — MEETING SCORE
        # ====================================================

        print(
            "[Pipeline] Calculating meeting effectiveness score..."
        )

        # Fetch current action items

        saved_action_items = (
            db.query(ActionItem)
            .filter(
                ActionItem.meeting_id
                == meeting.id
            )
            .all()
        )

        score_result = calculate_meeting_score(
            total_words=total_words,
            speaker_count=speaker_count,
            positive_sentiment=positive_sentiment,
            negative_sentiment=negative_sentiment,
            neutral_sentiment=neutral_sentiment,
            action_items=saved_action_items,
            duration=meeting.duration,
        )

        # ----------------------------------------------------
        # Handle score result
        # ----------------------------------------------------

        if isinstance(
            score_result,
            dict,
        ):

            meeting.effectiveness_score = (
                score_result.get(
                    "score",
                    0,
                )
            )

            meeting.effectiveness_rating = (
                score_result.get(
                    "rating",
                    "",
                )
            )

        else:

            meeting.effectiveness_score = (
                int(score_result)
            )

            if meeting.effectiveness_score >= 85:

                meeting.effectiveness_rating = (
                    "Excellent"
                )

            elif meeting.effectiveness_score >= 70:

                meeting.effectiveness_rating = (
                    "Good"
                )

            elif meeting.effectiveness_score >= 50:

                meeting.effectiveness_rating = (
                    "Needs Improvement"
                )

            else:

                meeting.effectiveness_rating = (
                    "Poor"
                )

        # ====================================================
        # SAVE BASIC ANALYTICS
        # ====================================================

        meeting.total_words = total_words

        meeting.speaker_count = speaker_count

        meeting.positive_sentiment = (
            positive_sentiment
        )

        meeting.negative_sentiment = (
            negative_sentiment
        )

        meeting.neutral_sentiment = (
            neutral_sentiment
        )

        db.commit()

        # ====================================================
        # STEP 9 — AI INSIGHTS
        # ====================================================

        set_progress(
            db,
            meeting,
            "analyzing",
            "insights",
            "Generating AI insights and recommendations...",
            90,
        )

        print(
            "[Pipeline] Generating AI insights..."
        )

        # Convert action items to dictionaries

        action_item_data = []

        for item in saved_action_items:

            action_item_data.append(
                {
                    "task": item.task,
                    "assigned_to": item.assigned_to,
                    "deadline": item.deadline,
                    "priority": item.priority,
                    "status": item.status,
                }
            )

        insights_result = (
            generate_meeting_insights(
                transcript=transcript.content,
                score=meeting.effectiveness_score,
                rating=meeting.effectiveness_rating,
                speaker_analytics=speaker_data,
                action_items=action_item_data,
                positive_sentiment=positive_sentiment,
                negative_sentiment=negative_sentiment,
                neutral_sentiment=neutral_sentiment,
            )
        )

        insights = insights_result.get(
            "insights",
            [],
        )

        recommendations = (
            insights_result.get(
                "recommendations",
                [],
            )
        )

        meeting.meeting_insights = json.dumps(
            insights
        )

        meeting.meeting_recommendations = (
            json.dumps(
                recommendations
            )
        )

        db.commit()

        # ====================================================
        # STEP 10 — PDF REPORT
        # ====================================================

        set_progress(
            db,
            meeting,
            "analyzing",
            "report",
            "Generating meeting report...",
            95,
        )

        print(
            "[Pipeline] Generating PDF report..."
        )

        # Refresh action items

        saved_action_items = (
            db.query(ActionItem)
            .filter(
                ActionItem.meeting_id
                == meeting.id
            )
            .all()
        )

        # Refresh speaker analytics

        saved_speaker_analytics = (
            db.query(SpeakerAnalytics)
            .filter(
                SpeakerAnalytics.meeting_id
                == meeting.id
            )
            .all()
        )

        generate_meeting_pdf(
            meeting=meeting,
            transcript=transcript,
            action_items=saved_action_items,
            speaker_analytics=saved_speaker_analytics,
        )

        print(
            "[Pipeline] PDF report generated."
        )

        # ====================================================
        # STEP 11 — COMPLETED
        # ====================================================

        set_progress(
            db,
            meeting,
            "completed",
            "completed",
            "Meeting processing completed successfully.",
            100,
        )

        print(
            f"[Pipeline] Meeting {meeting_id} completed successfully."
        )

    # ========================================================
    # ERROR HANDLING
    # ========================================================

    except Exception as error:

        print(
            "\n========================================"
        )

        print(
            f"[Pipeline ERROR] Meeting ID: {meeting_id}"
        )

        print(
            f"[Pipeline ERROR] {error}"
        )

        print(
            "========================================"
        )

        traceback.print_exc()

        try:

            meeting = (
                db.query(Meeting)
                .filter(
                    Meeting.id == meeting_id
                )
                .first()
            )

            if meeting:

                meeting.status = (
                    "processing_failed"
                )

                meeting.processing_stage = (
                    "failed"
                )

                meeting.processing_message = (
                    "Meeting processing failed."
                )

                meeting.processing_error = (
                    str(error)
                )

                meeting.processing_progress = 0

                db.commit()

                # Notify frontend

                send_progress(
                    meeting_id,
                    "processing_failed",
                    "failed",
                    "Meeting processing failed.",
                    0,
                )

        except Exception as db_error:

            print(
                "[Pipeline ERROR] "
                f"Could not save failure status: "
                f"{db_error}"
            )

    # ========================================================
    # CLOSE DATABASE
    # ========================================================

    finally:

        db.close()

        print(
            f"[Pipeline] Database connection closed "
            f"for meeting {meeting_id}."
        )