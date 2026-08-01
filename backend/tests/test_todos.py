"""GET /api/todos — user_id 및 status 필터 조회 확인."""
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Todo, User


async def test_list_todos_by_user(client: AsyncClient, db_session: AsyncSession, test_user: User):
    db_session.add_all(
        [
            Todo(user_id=test_user.id, title="발표자료 준비", priority="high", status="todo"),
            Todo(user_id=test_user.id, title="장보기", priority="low", status="done"),
        ]
    )
    await db_session.commit()

    resp = await client.get("/api/todos", params={"user_id": str(test_user.id)})

    assert resp.status_code == 200
    assert len(resp.json()["results"]) == 2


async def test_list_todos_filtered_by_status(client: AsyncClient, db_session: AsyncSession, test_user: User):
    db_session.add_all(
        [
            Todo(user_id=test_user.id, title="발표자료 준비", priority="high", status="todo"),
            Todo(user_id=test_user.id, title="장보기", priority="low", status="done"),
        ]
    )
    await db_session.commit()

    resp = await client.get("/api/todos", params={"user_id": str(test_user.id), "status": "done"})

    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 1
    assert results[0]["title"] == "장보기"
