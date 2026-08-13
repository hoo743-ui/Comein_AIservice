"""테스트 공통 픽스처.

예전에는 SQLite 인메모리 DB 에 `Base.metadata` 를 세워 `POST /api/items` 를
엔드투엔드로 검증했다. 그 경로가 사라진 뒤로는 세울 것이 없다 — 남은
엔드포인트(`/api/chat`·`/api/summary`)는 상태를 두지 않으므로, 앱에 붙는
클라이언트 하나면 충분하다.
"""
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
