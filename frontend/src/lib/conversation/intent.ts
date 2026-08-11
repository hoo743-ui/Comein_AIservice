// 이 말이 무엇을 하려는 말인가 — 의도 읽기.
//
// 두 가지를 지킨다.
//
//  ① 값싼 것부터. "ㅋㅋㅋ" 를 이해하러 모델을 부르지 않는다(§34).
//     여기 있는 것은 전부 규칙이고, 규칙이 확신하지 못할 때만 위층이 모델을 부른다.
//  ② 시간이 나온다고 일정이 아니다(§9). "내일 비 온대" 는 조율이 아니다 —
//     조율하자는 신호(언제·몇 시·볼까·가능해?)가 함께 있어야 일정 흐름을 켠다.

import { readConstraints, type TemporalConstraint } from "./temporal";

export type IntentType =
  | "chatter"             // 그냥 하는 말. AI 가 할 일이 없다.
  | "scheduling_request"  // "내일 언제 볼까?"
  | "availability"        // "나는 3시 이후 괜찮아."
  | "proposal"            // "그럼 4시 어때?"
  | "acceptance"          // "좋아."
  | "rejection"           // "그때는 안 돼."
  | "cancellation"        // "오늘은 못 볼 것 같아."
  | "place";              // "어디서 볼까?"

export interface MessageAnalysis {
  intent: IntentType;
  /** 0~1. 낮으면 위층은 아무것도 하지 않는다 — 침묵도 정상 동작이다(§13). */
  confidence: number;
  constraints: TemporalConstraint[];
  /** 규칙만으로 부족해 모델의 도움이 필요한가. 지금은 위층이 참고만 한다. */
  needsModel: boolean;
}

const CHATTER = /^[\s.,!?~ㅋㅎㅠㅜ0-9a-zA-Z가-힣]{0,3}$/;   // "ㅋㅋ", "ㅇㅇ", "네"
const ONLY_EMOJI = /^[\p{Extended_Pictographic}\s]+$/u;

/** 조율하자는 신호 — 시간이 나오더라도 이게 없으면 일정 흐름을 켜지 않는다. */
const COORDINATION = /(언제|몇\s*시|시간\s*(되|괜찮|있|어때)|볼까|만날까|보자|만나자|잡을까|잡자|일정|약속|가능(해|한|할)|스케줄|미팅|회의)/;
const ASK_WHEN = /(언제|몇\s*시)/;
const AVAILABLE = /(괜찮|가능|비어|돼|된다|좋아요?$|시간\s*있)/;
const PROPOSE = /(어때|어떄|할까|하자|ㄱㄱ|고고|로\s*하자|으로\s*하자)/;
const ACCEPT = /^(좋아|좋아요|ㅇㅋ|오케이|okay|ok|그래|그러자|콜|ㄱㄱ|고고|알겠어|알겠습니다|그때\s*보자)[\s.!~]*$/i;
const REJECT = /(안\s*돼|안돼|어려울|힘들|못\s*(가|봐|해)|불가|곤란|다른\s*시간|안될)/;
const CANCEL = /(취소|없던\s*걸로|다음에\s*(보자|하자)|미루|리스케)/;
const PLACE = /(어디서|어디로|장소|위치|카페|학교|사무실|역\s*(앞|에서))/;

/**
 * 한 마디를 읽는다. 모델을 부르지 않는다 — 부를지 말지는 위층이 정한다.
 *
 * @param text 사용자가 실제로 친 말
 * @param now  '지금' — 테스트에서 고정할 수 있도록 밖에서 받는다
 */
export function analyzeMessage(text: string, now: Date): MessageAnalysis {
  const raw = text.trim();
  const none: MessageAnalysis = { intent: "chatter", confidence: 0, constraints: [], needsModel: false };

  // ① 값싼 거름망 — 여기서 걸리면 그 뒤로는 아무 비용도 쓰지 않는다.
  if (!raw || ONLY_EMOJI.test(raw) || (CHATTER.test(raw) && !ACCEPT.test(raw))) return none;

  const constraints = readConstraints(raw, now);
  const hasClock = constraints.some((c) => c.kind !== "day");
  const coordination = COORDINATION.test(raw);

  // ② 수락·거절·취소는 짧게 온다. 시간이 없어도 뜻이 분명하다.
  if (ACCEPT.test(raw)) return { intent: "acceptance", confidence: 0.8, constraints, needsModel: false };
  if (CANCEL.test(raw)) return { intent: "cancellation", confidence: 0.7, constraints, needsModel: false };
  if (REJECT.test(raw)) return { intent: "rejection", confidence: 0.7, constraints, needsModel: false };

  // ③ 시각을 못 읽었는데 "언제 볼까?" 라면 — 조율은 시작됐고 시간은 아직 없다.
  if (!hasClock && ASK_WHEN.test(raw) && coordination) {
    return { intent: "scheduling_request", confidence: 0.8, constraints, needsModel: false };
  }

  // ④ 시각이 있다 — 그러나 조율 신호가 없으면 그냥 사실을 말한 것이다.
  //    "내일 비 온대" · "3시에 수업 있어" 는 조율이 아니다.
  if (hasClock) {
    if (!coordination && !AVAILABLE.test(raw) && !PROPOSE.test(raw)) {
      return { ...none, constraints, needsModel: true };  // 애매하다 — 위층이 모델에 물어볼 수 있다
    }
    if (PROPOSE.test(raw)) return { intent: "proposal", confidence: 0.85, constraints, needsModel: false };
    if (AVAILABLE.test(raw)) return { intent: "availability", confidence: 0.8, constraints, needsModel: false };
    return { intent: "scheduling_request", confidence: 0.6, constraints, needsModel: false };
  }

  if (PLACE.test(raw)) return { intent: "place", confidence: 0.6, constraints, needsModel: false };
  if (coordination) return { intent: "scheduling_request", confidence: 0.55, constraints, needsModel: false };

  return none;
}
