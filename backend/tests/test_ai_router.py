"""ai/router.py 의 '지금'과 '직전 질문' — 프롬프트에 실려 나가기 전의 판단만 검증한다.

LLM 호출은 여기서 하지 않는다. 검증하는 것은 그 앞의 두 결정이다:
    - 화면이 보낸 시각을 믿을 것인가(믿을 수 없으면 서버 시계로 물러난다)
    - 직전에 되물은 질문을 이번 메시지에 이어 붙일 것인가

`ai/` 에는 아직 테스트 자리가 없어서 백엔드의 pytest 설정을 빌려 여기 둔다.
AI 쪽에 테스트 체계가 서면 그때 옮긴다.
"""
import os
import sys

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from ai.router import _now_iso, _pending_block


def test_now_falls_back_to_server_clock_without_context():
    now, where = _now_iso(None)
    assert now.endswith("+09:00")
    assert "Korea" in where


def test_now_trusts_the_screen_when_it_carries_an_offset():
    now, where = _now_iso({"now": "2026-08-12T16:40:00-07:00", "tz": "America/Los_Angeles"})
    assert now == "2026-08-12T16:40:00-07:00"
    assert "America/Los_Angeles" in where


def test_now_accepts_the_z_suffix_the_browser_actually_sends():
    # toISOString() 은 언제나 'Z' 로 끝난다. 파이썬 3.10 의 fromisoformat 은 그걸 모른다.
    now, _ = _now_iso({"now": "2026-08-12T07:40:00Z", "tz": "UTC"})
    assert now == "2026-08-12T07:40:00+00:00"


def test_now_ignores_a_time_without_a_timezone():
    """오프셋이 없으면 어느 시각인지 알 수 없다 — 그건 믿을 수 없는 값이다."""
    now, where = _now_iso({"now": "2026-08-12T16:40:00"})
    assert now != "2026-08-12T16:40:00"
    assert "Korea" in where


def test_now_ignores_garbage():
    now, where = _now_iso({"now": "내일쯤", "tz": "Asia/Seoul"})
    assert "Korea" in where
    assert now.endswith("+09:00")


def test_pending_block_is_empty_without_a_question():
    assert _pending_block(None) == ""
    assert _pending_block({}) == ""
    assert _pending_block({"pending": {"ask": "언제로 잡을까요?"}}) == ""  # 원래 말이 없다
    assert _pending_block({"pending": {"message": "회의 잡아줘"}}) == ""  # 질문이 없다


def test_pending_block_carries_both_sides_of_the_exchange():
    block = _pending_block({"pending": {"message": "회의 잡아줘", "ask": "언제로 잡을까요?"}})
    assert "회의 잡아줘" in block
    assert "언제로 잡을까요?" in block
    assert "ANSWER" in block
