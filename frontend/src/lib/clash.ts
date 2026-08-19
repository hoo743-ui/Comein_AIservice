/**
 * Comein · 겹치는 시간 — 물어야 할 것과 물어선 안 될 것.
 *
 * 왜 판단을 여기에 두는가 —
 *   화면 안에 두면 캡처 바에서 한 번, 그룹 자리 만들기에서 또 한 번 같은 규칙을 짓게 된다.
 *   그리고 이 규칙은 눈으로 좇기 어렵다("같은 일정이면 묻지 않는다", "지난 일정과는 안 겹친다")
 *   — 시험으로 못 박는 편이 맞다.
 *
 * 무엇을 하지 않는가 —
 *   **아무것도 옮기지 않는다.** 낮은 것을 밀어내지도, 높은 것을 대신 확정하지도 않는다.
 *   여기서 나오는 것은 사람에게 건넬 한 마디뿐이다. 확정은 사람이 한다(§0).
 *
 *   그리고 **겹쳤다고 늘 묻지 않는다.** 하루에 회의가 셋 겹치는 사람에게 매번 물으면
 *   그건 비서가 아니라 알림이다. 물을 값이 있을 때만 묻는다 — 아래 `verdict` 참고.
 */

import type { Schedule, TodoPriority } from "@/lib/types";

/** 없으면 1시간짜리로 본다 — 화면이 일정을 세울 때 쓰는 것과 같은 가정이다. */
const HOUR = 60 * 60 * 1000;

const spanOf = (s: { start: string; end?: string }) => {
  const from = +new Date(s.start);
  const to = s.end ? +new Date(s.end) : from + HOUR;
  return [from, Number.isFinite(to) && to > from ? to : from + HOUR] as const;
};

/** 두 자리가 시간 위에서 겹치는가. 맞닿은 것(끝=시작)은 겹친 것이 아니다. */
export function overlaps(a: { start: string; end?: string }, b: { start: string; end?: string }): boolean {
  const [af, at] = spanOf(a);
  const [bf, bt] = spanOf(b);
  return af < bt && bf < at;
}

/** 말하지 않은 것은 가운데로 치지 않는다 — 비교할 때만 순서를 준다. */
const rank = (p?: TodoPriority): number => (p === "high" ? 2 : p === "low" ? 0 : 1);

export type Clash = {
  /** 부딪힌 상대. 여럿이면 가장 중요한 것 하나(같으면 먼저 시작하는 것). */
  with: Schedule;
  /** 몇 개와 부딪혔는가. 한 개면 이름으로, 여럿이면 수로 말한다. */
  count: number;
  /** 새로 세우려는 것이 상대보다 중요한가 · 덜한가 · 같은가. */
  weight: "higher" | "lower" | "same";
};

export interface ClashQuery {
  /** 새로 세우려는 자리. 아직 저장 전이어도 된다. */
  incoming: { start: string; end?: string; priority?: TodoPriority; id?: string };
  /** 이미 있는 것들. 지난 것은 여기서 걸러 낸다. */
  existing: Schedule[];
  now?: Date;
}

/**
 * 부딪힌 것이 있으면 돌려준다. 없으면 null — 그리고 null 이 대부분이다.
 *
 * 지난 일정과는 부딪히지 않는다. 이미 지나간 시간을 두고 "겹쳐요" 라고 말하는 것은
 * 사실도 아니고 도움도 안 된다.
 */
export function findClash({ incoming, existing, now = new Date() }: ClashQuery): Clash | null {
  const t = +now;
  const hits = existing.filter((e) => {
    if (incoming.id && e.id === incoming.id) return false;   // 자기 자신과는 겹치지 않는다
    const [, to] = spanOf(e);
    if (to <= t) return false;                               // 이미 끝난 자리
    return overlaps(incoming, e);
  });
  if (hits.length === 0) return null;

  // 여럿이면 가장 무거운 것 하나를 대표로 세운다 — 사람이 저울질할 대상은 하나면 족하다.
  const top = [...hits].sort((a, b) => rank(b.priority) - rank(a.priority) || +new Date(a.start) - +new Date(b.start))[0];
  const d = rank(incoming.priority) - rank(top.priority);
  return { with: top, count: hits.length, weight: d > 0 ? "higher" : d < 0 ? "lower" : "same" };
}

/**
 * 물을 값이 있는가 — 그리고 뭐라고 물을 것인가.
 *
 * 겹쳤다는 사실만으로는 묻지 않는다. 사람은 겹치는 일정을 일부러 잡기도 한다(대기 시간,
 * 온라인 참석, "가면 좋고"). 매번 물으면 그건 비서가 아니라 알림이고, 알림은 곧 꺼진다.
 *
 * 무게가 물음의 값을 정한다:
 *   새것이 더 중요하다  → 밀어낼 것이 있다는 뜻이라, 알려 줄 값이 있다
 *   새것이 덜 중요하다  → 중요한 자리를 건드리려는 것이라, 값이 가장 크다
 *   같다 / 아무도 말 안 함 → 저울질할 근거가 없다. 조용히 둔다
 *
 * 마지막 갈래가 이 함수의 핵심이다. 근거 없이 묻는 것은 묻지 않는 것보다 나쁘다 —
 * 사람은 답할 수 없는 질문을 받으면 그 다음 질문도 믿지 않는다.
 */
export function clashAsk(c: Clash | null, en = false): string | null {
  if (!c || c.weight === "same") return null;
  const other = c.with.title;
  const more = c.count > 1 ? (en ? ` and ${c.count - 1} more` : ` 외 ${c.count - 1}건`) : "";
  return c.weight === "lower"
    ? (en
        ? `"${other}"${more} is already there, and marked more important. Still add this?`
        : `그 시간에 더 중요한 "${other}"${more} 이(가) 있어요. 그래도 잡을까요?`)
    : (en
        ? `This overlaps "${other}"${more}, which you marked lighter. Keep both?`
        : `덜 중요한 "${other}"${more} 과(와) 겹쳐요. 둘 다 둘까요?`);
}
