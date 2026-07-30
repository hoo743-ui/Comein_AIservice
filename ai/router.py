"""AI Router — Chat 입력의 진입점.

단일 Pydantic 스키마(ParseResponse)를 이용해
사용자의 자연어를 완벽한 JSON 배열 형식으로 파싱하여 반환한다.
"""
from typing import Any, Literal
from pydantic import BaseModel
import datetime
import sys
import os

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
    
    now = datetime.datetime.now().isoformat()
    
    prompt = f"""
You are an intelligent workspace assistant. Extract information from the user's message and categorize it into actionable items.
The current time is: {now}

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
