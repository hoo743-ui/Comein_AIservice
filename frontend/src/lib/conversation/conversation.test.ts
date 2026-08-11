// Comein · 대화 엔진 시나리오 시험
//
// 새 의존성 없이 돈다 — Node 가 가진 것만 쓴다:  npm test
// (테스트 러너를 하나 더 깔지 않는다. §19 · §45)

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyzeConversation } from "./index";
import { analyzeMessage } from "./intent";
import { commonSlots, freeForAll } from "./availability";
import { emptyMemory, foldConversation, reduceConversation } from "./state";
import { readClock, readConstraints, readDay } from "./temporal";
import { summarize } from "./summary";
import { acceptanceRate, resetMetrics, setMetricSink, snapshot, track } from "./metrics";

/** 시험은 늘 같은 '지금' 위에서 돈다 — 2026-08-11(화) 10:00 */
const NOW = new Date(2026, 7, 11, 10, 0, 0, 0);
const at = (day: number, h: number, m = 0) => new Date(2026, 7, day, h, m, 0, 0);
const iso = (day: number, h: number, m = 0) => at(day, h, m).toISOString();
const busy = (day: number, from: number, to: number) => ({ start: iso(day, from), end: iso(day, to) });
const say = (...texts: string[]) => texts.map((text, i) => ({ id: `m${i}`, text }));

// ── 시간 읽기 ──────────────────────────────────────────

describe("temporal", () => {
  it("날짜말을 읽는다", () => {
    assert.equal(readDay("내일 보자", NOW)?.day.getDate(), 12);
    assert.equal(readDay("모레 어때", NOW)?.day.getDate(), 13);
    assert.equal(readDay("오늘 저녁", NOW)?.day.getDate(), 11);
  });

  it("요일은 늘 앞을 본다 — 지난 금요일을 잡지 않는다", () => {
    const fri = readDay("금요일에 보자", NOW)?.day;   // 2026-08-11 은 화요일
    assert.equal(fri?.getDate(), 14);
    // 같은 요일을 말하면 다음 주다("화요일에 보자"를 오늘로 읽지 않는다)
    assert.equal(readDay("화요일에 보자", NOW)?.day.getDate(), 18);
  });

  it("오전·오후를 안 붙인 한 자리 시각은 오후로 읽는다", () => {
    assert.equal(readClock("3시에 보자")?.hour, 15);
    assert.equal(readClock("오전 9시")?.hour, 9);
    assert.equal(readClock("9시")?.hour, 9);          // 9시는 그대로 오전
    assert.equal(readClock("15:00")?.hour, 15);       // 이미 24시간으로 말한 것은 건드리지 않는다
    assert.equal(readClock("오후 2시 30분")?.minute, 30);
  });

  it("이후·까지를 조건으로 구분한다", () => {
    assert.equal(readConstraints("내일 3시 이후 괜찮아", NOW)[0].kind, "after");
    assert.equal(readConstraints("내일 5시까지는 돼", NOW)[0].kind, "before");
    assert.equal(readConstraints("내일 3시에 보자", NOW)[0].kind, "at");
    assert.equal(readConstraints("내일 언제 볼까", NOW)[0].kind, "day");
  });
});

// ── 의도 ───────────────────────────────────────────────

describe("intent", () => {
  it("잡담에는 아무 뜻도 붙이지 않는다 (§34 값싼 거름망)", () => {
    for (const t of ["ㅋㅋㅋ", "ㅇㅇ", "🙂", "  "]) {
      assert.equal(analyzeMessage(t, NOW).intent, "chatter");
    }
  });

  it("시간이 나온다고 일정이 아니다 (§9)", () => {
    const a = analyzeMessage("내일 비 온대", NOW);
    assert.equal(a.intent, "chatter");
    const b = analyzeMessage("내일 3시에 수업 있어", NOW);
    assert.equal(b.intent, "chatter", "사실을 말한 것은 조율이 아니다");
  });

  it("조율하자는 신호가 있을 때만 일정 흐름을 켠다", () => {
    assert.equal(analyzeMessage("내일 언제 볼까?", NOW).intent, "scheduling_request");
    assert.equal(analyzeMessage("나는 3시 이후 괜찮아", NOW).intent, "availability");
    assert.equal(analyzeMessage("그럼 4시 어때?", NOW).intent, "proposal");
    assert.equal(analyzeMessage("좋아", NOW).intent, "acceptance");
    assert.equal(analyzeMessage("그때는 안 돼", NOW).intent, "rejection");
    assert.equal(analyzeMessage("오늘은 다음에 하자", NOW).intent, "cancellation");
  });
});

// ── 상태 ───────────────────────────────────────────────

