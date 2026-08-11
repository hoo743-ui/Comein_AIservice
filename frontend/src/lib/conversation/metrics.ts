// 무슨 일이 얼마나 일어났는가 — 관측(§35).
//
// 지키는 선이 하나 있고, 그게 이 파일이 이렇게 작은 이유다:
// **메시지 내용도, 일정 제목도, 사람 이름도 여기 담기지 않는다**(§31).
// 담기는 것은 숫자뿐이다 — 몇 번 권했고, 몇 번 받아들여졌고, 몇 번 실패했는가.
//
// 대시보드를 만들지 않는다. 지금 필요한 것은 "제안이 쓸모 있었나" 를 나중에
// 답할 수 있게 세어 두는 것까지다. 보내는 곳은 나중에 정한다(sink 를 갈아 끼우면 된다).

export type MetricName =
  | "suggestion.shown"
  | "suggestion.accepted"
  | "suggestion.dismissed"
  | "summary.generated"
  | "state.saved"
  | "state.stale"        // 낙관적 잠금에 막힘 — 잦으면 저장 주기가 잘못된 것이다
  | "engine.error";

const counts = new Map<MetricName, number>();

/** 어디로 내보낼지. 기본은 아무 데도 아니다 — 개발 중에 콘솔을 더럽히지 않는다. */
let sink: ((name: MetricName, total: number) => void) | null = null;

export function setMetricSink(fn: typeof sink) {
  sink = fn;
}

export function track(name: MetricName, by = 1): void {
  const total = (counts.get(name) ?? 0) + by;
  counts.set(name, total);
  try {
    sink?.(name, total);
  } catch {
    /* 관측이 제품을 넘어뜨리지 않는다 */
  }
}

/** 지금까지의 수치. 테스트와 디버깅용. */
export const snapshot = (): Record<string, number> => Object.fromEntries(counts);

export const resetMetrics = (): void => void counts.clear();

/** 받아들여진 비율 — 제안이 쓸모 있었는지 묻는 가장 짧은 질문. */
export function acceptanceRate(): number | null {
  const shown = counts.get("suggestion.shown") ?? 0;
  if (!shown) return null;
  return (counts.get("suggestion.accepted") ?? 0) / shown;
}
