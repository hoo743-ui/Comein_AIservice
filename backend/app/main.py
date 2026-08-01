"""Comein Backend — FastAPI 진입점.

API Gateway 역할: 클라이언트 요청을 받아 AI Workspace Engine(ai/)과
Data Layer로 연결한다. 상세 설계: ../docs/06_BACKEND.md, ../docs/10_API.md
"""
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()  # .env 값을 os.environ 으로 — ai/ 쪽이 환경변수를 직접 읽는다

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import ping_db


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    # 기동 시 커넥션 풀을 미리 만들어 첫 요청 지연을 줄인다(콜드스타트 대응).
    # DB 미설정/슬립이어도 기동은 계속한다 — docs/15_DEPLOY.md
    await ping_db()
    yield


app = FastAPI(
    title="Comein API",
    description="대화형 AI 워크스페이스 백엔드",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    """Render 헬스체크용 — DB를 건드리지 않아 항상 빠르다."""
    return {"status": "ok", "env": settings.ENV}


@app.get("/health/db", tags=["system"])
async def health_db() -> dict[str, str]:
    """외부 keep-alive(cron)용 — DB까지 한 번 왕복해 Supabase도 같이 깨운다."""
    return {"status": "ok", "db": "ok" if await ping_db() else "down"}
