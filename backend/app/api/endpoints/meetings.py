"""GET /api/meetings — user_id 기준 회의 조회.

Meeting은 Schedule과 1:1(CLAUDE.md §7)이라 제목/시각/장소는 Schedule에서
join해 가져온다.
"""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Meeting, Schedule
from app.schemas.meetings import MeetingListResponse, MeetingOut

router = APIRouter()


@router.get("", response_model=MeetingListResponse)
async def list_meetings(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> MeetingListResponse:
    stmt = (
        select(Meeting, Schedule)
        .join(Schedule, Meeting.schedule_id == Schedule.id)
        .where(Schedule.user_id == user_id)
        .order_by(Schedule.start_time)
    )
    rows = (await db.execute(stmt)).all()

    results = [
        MeetingOut(
            id=meeting.id,
            schedule_id=schedule.id,
            title=schedule.title,
            start_time=schedule.start_time,
            end_time=schedule.end_time,
            location=schedule.location,
            status=schedule.status,
            participants=meeting.participants,
            summary=meeting.summary,
            notes=meeting.notes,
            created_at=meeting.created_at,
        )
        for meeting, schedule in rows
    ]
    return MeetingListResponse(results=results)
