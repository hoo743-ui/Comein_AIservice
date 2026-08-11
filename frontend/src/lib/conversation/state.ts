// 대화의 상태 — 이 대화가 지금 어디쯤 와 있는가.
//
// 상태가 없으면 AI 는 같은 말을 반복한다. 거절당한 15시를 다시 권하는 일이
// 실제로 그렇게 생긴다(§8). 그래서 대화는 기억을 갖는다:
// 무엇이 제안됐고, 무엇이 거절됐고, 무엇으로 정해졌는가.
//
// 순수 함수다. 저장소도 네트워크도 모른다 — 그래야 시험할 수 있다.

import type { MessageAnalysis } from "./intent";
import type { TemporalConstraint } from "./temporal";

export type ConversationState =
  | "idle"                   // 그냥 대화 중
  | "scheduling_detected"    // 만나자는 말이 나왔다
  | "collecting_preferences" // 서로의 되는 시간이 쌓이는 중
  | "time_proposed"          // 후보 시각이 상 위에 올라왔다
  | "confirmed"              // 정해졌다
  | "cancelled";             // 없던 일이 됐다

export interface ConversationMemory {
  state: ConversationState;
  /** 지금까지 쌓인 시간 조건. 사람마다 다른 조건을 걸므로 누적한다. */
  constraints: TemporalConstraint[];
  /** 이미 상 위에 올려 본 시각(ISO). 같은 것을 두 번 권하지 않기 위해. */
  proposed: string[];
  /** 누군가 아니라고 한 시각(ISO). 다시는 권하지 않는다. */
  rejected: string[];
  /** 정해진 시각(ISO). */
  confirmed?: string;
  /** 어디까지 읽었는가 — 같은 말을 두 번 분석하지 않기 위해(§28). */
  lastMessageId?: string;
}

export const emptyMemory = (): ConversationMemory => ({
  state: "idle",
  constraints: [],
  proposed: [],
  rejected: [],
});

/** 마지막으로 상에 올린 시각 — 거절이 오면 이것이 거절된 것이다. */
const lastProposed = (m: ConversationMemory) => m.proposed[m.proposed.length - 1];

const uniq = (xs: string[]) => [...new Set(xs)];

/**
 * 한 마디가 대화의 상태를 어떻게 바꾸는가.
 * 되돌릴 수 없는 자리(confirmed·cancelled)에서도 대화는 이어질 수 있다 —
 * 다시 조율하자는 말이 나오면 처음으로 돌아간다.
 */
export function reduceConversation(
  memory: ConversationMemory,
  analysis: MessageAnalysis,
  messageId?: string,
): ConversationMemory {
  const m: ConversationMemory = { ...memory, lastMessageId: messageId ?? memory.lastMessageId };
  const times = analysis.constraints.filter((c) => c.kind !== "day").map((c) => c.at.toISOString());

  switch (analysis.intent) {
    case "scheduling_request":
      // 이미 정해진 뒤에 다시 "언제 볼까" 가 나오면 새 조율이다 — 기억은 비운다.
      if (m.state === "confirmed" || m.state === "cancelled") {
        return { ...emptyMemory(), state: "scheduling_detected", lastMessageId: m.lastMessageId };
      }
      return {
        ...m,
        state: m.state === "idle" ? "scheduling_detected" : m.state,
        constraints: [...m.constraints, ...analysis.constraints],
      };

    case "availability":
      return {
        ...m,
        state: m.state === "time_proposed" ? m.state : "collecting_preferences",
        constraints: [...m.constraints, ...analysis.constraints],
      };

    case "proposal":
      if (!times.length) return { ...m, state: "collecting_preferences" };
      return {
        ...m,
        state: "time_proposed",
        constraints: [...m.constraints, ...analysis.constraints],
        proposed: uniq([...m.proposed, ...times]),
      };

    case "acceptance": {
      // 수락은 '무엇을' 수락했는지가 있어야 뜻이 산다. 상에 올라온 게 없으면 상태를 옮기지 않는다.
      const target = times[0] ?? lastProposed(m);
      if (!target || m.state === "idle") return m;
      return { ...m, state: "confirmed", confirmed: target };
    }

    case "rejection": {
      const target = times[0] ?? lastProposed(m);
      if (!target) return { ...m, state: m.state === "idle" ? "idle" : "collecting_preferences" };
      return {
        ...m,
        state: "collecting_preferences",
        rejected: uniq([...m.rejected, target]),
        // 거절된 것은 후보 목록에서도 내린다 — 남겨 두면 다시 올라온다.
        proposed: m.proposed.filter((p) => p !== target),
        confirmed: m.confirmed === target ? undefined : m.confirmed,
      };
    }

    case "cancellation":
      return { ...m, state: "cancelled", confirmed: undefined };

    default:
      return m;
  }
}

/** 여러 마디를 차례로 흘려 넣는다. 화면은 이것만 부르면 된다. */
export function foldConversation(
  messages: { id?: string; text: string }[],
  analyze: (text: string) => MessageAnalysis,
  seed: ConversationMemory = emptyMemory(),
): ConversationMemory {
  return messages.reduce((m, msg) => reduceConversation(m, analyze(msg.text), msg.id), seed);
}

/** 지금 제안을 꺼내도 되는 자리인가. 정해졌거나 없던 일이 됐으면 조용히 있는다. */
export const isSchedulingOpen = (m: ConversationMemory) =>
  m.state === "scheduling_detected" || m.state === "collecting_preferences" || m.state === "time_proposed";
