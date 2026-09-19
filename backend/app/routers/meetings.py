import json
import os
import shutil

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
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
from app.services.transcript_merger import merge_transcript_with_speakers
from app.services.meeting_ai import (
    analyze_meeting,
    generate_meeting_insights,
)
from app.services.analytics import calculate_meeting_analytics
from app.services.meeting_score import calculate_meeting_score
from fastapi.responses import FileResponse, StreamingResponse

from app.services.pdf_report import (
    generate_meeting_pdf,
)

router = APIRouter(
    prefix="/meetings",
    tags=["Meetings"]
)


UPLOAD_DIRECTORY = "uploads"

os.makedirs(
    UPLOAD_DIRECTORY,
    exist_ok=True
)


ALLOWED_EXTENSIONS = {
    ".mp3",
    ".wav",
    ".m4a",
    ".mp4",
    ".webm",
    ".mov",
}

MAX_FILE_SIZE = 500 * 1024 * 1024


# =========================================================
# CREATE / UPLOAD MEETING
# =========================================================

@router.post("/upload")
async def upload_meeting(
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="File name is required."
        )

    extension = os.path.splitext(
        file.filename
    )[1].lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file format. "
                "Allowed formats: "
                + ", ".join(ALLOWED_EXTENSIONS)
            )
        )

    safe_filename = os.path.basename(
        file.filename
    )

    file_path = os.path.join(
        UPLOAD_DIRECTORY,
        safe_filename
    )

    # Avoid overwriting another file with the same name.
    base_name, extension = os.path.splitext(
        safe_filename
    )

    counter = 1

    while os.path.exists(file_path):
        safe_filename = (
            f"{base_name}_{counter}{extension}"
        )

        file_path = os.path.join(
            UPLOAD_DIRECTORY,
            safe_filename
        )

        counter += 1

    try:
        file_content = await file.read()

        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="File size cannot exceed 500 MB."
            )

        with open(file_path, "wb") as buffer:
            buffer.write(file_content)

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save file: {str(error)}"
        )

    meeting = Meeting(
        title=title,
        file_name=safe_filename,
        file_path=file_path,
        status="processing",
        owner_id=current_user.id,
    )

    db.add(meeting)
    db.commit()
    db.refresh(meeting)

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
        meeting.status = "audio_processing_failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    return {
        "message": "Meeting uploaded successfully.",
        "meeting_id": meeting.id,
        "title": meeting.title,
        "file_name": meeting.file_name,
        "status": meeting.status,
    }


# =========================================================
# GET ALL MEETINGS
# =========================================================

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


# =========================================================
# PHASE 25 — SMART MEETING KNOWLEDGE SEARCH
# =========================================================

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
            )
        )
        .distinct()
        .order_by(
            Meeting.created_at.desc()
        )
        .all()
    )

    return meetings

@router.get("/{meeting_id}/report")
def download_meeting_report(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id,
            Meeting.owner_id == current_user.id
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
            detail="Meeting analysis is not completed yet."
        )

    transcript = (
        db.query(Transcript)
        .filter(
            Transcript.meeting_id == meeting_id
        )
        .first()
    )

    action_items = (
        db.query(ActionItem)
        .filter(
            ActionItem.meeting_id == meeting_id
        )
        .all()
    )

    speaker_analytics = (
        db.query(SpeakerAnalytics)
        .filter(
            SpeakerAnalytics.meeting_id == meeting_id
        )
        .all()
    )

    file_path = generate_meeting_pdf(
        meeting=meeting,
        transcript=transcript,
        action_items=action_items,
        speaker_analytics=speaker_analytics,
    )

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=(
            f"meeting_report_{meeting.id}.pdf"
        ),
    )
# =========================================================
# GET SINGLE MEETING
# =========================================================

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
            Meeting.owner_id == current_user.id
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found."
        )

    return meeting


# =========================================================
# TRANSCRIBE MEETING
# =========================================================

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
            Meeting.owner_id == current_user.id
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found."
        )

    if not meeting.audio_path:
        raise HTTPException(
            status_code=400,
            detail="Processed audio is not available."
        )

    meeting.status = "transcribing"
    db.commit()

    try:
        result = transcribe_audio(
            meeting.audio_path
        )

        transcript_segments = result[
            "segments"
        ]

        transcript_text = "\n".join(
            segment["text"]
            for segment in transcript_segments
        )

        existing_transcript = (
            db.query(Transcript)
            .filter(
                Transcript.meeting_id
                == meeting.id
            )
            .first()
        )

        if existing_transcript:

            existing_transcript.content = (
                transcript_text
            )

            existing_transcript.language = (
                result["language"]
            )

            existing_transcript.segments = (
                json.dumps(
                    transcript_segments
                )
            )

        else:

            transcript = Transcript(
                content=transcript_text,
                language=result["language"],
                segments=json.dumps(
                    transcript_segments
                ),
                meeting_id=meeting.id,
            )

            db.add(transcript)

        meeting.status = "transcribed"

        db.commit()

        return {
            "message": "Transcription completed.",
            "language": result["language"],
            "language_probability": result[
                "language_probability"
            ],
            "segments": transcript_segments,
        }

    except Exception as error:

        meeting.status = "transcription_failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(error)}"
        )


