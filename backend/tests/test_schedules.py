"""GET /api/schedules — user_id 및 기간(from/to) 필터 조회 확인."""
from datetime import datetime

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Schedule, User


async def test_list_schedules_by_user(client: AsyncClient, db_session: AsyncSession, test_user: User):
    db_session.add_all(
        [
            Schedule(user_id=test_user.id, title="교수님 미팅", start_time=datetime(2026, 8, 4, 15, 0), status="pending"),
            Schedule(user_id=test_user.id, title="스터디", start_time=datetime(2026, 8, 5, 10, 0), status="confirmed"),
        ]
    )
    await db_session.commit()

    resp = await client.get("/api/schedules", params={"user_id": str(test_user.id)})

    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 2
    assert {r["title"] for r in results} == {"교수님 미팅", "스터디"}


async def test_list_schedules_filtered_by_period(client: AsyncClient, db_session: AsyncSession, test_user: User):
    db_session.add_all(
        [
            Schedule(user_id=test_user.id, title="이전 일정", start_time=datetime(2026, 8, 1, 9, 0), status="pending"),
            Schedule(user_id=test_user.id, title="기간 내 일정", start_time=datetime(2026, 8, 10, 9, 0), status="pending"),
        ]
    )
    await db_session.commit()

    resp = await client.get(
        "/api/schedules",
        params={"user_id": str(test_user.id), "from": "2026-08-05T00:00:00", "to": "2026-08-15T00:00:00"},
    )

    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 1
    assert results[0]["title"] == "기간 내 일정"


async def test_list_schedules_empty_for_other_user(client: AsyncClient, db_session: AsyncSession, test_user: User):
    db_session.add(Schedule(user_id=test_user.id, title="교수님 미팅", start_time=datetime(2026, 8, 4, 15, 0)))
    await db_session.commit()

    other_user = User(email="other@comein.dev", name="Other")
    db_session.add(other_user)
    await db_session.commit()
    await db_session.refresh(other_user)

    resp = await client.get("/api/schedules", params={"user_id": str(other_user.id)})

    assert resp.status_code == 200
    assert resp.json()["results"] == []
