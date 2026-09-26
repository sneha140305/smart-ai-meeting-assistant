import json
import os
import shutil
import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.database import get_db
from app.database.models import (
    User,
    Meeting,
    Transcript,
    ActionItem,
    SpeakerAnalytics,
)

from app.services.audio_processor import extract_audio
from app.services.transcription import transcribe_audio
from app.services.diarization import diarize_audio
from app.services.meeting_ai import (
    analyze_meeting,
    generate_meeting_insights,
)
from app.services.processing_pipeline import (
    process_meeting_pipeline,
)
from app.services.pdf_report import generate_meeting_pdf


router = APIRouter(
    prefix="/meetings",
    tags=["Meetings"]
)


UPLOAD_DIRECTORY = "uploads"

os.makedirs(
    UPLOAD_DIRECTORY,
    exist_ok=True
)


# ============================================================
# UPLOAD MEETING
# ============================================================

@router.post("/upload")
async def upload_meeting(
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed_extensions = {
        ".mp3",
        ".wav",
        ".m4a",
        ".mp4",
        ".webm",
        ".mov",
    }

    max_file_size = 500 * 1024 * 1024

    original_filename = file.filename or "meeting"

    extension = os.path.splitext(
        original_filename
    )[1].lower()

    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Allowed: mp3, wav, m4a, mp4, webm, mov"
            ),
        )

    unique_filename = (
        f"{uuid.uuid4().hex}{extension}"
    )

    file_path = os.path.join(
        UPLOAD_DIRECTORY,
        unique_filename
    )

    try:

        file_size = 0

        with open(file_path, "wb") as buffer:

            while True:

                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                file_size += len(chunk)

                if file_size > max_file_size:

                    buffer.close()

                    if os.path.exists(file_path):
                        os.remove(file_path)

                    raise HTTPException(
                        status_code=413,
                        detail="File size exceeds 500 MB limit."
                    )

                buffer.write(chunk)

    except HTTPException:
        raise

    except Exception as error:

        if os.path.exists(file_path):
            os.remove(file_path)

        raise HTTPException(
            status_code=500,
            detail=f"File upload failed: {str(error)}"
        )

    # --------------------------------------------------------
    # CREATE MEETING RECORD
    # --------------------------------------------------------

    meeting = Meeting(
        title=title,
        file_name=original_filename,
        file_path=file_path,
        status="processing",
        owner_id=current_user.id,
    )

    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    # --------------------------------------------------------
    # EXTRACT AUDIO
    # --------------------------------------------------------

    try:

        audio_path = extract_audio(
            file_path,
            meeting.id
        )

        meeting.audio_path = audio_path
        meeting.status = "audio_ready"

        db.commit()
        db.refresh(meeting)

    except Exception as error:

        meeting.status = "processing_failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Audio processing failed: {str(error)}"
        )

    return {
        "id": meeting.id,
        "title": meeting.title,
        "file_name": meeting.file_name,
        "status": meeting.status,
        "message": "Meeting uploaded successfully."
    }


# ============================================================
# START AUTOMATIC PROCESSING
# ============================================================

@router.post("/{meeting_id}/process")
def process_meeting(
    meeting_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id,
            Meeting.owner_id == current_user.id,
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found"
        )

    if not meeting.audio_path:
        raise HTTPException(
            status_code=400,
            detail="Processed audio is not available."
        )

    if meeting.status in {
        "processing",
        "transcribing",
        "diarizing",
        "analyzing",
    }:
        raise HTTPException(
            status_code=400,
            detail="Meeting is already being processed."
        )

    meeting.status = "processing"

    db.commit()

    # --------------------------------------------------------
    # RUN AI PIPELINE IN BACKGROUND
    # --------------------------------------------------------

    background_tasks.add_task(
        process_meeting_pipeline,
        meeting.id
    )

    return {
        "message": "Meeting processing started.",
        "meeting_id": meeting.id,
        "status": "processing",
    }


# ============================================================
# GET ALL USER MEETINGS
# ============================================================

@router.get("/")
def get_meetings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meetings = (
        db.query(Meeting)
        .filter(
            Meeting.owner_id == current_user.id
        )
        .order_by(
            Meeting.created_at.desc()
        )
        .all()
    )

    return meetings


# ============================================================
# SEARCH MEETINGS
# ============================================================

@router.get("/search")
def search_meetings(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = q.strip()

    if not query:
        return []

    search_term = f"%{query}%"

    meetings = (
        db.query(Meeting)
        .outerjoin(
            Transcript,
            Transcript.meeting_id == Meeting.id
        )
        .outerjoin(
            ActionItem,
            ActionItem.meeting_id == Meeting.id
        )
        .filter(
            Meeting.owner_id == current_user.id,
            (
                Meeting.title.ilike(search_term)
                | Meeting.file_name.ilike(search_term)
                | Meeting.summary.ilike(search_term)
                | Meeting.key_points.ilike(search_term)
                | Meeting.decisions.ilike(search_term)
                | Transcript.content.ilike(search_term)
                | ActionItem.task.ilike(search_term)
                | ActionItem.assigned_to.ilike(search_term)
            ),
        )
        .distinct()
        .order_by(
            Meeting.created_at.desc()
        )
        .all()
    )

    return meetings


# ============================================================
# GET SINGLE MEETING
# ============================================================

@router.get("/{meeting_id}")
def get_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id,
            Meeting.owner_id == current_user.id,
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found"
        )

    return meeting


