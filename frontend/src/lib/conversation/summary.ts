// 대화가 끝난 뒤 남는 것 — 결과 정리(Outcome Summary).
//
// 이것은 '대화를 줄여 쓴 글' 이 아니다(§17). 대화를 다시 읽지 않아도
// **무슨 결론이 났는지** 알 수 있으면 성공이고, 그러지 못하면 실패다(§19).
//
//   ✗ "A 가 먼저 내일 만나는 것에 대해 물었고, B 가 2시 이후 가능하다고 답했으며…"
//   ✓ "내일 15시에 만나기로 했어요."
//
// 그리고 모든 대화가 요약을 갖지는 않는다(§20). 잡담에는 아무것도 만들지 않는다 —
// 의미 없는 요약은 없느니만 못하다.
//
// 사실은 상태 기계가 쥔다. 여기서 하는 일은 그 사실을 사람의 말로 옮기는 것뿐이고,
// 모델은 부르지 않는다 — 결론 한 줄에 네트워크와 비용을 쓸 이유가 없다(§27·§34).

import type { ConversationMemory } from "./state";

export interface ConversationOutcome {
  /** 결론이 났는가. false 면 "아직 정해지지 않았다" 는 사실 자체가 결론이다. */
  decided: boolean;
  /** 정해진 시각(ISO). decided 일 때만 있다. */
  start?: string;
  end?: string;
  /** 한 줄 결론. 화면이 크게 쓰는 문장이다. */
  headline: string;
  /** 결론을 받치는 사실들. 1~3개로 묶는다(§19) — 더 늘리면 다시 '요약' 이 아니게 된다. */
  lines: string[];
  /** 캘린더로 건너갈 수 있는가. */
  actionable: boolean;
}

export interface SummaryInput {
  memory: ConversationMemory;
  /** 함께한 사람들의 표시 이름. 나를 포함해 넘긴다. */
  participants: string[];
  now: Date;
  en?: boolean;
  /** 아직 안 정해진 대화도 굳이 정리해 보여 줄 것인가.
   *  기본은 아니다 — 사람이 물었을 때만 "아직 없습니다" 라고 답한다(§20). */
  includeUndecided?: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 오늘·내일·모레는 날짜보다 그 말이 빠르다. 그 밖은 날짜로 적는다. */
function dayWord(d: Date, now: Date, en: boolean): string {
  const a = new Date(d); a.setHours(0, 0, 0, 0);
  const b = new Date(now); b.setHours(0, 0, 0, 0);
  const diff = Math.round((+a - +b) / 86_400_000);
  if (en) return diff === 0 ? "today" : diff === 1 ? "tomorrow" : diff === 2 ? "in two days" : `${a.getMonth() + 1}/${a.getDate()}`;
  return diff === 0 ? "오늘" : diff === 1 ? "내일" : diff === 2 ? "모레" : `${a.getMonth() + 1}월 ${a.getDate()}일`;
}

const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * 이 대화에 정리할 것이 있는가. 없으면 null — 그리고 없는 편이 흔하다.
 */
export function summarize({ memory, participants, now, en = false, includeUndecided = false }: SummaryInput): ConversationOutcome | null {
  const who = participants.filter(Boolean);
  const whoLine = who.length ? (en ? `With ${who.join(", ")}` : `참여자 · ${who.join(", ")}`) : null;

  // ── 정해졌다 ──
  if (memory.state === "confirmed" && memory.confirmed) {
    const at = new Date(memory.confirmed);
    const day = dayWord(at, now, en);
    const lines = [
      en ? `${day} · ${clock(at)}` : `${day} · ${clock(at)}`,
      whoLine,
    ].filter(Boolean) as string[];
    return {
      decided: true,
      start: memory.confirmed,
      headline: en
        ? `Agreed on ${day} at ${clock(at)}.`
        : `${day} ${at.getHours()}시${at.getMinutes() ? ` ${at.getMinutes()}분` : ""}에 만나기로 했어요.`,
      lines,
      actionable: true,
    };
  }

  // ── 없던 일이 됐다 ──
  if (memory.state === "cancelled") {
    return {
      decided: true,
      headline: en ? "Called off for now." : "이번엔 만나지 않기로 했어요.",
      lines: whoLine ? [whoLine] : [],
      actionable: false,
    };
  }

  // ── 조율은 있었지만 아직 결론이 없다 ──
  // 묻지 않았으면 아무 말도 하지 않는다. 결론 없는 요약을 들이미는 것은
  // '정리해 줬다' 는 느낌만 만들 뿐 아무것도 줄여 주지 않는다(§20).
  const openScheduling =
    memory.state === "scheduling_detected" ||
    memory.state === "collecting_preferences" ||
    memory.state === "time_proposed";
  if (openScheduling && includeUndecided) {
    const lines: string[] = [];
    if (memory.proposed.length) {
      const at = new Date(memory.proposed[memory.proposed.length - 1]);
      lines.push(en ? `On the table · ${dayWord(at, now, en)} ${clock(at)}` : `상에 오른 시각 · ${dayWord(at, now, en)} ${clock(at)}`);
    }
    if (memory.rejected.length) {
      lines.push(en ? `Ruled out · ${memory.rejected.length}` : `제외된 시각 · ${memory.rejected.length}개`);
    }
    return {
      decided: false,
      headline: en ? "Nothing decided yet." : "아직 결정된 내용이 없습니다.",
      lines,
      actionable: false,
    };
  }

  // 잡담에는 요약이 없다.
  return null;
}
