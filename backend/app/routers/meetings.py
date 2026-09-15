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


router = APIRouter(
    prefix="/meetings",
    tags=["Meetings"],
)


UPLOAD_DIRECTORY = "uploads"

os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)


# ============================================================
# Helper Functions
# ============================================================

def get_owned_meeting(
    meeting_id: int,
    current_user: User,
    db: Session,
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
            detail="Meeting not found",
        )

    return meeting


def parse_json(value, fallback=None):
    if fallback is None:
        fallback = []

    if not value:
        return fallback

    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return fallback


# ============================================================
# Upload Meeting
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
                "Allowed formats: mp3, wav, m4a, mp4, "
                "webm, mov."
            ),
        )

    file_path = os.path.join(
        UPLOAD_DIRECTORY,
        original_filename,
    )

    try:
        content = await file.read()

        if len(content) > max_file_size:
            raise HTTPException(
                status_code=400,
                detail="File size cannot exceed 500 MB.",
            )

        with open(file_path, "wb") as buffer:
            buffer.write(content)

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save file: {str(error)}",
        )

    meeting = Meeting(
        title=title,
        file_name=original_filename,
        file_path=file_path,
        status="uploaded",
        owner_id=current_user.id,
    )

    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    try:
        audio_path = extract_audio(
            file_path,
            meeting.id,
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
            detail=f"Audio processing failed: {str(error)}",
        )

    return {
        "message": "Meeting uploaded successfully",
        "meeting": {
            "id": meeting.id,
            "title": meeting.title,
            "file_name": meeting.file_name,
            "status": meeting.status,
        },
    }


# ============================================================
# Get All Meetings
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
        .order_by(Meeting.created_at.desc())
        .all()
    )

    return meetings


# ============================================================
# Get Single Meeting
# ============================================================

@router.get("/{meeting_id}")
def get_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = get_owned_meeting(
        meeting_id,
        current_user,
        db,
    )

    return meeting


# ============================================================
# Transcribe Meeting
# ============================================================

@router.post("/{meeting_id}/transcribe")
def transcribe_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = get_owned_meeting(
        meeting_id,
        current_user,
        db,
    )

    if not meeting.audio_path:
        raise HTTPException(
            status_code=400,
            detail="Processed audio is not available.",
        )

    if not os.path.exists(meeting.audio_path):
        raise HTTPException(
            status_code=404,
            detail="Processed audio file not found.",
        )

    meeting.status = "transcribing"
    db.commit()

    try:
        result = transcribe_audio(
            meeting.audio_path
        )

        segments = result["segments"]

        transcript_text = "\n".join(
            segment["text"]
            for segment in segments
        )

        transcript = (
            db.query(Transcript)
            .filter(
                Transcript.meeting_id == meeting.id
            )
            .first()
        )

        if transcript:
            transcript.content = transcript_text
            transcript.language = result["language"]
            transcript.segments = json.dumps(
                segments
            )
        else:
            transcript = Transcript(
                content=transcript_text,
                language=result["language"],
                segments=json.dumps(segments),
                meeting_id=meeting.id,
            )

            db.add(transcript)

        meeting.status = "transcribed"

        db.commit()
        db.refresh(transcript)

        return {
            "message": "Transcription completed",
            "language": result["language"],
            "language_probability": result[
                "language_probability"
            ],
            "segments": segments,
        }

    except Exception as error:
        meeting.status = "transcription_failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(error)}",
        )


# ============================================================
# Diarize Meeting
# ============================================================

@router.post("/{meeting_id}/diarize")
def diarize_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = get_owned_meeting(
        meeting_id,
        current_user,
        db,
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
            detail="Please transcribe the meeting first.",
        )

    if not meeting.audio_path:
        raise HTTPException(
            status_code=400,
            detail="Processed audio is not available.",
        )

    meeting.status = "diarizing"
    db.commit()

    try:
        speaker_segments = diarize_audio(
            meeting.audio_path
        )

        transcript_segments = parse_json(
            transcript.segments
        )

        merged_segments = merge_transcript_with_speakers(
            transcript_segments,
            speaker_segments,
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
        db.refresh(transcript)

        return {
            "message": "Speaker diarization completed",
            "segments": merged_segments,
        }

    except Exception as error:
        meeting.status = "diarization_failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Diarization failed: {str(error)}",
        )


# ============================================================
# Analyze Meeting
# ============================================================

