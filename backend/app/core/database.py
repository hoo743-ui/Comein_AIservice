"""DB 세션/엔진 — docs/06_BACKEND.md, docs/09_DATABASE.md.

Supabase(PostgreSQL) + asyncpg 기준 비동기 SQLAlchemy 세션을 제공한다.
라우터에서는 `Depends(get_db)`로 세션을 주입받아 사용한다.

무료 티어(Render 슬립 · Supabase 커넥션 제한) 전제로 풀을 작게 잡고,
끊긴 커넥션을 잡아내도록 `pool_pre_ping` 을 켠다. (docs/15_DEPLOY.md)
"""
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True,
    connect_args=settings.db_connect_args,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
    pool_recycle=1800,  # Supabase 풀러가 끊기 전에 먼저 재생성
)

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


async def ping_db() -> bool:
    """DB 왕복 1회. 헬스체크·기동 시 커넥션 풀 워밍업에 쓴다."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:  # noqa: BLE001 — DB 미설정/슬립 상태여도 앱은 살아 있어야 한다
        return False
