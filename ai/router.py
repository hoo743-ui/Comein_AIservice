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


# 사람이 "새벽" 이라고 말하는 방식들. 이 중 하나라도 있으면 00~05시는 그가 뜻한 것이다.
# ("밤 3시" 도 한국어에서는 새벽 세 시다. "0시"·"자정" 은 그 자체가 명시다.)
_SMALL_HOUR_WORDS = (
    "새벽", "오전", "아침", "밤", "자정", "0시", "00시", "심야",
    "am", "a.m.", "midnight", "dawn", "early morning", "overnight",
)


def _said_small_hours(message: str) -> bool:
    low = message.lower()
    return any(w in low for w in _SMALL_HOUR_WORDS)


def _shift_to_waking(iso: str) -> tuple[str, int]:
    """00:00~05:59 로 나온 시각을 낮으로 옮긴다. (옮긴 값, 옮긴 시간) 을 돌려준다.

    프롬프트에도 같은 규칙을 적어 두었지만, 프롬프트는 부탁이지 보장이 아니다 —
    적어 둔 뒤에도 배포본에서 여섯 번에 한 번은 "내일 3시" 를 새벽 세 시로 읽었다.
    캘린더에 새벽 세 시짜리 교수님 미팅이 앉으면, 그 화면 하나로 제품 설명이 끝난다.

    그래서 여기서 한 번 더 잡는다. 화면이 AI 를 믿되 검증하는 것과 같은 태도다
    (`toParsed` 가 모르는 필드를 버리듯이).
    """
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return iso, 0
    if 0 <= dt.hour <= 5:
        return (dt + timedelta(hours=12)).isoformat(), 12
    return iso, 0


def _fix_small_hours(resp: ParseResponse, message: str) -> None:
    """사용자가 새벽이라고 말하지 않았는데 새벽으로 잡힌 시각을 제자리로 돌린다."""
    if _said_small_hours(message):
        return
    for item in resp.items:
        if item.start:
            item.start, moved = _shift_to_waking(item.start)
            # 끝 시각은 시작이 움직였을 때만, 같은 만큼 움직인다 — 따로 판단하면
            # 밤을 넘기는 일정(23:00~01:00)의 끝만 낮으로 튀어 앞뒤가 뒤집힌다.
            if moved and item.end:
                try:
                    end = datetime.fromisoformat(item.end.replace("Z", "+00:00"))
                    item.end = (end + timedelta(hours=moved)).isoformat()
                except ValueError:
                    pass
        if item.due:
            item.due, _ = _shift_to_waking(item.due)


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


def _thread_block(context: dict[str, Any] | None) -> str:
    """이 말이 대화 한복판에서 나온 것이라면, 그 앞뒤를 함께 보여 준다.

    왜 필요한가 — 예전에는 방에서도 캡처 바와 **똑같이** 한 줄만 보냈다. 그런데 두 자리는
    말의 성질이 다르다:

      캡처 바 : "다음 주 화요일 3시에 교수님 미팅" — 혼자 서는 완결된 부탁
      대화    : "그럼 4시"                        — 앞말이 없으면 아무것도 아닌 말

    앞말 없이 "그럼 4시" 를 받으면 모델은 오늘 4시로 읽는다. 대화에서는 그게 대개 틀리다.

    그리고 성질이 다른 만큼 **해야 할 일도 다르다.** 캡처 바는 부탁을 받는 자리라 모르면
    되묻는 것이 맞지만, 대화는 두 사람 사이라 우리가 끼어들어 묻는 것이 방해가 된다.
    같은 프롬프트를 쓰되 이 블록이 그 차이를 말한다.
    """
    thread = (context or {}).get("thread")
    if not isinstance(thread, list):
        return ""
    lines = [str(t).strip() for t in thread if isinstance(t, str) and str(t).strip()]
    if not lines:
        return ""
    joined = "\n".join(f"  {ln}" for ln in lines[-8:])   # 여덟 마디면 '그때' 가 무엇인지 족하다
    return f"""
IN A CONVERSATION:
- The message below is ONE line of an ongoing conversation between people.
  Here is what was said just before it (oldest first):
{joined}
- Resolve short or relative wording against that thread. "그럼 4시" means the day they have
  been talking about, not today by default. If the thread never settled on a day, do not
  pick one.
- **Produce an item ONLY when they are actually settling on a time.** In a conversation most
  lines are not requests:
    · a refusal or a constraint  ("그때는 안 돼", "3시에 수업 있어")
    · a question                 ("언제가 좋아?")
    · small talk
  For those return an EMPTY `items` array. A stated constraint is not a schedule — it is the
  reason a schedule cannot be at that hour. Turning it into one hands the person back the very
  time they just ruled out.
- **`ask` must be null here.** This is a conversation between people; a question from us lands
  in the middle of it. If something is missing, they will work it out themselves.
"""


