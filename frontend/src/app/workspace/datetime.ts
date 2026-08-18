/**
 * Comein · 이 화면이 쓰는 아주 작은 날짜·시각 도구.
 *
 * 하루를 가리키는 키가 이 앱에 둘 있다. 여기의 dayKey 는 `2026-7-19`(월이 0부터)이고,
 * lib/store 의 dayKeyOf 는 `2026-08-19`(사람이 읽는 꼴)다. 전자는 화면 안에서만 도는
 * 비교용이고 후자는 저장되는 키라 모양이 다르다 — 섞어 쓰면 조용히 안 맞으니 이름을 갈라 둔다.
 */

export const pad = (n: number | string) => String(n).padStart(2, "0");

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
