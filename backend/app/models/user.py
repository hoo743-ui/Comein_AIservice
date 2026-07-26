"""User — docs/09_DATABASE.md 자리표시(비어있음) 대신 CLAUDE.md §7 기준으로 정의.

인증(JWT/Supabase Auth)은 별도 작업 범위. 여기서는 FK 대상으로서
최소 컬럼만 정의한다.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    schedules: Mapped[list["Schedule"]] = relationship(back_populates="user")
    todos: Mapped[list["Todo"]] = relationship(back_populates="user")
    memos: Mapped[list["Memo"]] = relationship(back_populates="user")
