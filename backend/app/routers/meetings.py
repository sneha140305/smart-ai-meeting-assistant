import os
import uuid
import json
from app.services.transcription import transcribe_audio
from app.services.diarization import diarize_audio
from app.services.transcript_merger import assign_speakers

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
    Meeting,
    User,
    Transcript
)
from app.schemas.meeting import MeetingResponse
from app.services.audio_processor import extract_audio
from app.services.transcription import transcribe_audio

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


os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)


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

    unique_name = (
        f"{uuid.uuid4()}{extension}"
    )

    file_path = os.path.join(
        UPLOAD_DIRECTORY,
        unique_name
    )

    with open(file_path, "wb") as output_file:
        output_file.write(file_data)

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
        audio_path = extract_audio(
            file_path,
            meeting.id
        )
        meeting.audio_path = audio_path
        meeting.status = "audio_ready"
    except RuntimeError:
        meeting.status = "processing_failed"

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

    meetings = db.query(Meeting).filter(
        Meeting.owner_id == current_user.id
    ).order_by(
        Meeting.created_at.desc()
    ).all()

    return meetings

@router.post("/{meeting_id}/transcribe")
def transcribe_meeting(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        Meeting.owner_id == current_user.id
    ).first()

    if meeting is None:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found"
        )

    if meeting.status != "audio_ready":
        raise HTTPException(
            status_code=400,
            detail="Meeting audio is not ready"
        )

    if not meeting.audio_path:
        raise HTTPException(
            status_code=400,
            detail="Processed audio file not found"
        )

    meeting.status = "transcribing"
    db.commit()

    try:
        result = transcribe_audio(
            meeting.audio_path
        )


        full_text = " ".join(
            segment["text"]
            for segment in result["segments"]
        )

        transcript = Transcript(
            content=full_text,
            language=result["language"],
            segments=json.dumps(
                result["segments"]
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
            "segments": result["segments"]
        }

    except Exception as error:

        meeting.status = "transcription_failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {error}"
        )

@router.post("/{meeting_id}/transcribe")
def transcribe_meeting(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        Meeting.owner_id == current_user.id
    ).first()

    if meeting is None:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found"
        )

    if meeting.status != "audio_ready":
        raise HTTPException(
            status_code=400,
            detail="Meeting audio is not ready"
        )

    meeting.status = "transcribing"
    db.commit()

    try:
        result = transcribe_audio(
            meeting.audio_path
        )

        speaker_segments = diarize_audio(
            meeting.audio_path
        )

        merged_segments = assign_speakers(
            result["segments"],
            speaker_segments
        )

        full_text = "\n".join(
            f"{segment['speaker']}: {segment['text']}"
            for segment in merged_segments
        )

        transcript = Transcript(
            content=full_text,
            language=result["language"],
            segments=json.dumps(
                merged_segments
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
            "segments": result["segments"]
        }

    except Exception as error:

        meeting.status = "transcription_failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {error}"
        )