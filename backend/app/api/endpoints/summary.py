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
    """요약은 줄인 글이 아니라 **행동할 수 있는 정보**다.

    네 갈래로 나눠 돌려준다 — 무슨 얘기였나 / 정해진 것 / 아직 안 정해진 것 / 다음에 할 일.
    근거가 없는 갈래는 빈 채로 둔다(칸을 채우려고 지어내지 않는다).
    `lines` 는 예전 화면과의 호환을 위해 네 갈래를 이어 붙인 것이다.
    """
    lines: list[str]
    recap: str = ""      # 최근 대화
    decided: str = ""    # 결정된 내용
    pending: str = ""    # 미정 사항
    next: str = ""       # 다음 행동


# 모델이 붙여 올 머리말 → 우리 갈래. 한국어·영어 둘 다 받는다.
_SECTIONS = {
    "recap": ("최근 대화", "recap"),
    "decided": ("결정", "decided"),
    "pending": ("미정", "pending"),
    "next": ("다음", "next"),
}


def _split_sections(raw: str) -> dict[str, str]:
    """`갈래: 내용` 형태의 줄을 갈래별로 담는다. 못 알아본 줄은 버리지 않고 recap 에 붙인다."""
    out = {k: "" for k in _SECTIONS}
    loose: list[str] = []
    for line in (raw or "").splitlines():
        s = line.strip().lstrip("•-*·").strip()
        if not s:
            continue
        key, _, rest = s.partition(":")
        head = key.strip().lower()
        hit = next((k for k, words in _SECTIONS.items() if any(w in head for w in words)), None)
        if hit and rest.strip():
            out[hit] = rest.strip()
        else:
            loose.append(s)
    if loose and not out["recap"]:
        out["recap"] = " ".join(loose[:2])
    return out


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
            "네 갈래로 정리해 주세요.\n"
            "최근 대화: 무슨 이야기를 했는지 한 문장\n"
            "결정: 확정된 것 한 문장\n"
            "미정: 아직 정해지지 않은 것 한 문장\n"
            "다음: 누가 무엇을 해야 하는지 한 문장\n\n"
            "규칙\n"
            "- 위 네 줄의 형식(`갈래: 내용`)을 그대로 지킵니다.\n"
            "- 대화에 근거가 없는 갈래는 **그 줄을 아예 쓰지 않습니다**. 칸을 채우려고 지어내지 않습니다.\n"
            "- 각 줄은 40자 이내, 한 가지만.\n"
            "- 불릿 기호·번호는 붙이지 않습니다.\n\n"
            f"{transcript}"
        )
        if korean
        else (
            f"Summarize the conversation about {where} so someone joining late can catch up.\n"
            "recap: what was discussed, one sentence\n"
            "decided: what is settled\n"
            "pending: what is still open\n"
            "next: who needs to do what\n\n"
            "Rules\n"
            "- Keep the exact `key: value` format above.\n"
            "- Omit a line entirely when the conversation gives no basis for it. Never invent.\n"
            "- One point per line, short.\n\n"
            f"{transcript}"
        )
    )

    try:
        provider = get_provider(Task.GENERATE)
        raw = await provider.generate(prompt)
    except Exception:
        logger.exception("summary failed")
        return SummaryResponse(lines=[])

    parts = _split_sections(raw or _FALLBACK)
    # lines 는 채워진 갈래만 이어 붙인다 — 빈 칸을 줄로 만들지 않는다.
    return SummaryResponse(
        lines=[v for v in (parts["recap"], parts["decided"], parts["pending"], parts["next"]) if v],
        recap=parts["recap"], decided=parts["decided"], pending=parts["pending"], next=parts["next"],
    )
