"""Memo — CLAUDE.md §7 컬럼 기준 (메모).

tags는 CLAUDE.md 문서상 VARCHAR[](Postgres 배열)이나, 로컬 SQLite 테스트와의
호환을 위해 이식 가능한 JSON 컬럼(문자열 배열)으로 구현한다. asyncpg 운영
환경에서도 JSON/JSONB로 동일하게 동작한다.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Memo(Base):
    __tablename__ = "memos"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="memos")
