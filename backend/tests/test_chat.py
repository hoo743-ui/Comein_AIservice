"""POST /api/chat — AI 파싱 결과 검증/보정 로직 확인.

ai.router.route()의 실제 반환 형태는 아직 확정 전(AI팀 작업 중)이므로,
여기서는 chat.py가 import한 ai_route를 목업으로 대체해 검증/폴백 로직만 검증한다.
"""
import pytest
from httpx import AsyncClient

import app.api.endpoints.chat as chat_module


async def test_chat_returns_valid_ai_result(client: AsyncClient, monkeypatch: pytest.MonkeyPatch):
    async def fake_route(message: str, user_id: str, context=None):
        return {
            "user_id": user_id,
            "items": [
                {
                    "category": "schedule",
                    "title": "교수님 미팅",
                    "start": "2026-08-04T15:00:00",
                }
            ],
        }

    monkeypatch.setattr(chat_module, "ai_route", fake_route)

    resp = await client.post("/api/chat", json={"message": "다음 주 화요일 3시에 교수님 미팅"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["intent"] == "schedule"
    assert len(body["items"]) == 1
    assert body["items"][0]["title"] == "교수님 미팅"


async def test_chat_falls_back_on_validation_error(client: AsyncClient, monkeypatch: pytest.MonkeyPatch):
    async def fake_route(message: str, user_id: str, context=None):
        # schedule 카테고리인데 필수 필드(start)가 없어 ParsedItem 검증에 실패해야 한다.
        return {"user_id": user_id, "items": [{"category": "schedule", "title": "제목만 있음"}]}

    monkeypatch.setattr(chat_module, "ai_route", fake_route)

    resp = await client.post("/api/chat", json={"message": "애매한 문장"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["intent"] == "chat"
    assert body["reply"] == "정확히 파악하지 못했어요. 다시 말씀해주시겠어요?"
    assert body["items"] == []


async def test_chat_falls_back_on_unexpected_error(client: AsyncClient, monkeypatch: pytest.MonkeyPatch):
    async def fake_route(message: str, user_id: str, context=None):
        raise RuntimeError("LLM provider unavailable")

    monkeypatch.setattr(chat_module, "ai_route", fake_route)

    resp = await client.post("/api/chat", json={"message": "아무 말"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["intent"] == "chat"
    assert body["reply"] == "일시적인 오류가 발생했어요."
    assert body["items"] == []


async def test_chat_no_items_defaults_to_chat_intent(client: AsyncClient, monkeypatch: pytest.MonkeyPatch):
    async def fake_route(message: str, user_id: str, context=None):
        return {"user_id": user_id, "items": []}

    monkeypatch.setattr(chat_module, "ai_route", fake_route)

    resp = await client.post("/api/chat", json={"message": "안녕"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["intent"] == "chat"
    assert body["items"] == []
