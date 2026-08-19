// Comein · 겹치는 시간 — 물어야 할 것과 물어선 안 될 것
//
// 이 규칙의 어려운 쪽은 "언제 묻는가" 가 아니라 **"언제 묻지 않는가"** 다.
// 겹쳤다고 매번 물으면 비서가 아니라 알림이 되고, 알림은 곧 꺼진다.
// 그 선은 눈으로 좇기 어려워서 여기 못 박는다.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clashAsk, findClash, overlaps } from "./clash";
import type { Schedule } from "./types";

const NOW = new Date("2026-08-19T10:00:00+09:00");
const at = (h: number, mins = 60, priority?: Schedule["priority"], id = `e${h}`): Schedule => ({
  id,
  title: `${h}시 자리`,
  start: new Date(`2026-08-19T${String(h).padStart(2, "0")}:00:00+09:00`).toISOString(),
  end: new Date(`2026-08-19T${String(h).padStart(2, "0")}:00:00+09:00`).getTime() + mins * 60_000
    ? new Date(new Date(`2026-08-19T${String(h).padStart(2, "0")}:00:00+09:00`).getTime() + mins * 60_000).toISOString()
    : undefined,
  status: "confirmed",
  priority,
});

describe("겹침 판정", () => {
  it("맞닿은 것은 겹친 것이 아니다", () => {
    // 14:00–15:00 과 15:00–16:00 은 이어지는 하루이지 부딪힘이 아니다.
    assert.equal(overlaps(at(14), at(15)), false);
  });

  it("끝 시각이 없으면 한 시간으로 본다 — 화면이 일정을 세울 때와 같은 가정", () => {
    const noEnd = { start: at(14).start };
    assert.equal(overlaps(noEnd, at(14, 30)), true);
    assert.equal(overlaps(noEnd, at(15)), false);
  });

  it("지난 일정과는 부딪히지 않는다", () => {
    // 이미 끝난 시간을 두고 "겹쳐요" 라고 말하는 것은 사실도 아니고 도움도 안 된다.
    const c = findClash({ incoming: { start: at(8).start, end: at(8, 120).end }, existing: [at(8)], now: NOW });
    assert.equal(c, null);
  });

  it("자기 자신과는 겹치지 않는다", () => {
    const mine = at(14, 60, "high", "same");
    const c = findClash({ incoming: { ...mine, id: "same" }, existing: [mine], now: NOW });
    assert.equal(c, null);
  });
});

describe("무엇을 물을 것인가", () => {
  it("둘 다 아무도 중요도를 말하지 않았으면 묻지 않는다", () => {
    // 근거 없이 묻는 것은 묻지 않는 것보다 나쁘다 — 답할 수 없는 질문을 받으면
    // 그 다음 질문도 믿지 않게 된다. 사람은 겹치는 자리를 일부러 잡기도 한다.
    const c = findClash({ incoming: { start: at(14).start, end: at(14).end }, existing: [at(14)], now: NOW });
    assert.equal(c?.weight, "same");
    assert.equal(clashAsk(c), null);
  });

  it("같은 중요도끼리도 묻지 않는다", () => {
    const c = findClash({
      incoming: { start: at(14).start, end: at(14).end, priority: "high" },
      existing: [at(14, 60, "high")], now: NOW,
    });
    assert.equal(clashAsk(c), null);
  });

  it("더 중요한 자리를 건드리면 그 이름을 대고 묻는다", () => {
    const c = findClash({
      incoming: { start: at(14).start, end: at(14).end, priority: "low" },
      existing: [at(14, 60, "high")], now: NOW,
    });
    assert.equal(c?.weight, "lower");
    assert.match(clashAsk(c) ?? "", /더 중요한 "14시 자리"/);
  });

  it("덜 중요한 자리와 겹치면 그렇다고 말한다", () => {
    const c = findClash({
      incoming: { start: at(14).start, end: at(14).end, priority: "high" },
      existing: [at(14, 60, "low")], now: NOW,
    });
    assert.equal(c?.weight, "higher");
    assert.match(clashAsk(c) ?? "", /덜 중요한/);
  });

  it("여럿과 겹치면 가장 무거운 것을 대표로 세우고 수를 함께 말한다", () => {
    const c = findClash({
      incoming: { start: at(14, 180).start, end: at(14, 180).end, priority: "low" },
      existing: [at(14, 60, "mid", "a"), at(15, 60, "high", "b"), at(16, 60, "low", "c")],
      now: NOW,
    });
    assert.equal(c?.count, 3);
    assert.equal(c?.with.id, "b", "가장 중요한 것이 대표로 선다");
    assert.match(clashAsk(c) ?? "", /외 2건/);
  });

  it("영어로 물으면 영어로 답한다", () => {
    const c = findClash({
      incoming: { start: at(14).start, end: at(14).end, priority: "low" },
      existing: [at(14, 60, "high")], now: NOW,
    });
    assert.match(clashAsk(c, true) ?? "", /more important/);
  });
});
