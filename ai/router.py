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

async def route(message: str, user_id: str = "default-user", context: dict[str, Any] | None = None) -> dict:
    """자연어 메시지를 파싱하여 ParseResponse 규격의 딕셔너리로 반환한다."""
    provider = get_provider(Task.GENERATE)
    
    now = datetime.now(KST).isoformat()

    prompt = f"""
You are an intelligent workspace assistant. Extract information from the user's message and categorize it into actionable items.

IMPORTANT DATE/TIME RULES:
- The current absolute time is: {now} (ISO 8601, Korea Standard Time). Use this as the baseline for "today".
- The user always speaks in Korea Standard Time (UTC+09:00). Interpret every time expression in KST.
- When the user says "오늘" (today), use the exact date from the current time.
- When the user says "내일" (tomorrow), add 1 day to the current date.
- When the user says "모레" (day after tomorrow), add 2 days.
- When the user says "글피" (two days after tomorrow), add 3 days.
- When the user says "다음 주" (next week) or specific days (e.g. "다음 주 월요일"), calculate the exact date based on the current date.
- ALWAYS return the parsed `start` and `end` times as a fully qualified ISO 8601 datetime string.

User Message: {message}

If there is additional context, use it to resolve ambiguities:
Context: {context or {}}

Extract all relevant schedules, todos, memos, and meetings from the user message.
If a single message contains multiple distinct items (e.g., a meeting and a todo), output multiple items in the `items` array.

Required fields per category:
- schedule: `title`, `start` (ISO datetime)
- meeting: `title`, `start` (ISO datetime)
- todo: `title`
- memo: `content`

Return the result strictly conforming to the requested JSON schema.
For user_id, use exactly: "{user_id}"
"""
    
    # generate_structured 호출 시 완벽한 ParseResponse Pydantic 모델 반환 보장
    response_obj = await provider.generate_structured(prompt, ParseResponse)
    
    return response_obj.model_dump(exclude_none=True)