# ============================================================
# TRANSCRIBE
# ============================================================

@router.post("/{meeting_id}/transcribe")
def transcribe_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id,
            Meeting.owner_id == current_user.id,
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found"
        )

    if not meeting.audio_path:
        raise HTTPException(
            status_code=400,
            detail="Audio file not available."
        )

    try:

        meeting.status = "transcribing"
        db.commit()

        result = transcribe_audio(
            meeting.audio_path
        )

        transcript = (
            db.query(Transcript)
            .filter(
                Transcript.meeting_id ==
                meeting.id
            )
            .first()
        )

        if not transcript:

            transcript = Transcript(
                meeting_id=meeting.id
            )

            db.add(transcript)

        transcript.language = result[
            "language"
        ]

        transcript.content = "\n".join(
            segment["text"]
            for segment in result["segments"]
        )

        transcript.segments = json.dumps(
            result["segments"]
        )

        meeting.status = "transcribed"

        db.commit()

        return {
            "message": "Transcription completed.",
            "language": result["language"],
            "segments": result["segments"],
        }

    except Exception as error:

        meeting.status = "transcription_failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(error)}"
        )


# ============================================================
# DIARIZE
# ============================================================

@router.post("/{meeting_id}/diarize")
def diarize_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id,
            Meeting.owner_id == current_user.id,
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found"
        )

    transcript = (
        db.query(Transcript)
        .filter(
            Transcript.meeting_id ==
            meeting.id
        )
        .first()
    )

    if not transcript:
        raise HTTPException(
            status_code=400,
            detail="Transcript not found."
        )

    if not meeting.audio_path:
        raise HTTPException(
            status_code=400,
            detail="Audio file not available."
        )

    try:

        meeting.status = "diarizing"
        db.commit()

        speaker_segments = diarize_audio(
            meeting.audio_path
        )

        if transcript.segments:

            transcript_segments = json.loads(
                transcript.segments
            )

        else:

            transcript_segments = []

        merged_segments = []

        for segment in transcript_segments:

            best_speaker = "Unknown"
            best_overlap = 0

            for speaker_segment in speaker_segments:

                overlap_start = max(
                    segment["start"],
                    speaker_segment["start"]
                )

                overlap_end = min(
                    segment["end"],
                    speaker_segment["end"]
                )

                overlap = max(
                    0,
                    overlap_end - overlap_start
                )

                if overlap > best_overlap:

                    best_overlap = overlap

                    best_speaker = (
                        speaker_segment["speaker"]
                    )

            merged_segments.append({
                "start": segment["start"],
                "end": segment["end"],
                "speaker": best_speaker,
                "text": segment["text"],
            })

        transcript.segments = json.dumps(
            merged_segments
        )

        transcript.content = "\n".join(
            f"[{segment['speaker']}] "
            f"{segment['text']}"
            for segment in merged_segments
        )

        meeting.status = "transcribed"

        db.commit()

        return {
            "message": "Speaker diarization completed.",
            "segments": merged_segments,
        }

    except Exception as error:

        meeting.status = "diarization_failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Diarization failed: {str(error)}"
        )


# ============================================================
# GET TRANSCRIPT
# ============================================================

@router.get("/{meeting_id}/transcript")
def get_transcript(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id,
            Meeting.owner_id == current_user.id,
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found"
        )

    transcript = (
        db.query(Transcript)
        .filter(
            Transcript.meeting_id ==
            meeting.id
        )
        .first()
    )

    if not transcript:
        raise HTTPException(
            status_code=404,
            detail="Transcript not found"
        )

    segments = []

    if transcript.segments:

        try:
            segments = json.loads(
                transcript.segments
            )

        except json.JSONDecodeError:
            segments = []

    return {
        "id": transcript.id,
        "content": transcript.content,
        "language": transcript.language,
        "segments": segments,
    }


# ============================================================
# ANALYZE MEETING
# ============================================================

