"""GET /api/meetings 응답 스키마.

Meeting은 Schedule과 1:1 관계(CLAUDE.md §7)라, 제목/시각/장소는 join한
Schedule에서 가져와 하나의 응답 모델로 합쳐 반환한다.
"""
import uuid
from datetime import datetime

from pydantic import BaseModel


class MeetingOut(BaseModel):
    """저장된 회의 1건 (Schedule과 join한 결과)."""

    id: uuid.UUID
    schedule_id: uuid.UUID
    title: str
    start_time: datetime
    end_time: datetime | None = None
    location: str | None = None
    status: str
    participants: list[str]
    summary: str | None = None
    notes: str | None = None
    created_at: datetime


class MeetingListResponse(BaseModel):
    results: list[MeetingOut]