describe("state", () => {
  it("거절된 시각은 후보에서 내려간다 (§8 같은 제안 반복 금지)", () => {
    let m = emptyMemory();
    m = reduceConversation(m, analyzeMessage("내일 언제 볼까?", NOW));
    m = reduceConversation(m, analyzeMessage("내일 3시 어때?", NOW));
    assert.equal(m.state, "time_proposed");
    assert.equal(m.proposed.length, 1);

    m = reduceConversation(m, analyzeMessage("그때는 안 돼", NOW));
    assert.equal(m.rejected.length, 1);
    assert.equal(m.proposed.length, 0, "거절된 자리는 후보에 남지 않는다");
    assert.equal(m.state, "collecting_preferences");
  });

  it("수락은 상에 올라온 것이 있을 때만 뜻이 산다", () => {
    const alone = reduceConversation(emptyMemory(), analyzeMessage("좋아", NOW));
    assert.equal(alone.state, "idle", "맥락 없는 '좋아'는 확정이 아니다");

    let m = foldConversation(say("내일 언제 볼까?", "내일 3시 어때?", "좋아"), (t) => analyzeMessage(t, NOW));
    assert.equal(m.state, "confirmed");
    assert.equal(m.confirmed, iso(12, 15));
  });

  it("확정 뒤 다시 조율하자고 하면 처음으로 돌아간다", () => {
    let m = foldConversation(say("내일 언제 볼까?", "내일 3시 어때?", "좋아"), (t) => analyzeMessage(t, NOW));
    m = reduceConversation(m, analyzeMessage("아 그런데 다시 언제 볼까?", NOW));
    assert.equal(m.state, "scheduling_detected");
    assert.equal(m.confirmed, undefined);
  });
});

// ── 가용 시간(결정론) ──────────────────────────────────

describe("availability", () => {
  it("바쁜 구간을 피해 후보를 낸다", () => {
    const slots = commonSlots({
      day: at(12, 0),
      durationMin: 60,
      participants: [[busy(12, 14, 15)], [busy(12, 16, 17)]],
      now: NOW,
    });
    const open = freeForAll(slots);
    assert.ok(open.length > 0);
    assert.ok(open.every((s) => {
      const h = new Date(s.start).getHours();
      return h !== 14 && h !== 16;
    }));
  });

  it("조건(3시 이후)을 지킨다", () => {
    const slots = commonSlots({
      day: at(12, 0),
      durationMin: 60,
      participants: [[], []],
      constraints: readConstraints("내일 3시 이후", NOW),
      now: NOW,
    });
    assert.ok(slots.every((s) => new Date(s.start).getHours() >= 15));
  });

  it("모두 되는 자리가 없으면 빈 손으로 돌아온다 — 지어내지 않는다", () => {
    const allDayBusy = [busy(12, 9, 22)];
    const slots = commonSlots({
      day: at(12, 0),
      durationMin: 60,
      participants: [allDayBusy, allDayBusy],
      now: NOW,
    });
    assert.equal(freeForAll(slots).length, 0);
  });
});

// ── 시나리오 (§42) ─────────────────────────────────────

describe("scenarios", () => {
  it("1. 서로 3시 이후가 되면 제안이 나온다", () => {
    const out = analyzeConversation({
      messages: say("내일 언제 볼까?", "나는 3시 이후 괜찮아"),
      participants: [[busy(12, 9, 12)], [busy(12, 10, 11)]],
      now: NOW,
    });
    assert.ok(out.suggestion, "제안이 있어야 한다");
    assert.ok(new Date(out.suggestion!.start).getHours() >= 15);
    assert.equal(out.suggestion!.reason.includes("가능"), true);
  });

  it("2. 공통 시간이 없으면 제안하지 않는다", () => {
    const full = [busy(12, 0, 24)];
    const out = analyzeConversation({
      messages: say("내일 언제 볼까?", "나는 3시 이후 괜찮아"),
      participants: [full, full],
      now: NOW,
    });
    assert.equal(out.suggestion, null);
  });

  it("3. 거절당한 시각을 다시 권하지 않는다", () => {
    const out = analyzeConversation({
      messages: say("내일 언제 볼까?", "내일 3시 어때?", "그때는 안 돼"),
      participants: [[], []],
      now: NOW,
    });
    assert.ok(out.memory.rejected.includes(iso(12, 15)));
    assert.notEqual(out.suggestion?.start, iso(12, 15));
  });

  it("4. 수락하면 확정 상태가 되고, 더는 권하지 않는다", () => {
    const out = analyzeConversation({
      messages: say("내일 언제 볼까?", "내일 3시 어때?", "좋아"),
      participants: [[], []],
      now: NOW,
    });
    assert.equal(out.memory.state, "confirmed");
    assert.equal(out.memory.confirmed, iso(12, 15));
    assert.equal(out.suggestion, null, "정해진 뒤에는 조용히 있는다");
  });

  it("7. 잡담에는 제안도 상태 변화도 없다", () => {
    const out = analyzeConversation({
      messages: say("ㅋㅋㅋ", "밥 먹었어?", "내일 비 온대"),
      participants: [[], []],
      now: NOW,
    });
    assert.equal(out.memory.state, "idle");
    assert.equal(out.suggestion, null);
    assert.equal(out.slots.length, 0, "조율이 없으면 달력도 들여다보지 않는다");
  });

  it("같은 제안을 두 번 띄우지 않는다 (§28)", () => {
    const input = {
      messages: say("내일 언제 볼까?", "나는 3시 이후 괜찮아"),
      participants: [[], []] as never,
      now: NOW,
    };
    const first = analyzeConversation(input);
    assert.ok(first.suggestion);
    const second = analyzeConversation({ ...input, shown: [first.suggestion!.key] });
    assert.notEqual(second.suggestion?.key, first.suggestion!.key);
  });

  it("조율 신호만 있고 조건이 없으면 바로 들이밀지 않는다", () => {
    const out = analyzeConversation({
      messages: say("내일 언제 볼까?"),
      participants: [[], []],
      now: NOW,
    });
    assert.equal(out.suggestion, null, "상대의 대답을 한 번은 기다린다");
  });
});

