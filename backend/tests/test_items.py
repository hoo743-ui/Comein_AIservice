"""POST /api/items — 카테고리(일정/할일/메모/회의)별 실제 DB 저장 확인.

AI팀 파싱 API가 아직 없으므로, 그 결과물로 예상되는 mock JSON(ParsedItem)을
그대로 요청 본문에 넣어 저장 로직만 검증한다.
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Memo, Meeting, Schedule, Todo, User


async def test_create_schedule_item(client: AsyncClient, db_session: AsyncSession, test_user: User):
    payload = {
        "user_id": str(test_user.id),
        "items": [
            {
                "category": "schedule",
                "title": "교수님 미팅",
                "start": "2026-08-04T15:00:00",
                "end": "2026-08-04T16:00:00",
                "location": "공학관 401",
            }
        ],
    }

    resp = await client.post("/api/items", json=payload)

    assert resp.status_code == 200
    result = resp.json()["results"][0]
    assert result["category"] == "schedule"

    schedule = await db_session.scalar(select(Schedule).where(Schedule.id == uuid.UUID(result["id"])))
    assert schedule is not None
    assert schedule.title == "교수님 미팅"
    assert schedule.location == "공학관 401"
    assert schedule.status == "pending"
    assert schedule.user_id == test_user.id


async def test_create_todo_item(client: AsyncClient, db_session: AsyncSession, test_user: User):
    payload = {
        "user_id": str(test_user.id),
        "items": [
            {
                "category": "todo",
                "title": "발표자료 준비",
                "due": "2026-08-05T23:59:00",
                "priority": "high",
            }
        ],
    }

    resp = await client.post("/api/items", json=payload)

    assert resp.status_code == 200
    result = resp.json()["results"][0]
    assert result["category"] == "todo"

    todo = await db_session.scalar(select(Todo).where(Todo.id == uuid.UUID(result["id"])))
    assert todo is not None
    assert todo.title == "발표자료 준비"
    assert todo.priority == "high"
    assert todo.status == "todo"
    assert todo.user_id == test_user.id


async def test_create_memo_item(client: AsyncClient, db_session: AsyncSession, test_user: User):
    payload = {
        "user_id": str(test_user.id),
        "items": [
            {
                "category": "memo",
                "title": "아이디어",
                "content": "워크스페이스 온보딩에 문 여는 연출 추가하기",
                "tags": ["아이디어", "온보딩"],
            }
        ],
    }

    resp = await client.post("/api/items", json=payload)

    assert resp.status_code == 200
    result = resp.json()["results"][0]
    assert result["category"] == "memo"

    memo = await db_session.scalar(select(Memo).where(Memo.id == uuid.UUID(result["id"])))
    assert memo is not None
    assert memo.content == "워크스페이스 온보딩에 문 여는 연출 추가하기"
    assert memo.tags == ["아이디어", "온보딩"]
    assert memo.user_id == test_user.id


async def test_create_meeting_item(client: AsyncClient, db_session: AsyncSession, test_user: User):
    payload = {
        "user_id": str(test_user.id),
        "items": [
            {
                "category": "meeting",
                "title": "주간 통합 테스트 미팅",
                "start": "2026-08-06T10:00:00",
                "participants": ["정우", "AI A", "AI B", "풀스택"],
                "summary": "E2E 시퀀스 점검 완료, 이슈 3건 발견",
                "notes": "1) 캘린더 충돌감지 확인 2) 메모 태그 자동화 확인",
            }
        ],
    }

    resp = await client.post("/api/items", json=payload)

    assert resp.status_code == 200
    result = resp.json()["results"][0]
    assert result["category"] == "meeting"

    meeting = await db_session.scalar(select(Meeting).where(Meeting.id == uuid.UUID(result["id"])))
    assert meeting is not None
    assert meeting.participants == ["정우", "AI A", "AI B", "풀스택"]
    assert meeting.summary == "E2E 시퀀스 점검 완료, 이슈 3건 발견"

    # Schedule ─ Meeting 1:1 — 연결된 일정도 생성되어야 한다 (CLAUDE.md §7 ERD)
    schedule = await db_session.scalar(select(Schedule).where(Schedule.id == meeting.schedule_id))
    assert schedule is not None
    assert schedule.title == "주간 통합 테스트 미팅"
    assert schedule.status == "confirmed"
    assert schedule.user_id == test_user.id


async def test_unknown_user_returns_404(client: AsyncClient, db_session: AsyncSession):
    payload = {
        "user_id": str(uuid.uuid4()),
        "items": [{"category": "todo", "title": "존재하지 않는 유저"}],
    }

    resp = await client.post("/api/items", json=payload)

    assert resp.status_code == 404
