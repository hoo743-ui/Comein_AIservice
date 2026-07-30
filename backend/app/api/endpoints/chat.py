"""Chat 엔드포인트 — 모든 기능의 입구.

자연어 요청을 받아 AI Router(ai/)로 전달하고, 결과를 검증/보정해 AiResult로
응답한다. ai.router.route()의 반환 형태는 아직 확정 전(AI팀 작업 중)이므로,
여기서는 방어적으로 검증하고 실패 시 자연스러운 대화 응답으로 폴백한다.
저장(POST /api/items)은 이 엔드포인트의 책임이 아니다 — 반환된 items를
프론트/호출자가 확인 후 별도로 /api/items에 넘기는 흐름을 전제로 한다
(docs/24_AI_PIPELINE_STATUS.md 참고).
"""
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
import sys
import os
import logging

# 프로젝트 루트(ai 폴더가 있는 곳)를 시스템 경로에 추가
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from ai.router import route as ai_route

from app.schemas.ai_result import AiResult
from app.schemas.items import ParsedItem

router = APIRouter()
logger = logging.getLogger(__name__)

_FALLBACK_PARSE_FAILED = "정확히 파악하지 못했어요. 다시 말씀해주시겠어요?"
_FALLBACK_ERROR = "일시적인 오류가 발생했어요."

_CATEGORY_LABELS = {
    "schedule": "일정",
    "todo": "할 일",
    "memo": "메모",
    "meeting": "회의",
}


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


def _default_reply(items: list[ParsedItem]) -> str:
    if not items:
        return "네, 알겠어요."
    if len(items) == 1:
        return f"{_CATEGORY_LABELS[items[0].category]}(으)로 정리했어요."
    return f"{len(items)}건을 정리했어요."


@router.post("", response_model=AiResult)
async def chat(req: ChatRequest) -> AiResult:
    raw = None
    try:
        raw = await ai_route(message=req.message, user_id=req.conversation_id or "default")
        raw_items = raw.get("items", []) if isinstance(raw, dict) else []
        items = [ParsedItem.model_validate(item) for item in raw_items]
    except ValidationError:
        logger.warning("AI 파싱 결과가 ParsedItem 검증을 통과하지 못했습니다: %s", raw)
        return AiResult(intent="chat", reply=_FALLBACK_PARSE_FAILED, items=[])
    except Exception:
        logger.exception("AI processing error")
        return AiResult(intent="chat", reply=_FALLBACK_ERROR, items=[])

    intent = items[0].category if items else "chat"
    reply = raw.get("reply") if isinstance(raw, dict) and raw.get("reply") else _default_reply(items)
    return AiResult(intent=intent, reply=reply, items=items)
