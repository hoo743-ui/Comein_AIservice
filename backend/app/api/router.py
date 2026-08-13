"""API 라우터 집약 지점.

백엔드가 하는 일은 **AI 파싱 하나**다 — 자연어를 항목으로 가르거나(`/chat`),
대화를 요약으로 접는다(`/summary`). 둘 다 상태를 두지 않는다.

저장·조회는 여기를 지나지 않는다. 프론트가 Supabase 에 직접 붙는다
(`frontend/src/lib/remote.ts`, RLS + Realtime). 예전에는 `/api/items` 로
저장하는 SQLAlchemy 경로가 함께 있었지만, 저장처가 옮겨간 뒤로는 아무도
부르지 않아 걷어냈다 — 자세한 사정은 `docs/24_AI_PIPELINE_STATUS.md` §16.
"""
from fastapi import APIRouter

from app.api.endpoints import chat, summary

api_router = APIRouter()
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
# 요약은 /chat 과 갈라 둔다 — 그쪽은 한 마디를 항목으로 가르는 파서라
# 대화를 넣으면 요약 대신 "N건을 정리했어요" 가 돌아온다.
api_router.include_router(summary.router, prefix="/summary", tags=["summary"])
