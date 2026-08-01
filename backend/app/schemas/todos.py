"""GET /api/todos 응답 스키마."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TodoOut(BaseModel):
    """저장된 할 일 1건."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    due_date: datetime | None = None
    priority: str
    status: str
    created_at: datetime


class TodoListResponse(BaseModel):
    results: list[TodoOut]
