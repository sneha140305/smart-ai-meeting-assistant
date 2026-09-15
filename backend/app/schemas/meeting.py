from datetime import datetime
from pydantic import BaseModel, ConfigDict


class MeetingResponse(BaseModel):
    id: int
    title: str
    file_name: str
    duration: int | None
    status: str
    created_at: datetime

    summary: str | None = None
    key_points: str | None = None
    decisions: str | None = None

    total_words: int | None = None
    speaker_count: int | None = None

    positive_sentiment: int | None = None
    negative_sentiment: int | None = None
    neutral_sentiment: int | None = None

    effectiveness_score: int | None = None
    effectiveness_rating: str | None = None

    model_config = ConfigDict(from_attributes=True)