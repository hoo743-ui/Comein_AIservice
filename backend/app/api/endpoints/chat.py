"""Chat 엔드포인트 — 모든 기능의 입구.

자연어 요청을 받아 AI Router(ai/)로 전달하고, 자연어 + 인라인 카드로 응답.
"""
from fastapi import APIRouter
from pydantic import BaseModel
import sys
import os
import logging

# 프로젝트 루트(ai 폴더가 있는 곳)를 시스템 경로에 추가
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from ai.router import route as ai_route

router = APIRouter()
logger = logging.getLogger(__name__)

class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None

@router.post("")
async def chat(req: ChatRequest):
    try:
        # ai/router.py 호출 (ParsedItem JSON 배열 반환)
        parsed_result = await ai_route(message=req.message, user_id=req.conversation_id or "default")
        return parsed_result
    except Exception as e:
        logger.exception("AI processing error")
        return {"error": str(e)}
