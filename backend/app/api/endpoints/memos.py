"""GET /api/memos — user_id 기준 메모 조회."""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Memo
from app.schemas.memos import MemoListResponse, MemoOut

router = APIRouter()


@router.get("", response_model=MemoListResponse)
async def list_memos(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> MemoListResponse:
    stmt = select(Memo).where(Memo.user_id == user_id).order_by(Memo.created_at)
    memos = (await db.scalars(stmt)).all()
    return MemoListResponse(results=[MemoOut.model_validate(m) for m in memos])