@router.post("/{meeting_id}/analyze")
def analyze_meeting_endpoint(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = get_owned_meeting(
        meeting_id,
        current_user,
        db,
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
            detail="Please transcribe the meeting first.",
        )

    if not transcript.content:
        raise HTTPException(
            status_code=400,
            detail="Transcript is empty.",
        )

    meeting.status = "analyzing"
    db.commit()

    try:

        # ----------------------------------------------------
        # 1. Basic AI Analysis
        # ----------------------------------------------------

        result = analyze_meeting(
            transcript.content
        )

        meeting.summary = result.get(
            "summary",
            "",
        )

        meeting.key_points = json.dumps(
            result.get(
                "key_points",
                [],
            )
        )

        meeting.decisions = json.dumps(
            result.get(
                "decisions",
                [],
            )
        )


        # ----------------------------------------------------
        # 2. Action Items
        # ----------------------------------------------------

        db.query(ActionItem).filter(
            ActionItem.meeting_id == meeting.id
        ).delete(
            synchronize_session=False
        )

        created_action_items = []

        for item in result.get(
            "action_items",
            [],
        ):

            action_item = ActionItem(
                task=item.get(
                    "task",
                    "",
                ),
                assigned_to=item.get(
                    "assigned_to",
                    "Unknown",
                ),
                deadline=item.get(
                    "deadline",
                    "Not mentioned",
                ),
                status="pending",
                meeting_id=meeting.id,
            )

            db.add(action_item)

            created_action_items.append(
                action_item
            )

        db.flush()


        # ----------------------------------------------------
        # 3. Meeting Analytics
        # ----------------------------------------------------

        transcript_segments = parse_json(
            transcript.segments
        )

        analytics = calculate_meeting_analytics(
            transcript_segments
        )


        meeting.total_words = analytics.get(
            "total_words",
            0,
        )

        meeting.speaker_count = analytics.get(
            "speaker_count",
            0,
        )

        meeting.positive_sentiment = analytics.get(
            "positive_sentiment",
            0,
        )

        meeting.negative_sentiment = analytics.get(
            "negative_sentiment",
            0,
        )

        meeting.neutral_sentiment = analytics.get(
            "neutral_sentiment",
            0,
        )

        if analytics.get("duration") is not None:
            meeting.duration = analytics.get(
                "duration"
            )


        # ----------------------------------------------------
        # 4. Meeting Effectiveness Score
        # ----------------------------------------------------

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
            action_items=created_action_items,
            duration=meeting.duration,
        )

        meeting.effectiveness_score = (
            meeting_score["score"]
        )

        meeting.effectiveness_rating = (
            meeting_score["rating"]
        )


        # ----------------------------------------------------
        # 5. Speaker Analytics
        # ----------------------------------------------------

        speaker_data = [
            {
                "speaker": item.speaker,
                "speaking_time": item.speaking_time,
                "word_count": item.word_count,
            }
            for item in meeting.speaker_analytics
        ]


        # ----------------------------------------------------
        # 6. AI Insights & Recommendations
        # ----------------------------------------------------

        action_item_data = [
            {
                "task": item.task,
                "assigned_to": item.assigned_to,
                "deadline": item.deadline,
                "status": item.status,
            }
            for item in created_action_items
        ]

        insights = generate_meeting_insights(
            transcript=transcript.content,
            score=meeting_score["score"],
            rating=meeting_score["rating"],
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
                [],
            )
        )

        meeting.meeting_recommendations = json.dumps(
            insights.get(
                "recommendations",
                [],
            )
        )


        # ----------------------------------------------------
        # 7. Complete
        # ----------------------------------------------------

        meeting.status = "completed"

        db.commit()
        db.refresh(meeting)

        return {
            "message": "Meeting analysis completed",

            "summary": meeting.summary,

            "key_points": parse_json(
                meeting.key_points
            ),

            "decisions": parse_json(
                meeting.decisions
            ),

            "action_items": [
                {
                    "id": item.id,
                    "task": item.task,
                    "assigned_to": item.assigned_to,
                    "deadline": item.deadline,
                    "status": item.status,
                    "meeting_id": item.meeting_id,
                }
                for item in created_action_items
            ],

            "analytics": {
                "total_words": meeting.total_words,
                "speaker_count": meeting.speaker_count,
                "positive_sentiment": (
                    meeting.positive_sentiment
                ),
                "negative_sentiment": (
                    meeting.negative_sentiment
                ),
                "neutral_sentiment": (
                    meeting.neutral_sentiment
                ),
                "duration": meeting.duration,
            },

            "meeting_score": meeting_score,

            "insights": insights.get(
                "insights",
                [],
            ),

            "recommendations": insights.get(
                "recommendations",
                [],
            ),
        }

    except Exception as error:

        db.rollback()

        meeting.status = "analysis_failed"

        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Meeting analysis failed: {str(error)}",
        )


# ============================================================
# Get Transcript
# ============================================================

@router.get("/{meeting_id}/transcript")
def get_transcript(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = get_owned_meeting(
        meeting_id,
        current_user,
        db,
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
            detail="Transcript not found.",
        )

    segments = parse_json(
        transcript.segments
    )

    return {
        "id": transcript.id,
        "content": transcript.content,
        "language": transcript.language,
        "segments": segments,
    }


# ============================================================
# Get Action Items
# ============================================================

@router.get("/{meeting_id}/action-items")
def get_action_items(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = get_owned_meeting(
        meeting_id,
        current_user,
        db,
    )

    action_items = (
        db.query(ActionItem)
        .filter(
            ActionItem.meeting_id == meeting.id
        )
        .all()
    )

    return [
        {
            "id": item.id,
            "task": item.task,
            "assigned_to": item.assigned_to,
            "deadline": item.deadline,
            "status": item.status,
            "meeting_id": item.meeting_id,
        }
        for item in action_items
    ]


# ============================================================
# Update Action Item Status
# ============================================================

@router.patch(
    "/{meeting_id}/action-items/{action_item_id}"
)
def update_action_item(
    meeting_id: int,
    action_item_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = get_owned_meeting(
        meeting_id,
        current_user,
        db,
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
            detail="Action item not found.",
        )

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
                + ", ".join(allowed_statuses)
            ),
        )

    action_item.status = status

    db.commit()
    db.refresh(action_item)

    return {
        "id": action_item.id,
        "task": action_item.task,
        "assigned_to": action_item.assigned_to,
        "deadline": action_item.deadline,
        "status": action_item.status,
        "meeting_id": action_item.meeting_id,
    }


# ============================================================
# Get Speaker Analytics
# ============================================================

@router.get("/{meeting_id}/speaker-analytics")
def get_speaker_analytics(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = get_owned_meeting(
        meeting_id,
        current_user,
        db,
    )

    analytics = (
        db.query(SpeakerAnalytics)
        .filter(
            SpeakerAnalytics.meeting_id == meeting.id
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