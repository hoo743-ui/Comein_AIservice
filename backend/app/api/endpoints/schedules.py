"""GET /api/schedules — user_id 기준, 선택적으로 기간(from/to)으로 일정 조회."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Schedule
from app.schemas.schedules import ScheduleListResponse, ScheduleOut

router = APIRouter()


@router.get("", response_model=ScheduleListResponse)
async def list_schedules(
    user_id: uuid.UUID,
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> ScheduleListResponse:
    stmt = select(Schedule).where(Schedule.user_id == user_id)
    if from_ is not None:
        stmt = stmt.where(Schedule.start_time >= from_)
    if to is not None:
        stmt = stmt.where(Schedule.start_time <= to)
    stmt = stmt.order_by(Schedule.start_time)

    schedules = (await db.scalars(stmt)).all()
    return ScheduleListResponse(results=[ScheduleOut.model_validate(s) for s in schedules])
