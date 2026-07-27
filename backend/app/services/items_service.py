"""JSON 추출 결과(ParsedItem) → 카테고리별 테이블 저장.

흐름: 텍스트 → (AI팀 파싱 API, 미구현) → ParsedItem[] → 이 서비스.
AI팀 API가 준비되면 `ParsedItem` 리스트를 만들어 `create_items_from_parsed`를
호출하는 지점만 새로 연결하면 된다(app/api/endpoints/items.py 참고).
"""
import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Memo, Meeting, Schedule, Todo
from app.schemas.items import ItemResult, ParsedItem


def _parse_dt(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value)


async def _save_schedule(db: AsyncSession, user_id: uuid.UUID, item: ParsedItem) -> ItemResult:
    schedule = Schedule(
        user_id=user_id,
        title=item.title,
        start_time=_parse_dt(item.start),
        end_time=_parse_dt(item.end),
        location=item.location,
        status="pending",  # AI 제안 → 사용자 확정 전 (CLAUDE.md §7)
    )
    db.add(schedule)
    await db.flush()
    return ItemResult(category="schedule", id=schedule.id, title=schedule.title)


async def _save_todo(db: AsyncSession, user_id: uuid.UUID, item: ParsedItem) -> ItemResult:
    todo = Todo(
        user_id=user_id,
        title=item.title,
        due_date=_parse_dt(item.due),
        priority=item.priority or "mid",
        status="todo",
    )
    db.add(todo)
    await db.flush()
    return ItemResult(category="todo", id=todo.id, title=todo.title)


async def _save_memo(db: AsyncSession, user_id: uuid.UUID, item: ParsedItem) -> ItemResult:
    memo = Memo(
        user_id=user_id,
        title=item.title,
        content=item.content,
        tags=item.tags or [],
    )
    db.add(memo)
    await db.flush()
    return ItemResult(category="memo", id=memo.id, title=memo.title)


async def _save_meeting(db: AsyncSession, user_id: uuid.UUID, item: ParsedItem) -> ItemResult:
    # Schedule ─ Meeting은 1:1(CLAUDE.md §7 ERD) — 제목/시각은 Schedule 쪽에 저장.
    schedule = Schedule(
        user_id=user_id,
        title=item.title,
        start_time=_parse_dt(item.start),
        end_time=_parse_dt(item.end),
        status="confirmed",  # 회의록 기반 저장이므로 제안이 아닌 확정 일정으로 취급
    )
    db.add(schedule)
    await db.flush()

    meeting = Meeting(
        schedule_id=schedule.id,
        participants=item.participants or [],
        summary=item.summary,
        notes=item.notes or item.content,
    )
    db.add(meeting)
    await db.flush()
    return ItemResult(category="meeting", id=meeting.id, title=schedule.title)


_SAVE_FUNCS = {
    "schedule": _save_schedule,
    "todo": _save_todo,
    "memo": _save_memo,
    "meeting": _save_meeting,
}


async def create_item_from_parsed(
    db: AsyncSession, user_id: uuid.UUID, item: ParsedItem
) -> ItemResult:
    """category 값을 보고 알맞은 저장 함수로 분기한다."""
    return await _SAVE_FUNCS[item.category](db, user_id, item)


async def create_items_from_parsed(
    db: AsyncSession, user_id: uuid.UUID, items: list[ParsedItem]
) -> list[ItemResult]:
    results = [await create_item_from_parsed(db, user_id, item) for item in items]
    await db.commit()
    return results