// ── 결과 정리 (§17~20) ─────────────────────────────────

describe("summary", () => {
  const memoryOf = (...texts: string[]) => foldConversation(say(...texts), (t) => analyzeMessage(t, NOW));

  it("§18 대화를 다시 서술하지 않는다 — 결론 한 줄과 사실 몇 개뿐", () => {
    const m = memoryOf("내일 언제 볼까?", "나는 2시 이후 괜찮아", "그럼 내일 3시 어때?", "좋아");
    const out = summarize({ memory: m, participants: ["나", "fapp1004"], now: NOW });
    assert.ok(out);
    assert.equal(out!.decided, true);
    // "3시" 는 오후로 읽히므로 결론도 15시로 적힌다 — §18 의 예시와 같은 모양이다.
    assert.equal(out!.headline, "내일 15시에 만나기로 했어요.");
    assert.ok(out!.lines.some((l) => l.includes("15:00")));
    assert.ok(out!.lines.some((l) => l.includes("fapp1004")));
    // §19 — 짧아야 한다. 사실은 세 줄을 넘기지 않는다.
    assert.ok(out!.lines.length <= 3, "요약이 길어지면 그건 요약이 아니다");
    // 대화를 되풀이하지 않는다
    assert.ok(!out!.headline.includes("괜찮"), "누가 무슨 말을 했는지는 결론이 아니다");
  });

  it("§20 잡담에는 요약을 만들지 않는다", () => {
    const m = memoryOf("ㅋㅋㅋ", "밥 먹었어?", "내일 비 온대");
    assert.equal(summarize({ memory: m, participants: ["나"], now: NOW }), null);
  });

  it("§20 결정되지 않은 대화는 물었을 때만 답한다", () => {
    const m = memoryOf("내일 언제 볼까?", "나는 3시 이후 괜찮아");
    assert.equal(summarize({ memory: m, participants: ["나"], now: NOW }), null, "묻지 않으면 조용하다");

    const asked = summarize({ memory: m, participants: ["나"], now: NOW, includeUndecided: true });
    assert.ok(asked);
    assert.equal(asked!.decided, false);
    assert.equal(asked!.headline, "아직 결정된 내용이 없습니다.");
    assert.equal(asked!.actionable, false);
  });

  it("확정된 요약만 캘린더로 건너갈 수 있다", () => {
    const done = memoryOf("내일 언제 볼까?", "내일 3시 어때?", "좋아");
    assert.equal(summarize({ memory: done, participants: [], now: NOW })!.actionable, true);

    const off = memoryOf("내일 언제 볼까?", "내일 3시 어때?", "아 오늘은 다음에 하자");
    const s = summarize({ memory: off, participants: [], now: NOW });
    assert.equal(s!.decided, true);
    assert.equal(s!.actionable, false, "없던 일이 된 대화에 '캘린더에 추가' 를 달지 않는다");
  });
});

// ── 관측 (§35) — 숫자만 담는다 ─────────────────────────

describe("metrics", () => {
  it("센 것은 숫자뿐이고, 내용은 담기지 않는다 (§31)", () => {
    resetMetrics();
    track("suggestion.shown");
    track("suggestion.shown");
    track("suggestion.accepted");
    const snap = snapshot();
    assert.equal(snap["suggestion.shown"], 2);
    assert.equal(acceptanceRate(), 0.5);
    // 담긴 열쇠는 미리 정해진 이름뿐이다 — 메시지도 제목도 들어갈 자리가 없다.
    assert.ok(Object.keys(snap).every((k) => k.includes(".")));
  });

  it("관측이 제품을 넘어뜨리지 않는다", () => {
    resetMetrics();
    setMetricSink(() => { throw new Error("sink 고장"); });
    assert.doesNotThrow(() => track("engine.error"));
    setMetricSink(null);
  });
});
