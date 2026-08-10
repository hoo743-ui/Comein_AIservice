"""API 라우터 집약 지점. 도메인별 라우터를 여기서 묶는다.

계약(JSON Schema)은 docs/10_API.md 에서 확정 → AI↔백엔드 병렬 개발.
"""
from fastapi import APIRouter

from app.api.endpoints import chat, items, memos, meetings, schedules, summary, todos, users

api_router = APIRouter()
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
# 요약은 /chat 과 갈라 둔다 — 그쪽은 한 마디를 항목으로 가르는 파서라
# 대화를 넣으면 요약 대신 "N건을 정리했어요" 가 돌아온다.
api_router.include_router(summary.router, prefix="/summary", tags=["summary"])
api_router.include_router(items.router, prefix="/items", tags=["items"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["schedules"])
api_router.include_router(todos.router, prefix="/todos", tags=["todos"])
api_router.include_router(memos.router, prefix="/memos", tags=["memos"])
api_router.include_router(meetings.router, prefix="/meetings", tags=["meetings"])

# TODO: schedules, todos, memos, meetings 개별 수정(PATCH)/단건 조회 라우터 (docs/10_API.md)
