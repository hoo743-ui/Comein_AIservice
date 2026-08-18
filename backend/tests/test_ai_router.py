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


# ── 새벽으로 잡힌 시각 ──────────────────────────────────────────────
# 프롬프트에 "맨 시각은 깨어 있는 쪽으로" 를 적어 두었지만, 프롬프트는 부탁이지
# 보장이 아니다. 배포본에서 여섯 번에 한 번은 "내일 3시" 가 새벽 세 시로 왔다.
# 여기서 검증하는 것은 그 뒤를 받는 결정론적인 자리다.

from ai.router import ParseResponse, _fix_small_hours, _said_small_hours


def _resp(**item) -> ParseResponse:
    return ParseResponse(user_id="u", items=[{"category": "meeting", "title": "미팅", **item}])


def test_bare_hour_at_dawn_moves_to_the_afternoon():
    r = _resp(start="2026-08-15T03:00:00+09:00")
    _fix_small_hours(r, "내일 3시 교수님 미팅")
    assert r.items[0].start.startswith("2026-08-15T15:00:00")


def test_what_the_user_actually_said_is_left_alone():
    for said in ("내일 새벽 3시 배포", "내일 밤 3시 배포", "deploy at 3am", "오전 3시 배포"):
        r = _resp(start="2026-08-15T03:00:00+09:00")
        _fix_small_hours(r, said)
        assert r.items[0].start.startswith("2026-08-15T03:00:00"), said


def test_daytime_hours_are_never_touched():
    for hour in ("06:00:00", "09:00:00", "15:00:00", "23:30:00"):
        r = _resp(start=f"2026-08-15T{hour}+09:00")
        _fix_small_hours(r, "내일 회의")
        assert hour in r.items[0].start


def test_the_end_follows_the_start_by_the_same_amount():
    r = _resp(start="2026-08-15T03:00:00+09:00", end="2026-08-15T04:00:00+09:00")
    _fix_small_hours(r, "내일 3시 회의")
    assert r.items[0].start.startswith("2026-08-15T15:00:00")
    assert r.items[0].end.startswith("2026-08-15T16:00:00")


def test_a_night_crossing_event_does_not_get_its_end_flipped():
    # 23:00~01:00. 시작이 움직이지 않았으므로 끝도 그대로다 —
    # 끝만 따로 판단하면 01:00 이 13:00 으로 튀어 앞뒤가 뒤집힌다.
    r = _resp(start="2026-08-15T23:00:00+09:00", end="2026-08-16T01:00:00+09:00")
    _fix_small_hours(r, "내일 밤샘 작업")
    assert r.items[0].start.startswith("2026-08-15T23:00:00")
    assert r.items[0].end.startswith("2026-08-16T01:00:00")


def test_a_todo_due_at_dawn_moves_too():
    r = ParseResponse(user_id="u", items=[{"category": "todo", "title": "자료 정리", "due": "2026-08-15T02:00:00+09:00"}])
    _fix_small_hours(r, "내일 2시까지 자료 정리")
    assert r.items[0].due.startswith("2026-08-15T14:00:00")


def test_midnight_said_plainly_is_still_midnight():
    r = _resp(start="2026-08-15T00:00:00+09:00")
    _fix_small_hours(r, "내일 자정에 배포")
    assert r.items[0].start.startswith("2026-08-15T00:00:00")


def test_a_broken_timestamp_is_left_as_it_is():
    r = _resp(start="내일 오후")
    _fix_small_hours(r, "내일 3시 회의")
    assert r.items[0].start == "내일 오후"


def test_marker_detection_is_case_insensitive():
    assert _said_small_hours("deploy at 3AM")
    assert _said_small_hours("Midnight release")
    assert not _said_small_hours("meeting at 3")
