"""API 라우터 집약 지점. 도메인별 라우터를 여기서 묶는다.

계약(JSON Schema)은 docs/10_API.md 에서 확정 → AI↔백엔드 병렬 개발.
"""
from fastapi import APIRouter

from app.api.endpoints import chat, items, memos, meetings, schedules, todos, users

api_router = APIRouter()
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(items.router, prefix="/items", tags=["items"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["schedules"])
api_router.include_router(todos.router, prefix="/todos", tags=["todos"])
api_router.include_router(memos.router, prefix="/memos", tags=["memos"])
api_router.include_router(meetings.router, prefix="/meetings", tags=["meetings"])

# TODO: schedules, todos, memos, meetings 개별 수정(PATCH)/단건 조회 라우터 (docs/10_API.md)
