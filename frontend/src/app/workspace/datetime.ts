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

/** 일정 칩에 적는 짧은 날짜.
 *
 *  칩은 지금까지 제목만 들고 있었고 날짜는 툴팁 뒤에 숨어 있었다. 그래서 "함께하는 일정"
 *  줄을 보면 **어느 것이 지났고 어느 것이 앞으로인지 알 수 없었다** — 손을 올려 봐야 알았다.
 *  칩 자리(`rmg-pwith-at`)는 처음부터 이걸 담으려고 있던 칸이다. 이제 채운다.
 *
 *  오늘·내일·어제는 날짜보다 그 말이 빠르다. 해가 다르면 연도까지 적는다 —
 *  "8/20" 만으로는 그게 올해인지 작년인지 알 수 없고, 모르면 날짜가 거짓말을 한다. */
export function eventStamp(d: Date, en: boolean, now: Date = new Date()): string {
  const days = Math.round(
    (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000,
  );
  if (days === 0) return en ? "Today" : "오늘";
  if (days === 1) return en ? "Tomorrow" : "내일";
  if (days === -1) return en ? "Yesterday" : "어제";
  if (d.getFullYear() !== now.getFullYear()) {
    return `${String(d.getFullYear()).slice(2)}.${d.getMonth() + 1}.${d.getDate()}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
