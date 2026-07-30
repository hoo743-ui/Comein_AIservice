"""GET /api/memos 응답 스키마."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MemoOut(BaseModel):
    """저장된 메모 1건."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str | None = None
    content: str
    tags: list[str]
    created_at: datetime


class MemoListResponse(BaseModel):
    results: list[MemoOut]
