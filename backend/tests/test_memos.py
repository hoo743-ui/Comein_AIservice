"""GET /api/memos — user_id 기준 조회 확인."""
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Memo, User


async def test_list_memos_by_user(client: AsyncClient, db_session: AsyncSession, test_user: User):
    db_session.add(
        Memo(user_id=test_user.id, title="아이디어", content="워크스페이스 온보딩에 문 여는 연출 추가하기", tags=["아이디어", "온보딩"])
    )
    await db_session.commit()

    resp = await client.get("/api/memos", params={"user_id": str(test_user.id)})

    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 1
    assert results[0]["content"] == "워크스페이스 온보딩에 문 여는 연출 추가하기"
    assert results[0]["tags"] == ["아이디어", "온보딩"]
