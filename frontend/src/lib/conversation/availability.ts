// 언제가 되는가 — 사실을 계산하는 자리.
//
// 이 계산은 AI 가 하지 않는다(§10·§27). AI 는 여기서 나온 사실을 사람의 말로 옮길 뿐이다.
// 모델이 "아마 3시쯤 괜찮을 거예요" 라고 말하는 순간 제품은 신뢰를 잃는다.
//
// 프라이버시(§11): 이 함수가 받는 것은 '바쁜 구간' 뿐이다. 제목도 장소도 받지 않는다.
// 누가 왜 바쁜지는 알 필요가 없고, 알아서도 안 된다.

import type { TemporalConstraint } from "./temporal";

/** 남의 달력에서 우리가 아는 것의 전부 — 언제부터 언제까지 차 있다. */
export interface BusyInterval {
  start: string; // ISO
  end: string;   // ISO
}

export interface SlotCandidate {
  start: string;  // ISO
  end: string;    // ISO
  /** 이 시간에 겹치는 사람 수. 0 이면 모두 가능하다. */
  conflicts: number;
  /** 클수록 좋은 자리. 순위를 매기기 위한 값일 뿐 사람에게 보여 주지 않는다. */
  score: number;
}

export interface SlotQuery {
  /** 어느 날을 볼 것인가(로컬). */
  day: Date;
  durationMin: number;
  /** 참여자별 바쁜 구간. 사람 수만큼의 배열. */
  participants: BusyInterval[][];
  /** 대화에서 쌓인 시간 조건 */
  constraints?: TemporalConstraint[];
  /** 하루 중 들여다볼 범위(로컬 시각). 기본 09~22시 — 새벽을 권하지 않기 위해. */
  window?: { fromHour: number; toHour: number };
  /** 후보 간격(분). 기본 30분 — 사람이 말하는 단위다. */
  stepMin?: number;
  /** '지금' 이후만 본다. 지나간 시각은 후보가 아니다. */
  now?: Date;
}

const overlaps = (aFrom: number, aTo: number, bFrom: number, bTo: number) => aFrom < bTo && bFrom < aTo;

/**
 * 모두가 되는 시간을 찾아 순위대로 돌려준다. 없으면 빈 배열 — 억지로 만들지 않는다.
 *
 * 순위는 이렇게 매긴다:
 *   ① 겹치는 사람이 적을수록 좋다 (가장 무겁게)
 *   ② 대화에서 걸린 조건(3시 이후 …)을 지킬수록 좋다
 *   ③ 이른 시각일수록 조금 좋다 — 같은 조건이면 빨리 만나는 편이 낫다
 */
export function commonSlots(q: SlotQuery): SlotCandidate[] {
  const { fromHour, toHour } = q.window ?? { fromHour: 9, toHour: 22 };
  const step = q.stepMin ?? 30;
  const dur = Math.max(15, q.durationMin);

  const dayStart = new Date(q.day);
  dayStart.setHours(fromHour, 0, 0, 0);
  const dayEnd = new Date(q.day);
  dayEnd.setHours(toHour, 0, 0, 0);

  // 조건을 시각의 하한·상한으로 접는다. 여러 사람이 각자 조건을 걸면 가장 좁은 창이 남는다.
  let lower = +dayStart;
  let upper = +dayEnd;
  for (const c of q.constraints ?? []) {
    if (c.kind === "after") lower = Math.max(lower, +c.at);
    else if (c.kind === "before") upper = Math.min(upper, +c.at);
    else if (c.kind === "at") { lower = Math.max(lower, +c.at); upper = Math.min(upper, +c.at + dur * 60_000); }
  }
  if (q.now) lower = Math.max(lower, +q.now);

  const busy = q.participants.map((rows) =>
    rows
      .map((b) => [+new Date(b.start), +new Date(b.end)] as const)
      .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s),
  );

  const out: SlotCandidate[] = [];
  // 후보는 '칸' 위에서만 만든다(정시·30분). 사람은 09:07 에 만나자고 하지 않는다.
  const firstTick = Math.ceil(lower / (step * 60_000)) * (step * 60_000);
  for (let t = firstTick; t + dur * 60_000 <= upper; t += step * 60_000) {
    const end = t + dur * 60_000;
    const conflicts = busy.filter((rows) => rows.some(([s, e]) => overlaps(t, end, s, e))).length;
    const hoursFromStart = (t - +dayStart) / 3_600_000;
    out.push({
      start: new Date(t).toISOString(),
      end: new Date(end).toISOString(),
      conflicts,
      score: -conflicts * 100 - hoursFromStart,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

/** 이 시각이 대화에서 걸린 조건들을 지키는가.
 *  후보를 서버가 계산해 준 경우에도 조건은 우리가 건다 — 서버는 대화를 모른다. */
export function withinConstraints(at: Date, constraints: TemporalConstraint[]): boolean {
  for (const c of constraints) {
    if (c.kind === "after" && +at < +c.at) return false;
    if (c.kind === "before" && +at > +c.at) return false;
    if (c.kind === "at" && Math.abs(+at - +c.at) > 30 * 60_000) return false;
  }
  return true;
}

/** 모두 되는 자리만. 하나도 없으면 빈 배열이고, 그때는 제안하지 않는 것이 맞다. */
export const freeForAll = (slots: SlotCandidate[]) => slots.filter((s) => s.conflicts === 0);
