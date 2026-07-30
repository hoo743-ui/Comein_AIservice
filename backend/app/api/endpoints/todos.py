"""GET /api/todos — user_id 기준, 선택적으로 status로 할 일 조회."""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Todo
from app.schemas.todos import TodoListResponse, TodoOut

router = APIRouter()


@router.get("", response_model=TodoListResponse)
async def list_todos(
    user_id: uuid.UUID,
    status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> TodoListResponse:
    stmt = select(Todo).where(Todo.user_id == user_id)
    if status is not None:
        stmt = stmt.where(Todo.status == status)
    stmt = stmt.order_by(Todo.created_at)

    todos = (await db.scalars(stmt)).all()
    return TodoListResponse(results=[TodoOut.model_validate(t) for t in todos])
