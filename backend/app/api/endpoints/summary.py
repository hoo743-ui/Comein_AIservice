"""Summary 엔드포인트 — 쌓인 대화를 대신 읽어 준다.

/api/chat 을 쓰지 않는 이유:
    그쪽은 파서다. 한 마디를 일정·할 일·메모로 갈라 담고 "3건을 정리했어요" 같은
    영수증을 돌려준다. 요약을 시키면 대화가 통째로 일정 파싱에 들어가고, 돌아오는
    reply 는 요약이 아니라 그 영수증이다(실제로 그랬다).

여기서는 구조화된 출력을 요구하지 않는다. 요약은 사람이 읽는 글이라
JSON 스키마에 끼워 넣을 이유가 없다 — 줄 단위 텍스트를 그대로 돌려준다.
"""
from fastapi import APIRouter
from pydantic import BaseModel
import logging
import os
import sys

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from ai.llm.factory import get_provider, Task

router = APIRouter()
logger = logging.getLogger(__name__)

# 요약이 없어도 대화는 그대로다 — 실패를 크게 말하지 않는다.
_FALLBACK = ""

_MAX_CHARS = 6000


class SummaryRequest(BaseModel):
    """transcript 는 "이름: 말" 을 줄바꿈으로 이은 것."""
    transcript: str
    title: str | None = None
    lang: str = "ko"


class SummaryResponse(BaseModel):
    """lines 는 불릿 기호 없는 순수 문장들. 기호는 화면이 붙인다."""
    lines: list[str]


def _clean(raw: str) -> list[str]:
    out: list[str] = []
    for line in raw.splitlines():
        s = line.strip()
        if not s:
            continue
        # 모델이 붙여 오는 불릿·번호를 걷어낸다 — 표식은 화면의 몫이다.
        s = s.lstrip("•-*·").strip()
        if s[:2].rstrip(".").isdigit():
            s = s.split(".", 1)[-1].strip()
        if not s:
            continue
        out.append(s)
        if len(out) >= 5:
            break
    return out


@router.post("", response_model=SummaryResponse)
async def summarize(req: SummaryRequest) -> SummaryResponse:
    transcript = (req.transcript or "").strip()
    if not transcript:
        return SummaryResponse(lines=[])

    # 뒤쪽만 남긴다. 오래된 말까지 다 넣으면 요약이 지금 이야기를 놓친다.
    if len(transcript) > _MAX_CHARS:
        transcript = transcript[-_MAX_CHARS:]

    korean = req.lang != "en"
    where = f'"{req.title}"' if req.title else "이 일정" if korean else "this event"

    prompt = (
        (
            f"다음은 {where} 에 대한 대화입니다. 뒤늦게 들어온 사람이 흐름을 잡을 수 있도록 "
            "3~4줄로 정리해 주세요.\n"
            "- 정해진 것, 아직 안 정해진 것, 누가 무엇을 맡았는지 위주로 씁니다.\n"
            "- 대화에 없는 내용을 지어내지 않습니다. 근거가 없으면 그 줄은 쓰지 않습니다.\n"
            "- 한 줄에 한 가지만, 각 줄은 40자 이내로.\n"
            "- 불릿 기호·번호·머리말 없이 문장만 줄바꿈으로 나열합니다.\n\n"
            f"{transcript}"
        )
        if korean
        else (
            f"Summarize the conversation about {where} in 3-4 lines so someone joining "
            "late can catch up.\n"
            "- Focus on what was decided, what is still open, and who owns what.\n"
            "- Never invent anything that is not in the conversation.\n"
            "- One point per line, no bullets or numbering.\n\n"
            f"{transcript}"
        )
    )

    try:
        provider = get_provider(Task.GENERATE)
        raw = await provider.generate(prompt)
    except Exception:
        logger.exception("summary failed")
        return SummaryResponse(lines=[])

    return SummaryResponse(lines=_clean(raw or _FALLBACK))
