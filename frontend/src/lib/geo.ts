// 좌표 기반 이동시간 추정 — 유료 길찾기 API 없이 로컬 계산(무료).
// 실제 지도 연동 시 x/y(스키매틱 0~100) → lat/lng, 추정 → 실경로로 교체 가능.

export type Point = { x: number; y: number };

/** 데모용 "현재 위치"(스키매틱). 실제 앱에선 GPS로 대체. */
export const CURRENT_LOC: Point = { x: 50, y: 96 };

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** 직선거리 → 도보 예상(분). 계수는 스키매틱 튜닝값. */
export const walkMinutes = (a: Point, b: Point) =>
  Math.max(1, Math.round(distance(a, b) * 0.7));

// ── 실제 좌표(위경도) 기반 도보 계산 — 무료(로컬 계산). 캠퍼스는 직선≈도보로 충분히 근사. ──
export type LatLng = { lat: number; lng: number };

/** 두 위경도 사이 실제 거리(m) — 하버사인 공식. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000; // 지구 반지름(m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** 도보 속도 ≈ 75 m/분(약 4.5km/h) 기준, 거리(m) → 소요(분, 최소 1). */
export const walkMinutesFromMeters = (m: number) => Math.max(1, Math.round(m / 75));

/** 위경도 두 지점의 도보 예상(분). 좌표 없으면 null. */
export function realWalkMinutes(a?: LatLng | null, b?: LatLng | null): number | null {
  if (!a || !b) return null;
  return walkMinutesFromMeters(haversineMeters(a, b));
}

/**
 * "지금 출발" 판단 — 이동시간 + 버퍼를 고려해 출발할 시각이 되었는지.
 * @param startMs 일정 시작(ms), @param nowMs 현재(ms), @param travelMin 이동(분)
 */
export function shouldLeaveNow(startMs: number, nowMs: number, travelMin: number, bufferMin = 5) {
  const leaveAt = startMs - (travelMin + bufferMin) * 60_000;
  return nowMs >= leaveAt && nowMs < startMs;
}
