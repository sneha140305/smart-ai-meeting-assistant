import json
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.database.models import Meeting, Transcript, ActionItem

from app.services.transcription import transcribe_audio
from app.services.diarization import diarize_audio
from app.services.meeting_ai import analyze_meeting


def update_status(db: Session, meeting: Meeting, status: str):
    meeting.status = status
    db.commit()
    db.refresh(meeting)


def calculate_overlap(start1, end1, start2, end2):
    overlap_start = max(start1, start2)
    overlap_end = min(end1, end2)

    if overlap_end <= overlap_start:
        return 0

    return overlap_end - overlap_start


def merge_transcript_with_speakers(transcript_segments, speaker_segments):
    merged = []

    for segment in transcript_segments:
        best_speaker = "Unknown"
        best_overlap = 0

        for speaker_segment in speaker_segments:
            overlap = calculate_overlap(
                segment["start"],
                segment["end"],
                speaker_segment["start"],
                speaker_segment["end"]
            )

            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = speaker_segment["speaker"]

        merged.append({
            "start": segment["start"],
            "end": segment["end"],
            "speaker": best_speaker,
            "text": segment["text"]
        })

    return merged


def process_meeting_pipeline(meeting_id: int):
    """
    Complete background processing pipeline.

    Upload
        ↓
    Transcription
        ↓
    Speaker Diarization
        ↓
    Transcript Merge
        ↓
    AI Analysis
        ↓
    Completed
    """

    db = SessionLocal()

    try:
        meeting = (
            db.query(Meeting)
            .filter(Meeting.id == meeting_id)
            .first()
        )

        if not meeting:
            return

        if not meeting.audio_path:
            meeting.status = "processing_failed"
            db.commit()
            return

        # --------------------------------------------------
        # STEP 1: TRANSCRIPTION
        # --------------------------------------------------

        update_status(db, meeting, "transcribing")

        transcription_result = transcribe_audio(
            meeting.audio_path
        )

        transcript_segments = transcription_result["segments"]

        transcript = (
            db.query(Transcript)
            .filter(Transcript.meeting_id == meeting.id)
            .first()
        )

        if not transcript:
            transcript = Transcript(
                meeting_id=meeting.id
            )
            db.add(transcript)

        transcript.language = transcription_result["language"]

        transcript.segments = json.dumps(
            transcript_segments
        )

        transcript.content = "\n".join(
            segment["text"]
            for segment in transcript_segments
        )

        db.commit()

        # --------------------------------------------------
        # STEP 2: SPEAKER DIARIZATION
        # --------------------------------------------------

        update_status(db, meeting, "diarizing")

        speaker_segments = diarize_audio(
            meeting.audio_path
        )

        # --------------------------------------------------
        # STEP 3: MERGE TRANSCRIPT + SPEAKERS
        # --------------------------------------------------

        merged_segments = merge_transcript_with_speakers(
            transcript_segments,
            speaker_segments
        )

        transcript.segments = json.dumps(
            merged_segments
        )

        transcript.content = "\n".join(
            f"[{segment['speaker']}] {segment['text']}"
            for segment in merged_segments
        )

        db.commit()

        # --------------------------------------------------
        # STEP 4: AI ANALYSIS
        # --------------------------------------------------

        update_status(db, meeting, "analyzing")

        ai_result = analyze_meeting(
            transcript.content
        )

        meeting.summary = ai_result.get(
            "summary",
            ""
        )

        meeting.key_points = json.dumps(
            ai_result.get("key_points", [])
        )

        meeting.decisions = json.dumps(
            ai_result.get("decisions", [])
        )

        # --------------------------------------------------
        # STEP 5: ACTION ITEMS
        # --------------------------------------------------

        db.query(ActionItem).filter(
            ActionItem.meeting_id == meeting.id
        ).delete()

        for item in ai_result.get(
            "action_items",
            []
        ):
            action_item = ActionItem(
                meeting_id=meeting.id,
                task=item.get("task", ""),
                assigned_to=item.get(
                    "assigned_to",
                    "Unknown"
                ),
                deadline=item.get(
                    "deadline",
                    "Not mentioned"
                ),
                priority=item.get(
                    "priority",
                    "medium"
                ),
                status="pending"
            )

            db.add(action_item)

        db.commit()

        # --------------------------------------------------
        # STEP 6: FINAL STATUS
        # --------------------------------------------------

        update_status(
            db,
            meeting,
            "completed"
        )

    except Exception as error:

        print(
            f"Processing failed for meeting "
            f"{meeting_id}: {error}"
        )

        try:
            meeting = (
                db.query(Meeting)
                .filter(Meeting.id == meeting_id)
                .first()
            )

            if meeting:
                meeting.status = "processing_failed"
                db.commit()

        except Exception:
            db.rollback()

    finally:
        db.close()