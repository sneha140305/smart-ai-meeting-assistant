import os
import uuid
import json

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status
)

from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.database import get_db
from app.database.models import (
    ActionItem,
    Meeting,
    User,
    Transcript
)
from app.schemas.meeting import MeetingResponse

from app.services.audio_processor import extract_audio
from app.services.transcription import transcribe_audio
from app.services.meeting_ai import analyze_meeting as ai_analyze_meeting
from app.services.analytics import calculate_meeting_analytics
from app.services.transcription import transcribe_audio
from app.services.diarization import diarize_audio
from app.services.transcript_merger import assign_speakers

router = APIRouter(
    prefix="/meetings",
    tags=["Meetings"]
)


UPLOAD_DIRECTORY = "uploads"


ALLOWED_EXTENSIONS = {
    ".mp3",
    ".wav",
    ".m4a",
    ".mp4",
    ".webm",
    ".mov"
}


MAX_FILE_SIZE = 500 * 1024 * 1024


os.makedirs(
    UPLOAD_DIRECTORY,
    exist_ok=True
)

@router.post(
    "/upload",
    response_model=MeetingResponse
)
async def upload_meeting(
    title: str=Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    extension = os.path.splitext(
        file.filename or ""
    )[1].lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format"
        )

    file_data = await file.read()

    if len(file_data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File size exceeds 500 MB limit"
        )

    unique_name = f"{uuid.uuid4()}{extension}"

    file_path = os.path.join(
        UPLOAD_DIRECTORY,
        unique_name
    )

    with open(
        file_path,
        "wb"
    ) as output_file:

        output_file.write(
            file_data
        )

    meeting = Meeting(
        title=title,
        file_name=file.filename,
        file_path=file_path,
        status="preprocessing",
        owner_id=current_user.id
    )

    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    try:

        # Convert uploaded media into
        # 16 kHz mono WAV audio.
        audio_path = extract_audio(
            file_path,
            meeting.id
        )

        meeting.audio_path = audio_path
        meeting.status = "audio_ready"

    except Exception as error:

        meeting.status = "processing_failed"

        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Audio processing failed: {error}"
        )

    db.commit()
    db.refresh(meeting)

    return meeting


@router.get(
    "/",
    response_model=list[MeetingResponse]
)
def get_my_meetings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
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

@router.get("/{meeting_id}", response_model=MeetingResponse)
def get_meeting(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
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

    return meeting

@router.get(
    "/{meeting_id}",
    response_model=MeetingResponse
)
def get_meeting(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id,
            Meeting.owner_id == current_user.id
        )
        .first()
    )

    if meeting is None:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found"
        )

    return meeting


@router.post(
    "/{meeting_id}/transcribe"
)
def transcribe_meeting(
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

    if meeting.status != "audio_ready":
        raise HTTPException(
            status_code=400,
            detail=(
                f"Meeting audio is not ready. "
                f"Current status: {meeting.status}"
            )
        )

    if not meeting.audio_path:
        raise HTTPException(
            status_code=400,
            detail="Processed audio file not found"
        )

    try:
        meeting.status = "transcribing"
        db.commit()

        transcription  = transcribe_audio(
            meeting.audio_path
        )
        speaker_segments = diarize_audio(meeting.audio_path)
        merged_segments = assign_speakers(
            transcription["segments"],
            speaker_segments
        )

        full_text = " ".join(
            segment["text"]
            for segment in merged_segments
        )
        transcript = Transcript(
            content=full_text,
            language=transcription["language"],
            segments=json.dumps(merged_segments),
            meeting_id=meeting.id
        )

        db.add(transcript)

        meeting.status = "transcribed"

        db.commit()
        db.refresh(transcript)

        return {
            "message": "Transcription and speaker identification completed",
            "meeting_id": meeting.id,
            "language": transcription["language"],
            "language_probability": transcription["language_probability"],
            "segments": merged_segments
        }
    except Exception as exc:
        db.rollback()

        meeting.status = "transcription_failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {exc}"
        )

