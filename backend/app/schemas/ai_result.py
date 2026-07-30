"""AI 파싱 결과를 감싸는 응답 계약 — POST /api/chat 이 이 스키마로 응답한다.

`items`는 저장 계약(POST /api/items)과 동일한 `ParsedItem`을 그대로 재사용해,
검증을 통과한 항목을 `create_items_from_parsed()`에 바로 넘길 수 있게 한다.
"""
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.items import ParsedItem

Intent = Literal["schedule", "todo", "memo", "meeting", "chat"]


class AiResult(BaseModel):
    intent: Intent
    reply: str
    items: list[ParsedItem] = Field(default_factory=list)
