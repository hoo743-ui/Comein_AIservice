"""AI Router — Chat 입력의 진입점.

단일 Pydantic 스키마(ParseResponse)를 이용해
사용자의 자연어를 완벽한 JSON 배열 형식으로 파싱하여 반환한다.
"""
from typing import Any, Literal
from pydantic import BaseModel
import datetime

from ai.llm.factory import get_provider, Task

Category = Literal["schedule", "todo", "memo", "meeting"]
Priority = Literal["high", "mid", "low"]

class ParsedItem(BaseModel):
    category: Category
    title: str | None = None
    content: str | None = None
    start: str | None = None
    end: str | None = None
    location: str | None = None
    participants: list[str] | None = None
    summary: str | None = None
    notes: str | None = None
    due: str | None = None
    priority: Priority | None = None
    tags: list[str] | None = None

class ParseResponse(BaseModel):
    user_id: str
    items: list[ParsedItem]

async def route(message: str, user_id: str = "default-user", context: dict[str, Any] | None = None) -> dict:
    """자연어 메시지를 파싱하여 ParseResponse 규격의 딕셔너리로 반환한다."""
    provider = get_provider(Task.GENERATE)
    
    now = datetime.datetime.now().isoformat()
    
    prompt = f"""
You are an intelligent workspace assistant. Extract information from the user's message and categorize it into actionable items.
The current time is: {now}

User Message: {message}

If there is additional context, use it to resolve ambiguities:
Context: {context or {}}

Extract all relevant schedules, todos, memos, and meetings.
Return the result strictly conforming to the requested JSON schema.
For user_id, use exactly: "{user_id}"
"""
    
    # generate_structured 호출 시 완벽한 ParseResponse Pydantic 모델 반환 보장
    response_obj = await provider.generate_structured(prompt, ParseResponse)
    
    return response_obj.model_dump(exclude_none=True)
