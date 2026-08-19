"""AI 파싱 결과를 감싸는 응답 계약 — POST /api/chat 이 이 스키마로 응답한다.

`items`는 저장 계약(POST /api/items)과 동일한 `ParsedItem`을 그대로 재사용해,
검증을 통과한 항목을 `create_items_from_parsed()`에 바로 넘길 수 있게 한다.
"""
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.items import ParsedItem

Intent = Literal["schedule", "todo", "meeting", "chat"]


class AiResult(BaseModel):
    intent: Intent
    reply: str
    items: list[ParsedItem] = Field(default_factory=list)
    # 되묻기 — 필수 정보(일정/회의의 시각)가 없어 지어내지 않고 물어보는 한 줄.
    # `items` 가 비어 있는데 이 값이 있으면, 실패가 아니라 **답을 기다리는 상태**다.
    # 호출자는 이 값을 다음 요청의 `context.pending.ask` 로 되돌려 보내 대화를 잇는다.
    ask: str | None = None
