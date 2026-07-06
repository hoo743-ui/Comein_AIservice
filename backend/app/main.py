"""Comein Backend — FastAPI 진입점.

API Gateway 역할: 클라이언트 요청을 받아 AI Workspace Engine(ai/)과
Data Layer로 연결한다. 상세 설계: ../docs/06_BACKEND.md, ../docs/10_API.md
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings

app = FastAPI(
    title="Comein API",
    description="대화형 AI 워크스페이스 백엔드",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
