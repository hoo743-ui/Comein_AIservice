"""API 라우터 집약 지점. 도메인별 라우터를 여기서 묶는다.

계약(JSON Schema)은 docs/10_API.md 에서 확정 → AI↔백엔드 병렬 개발.
"""
from fastapi import APIRouter

from app.api.endpoints import chat

api_router = APIRouter()
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])

# TODO: schedules, todos, memos, meetings 라우터 추가 (docs/10_API.md)