@router.get("/{meeting_id}/transcript")
def get_meeting_transcript(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
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

    transcript = (
        db.query(Transcript)
        .filter(Transcript.meeting_id == meeting_id)
        .first()
    )

    if not transcript:
        raise HTTPException(
            status_code=404,
            detail="Transcript not available yet"
        )

    segments = []
    if transcript.segments:
        try:
            segments = json.loads(transcript.segments)
        except json.JSONDecodeError:
            segments = []

    return {
        "id": transcript.id,
        "content": transcript.content,
        "language": transcript.language,
        "segments": segments
    }

@router.post("/{meeting_id}/analyze")
def analyze_meeting_endpoint(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
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

    transcript = (
        db.query(Transcript)
        .filter(
            Transcript.meeting_id == meeting_id
        )
        .first()
    )

    if not transcript:
        raise HTTPException(
            status_code=400,
            detail="Please transcribe the meeting first."
        )

    try:
        meeting.status = "analyzing"
        db.commit()

        # --------------------------------
        # GET TRANSCRIPT
        # --------------------------------

        transcript_text = transcript.content or ""

        if not transcript_text.strip():
            raise ValueError(
                "Transcript is empty."
            )

        # --------------------------------
        # AI ANALYSIS
        # --------------------------------

        from app.services.meeting_ai import analyze_meeting

        result = analyze_meeting(
            transcript_text
        )

        # --------------------------------
        # SAVE SUMMARY
        # --------------------------------

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

        # --------------------------------
        # DELETE OLD ACTION ITEMS
        # --------------------------------

        db.query(ActionItem).filter(
            ActionItem.meeting_id == meeting_id
        ).delete()

        # --------------------------------
        # SAVE ACTION ITEMS
        # --------------------------------

        action_items = result.get(
            "action_items",
            []
        )

        for item in action_items:

            if not isinstance(item, dict):
                continue

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
                status="pending",
                meeting_id=meeting_id
            )

            db.add(action_item)

        # --------------------------------
        # ANALYTICS
        # --------------------------------

        analytics = {}

        if transcript.segments:

            try:
                transcript_segments = json.loads(
                    transcript.segments
                )

                from app.services.analytics import (
                    calculate_meeting_analytics
                )

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

                sentiment = analytics.get(
                    "sentiment",
                    {}
                )

                meeting.positive_sentiment = sentiment.get(
                    "positive",
                    0
                )

                meeting.negative_sentiment = sentiment.get(
                    "negative",
                    0
                )

                meeting.neutral_sentiment = sentiment.get(
                    "neutral",
                    0
                )

                # --------------------------------
                # UPDATE DURATION
                # --------------------------------

                if transcript_segments:

                    latest_end = max(
                        float(
                            segment.get(
                                "end",
                                0
                            )
                        )
                        for segment in transcript_segments
                    )

                    meeting.duration = round(
                        latest_end
                    )

            except Exception as analytics_error:

                print(
                    "Analytics warning:",
                    analytics_error
                )

        # --------------------------------
        # COMPLETE
        # --------------------------------

        meeting.status = "completed"

        db.commit()
        db.refresh(meeting)

        return {
            "message": "Meeting analysis completed.",
            "meeting_id": meeting.id,
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
            "analytics": analytics
        }

    except Exception as error:

        meeting.status = "analysis_failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Meeting analysis failed: {str(error)}"
        )

@router.get(
    "/{meeting_id}/analytics"
)
def get_meeting_analytics(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id,
            Meeting.owner_id == current_user.id
        )
        .first()
    )

    if meeting is None:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found"
        )

    if meeting.transcript is None:
        raise HTTPException(
            status_code=400,
            detail="Transcript not available"
        )

    if not meeting.transcript.segments:
        raise HTTPException(
            status_code=400,
            detail="Transcript segments not available"
        )

    try:

        segments = json.loads(
            meeting.transcript.segments
        )

    except json.JSONDecodeError:

        raise HTTPException(
            status_code=500,
            detail="Invalid transcript segment data"
        )

    analytics = calculate_meeting_analytics(
        segments
    )

    return analytics

@router.post("/{meeting_id}/diarize")
def diarize_meeting(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
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

    transcript = (
        db.query(Transcript)
        .filter(Transcript.meeting_id == meeting_id)
        .first()
    )

    if not transcript:
        raise HTTPException(
            status_code=400,
            detail="Please transcribe the meeting first."
        )

    if not meeting.audio_path:
        raise HTTPException(
            status_code=400,
            detail="Processed audio is not available."
        )

    try:
        meeting.status = "diarizing"
        db.commit()

        transcript_segments = json.loads(
            transcript.segments or "[]"
        )

        speaker_segments = diarize_audio(
            meeting.audio_path
        )

        merged_segments = assign_speakers(
            transcript_segments,
            speaker_segments
        )

        transcript.segments = json.dumps(
            merged_segments
        )

        # Update readable transcript
        transcript.content = "\n".join(
            f"{segment.get('speaker', 'UNKNOWN')}: "
            f"{segment.get('text', '')}"
            for segment in merged_segments
        )

        meeting.status = "transcribed"

        db.commit()
        db.refresh(transcript)

        return {
            "message": "Speaker diarization completed.",
            "segments": merged_segments
        }

    except Exception as error:
        meeting.status = "diarization_failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Speaker diarization failed: {str(error)}"
        )

    
@router.get("/{meeting_id}/action-items")
def get_action_items(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
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

    action_items = (
        db.query(ActionItem)
        .filter(ActionItem.meeting_id == meeting_id)
        .all()
    )

    return action_items

@router.get("/{meeting_id}/speaker-analytics")
def get_speaker_analytics(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
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

    transcript = (
        db.query(Transcript)
        .filter(
            Transcript.meeting_id == meeting_id
        )
        .first()
    )

    if not transcript:
        raise HTTPException(
            status_code=400,
            detail="Transcript not available."
        )

    try:
        segments = json.loads(
            transcript.segments or "[]"
        )

        from app.services.analytics import (
            calculate_meeting_analytics
        )

        analytics = calculate_meeting_analytics(
            segments
        )

        return {
            "meeting_id": meeting_id,
            "speaker_count": analytics["speaker_count"],
            "total_words": analytics["total_words"],
            "speakers": analytics["speakers"]
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to calculate speaker analytics: {str(error)}"
        )

@router.patch("/{meeting_id}/action-items/{action_item_id}")
def update_action_item(
    meeting_id: int,
    action_item_id: int,
    status: str,
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
            detail="Action item not found"
        )

    allowed_statuses = ["pending", "in_progress", "completed"]

    if status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Status must be one of: {', '.join(allowed_statuses)}"
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
        "meeting_id": action_item.meeting_id
    }