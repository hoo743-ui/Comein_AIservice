// 말을 걸 것인가, 가만히 있을 것인가.
//
// 이 파일의 기본값은 '아무것도 하지 않는다' 이다(§13). 제안은 다섯 조건이 모두 맞을 때만 나간다:
//   ① 조율하려는 뜻이 분명하다      ② 대화가 아직 열려 있다
//   ③ 실제로 계산된 자리가 있다      ④ 그 자리가 의미 있다(모두 가능)
//   ⑤ 전에 권했거나 거절당한 자리가 아니다
//
// 침묵도 정상 동작이다. 확신이 없으면 조용히 있는 편이 언제나 낫다.

import { freeForAll, type SlotCandidate } from "./availability";
import { isSchedulingOpen, type ConversationMemory } from "./state";

export interface Suggestion {
  /** 같은 제안을 두 번 만들지 않기 위한 열쇠(§28). */
  key: string;
  start: string; // ISO
  end: string;   // ISO
  /** 이 자리를 권하는 이유 한 줄 — 사람에게 그대로 보여 준다. */
  reason: string;
  /** 0~1 */
  confidence: number;
}

export interface DecideInput {
  memory: ConversationMemory;
  slots: SlotCandidate[];
  /** 이 대화에서 이미 화면에 띄운 제안들의 key. 중복 방지. */
  shown?: string[];
  en?: boolean;
}

/** 제안 하나를 가리키는 열쇠 — 시각이 같으면 같은 제안이다. */
export const suggestionKey = (start: string, end: string) => `${start}|${end}`;

const fmt = (iso: string, en: boolean) => {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return en ? `${hh}:${mm}` : `${hh}:${mm}`;
};

/**
 * 지금 제안할 것이 있는가. 없으면 null — 그리고 null 이 기본값이다.
 */
export function decideSuggestion({ memory, slots, shown = [], en = false }: DecideInput): Suggestion | null {
  // ② 대화가 닫혀 있으면(정해졌거나 취소됐거나 아직 시작도 안 했으면) 아무 말도 하지 않는다.
  if (!isSchedulingOpen(memory)) return null;
  // ① 조율의 뜻이 막 보이기 시작한 자리에서 바로 들이밀지 않는다.
  //    "내일 언제 볼까?" 한 마디에 곧바로 시각을 들이미는 것은 대화가 아니라 자판기다 —
  //    누군가 되는 시간을 말했을 때(collecting_preferences) 비로소 움직인다.
  if (memory.state === "scheduling_detected") return null;

  // ③④ 모두 되는 자리만 권한다. 겹치는 자리를 권하면 그 다음 대화가 더 길어진다.
  const open = freeForAll(slots);
  if (!open.length) return null;

  // ⑤ 이미 권했거나 거절당한 자리는 건너뛴다.
  const blocked = new Set([...memory.proposed, ...memory.rejected]);
  const pick = open.find((s) => !blocked.has(s.start) && !shown.includes(suggestionKey(s.start, s.end)));
  if (!pick) return null;

  return {
    key: suggestionKey(pick.start, pick.end),
    start: pick.start,
    end: pick.end,
    reason: en ? "Everyone is free then." : "두 분 모두 가능한 시간이에요.",
    confidence: memory.state === "collecting_preferences" ? 0.8 : 0.65,
  };
}

/** 제안 한 줄을 사람의 말로. 화면은 이 문장만 그리면 된다. */
export function suggestionLine(s: Suggestion, en = false): string {
  return en
    ? `${fmt(s.start, en)} — ${fmt(s.end, en)}`
    : `${fmt(s.start, en)} — ${fmt(s.end, en)}`;
}