async def route(message: str, user_id: str = "default-user", context: dict[str, Any] | None = None) -> dict:
    """자연어 메시지를 파싱하여 ParseResponse 규격의 딕셔너리로 반환한다."""
    provider = get_provider(Task.GENERATE)

    now, where = _now_iso(context)
    follow_up = _pending_block(context)
    thread = _thread_block(context)

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

{follow_up}{thread}
User Message: {message}

Extract all relevant schedules, meetings, and todos from the user message.
If a single message contains multiple distinct items (e.g., a meeting and a todo), output multiple items in the `items` array.

There are exactly three categories. There is no `memo` — a thought worth keeping is either
something to do (todo) or something that happens at a time (schedule). Do not invent a fourth.

Required fields per category:
- schedule: `title`, `start` (ISO datetime), and `end` when the user gives one
- meeting: `title`, `start` (ISO datetime), and `end` when the user gives one
- todo: `title`

DURATION:
- If the user says how long it runs or when it ends ("2시부터 5시까지", "3시에 한 시간"),
  put that in `end`. If they do not say, leave `end` null — do not guess a length.

HOW IMPORTANT (`priority`, any category):
- Only when the user actually signals it. "중요한", "꼭", "절대", "놓치면 안 되는",
  "important", "must" -> "high". "급하지 않은", "여유되면", "whenever" -> "low".
  "보통", "normal" -> "mid".
- **Otherwise leave it null.** Null means nobody said. That is different from "mid", which
  means they said it is ordinary. Do not rate things on your own — an invented importance
  becomes a reason to interrupt someone later, and it will be the wrong reason.
- Do not infer from the kind of event. A 시험 is not automatically high; a 점심 is not low.

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
- Never do both for THE SAME THING: if you produced that item, do not also ask about it.
- But this rule is **per item, not per message.** If one message holds two things and only
  one of them has a time, produce the complete one AND ask about the other:
    "내일 3시 회의 잡고 교수님 면담도 잡아줘"
      -> items: [meeting 회의 tomorrow 15:00]   ask: "교수님 면담은 언제로 잡을까요?"
  Dropping the incomplete one is the one thing you must not do. The user said it out loud;
  if it vanishes with no item and no question, they will not know it is gone.
- Only schedules and meetings are worth asking about. A todo without a due date is a
  perfectly good todo — take it as it is, `ask` stays null.

NOTHING TO FILE — and that is a normal outcome:
- Some messages ask nothing of you. A refusal ("그때는 안 돼", "못 갈 것 같아",
  "안 될 것 같아", "I can't make it"), a cancellation, a thank-you, or plain small talk.
  For those return an EMPTY `items` array AND `ask: null`. Silence is the correct answer.
- A refusal is the clearest case, and the easiest to get wrong. The user is telling you a
  time does NOT work. Asking "언제로 잡을까요?" back reads as if you did not understand
  them at all — worse than saying nothing. Never ask a question in response to a refusal.
- `ask` is only for a request you understood but cannot complete. If there was no request,
  there is nothing to ask about.

Output JSON shape:
{{"user_id": "{user_id}", "items": [ ...zero or more items... ], "ask": null or "one short question"}}

Return the result strictly conforming to that shape.
For user_id, use exactly: "{user_id}"
"""
    
    # generate_structured 호출 시 완벽한 ParseResponse Pydantic 모델 반환 보장
    response_obj = await provider.generate_structured(prompt, ParseResponse)

    # 프롬프트가 부탁한 것을 여기서 한 번 더 확인한다 — 새벽으로 잡힌 시각.
    _fix_small_hours(response_obj, message)

    return response_obj.model_dump(exclude_none=True)
