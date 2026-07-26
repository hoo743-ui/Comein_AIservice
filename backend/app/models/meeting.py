"""Meeting — CLAUDE.md §7 컬럼 기준 (회의).

Schedule과 1:1 관계(ERD `Schedule ─ Meeting (1:1)`). title/시작시각은
Schedule에 저장되고, Meeting은 참석자·요약·회의록만 갖는다.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    schedule_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("schedules.id"), nullable=False, unique=True, index=True
    )
    participants: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    schedule: Mapped["Schedule"] = relationship(back_populates="meeting")
