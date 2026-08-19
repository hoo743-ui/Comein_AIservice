"""Chat 엔드포인트 — 모든 기능의 입구.

자연어 요청을 받아 AI Router(ai/)로 전달하고, 결과를 검증/보정해 AiResult로
응답한다. 모델이 흔들려도 화면은 흔들리지 않아야 하므로, 여기서 한 번 더
방어적으로 검증하고 실패 시 되묻기 또는 대화 응답으로 폴백한다.

**저장은 이 엔드포인트를 지나지 않는다.** 화면이 items 를 받아 Supabase 에 직접 쓴다
(`frontend/src/lib/store.ts` → `remote.ts`). 예전의 `POST /api/items` 경유 저장은
사라졌다(docs/24 §16). 그래서 이 서버에는 상태가 없다 — DB 세션도 커넥션 풀도 없다.
"""
from typing import Any

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
    "meeting": "회의",
}


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    # 화면이 아는 것을 함께 보낸다 — 서버가 알 수 없는 것들이다.
    #   now/tz     : 사용자가 실제로 서 있는 시각과 시간대(서버 시계는 UTC 로 돈다)
    #   pending    : 직전에 우리가 되물은 질문과 그때의 원래 말 → 이번 메시지는 그 답
    # 스키마를 좁게 고정하지 않는다: 여기서 늘리는 값은 프롬프트가 읽는 것이지
    # 저장되는 것이 아니라, 화면과 AI 가 먼저 맞춰 보고 굳는 편이 낫다.
    context: dict[str, Any] | None = None


def _ro(word: str) -> str:
    """'…로' 인지 '…으로' 인지 — 받침을 보고 고른다.

    예전에는 `(으)로` 한 벌로 때웠다. 그런데 이 문장은 한 줄을 넣을 때마다 화면에 뜨는,
    사용자가 **가장 자주 보는 한 마디**다. 거기에 괄호가 서 있으면 완성되지 않은 자리로 읽힌다.
    받침이 없거나 ㄹ 이면 '로', 그 밖에는 '으로' (일정으로 · 할 일로 · 메모로 · 회의로).
    """
    last = word.strip()[-1:]
    if not last or not ("가" <= last <= "힣"):
        return f"{word}로"
    jong = (ord(last) - 0xAC00) % 28
    return f"{word}로" if jong in (0, 8) else f"{word}으로"


def _default_reply(items: list[ParsedItem]) -> str:
    if not items:
        return "네, 알겠어요."
    if len(items) == 1:
        return f"{_ro(_CATEGORY_LABELS[items[0].category])} 정리했어요."
    return f"{len(items)}건을 정리했어요."


def _ask_of(raw: object) -> str | None:
    """AI 가 되물은 한 줄. 없거나 빈 문자열이면 없는 것으로 본다."""
    if not isinstance(raw, dict):
        return None
    ask = raw.get("ask")
    return ask.strip() if isinstance(ask, str) and ask.strip() else None


@router.post("", response_model=AiResult)
async def chat(req: ChatRequest) -> AiResult:
    raw = None
    try:
        raw = await ai_route(
            message=req.message,
            user_id=req.conversation_id or "default",
            context=req.context,
        )
        raw_items = raw.get("items", []) if isinstance(raw, dict) else []
        items = [ParsedItem.model_validate(item) for item in raw_items]
    except ValidationError:
        # 항목 하나가 규격을 못 지켰다. 그래도 AI 가 '무엇이 비었는지' 알고 물어봤다면
        # 그 질문을 그대로 전한다 — "정확히 파악하지 못했어요" 는 사용자가 무엇을
        # 고쳐 말해야 하는지 알려 주지 않아서, 같은 말을 다시 하게 만든다.
        ask = _ask_of(raw)
        logger.warning("AI 파싱 결과가 ParsedItem 검증을 통과하지 못했습니다: %s", raw)
        return AiResult(intent="chat", reply=ask or _FALLBACK_PARSE_FAILED, items=[], ask=ask)
    except Exception:
        logger.exception("AI processing error")
        return AiResult(intent="chat", reply=_FALLBACK_ERROR, items=[])

    # 물음은 그대로 전한다.
    #
    # 예전에는 `None if items else ...` 였다 — "뽑았으면 묻지 않는다". 같은 것을 두고
    # 항목과 질문이 함께 서는 것을 막으려던 것이고, 그 자체는 옳다. 그런데 **한 마디에 두
    # 가지가 들어 있을 때** 그 규칙이 엉뚱하게 걸렸다:
    #
    #   "내일 3시 회의 잡고 교수님 면담도 잡아줘"
    #     → 회의(시각 있음)는 서고, 면담(시각 없음)은 items 에도 ask 에도 없이 사라졌다.
    #
    # 사용자가 말한 것 하나가 조용히 증발한다. 같은 것을 두 번 묻는 것보다 나쁘다 —
    # 두 번 물으면 귀찮을 뿐이지만, 사라지면 없어진 줄도 모른다.
    #
    # '같은 것을 두고 둘 다 하지 않는다' 는 판단은 프롬프트가 항목 단위로 한다
    # (ai/router.py 의 ASK BACK — "for the same thing"). 여기서 통째로 덮지 않는다.
    ask = _ask_of(raw)

    intent = items[0].category if items else "chat"
    # 예전에는 여기서 `raw.get("reply")` 를 먼저 봤다. 그런데 `ParseResponse`(ai/router.py)에는
    # `reply` 필드가 없다 — 늘 None 이었고, 화면에 뜨는 말은 언제나 아래 둘 중 하나였다.
    # "AI 가 자연어로 답한다" 고 읽히는 코드였지만 그런 적이 없다. 있는 대로 적는다.
    reply = ask or _default_reply(items)
    return AiResult(intent=intent, reply=reply, items=items, ask=ask)
