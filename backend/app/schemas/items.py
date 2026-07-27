"""JSON 추출 결과 → 카테고리별 저장 스키마 (docs/10_API.md 계약 필드명 정렬).

AI팀 API는 아직 없다. 이 스키마는 "텍스트 → JSON 추출" 이후 단계의
입력 계약이며, docs/10_API.md의 `AiResult.entity` 필드명
(start/end/due/tags/participants/summary)을 그대로 따라 프론트·AI 파트와
동일한 어휘를 쓴다. 테이블 컬럼명과 다른 것(start→start_time 등)은
서비스 레이어에서 매핑한다.
"""
import uuid
from typing import Literal

from pydantic import BaseModel, Field, model_validator

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


class ItemsCreateRequest(BaseModel):
    """POST /api/items 요청 본문.

    user_id는 인증 시스템이 아직 없어 임시로 요청 바디에 직접 받는다.
    추후 JWT 인증이 붙으면 이 필드는 `get_current_user` 의존성으로 대체된다.
    """

    user_id: uuid.UUID
    items: list[ParsedItem] = Field(min_length=1)


class ItemResult(BaseModel):
    """저장된 엔티티 1건의 응답 요약."""

    category: Category
    id: uuid.UUID
    title: str | None = None


class ItemsCreateResponse(BaseModel):
    results: list[ItemResult]
