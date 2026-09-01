from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MeetingResponse(BaseModel):
    id: int
    title: str
    file_name: str
    duration: int | None
    status: str
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )