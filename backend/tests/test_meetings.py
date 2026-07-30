"""GET /api/meetings — Schedule과 join된 회의 조회 확인."""
from datetime import datetime

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Meeting, Schedule, User


async def test_list_meetings_by_user(client: AsyncClient, db_session: AsyncSession, test_user: User):
    schedule = Schedule(
        user_id=test_user.id,
        title="주간 통합 테스트 미팅",
        start_time=datetime(2026, 8, 6, 10, 0),
        status="confirmed",
    )
    db_session.add(schedule)
    await db_session.flush()

    meeting = Meeting(
        schedule_id=schedule.id,
        participants=["정우", "AI A", "AI B", "풀스택"],
        summary="E2E 시퀀스 점검 완료, 이슈 3건 발견",
        notes="1) 캘린더 충돌감지 확인 2) 메모 태그 자동화 확인",
    )
    db_session.add(meeting)
    await db_session.commit()

    resp = await client.get("/api/meetings", params={"user_id": str(test_user.id)})

    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 1
    result = results[0]
    assert result["title"] == "주간 통합 테스트 미팅"
    assert result["schedule_id"] == str(schedule.id)
    assert result["participants"] == ["정우", "AI A", "AI B", "풀스택"]
    assert result["summary"] == "E2E 시퀀스 점검 완료, 이슈 3건 발견"
