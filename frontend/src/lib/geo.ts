// 좌표 기반 이동시간 추정 — 유료 길찾기 API 없이 로컬 계산(무료).
// 실제 지도 연동 시 x/y(스키매틱 0~100) → lat/lng, 추정 → 실경로로 교체 가능.

export type Point = { x: number; y: number };

/** 데모용 "현재 위치"(스키매틱). 실제 앱에선 GPS로 대체. */
export const CURRENT_LOC: Point = { x: 50, y: 96 };

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** 직선거리 → 도보 예상(분). 계수는 스키매틱 튜닝값. */
export const walkMinutes = (a: Point, b: Point) =>
  Math.max(1, Math.round(distance(a, b) * 0.7));

/**
 * "지금 출발" 판단 — 이동시간 + 버퍼를 고려해 출발할 시각이 되었는지.
 * @param startMs 일정 시작(ms), @param nowMs 현재(ms), @param travelMin 이동(분)
 */
export function shouldLeaveNow(startMs: number, nowMs: number, travelMin: number, bufferMin = 5) {
  const leaveAt = startMs - (travelMin + bufferMin) * 60_000;
  return nowMs >= leaveAt && nowMs < startMs;
}
