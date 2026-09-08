import os
import uuid
import json

from fastapi import (
    APIRouter,
    Depends,
    File,
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
from app.services.meeting_ai import analyze_meeting
from app.services.analytics import calculate_meeting_analytics


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
    response_model=MeetingResponse,
    status_code=status.HTTP_201_CREATED
)
async def upload_meeting(
    title: str,
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

    if not os.path.exists(meeting.audio_path):
        raise HTTPException(
            status_code=400,
            detail=(
                "Processed audio file does not exist: "
                f"{meeting.audio_path}"
            )
        )

    meeting.status = "transcribing"

    db.commit()

    try:
        result = transcribe_audio(
            meeting.audio_path
        )
        transcript_segments = []

        for segment in result["segments"]:

            transcript_segments.append(
                {
                    "start": segment["start"],
                    "end": segment["end"],
                    "speaker": "UNKNOWN",
                    "text": segment["text"]
                }
            )

        full_text = "\n".join(
            f"{segment['speaker']}: {segment['text']}"
            for segment in transcript_segments
        )

        if meeting.transcript is not None:

            db.delete(
                meeting.transcript
            )

            db.flush()

        transcript = Transcript(
            content=full_text,
            language=result["language"],
            segments=json.dumps(
                transcript_segments
            ),
            meeting_id=meeting.id
        )

        db.add(transcript)

        meeting.status = "transcribed"

        db.commit()
        db.refresh(transcript)

        return {
            "message": "Transcription completed",
            "meeting_id": meeting.id,
            "language": result["language"],
            "language_probability": result[
                "language_probability"
            ],
            "segments": transcript_segments
        }

    except Exception as error:

        db.rollback()

        meeting = (
            db.query(Meeting)
            .filter(
                Meeting.id == meeting_id,
                Meeting.owner_id == current_user.id
            )
            .first()
        )

        if meeting is not None:

            meeting.status = "transcription_failed"

            db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {error}"
        )

@router.post(
    "/{meeting_id}/analyze"
)
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

    if meeting is None:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found"
        )

    if meeting.status != "transcribed":
        raise HTTPException(
            status_code=400,
            detail=(
                "Meeting must be transcribed first. "
                f"Current status: {meeting.status}"
            )
        )

    if meeting.transcript is None:
        raise HTTPException(
            status_code=400,
            detail="Transcript not available"
        )

    meeting.status = "analyzing"

    db.commit()

    try:
        result = analyze_meeting(
            meeting.transcript.content
        )

        meeting.summary = result[
            "summary"
        ]

        meeting.key_points = json.dumps(
            result["key_points"]
        )

        meeting.decisions = json.dumps(
            result["decisions"]
        )

        for item in result[
            "action_items"
        ]:

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
                meeting_id=meeting.id
            )

            db.add(
                action_item
            )

        meeting.status = "completed"

        db.commit()
        db.refresh(meeting)

        return {
            "message": "Meeting analysis completed",
            "meeting_id": meeting.id,
            "summary": result[
                "summary"
            ],
            "key_points": result[
                "key_points"
            ],
            "decisions": result[
                "decisions"
            ],
            "action_items": result[
                "action_items"
            ]
        }

    except Exception as error:

        db.rollback()

        meeting = (
            db.query(Meeting)
            .filter(
                Meeting.id == meeting_id,
                Meeting.owner_id == current_user.id
            )
            .first()
        )

        if meeting is not None:

            meeting.status = "analysis_failed"

            db.commit()

        raise HTTPException(
            status_code=500,
            detail=(
                f"Meeting analysis failed: "
                f"{error}"
            )
        )


# ---------------------------------------------------------
# Meeting Analytics
# ---------------------------------------------------------

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

