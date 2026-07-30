"""GET /api/schedules 응답 스키마."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ScheduleOut(BaseModel):
    """저장된 일정 1건."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    start_time: datetime
    end_time: datetime | None = None
    location: str | None = None
    status: str
    created_at: datetime


class ScheduleListResponse(BaseModel):
    results: list[ScheduleOut]
