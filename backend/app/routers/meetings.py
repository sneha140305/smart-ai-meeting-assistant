import os
import uuid

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
from app.database.models import Meeting, User
from app.schemas.meeting import MeetingResponse


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
        status="uploaded",
        owner_id=current_user.id
    )

    db.add(meeting)
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