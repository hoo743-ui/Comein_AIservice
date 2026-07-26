"""DB 세션/엔진 — docs/06_BACKEND.md, docs/09_DATABASE.md.

Supabase(PostgreSQL) + asyncpg 기준 비동기 SQLAlchemy 세션을 제공한다.
라우터에서는 `Depends(get_db)`로 세션을 주입받아 사용한다.
"""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False, future=True)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """모든 ORM 모델의 공통 베이스 (app/models/*)."""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