@router.post("/{meeting_id}/analyze")
def analyze_meeting_endpoint(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id,
            Meeting.owner_id == current_user.id,
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found"
        )

    transcript = (
        db.query(Transcript)
        .filter(
            Transcript.meeting_id ==
            meeting.id
        )
        .first()
    )

    if not transcript:
        raise HTTPException(
            status_code=400,
            detail="Transcript not found."
        )

    try:

        meeting.status = "analyzing"
        db.commit()

        result = analyze_meeting(
            transcript.content
        )

        meeting.summary = result.get(
            "summary",
            ""
        )

        meeting.key_points = json.dumps(
            result.get(
                "key_points",
                []
            )
        )

        meeting.decisions = json.dumps(
            result.get(
                "decisions",
                []
            )
        )

        db.query(ActionItem).filter(
            ActionItem.meeting_id ==
            meeting.id
        ).delete()

        action_items = result.get(
            "action_items",
            []
        )

        for item in action_items:

            db.add(
                ActionItem(
                    meeting_id=meeting.id,
                    task=item.get(
                        "task",
                        ""
                    ),
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
                    status="pending",
                )
            )

        meeting.status = "completed"

        db.commit()

        return {
            "message": "Meeting analysis completed.",
            "summary": meeting.summary,
            "key_points": result.get(
                "key_points",
                []
            ),
            "decisions": result.get(
                "decisions",
                []
            ),
            "action_items": action_items,
        }

    except Exception as error:

        meeting.status = "analysis_failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(error)}"
        )


# ============================================================
# ACTION ITEMS
# ============================================================

@router.get("/{meeting_id}/action-items")
def get_action_items(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id,
            Meeting.owner_id == current_user.id,
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found"
        )

    return (
        db.query(ActionItem)
        .filter(
            ActionItem.meeting_id ==
            meeting.id
        )
        .order_by(
            ActionItem.id.asc()
        )
        .all()
    )


# ============================================================
# UPDATE ACTION ITEM
# ============================================================

@router.patch("/{meeting_id}/action-items/{action_item_id}")
def update_action_item(
    meeting_id: int,
    action_item_id: int,
    status: str | None = None,
    priority: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id,
            Meeting.owner_id == current_user.id,
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found"
        )

    action_item = (
        db.query(ActionItem)
        .filter(
            ActionItem.id == action_item_id,
            ActionItem.meeting_id == meeting.id,
        )
        .first()
    )

    if not action_item:
        raise HTTPException(
            status_code=404,
            detail="Action item not found"
        )

    allowed_statuses = {
        "pending",
        "in_progress",
        "completed",
    }

    allowed_priorities = {
        "low",
        "medium",
        "high",
    }

    if status is not None:

        if status not in allowed_statuses:
            raise HTTPException(
                status_code=400,
                detail="Invalid status."
            )

        action_item.status = status

    if priority is not None:

        if priority not in allowed_priorities:
            raise HTTPException(
                status_code=400,
                detail="Invalid priority."
            )

        action_item.priority = priority

    db.commit()
    db.refresh(action_item)

    return action_item


# ============================================================
# SPEAKER ANALYTICS
# ============================================================

@router.get("/{meeting_id}/speaker-analytics")
def get_speaker_analytics(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id,
            Meeting.owner_id == current_user.id,
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found"
        )

    return (
        db.query(SpeakerAnalytics)
        .filter(
            SpeakerAnalytics.meeting_id ==
            meeting.id
        )
        .order_by(
            SpeakerAnalytics.speaking_time.desc()
        )
        .all()
    )


# ============================================================
# AUDIO
# ============================================================

@router.get("/{meeting_id}/audio")
def get_meeting_audio(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id,
            Meeting.owner_id == current_user.id,
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found"
        )

    if not meeting.audio_path:
        raise HTTPException(
            status_code=404,
            detail="Processed audio not found."
        )

    if not os.path.exists(
        meeting.audio_path
    ):
        raise HTTPException(
            status_code=404,
            detail="Audio file does not exist."
        )

    return FileResponse(
        meeting.audio_path,
        media_type="audio/wav",
        filename=(
            f"meeting_{meeting.id}.wav"
        ),
    )


# ============================================================
# PDF REPORT
# ============================================================

@router.get("/{meeting_id}/report")
def download_meeting_report(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id,
            Meeting.owner_id == current_user.id,
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found"
        )

    if meeting.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=(
                "Meeting processing must be completed "
                "before generating the report."
            )
        )

    transcript = (
        db.query(Transcript)
        .filter(
            Transcript.meeting_id ==
            meeting.id
        )
        .first()
    )

    action_items = (
        db.query(ActionItem)
        .filter(
            ActionItem.meeting_id ==
            meeting.id
        )
        .all()
    )

    speaker_analytics = (
        db.query(SpeakerAnalytics)
        .filter(
            SpeakerAnalytics.meeting_id ==
            meeting.id
        )
        .all()
    )

    try:

        report_path = generate_meeting_pdf(
            meeting=meeting,
            transcript=transcript,
            action_items=action_items,
            speaker_analytics=speaker_analytics,
        )

        return FileResponse(
            report_path,
            media_type="application/pdf",
            filename=(
                f"meeting_report_{meeting.id}.pdf"
            ),
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"PDF generation failed: {str(error)}"
        )