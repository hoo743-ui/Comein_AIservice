// 대화 → 이해 → 사실 → 제안. 이 순서를 지키는 자리(Orchestrator).
//
// 하나의 거대한 함수에 다 넣지 않는다(§26). 여기는 조립만 한다:
//   intent(뜻)  ·  state(상태)  ·  availability(사실)  ·  suggestion(권함)
// 각 조각은 저마다 혼자서도 시험할 수 있고, 여기는 그것들을 잇는 배선일 뿐이다.
//
// 이 파일 어디에서도 네트워크를 부르지 않는다. 화면이 재료(바쁜 구간)를 건네면
// 결과(상태·제안)를 돌려준다 — 그래야 AI 가 죽어도 대화와 캘린더는 살아 있다(§32).

import { commonSlots, withinConstraints, type BusyInterval, type SlotCandidate } from "./availability";
import { anchorToDay } from "./temporal";
import { analyzeMessage, type MessageAnalysis } from "./intent";
import { emptyMemory, foldConversation, type ConversationMemory } from "./state";
import { decideSuggestion, type Suggestion } from "./suggestion";

export * from "./availability";
export * from "./intent";
export * from "./state";
export * from "./suggestion";
export * from "./summary";
export * from "./metrics";
export * from "./temporal";

export interface ConversationInput {
  /** 오래된 것부터. 최근 몇 마디만 넘긴다 — 전부 넘기면 비용도 오해도 커진다(§6·§34). */
  messages: { id?: string; text: string }[];
  /** 참여자별 바쁜 구간. 제목은 넘기지 않는다(§11). */
  participants: BusyInterval[][];
  now: Date;
  durationMin?: number;
  /** 이미 화면에 띄운 제안 key — 같은 것을 두 번 띄우지 않는다(§28). */
  shown?: string[];
  en?: boolean;
  /** 서버가 이미 계산해 준 후보. 있으면 이걸 쓴다.
   *  서버는 양쪽 달력을 볼 수 있고 우리는 볼 수 없다 — 그러니 사실은 저쪽이 더 정확하다.
   *  (없으면 아는 달력만으로 계산한다. 그때도 '모른다' 를 '한가하다' 로 바꿔 읽지 않는다.) */
  slots?: SlotCandidate[];
}

export interface AnalysisOutcome {
  memory: ConversationMemory;
  /** 계산된 후보(순위대로). 화면이 직접 쓸 일은 드물고, 대개 suggestion 만 본다. */
  slots: SlotCandidate[];
  /** 권할 것이 있으면 하나. 없으면 null — 그리고 null 이 기본값이다. */
  suggestion: Suggestion | null;
  /** 마지막 한 마디를 어떻게 읽었는가. 화면이 굳이 알 필요는 없지만, 디버깅에 쓴다. */
  last: MessageAnalysis;
}

/** 최근 몇 마디만 본다. 옛날 약속이 오늘 되살아나지 않도록. */
const WINDOW = 12;

/**
 * 대화 한 덩어리를 읽고, 지금 무엇을 해야 하는지 돌려준다.
 * 조율할 일이 없으면 memory.state 는 "idle" 이고 suggestion 은 null 이다 — 그게 정상이다.
 */
export function analyzeConversation(input: ConversationInput): AnalysisOutcome {
  const { now, en = false } = input;
  const recent = input.messages.slice(-WINDOW);
  const analyze = (text: string) => analyzeMessage(text, now);

  const memory = recent.length
    ? foldConversation(recent, analyze, emptyMemory())
    : emptyMemory();
  const last = analyze(recent.length ? recent[recent.length - 1].text : "");

  // 조율이 열려 있지 않으면 달력을 들여다볼 이유도 없다 — 계산도 비용이다(§34).
  if (memory.state === "idle" || memory.state === "confirmed" || memory.state === "cancelled") {
    return { memory, slots: [], suggestion: null, last };
  }

  // 어느 날을 볼 것인가 — 대화에서 날짜를 직접 짚은 마지막 말이 그 날을 정한다.
  // 그리고 날짜 없이 시각만 말한 조건들("3시 이후")을 전부 그 날 위로 옮긴다.
  // 이걸 빠뜨리면 "내일 언제 볼까 / 3시 이후 괜찮아" 가 서로 다른 날로 갈린다.
  const dayed = memory.constraints.filter((c) => c.hasDay);
  const day = new Date(dayed.length ? dayed[dayed.length - 1].at : now);
  const constraints = memory.constraints.map((c) => anchorToDay(c, day));

  const slots = input.slots
    ? // 서버가 준 후보에도 대화의 조건은 그대로 걸린다 — "3시 이후" 라고 했으면 3시 이후만 본다.
      input.slots.filter((s) => withinConstraints(new Date(s.start), constraints))
    : commonSlots({
        day,
        durationMin: input.durationMin ?? 60,
        participants: input.participants,
        constraints,
        now,
      });

  return {
    memory,
    slots,
    suggestion: decideSuggestion({ memory, slots, shown: input.shown, en }),
    last,
  };
}
