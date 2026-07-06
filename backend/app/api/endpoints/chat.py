"""Chat 엔드포인트 — 모든 기능의 입구.

자연어 요청을 받아 AI Router(ai/)로 전달하고, 자연어 + 인라인 카드로 응답.
"""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    reply: str
    intent: str | None = None
    cards: list[dict] = []


@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    # TODO: ai.router.route(req.message) 연동 (docs/07_AI_SYSTEM.md)
    return ChatResponse(reply="아직 AI Router가 연결되지 않았습니다.", intent="unknown")