# =========================================================
# DIARIZE MEETING
# =========================================================

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
            Meeting.owner_id == current_user.id
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found."
        )

    transcript = (
        db.query(Transcript)
        .filter(
            Transcript.meeting_id == meeting.id
        )
        .first()
    )

    if not transcript:
        raise HTTPException(
            status_code=400,
            detail="Transcript not found. Transcribe first."
        )

    if not meeting.audio_path:
        raise HTTPException(
            status_code=400,
            detail="Processed audio is not available."
        )

    meeting.status = "diarizing"
    db.commit()

    try:
        speaker_segments = diarize_audio(
            meeting.audio_path
        )

        if transcript.segments:

            transcript_segments = json.loads(
                transcript.segments
            )

        else:
            transcript_segments = []

        merged_segments = (
            merge_transcript_with_speakers(
                transcript_segments,
                speaker_segments
            )
        )

        transcript.segments = json.dumps(
            merged_segments
        )

        transcript.content = "\n".join(
            f"{segment.get('speaker', 'UNKNOWN')}: "
            f"{segment.get('text', '')}"
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


# =========================================================
# ANALYZE MEETING
# =========================================================

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
            Meeting.owner_id == current_user.id
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found."
        )

    transcript = (
        db.query(Transcript)
        .filter(
            Transcript.meeting_id == meeting.id
        )
        .first()
    )

    if not transcript:
        raise HTTPException(
            status_code=400,
            detail="Transcript not found."
        )

    meeting.status = "analyzing"
    db.commit()

    try:

        # -----------------------------------------
        # AI ANALYSIS
        # -----------------------------------------

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

        # -----------------------------------------
        # REMOVE OLD ACTION ITEMS
        # -----------------------------------------

        db.query(ActionItem).filter(
            ActionItem.meeting_id
            == meeting.id
        ).delete(
            synchronize_session=False
        )

        db.commit()

        # -----------------------------------------
        # CREATE ACTION ITEMS
        # -----------------------------------------

        for item in result.get(
            "action_items",
            []
        ):

            action_item = ActionItem(
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

                meeting_id=meeting.id,
            )

            db.add(action_item)

        db.commit()

        # -----------------------------------------
        # CALCULATE ANALYTICS
        # -----------------------------------------

        if transcript.segments:

            transcript_segments = json.loads(
                transcript.segments
            )

        else:

            transcript_segments = []

        analytics = calculate_meeting_analytics(
            transcript_segments
        )

        meeting.total_words = analytics.get(
            "total_words",
            0
        )

        meeting.speaker_count = analytics.get(
            "speaker_count",
            0
        )

        meeting.positive_sentiment = analytics.get(
            "positive_sentiment",
            0
        )

        meeting.negative_sentiment = analytics.get(
            "negative_sentiment",
            0
        )

        meeting.neutral_sentiment = analytics.get(
            "neutral_sentiment",
            0
        )

        # -----------------------------------------
        # SAVE SPEAKER ANALYTICS
        # -----------------------------------------

        db.query(SpeakerAnalytics).filter(
            SpeakerAnalytics.meeting_id
            == meeting.id
        ).delete(
            synchronize_session=False
        )

        db.commit()

        speaker_analytics_data = analytics.get(
            "speaker_analytics",
            []
        )

        for speaker in speaker_analytics_data:

            speaker_record = SpeakerAnalytics(
                speaker=speaker.get(
                    "speaker",
                    "UNKNOWN"
                ),

                speaking_time=speaker.get(
                    "speaking_time",
                    0
                ),

                word_count=speaker.get(
                    "word_count",
                    0
                ),

                meeting_id=meeting.id,
            )

            db.add(speaker_record)

        db.commit()

        # -----------------------------------------
        # REFRESH RELATIONSHIPS
        # -----------------------------------------

        db.refresh(meeting)

        # -----------------------------------------
        # MEETING EFFECTIVENESS SCORE
        # -----------------------------------------

        meeting_score = calculate_meeting_score(
            total_words=meeting.total_words or 0,

            speaker_count=meeting.speaker_count or 0,

            positive_sentiment=(
                meeting.positive_sentiment or 0
            ),

            negative_sentiment=(
                meeting.negative_sentiment or 0
            ),

            neutral_sentiment=(
                meeting.neutral_sentiment or 0
            ),

            action_items=meeting.action_items,

            duration=meeting.duration,
        )

        meeting.effectiveness_score = (
            meeting_score["score"]
        )

        meeting.effectiveness_rating = (
            meeting_score["rating"]
        )

        db.commit()

        # -----------------------------------------
        # AI INSIGHTS
        # -----------------------------------------

        speaker_data = [
            {
                "speaker": item.speaker,
                "speaking_time": item.speaking_time,
                "word_count": item.word_count,
            }
            for item in meeting.speaker_analytics
        ]

        action_item_data = [
            {
                "task": item.task,
                "assigned_to": item.assigned_to,
                "deadline": item.deadline,
                "priority": item.priority,
                "status": item.status,
            }
            for item in meeting.action_items
        ]

        insights = generate_meeting_insights(
            transcript=transcript.content,

            score=meeting.effectiveness_score,

            rating=meeting.effectiveness_rating,

            speaker_analytics=speaker_data,

            action_items=action_item_data,

            positive_sentiment=(
                meeting.positive_sentiment or 0
            ),

            negative_sentiment=(
                meeting.negative_sentiment or 0
            ),

            neutral_sentiment=(
                meeting.neutral_sentiment or 0
            ),
        )

        meeting.meeting_insights = json.dumps(
            insights.get(
                "insights",
                []
            )
        )

        meeting.meeting_recommendations = (
            json.dumps(
                insights.get(
                    "recommendations",
                    []
                )
            )
        )

        meeting.status = "completed"

        db.commit()
        db.refresh(meeting)

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

            "action_items": action_item_data,

            "analytics": analytics,

            "meeting_score": meeting_score,

            "insights": insights.get(
                "insights",
                []
            ),

            "recommendations": insights.get(
                "recommendations",
                []
            ),
        }

    except Exception as error:

        meeting.status = "analysis_failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Meeting analysis failed: {str(error)}"
        )


