"""User 응답 스키마 — 인증 붙기 전 임시 데모 사용자 조회용."""
import uuid

from pydantic import BaseModel


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
