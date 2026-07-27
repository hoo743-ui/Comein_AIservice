"""Todo — CLAUDE.md §7 컬럼 기준 (할 일)."""
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Todo(Base):
    __tablename__ = "todos"
    __table_args__ = (
        CheckConstraint("priority IN ('high', 'mid', 'low')", name="ck_todos_priority"),
        CheckConstraint("status IN ('todo', 'doing', 'done')", name="ck_todos_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    priority: Mapped[str] = mapped_column(String, nullable=False, default="mid")
    status: Mapped[str] = mapped_column(String, nullable=False, default="todo")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="todos")