# =========================================================
# GET TRANSCRIPT
# =========================================================

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
            Meeting.owner_id == current_user.id
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found."
        )

    transcript = (
        db.query(Transcript)
        .filter(
            Transcript.meeting_id == meeting.id
        )
        .first()
    )

    if not transcript:
        raise HTTPException(
            status_code=404,
            detail="Transcript not found."
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


# =========================================================
# GET ACTION ITEMS
# =========================================================

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
            Meeting.owner_id == current_user.id
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found."
        )

    action_items = (
        db.query(ActionItem)
        .filter(
            ActionItem.meeting_id == meeting_id
        )
        .order_by(
            ActionItem.id.asc()
        )
        .all()
    )

    return [
        {
            "id": item.id,
            "task": item.task,
            "assigned_to": item.assigned_to,
            "deadline": item.deadline,
            "priority": item.priority,
            "status": item.status,
            "meeting_id": item.meeting_id,
        }
        for item in action_items
    ]


# =========================================================
# UPDATE ACTION ITEM
# =========================================================

@router.patch(
    "/{meeting_id}/action-items/{action_item_id}"
)
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
            Meeting.owner_id == current_user.id
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found."
        )

    action_item = (
        db.query(ActionItem)
        .filter(
            ActionItem.id == action_item_id,
            ActionItem.meeting_id == meeting_id
        )
        .first()
    )

    if not action_item:
        raise HTTPException(
            status_code=404,
            detail="Action item not found."
        )

    if status is not None:

        allowed_statuses = [
            "pending",
            "in_progress",
            "completed",
        ]

        if status not in allowed_statuses:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Status must be one of: "
                    "pending, in_progress, completed"
                )
            )

        action_item.status = status

    if priority is not None:

        allowed_priorities = [
            "low",
            "medium",
            "high",
        ]

        if priority not in allowed_priorities:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Priority must be one of: "
                    "low, medium, high"
                )
            )

        action_item.priority = priority

    db.commit()
    db.refresh(action_item)

    return {
        "id": action_item.id,
        "task": action_item.task,
        "assigned_to": action_item.assigned_to,
        "deadline": action_item.deadline,
        "priority": action_item.priority,
        "status": action_item.status,
        "meeting_id": action_item.meeting_id,
    }


# =========================================================
# GET SPEAKER ANALYTICS
# =========================================================

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
            Meeting.owner_id == current_user.id
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found."
        )

    analytics = (
        db.query(SpeakerAnalytics)
        .filter(
            SpeakerAnalytics.meeting_id
            == meeting_id
        )
        .order_by(
            SpeakerAnalytics.word_count.desc()
        )
        .all()
    )

    return [
        {
            "id": item.id,
            "speaker": item.speaker,
            "speaking_time": item.speaking_time,
            "word_count": item.word_count,
            "meeting_id": item.meeting_id,
        }
        for item in analytics
    ]

@router.get("/{meeting_id}/audio")
def get_meeting_audio(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id,
            Meeting.owner_id == current_user.id
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
            detail="Processed audio not found"
        )

    if not os.path.exists(meeting.audio_path):
        raise HTTPException(
            status_code=404,
            detail="Audio file does not exist"
        )

    return FileResponse(
        meeting.audio_path,
        media_type="audio/wav",
        filename=f"meeting_{meeting.id}.wav"
    )

