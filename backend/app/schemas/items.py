"""AI 가 뽑아낸 항목 1건의 모양 — `/api/chat` 응답의 검증 기준.

`docs/10_API.md` 의 `AiResult.entity` 필드명(start/end/due/tags/participants/
summary)을 그대로 따라 프론트·AI 파트와 같은 어휘를 쓴다.

예전에는 이 파일에 저장 계약(`ItemsCreateRequest`·`ItemResult`·
`ItemsCreateResponse`)도 함께 있었다. 저장이 Supabase 직행으로 옮겨가
`POST /api/items` 가 사라지면서 함께 걷었다(docs/24 §16). 남은 것은
"AI 가 무엇을 뽑았는가" 를 재는 자 하나뿐이다.
"""
from typing import Literal

from pydantic import BaseModel, model_validator

Category = Literal["schedule", "todo", "memo", "meeting"]
Priority = Literal["high", "mid", "low"]


class ParsedItem(BaseModel):
    """AI 추출 결과 1건. category별로 아래 필드 중 일부만 사용된다."""

    category: Category

    # 공통
    title: str | None = None
    content: str | None = None

    # schedule / meeting
    start: str | None = None  # ISO datetime
    end: str | None = None  # ISO datetime (schedule만)
    location: str | None = None  # schedule만
    participants: list[str] | None = None  # meeting만
    summary: str | None = None  # meeting만
    notes: str | None = None  # meeting만 (없으면 content로 대체)

    # todo
    due: str | None = None  # ISO datetime
    priority: Priority | None = None

    # memo
    tags: list[str] | None = None

    @model_validator(mode="after")
    def _check_required_fields(self) -> "ParsedItem":
        if self.category in ("schedule", "meeting"):
            if not self.title:
                raise ValueError(f"{self.category}: title은 필수입니다.")
            if not self.start:
                raise ValueError(f"{self.category}: start(ISO datetime)는 필수입니다.")
        elif self.category == "todo":
            if not self.title:
                raise ValueError("todo: title은 필수입니다.")
        elif self.category == "memo":
            if not self.content:
                raise ValueError("memo: content는 필수입니다.")
        return self
