"""AI 가 뽑아낸 항목 1건의 모양 — `/api/chat` 응답의 검증 기준.

`docs/10_API.md` 의 `AiResult.entity` 필드명(start/end/due/participants/summary)을
그대로 따라 프론트·AI 파트와 같은 어휘를 쓴다.

예전에는 이 파일에 저장 계약(`ItemsCreateRequest`·`ItemResult`·
`ItemsCreateResponse`)도 함께 있었다. 저장이 Supabase 직행으로 옮겨가
`POST /api/items` 가 사라지면서 함께 걷었다(docs/24 §16). 남은 것은
"AI 가 무엇을 뽑았는가" 를 재는 자 하나뿐이다.
"""
from typing import Literal

from pydantic import BaseModel, model_validator

#: 세 갈래뿐이다. `memo` 가 여기 있었지만 화면이 그것을 '할 일'로 접어 담았고, 그 할 일은
#: 담을 곳이 없어 사라졌다 — 뽑아 놓고 버리는 갈래였다(docs/24 §25). 갈래는 §9(4→2)·
#: §10.1(뷰 3) 을 거쳐 계속 줄어 왔고, 이번이 그 다음 걸음이다.
Category = Literal["schedule", "todo", "meeting"]
Priority = Literal["high", "mid", "low"]


class ParsedItem(BaseModel):
    """AI 추출 결과 1건. category별로 아래 필드 중 일부만 사용된다."""

    category: Category

    # 공통
    title: str | None = None
    content: str | None = None

    # schedule / meeting
    start: str | None = None  # ISO datetime
    # 끝 시각. 사용자가 말했을 때만 온다 — 없으면 길이를 지어내지 않는다(화면이 정한다).
    end: str | None = None  # ISO datetime
    location: str | None = None  # schedule만
    participants: list[str] | None = None  # meeting만
    summary: str | None = None  # meeting만
    notes: str | None = None  # meeting만 (없으면 content로 대체)

    # todo
    due: str | None = None  # ISO datetime
    priority: Priority | None = None

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
        return self
