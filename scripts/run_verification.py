#!/usr/bin/env python3
"""Comein · 자연어 파싱 정확도 검증 — 배포된 /api/chat 을 상대로 채점한다.

무엇을 재는가
-------------
`scripts/verification_cases.json` 의 100개 문장을 실제 배포 서버(기본값: Render)의
`POST /api/chat` 에 그대로 보내고, 돌아온 `AiResult` 를 정답지와 항목 단위로 맞춰 본다.

왜 배포 서버인가
---------------
pytest(`backend/tests/`)는 LLM 을 목업으로 갈아 끼운다 — 그쪽이 재는 것은 "우리 코드가
계약을 지키는가" 다. 여기서 재려는 것은 그 앞의 질문, **"모델이 한국어를 제대로
읽는가"** 이고 그건 진짜 모델을 불러 봐야만 알 수 있다. 그래서 이 스크립트는 테스트
스위트가 아니라 계측기다 — CI 에 넣지 않는다(LLM 쿼터를 쓰고, 네트워크에 매인다).

왜 `context.now` 를 고정하는가
-----------------------------
'내일'·'다음 주 화요일' 의 정답은 오늘이 언제냐에 따라 달라진다. 화면은 늘 자기가 아는
`now`·`tz` 를 함께 보내므로(`frontend/src/lib/api.ts`), 여기서도 정답지의 `anchor` 를
그대로 보낸다. 그래서 **다음 달에 돌려도 같은 정답지로 채점된다.**

채점 규칙 (expect.kind)
----------------------
    item          항목을 세워야 한다. category ∈ 기대 목록이고 start 가 분 단위까지
                  같은 항목이 하나라도 있으면 통과. end·participants 는 적혀 있을 때만 본다.
    ask           지어낼 수 없는 값이 비었다 → items 는 비고 ask 한 줄이 와야 통과.
    no_new_item   지금 지원하지 않는 요청 → 없는 일정을 만들어 내지 않으면 통과.
                  (되묻든 대화로 받아넘기든 상관없다. **지어내지만 않으면 된다.**)

쓰는 법
------
    python scripts/run_verification.py                     # 배포 서버로
    python scripts/run_verification.py --base-url http://127.0.0.1:8000
    python scripts/run_verification.py --only ask,edge     # 한 갈래만
    python scripts/run_verification.py --out result.json   # 원본 응답까지 저장

의존성 없음 — 표준 라이브러리만 쓴다(`urllib`). 어느 컴퓨터에서든 클론하고 바로 돈다.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

DEFAULT_BASE_URL = "https://comein-aiservice.onrender.com"
CASES_PATH = Path(__file__).with_name("verification_cases.json")

# 콜드스타트. Render 무료는 15분 무요청이면 자고, 첫 응답이 20초를 넘긴다(docs/15 §4).
# 첫 요청만 넉넉히 기다리고, 그 뒤로는 평소 상한으로 돌아간다.
WAKE_TIMEOUT = 90
CALL_TIMEOUT = 60


# ── 시각 비교 ────────────────────────────────────────────
# 모델은 "2026-08-25T14:00:00+09:00" 으로도, "2026-08-25T14:00:00" 으로도 답한다.
# 우리가 묻는 것은 '몇 월 며칠 몇 시 몇 분' 하나뿐이라, 거기까지만 잘라 맞춘다.
# (시간대를 붙여 왔으면 KST 로 옮긴 뒤 자른다 — UTC 로 답한 것을 틀렸다고 하면 안 된다.)

KST = timezone(timedelta(hours=9))


def to_kst_minute(raw: str | None) -> str | None:
    """ISO 문자열 → 'YYYY-MM-DDTHH:MM' (KST). 못 읽으면 None."""
    if not isinstance(raw, str) or not raw.strip():
        return None
    s = raw.strip().replace(" ", "T")
    s = re.sub(r"Z$", "+00:00", s)
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(KST).replace(tzinfo=None)
    return dt.strftime("%Y-%m-%dT%H:%M")


def names_contain(got: Any, wanted: list[str]) -> bool:
    """참여자는 부분 일치로 본다 — '시현이'·'박시현' 모두 '시현' 을 만족한다."""
    if not isinstance(got, list):
        return False
    blob = " ".join(str(g) for g in got)
    return all(w in blob for w in wanted)


# ── 채점 ─────────────────────────────────────────────────


def grade(case: dict, res: dict) -> tuple[bool, str]:
    """(통과 여부, 사유). 사유는 실패했을 때 사람이 읽을 한 줄."""
    exp = case["expect"]
    kind = exp["kind"]
    items = res.get("items") or []
    ask = (res.get("ask") or "").strip()

    if kind == "ask":
        if items:
            return False, f"되물어야 하는데 {len(items)}건을 세웠다"
        if not ask:
            return False, "항목도 질문도 없다"
        return True, ""

    if kind == "no_new_item":
        if items:
            titles = ", ".join(str(i.get("title")) for i in items)
            return False, f"없는 일정을 만들었다: {titles}"
        return True, ""

    # kind == "item"
    if not items:
        return False, f"항목이 없다 (ask={ask or '없음'})"

    want_cat = exp["category"]
    want_start = exp.get("start")
    want_end = exp.get("end")
    want_people = exp.get("participants")

    near_miss = []
    for it in items:
        cat = it.get("category")
        if cat not in want_cat:
            near_miss.append(f"갈래 {cat}")
            continue
        got_start = to_kst_minute(it.get("start") or it.get("due"))
        if want_start and got_start != want_start:
            near_miss.append(f"시각 {got_start}")
            continue
        if want_end:
            got_end = to_kst_minute(it.get("end"))
            if got_end != want_end:
                near_miss.append(f"끝 {got_end}")
                continue
        if want_people and not names_contain(it.get("participants"), want_people):
            near_miss.append(f"참여자 {it.get('participants')}")
            continue
        return True, ""

    return False, "기대 " + f"{'/'.join(want_cat)}@{want_start}" + " · 받은 " + (", ".join(near_miss) or "없음")


# ── 호출 ─────────────────────────────────────────────────


def call(base_url: str, message: str, now: str, tz: str, timeout: int) -> dict:
    body = json.dumps(
        {"message": message, "conversation_id": "verification", "context": {"now": now, "tz": tz}},
        ensure_ascii=False,
    ).encode("utf-8")
    req = urllib.request.Request(
        base_url.rstrip("/") + "/api/chat",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def wake(base_url: str) -> float:
    """자고 있으면 깨운다. 걸린 시간을 돌려준다 — 그 자체가 보고할 값이다(docs/15 §4)."""
    t0 = time.time()
    try:
        with urllib.request.urlopen(base_url.rstrip("/") + "/health", timeout=WAKE_TIMEOUT):
            pass
    except Exception as e:  # noqa: BLE001
        print(f"  ! /health 응답 없음: {e}", file=sys.stderr)
    return time.time() - t0


# ── 실행 ─────────────────────────────────────────────────


def main() -> int:
    # 윈도우 콘솔의 기본 코드페이지(cp949)는 ✓·─ 를 못 찍고 그 자리에서 죽는다.
    # 결과를 읽으려고 돌리는 물건이 출력 한 줄에 걸려 멈추면 안 된다.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
        except (AttributeError, OSError):
            pass

    p = argparse.ArgumentParser(description="Comein 자연어 파싱 정확도 검증")
    p.add_argument("--base-url", default=DEFAULT_BASE_URL)
    p.add_argument("--cases", type=Path, default=CASES_PATH)
    p.add_argument("--only", default="", help="갈래만 골라 돌린다 (예: ask,edge)")
    p.add_argument("--ids", default="", help="케이스 id 만 골라 돌린다 (예: C25,D06)")
    p.add_argument("--workers", type=int, default=4, help="동시 요청 수 (쿼터를 아끼려면 1)")
    p.add_argument("--out", type=Path, default=None, help="원본 응답까지 JSON 으로 저장")
    args = p.parse_args()

    spec = json.loads(args.cases.read_text(encoding="utf-8"))
    anchor, tz, groups = spec["anchor"], spec["tz"], spec["groups"]
    cases = spec["cases"]
    if args.only:
        keep = {g.strip() for g in args.only.split(",") if g.strip()}
        cases = [c for c in cases if c["group"] in keep]
    if args.ids:
        want = {i.strip().upper() for i in args.ids.split(",") if i.strip()}
        cases = [c for c in cases if c["id"].upper() in want]

    print(f"대상   {args.base_url}")
    print(f"기준시 {anchor} ({tz})")
    print(f"케이스 {len(cases)}건 · 동시 {args.workers}\n")

    print("깨우는 중…", end=" ", flush=True)
    woke = wake(args.base_url)
    print(f"{woke:.1f}초\n")

    rows: list[dict] = []

    def run(case: dict) -> dict:
        try:
            res = call(args.base_url, case["message"], anchor, tz, CALL_TIMEOUT)
            ok, why = grade(case, res)
        except Exception as e:  # noqa: BLE001
            res, ok, why = {"_error": str(e)}, False, f"호출 실패: {e}"
        return {**case, "response": res, "pass": ok, "why": why}

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        for r in pool.map(run, cases):
            rows.append(r)
            print(f"  {'✓' if r['pass'] else '✗'} {r['id']}  {r['message'][:34]:<36} {r['why']}")

    # ── 집계 ──
    print("\n" + "─" * 72)
    print(f"{'갈래':<22}{'n':>5}{'통과':>7}{'정확도':>10}")
    print("─" * 72)
    summary = {}
    for key, label in groups.items():
        g = [r for r in rows if r["group"] == key]
        if not g:
            continue
        hit = sum(1 for r in g if r["pass"])
        acc = hit / len(g) * 100
        summary[key] = {"label": label, "n": len(g), "pass": hit, "accuracy": round(acc, 1)}
        print(f"{label:<22}{len(g):>5}{hit:>7}{acc:>9.1f}%")
    total_hit = sum(1 for r in rows if r["pass"])
    total_acc = total_hit / len(rows) * 100 if rows else 0.0
    print("─" * 72)
    print(f"{'전체':<22}{len(rows):>5}{total_hit:>7}{total_acc:>9.1f}%")

    fails = [r for r in rows if not r["pass"]]
    if fails:
        print(f"\n실패 {len(fails)}건")
        for r in fails:
            print(f"  {r['id']} [{groups[r['group']]}] {r['message']}\n      → {r['why']}")

    if args.out:
        args.out.write_text(
            json.dumps(
                {
                    "base_url": args.base_url,
                    "anchor": anchor,
                    "cold_start_sec": round(woke, 1),
                    "total": {"n": len(rows), "pass": total_hit, "accuracy": round(total_acc, 1)},
                    "groups": summary,
                    "cases": rows,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        print(f"\n기록 {args.out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
