"""AI Router — Chat 입력의 진입점.

단일 Pydantic 스키마(ParseResponse)를 이용해
사용자의 자연어를 완벽한 JSON 배열 형식으로 파싱하여 반환한다.
"""
from typing import Any, Literal
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
import sys
import os

# 사용자는 언제나 한국 시각으로 말한다. 서버는 아니다 — Render 는 UTC 로 돈다.
# 그래서 `datetime.now()` 로 "오늘"을 잡으면 한국 시간 오전 9시 이전에 하루가 밀린다
# (한국 8/12 새벽 2시 = UTC 8/11 17시 → AI 가 "내일"을 8/12 로 계산).
# 서머타임이 없으므로 ZoneInfo 대신 고정 오프셋으로 충분하다(tzdata 의존 없음).
KST = timezone(timedelta(hours=9), "KST")

# 백엔드 스키마를 가져오기 위해 경로 추가
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.schemas.items import ParsedItem
from ai.llm.factory import get_provider, Task

class ParseResponse(BaseModel):
    user_id: str
    items: list[ParsedItem]
    # 되묻기 — 필수 정보가 없을 때 지어내는 대신 한 줄 물어본다.
    # 항목과 질문은 같은 것을 두고 동시에 서지 않는다: 뽑았으면 묻지 않고, 물었으면 뽑지 않는다.
    ask: str | None = None


def _now_iso(context: dict[str, Any] | None) -> tuple[str, str]:
    """'지금'을 어디서 얻을지 정한다 — (ISO 시각, 어느 시간대인지 설명).

    서버 시계는 UTC 로 돌고(Render), 사용자는 제 시간대로 말한다.
    그래서 화면이 보내 준 시각을 먼저 믿는다 — 그게 실제로 사용자가 서 있는 시각이다.
    다만 믿기 전에 파싱해 본다. 모양이 어긋난 값이 프롬프트에 그대로 실려 들어가면
    '내일' 이 통째로 어긋나는데, 그건 화면에서는 AI 가 틀린 것처럼 보인다.
    """
    if context:
        raw = context.get("now")
        tz = context.get("tz")
        if isinstance(raw, str):
            try:
                # 파이썬 3.10 은 'Z' 접미사를 모른다 — 화면(toISOString)은 늘 Z 로 보낸다.
                parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except ValueError:
                parsed = None
            if parsed is not None and parsed.tzinfo is not None:
                where = f"the user's own timezone ({tz})" if isinstance(tz, str) and tz else "the user's own timezone"
                return parsed.isoformat(), where
    return datetime.now(KST).isoformat(), "Korea Standard Time (UTC+09:00)"


def _pending_block(context: dict[str, Any] | None) -> str:
    """직전에 우리가 되물었다면, 이번 메시지는 그 답이다.

    질문만 하고 답을 받을 자리가 없으면 되묻기는 막다른 길이 된다 —
    사용자는 "3시" 라고만 답하는데 그 한 마디만으로는 아무것도 아니기 때문이다.
    """
    pending = (context or {}).get("pending")
    if not isinstance(pending, dict):
        return ""
    asked = pending.get("ask")
    said = pending.get("message")
    if not isinstance(asked, str) or not isinstance(said, str) or not asked or not said:
        return ""
    return f"""
FOLLOW-UP:
- Just before this, the user said: "{said}"
- We asked back: "{asked}"
- The new message below is most likely the ANSWER to that question.
  Merge the two: take the intent from the earlier message and the missing detail
  from the new one, then produce the complete item. Do not ask the same thing twice.
"""


async def route(message: str, user_id: str = "default-user", context: dict[str, Any] | None = None) -> dict:
    """자연어 메시지를 파싱하여 ParseResponse 규격의 딕셔너리로 반환한다."""
    provider = get_provider(Task.GENERATE)

    now, where = _now_iso(context)
    follow_up = _pending_block(context)

    prompt = f"""
You are an intelligent workspace assistant. Extract information from the user's message and categorize it into actionable items.

IMPORTANT DATE/TIME RULES:
- The current absolute time is: {now} (ISO 8601). Use this as the baseline for "today".
- That timestamp is in {where}. Interpret every time expression the user makes in that same timezone,
  and return times with the same UTC offset — never shift them into another zone.
- When the user says "오늘" (today), use the exact date from the current time.
- When the user says "내일" (tomorrow), add 1 day to the current date.
- When the user says "모레" (day after tomorrow), add 2 days.
- When the user says "글피" (two days after tomorrow), add 3 days.
- When the user says "다음 주" (next week) or specific days (e.g. "다음 주 월요일"), calculate the exact date based on the current date.
- ALWAYS return the parsed `start` and `end` times as a fully qualified ISO 8601 datetime string.
- AM/PM: a bare hour with no marker means the WAKING-HOURS reading, not the small hours.
  "3시" / "at 3" -> 15:00, "9시" -> 09:00, "7시 저녁" -> 19:00.
  Only produce an hour between 00:00 and 05:59 when the user says so explicitly
  ("새벽 3시", "3am", "오전 3시"). People do not schedule meetings at 3 in the morning.

{follow_up}
User Message: {message}

Extract all relevant schedules, todos, memos, and meetings from the user message.
If a single message contains multiple distinct items (e.g., a meeting and a todo), output multiple items in the `items` array.

Required fields per category:
- schedule: `title`, `start` (ISO datetime)
- meeting: `title`, `start` (ISO datetime)
- todo: `title`
- memo: `content`

PEOPLE (meeting only):
- If the message names other people to meet with, put their names in `participants`
  as a list of strings, e.g. "이하늘, 김민수랑 내일 2시 회의" -> participants: ["이하늘", "김민수"].
- Keep those names OUT of `title`. The title is what the meeting is about, not who is in it
  ("회의", "면담"), so "이하늘, 김민수 회의" is wrong — title "회의", participants ["이하늘","김민수"].
- Role words used as a name are still names ("교수님", "팀장님"). The speaker themselves
  ("나", "저") is never a participant.
- If nobody else is named, leave `participants` null. Do not invent people.

ASK BACK INSTEAD OF GUESSING:
- A schedule or a meeting needs a specific date AND time. If the message does not let you
  determine one, DO NOT invent it and DO NOT fall back to a default hour.
  Leave that item out of `items` and put ONE short question in `ask` instead.
- Write `ask` in the same language the user wrote in, and name exactly what is missing
  (e.g. "언제로 잡을까요?" / "몇 시로 할까요?"). One sentence. No greeting, no apology.
- Never do both for the same thing: if you produced the item, `ask` must be null.
- Only schedules and meetings are worth asking about. A todo without a due date is a
  perfectly good todo, and a memo is just a memo — take those as they are, `ask` stays null.

Output JSON shape:
{{"user_id": "{user_id}", "items": [ ...zero or more items... ], "ask": null or "one short question"}}

Return the result strictly conforming to that shape.
For user_id, use exactly: "{user_id}"
"""
    
    # generate_structured 호출 시 완벽한 ParseResponse Pydantic 모델 반환 보장
    response_obj = await provider.generate_structured(prompt, ParseResponse)
    
    return response_obj.model_dump(exclude_none=True)
