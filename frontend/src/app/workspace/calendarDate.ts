/**
 * Comein · 날짜를 말로 찾는다.
 *
 * "다음 학기", "8월 둘째 주", "회의 있는 날" — 달력에서 날짜를 고르는 일이
 * 늘 숫자로 시작하지는 않는다. 여기서 그 말을 하루로 옮긴다.
 */

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 왼쪽 여백의 월간 캘린더 — 익숙한 그리드, 오늘 표시, 일정 있는 날 점, 날짜 클릭 선택. */
export const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const WEEKDAYS_EN = ["S", "M", "T", "W", "T", "F", "S"];

/** 자연어 → 날짜. Comein의 AI 캘린더 탐색: 날짜 형식을 기억할 필요 없이 말로 이동한다. */
export function parseNaturalDate(raw: string, now: Date, events: Date[]): { date: Date; label: string } | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mk = (y: number, m: number, d: number) => new Date(y, m, d);
  const add = (b: Date, days: number) => { const x = new Date(b); x.setDate(x.getDate() + days); return x; };
  const addMonths = (b: Date, n: number) => { const x = new Date(b); x.setDate(1); x.setMonth(x.getMonth() + n); return x; };
  const firstOf = (d: Date) => mk(d.getFullYear(), d.getMonth(), 1);

  if (/오늘|today/.test(s)) return { date: today, label: "오늘" };
  if (/내일|tomorrow/.test(s)) return { date: add(today, 1), label: "내일" };
  if (/모레/.test(s)) return { date: add(today, 2), label: "모레" };
  if (/글피/.test(s)) return { date: add(today, 3), label: "글피" };
  if (/어제|yesterday/.test(s)) return { date: add(today, -1), label: "어제" };
  if (/다음\s*주|next\s*week/.test(s)) return { date: add(today, 7), label: "다음 주" };
  if (/지난\s*주|저번\s*주|last\s*week/.test(s)) return { date: add(today, -7), label: "지난 주" };
  if (/이번\s*주|this\s*week/.test(s)) return { date: today, label: "이번 주" };
  if (/다음\s*달|담달|next\s*month/.test(s)) return { date: firstOf(addMonths(today, 1)), label: "다음 달" };
  if (/지난\s*달|저번\s*달|last\s*month/.test(s)) return { date: firstOf(addMonths(today, -1)), label: "지난 달" };
  if (/이번\s*달|this\s*month/.test(s)) return { date: firstOf(today), label: "이번 달" };

  let m = s.match(/(\d+)\s*개?월\s*(뒤|후|later|후에)/) || s.match(/in\s*(\d+)\s*months?/);
  if (m) return { date: firstOf(addMonths(today, parseInt(m[1], 10))), label: `${m[1]}개월 뒤` };
  m = s.match(/(\d+)\s*주\s*(뒤|후)/) || s.match(/in\s*(\d+)\s*weeks?/);
  if (m) return { date: add(today, parseInt(m[1], 10) * 7), label: `${m[1]}주 뒤` };
  m = s.match(/(\d+)\s*일\s*(뒤|후)/) || s.match(/in\s*(\d+)\s*days?/);
  if (m) return { date: add(today, parseInt(m[1], 10)), label: `${m[1]}일 뒤` };

  if (/다음\s*학기|next\s*semester/.test(s)) {
    const mo = today.getMonth(); let ty = today.getFullYear(), tm;
    if (mo < 2) tm = 2; else if (mo < 8) tm = 8; else { tm = 2; ty += 1; }
    return { date: mk(ty, tm, 1), label: "다음 학기" };
  }
  if (/크리스마스|christmas|성탄/.test(s)) { let y = today.getFullYear(); if (today.getMonth() === 11 && today.getDate() > 25) y++; return { date: mk(y, 11, 25), label: "크리스마스" }; }
  if (/새해|신정|new\s*year/.test(s)) return { date: mk(today.getFullYear() + 1, 0, 1), label: "새해" };

  let ym = s.match(/(\d{4})\s*년\s*(\d{1,2})\s*월/) || s.match(/(\d{4})[-./](\d{1,2})/);
  if (ym) { const y = +ym[1], mm = Math.min(12, Math.max(1, +ym[2])) - 1; return { date: mk(y, mm, 1), label: `${y}년 ${mm + 1}월` }; }

  const wk = s.match(/(\d{1,2})\s*월\s*(첫|둘|셋|넷|다섯)\s*(?:째|번째)?\s*주/);
  if (wk) {
    const mm = Math.min(12, Math.max(1, +wk[1])) - 1;
    const idx = { "첫": 0, "둘": 1, "셋": 2, "넷": 3, "다섯": 4 }[wk[2]] ?? 0;
    let y = today.getFullYear(); if (mm < today.getMonth()) y++;
    const last = new Date(y, mm + 1, 0).getDate();
    return { date: mk(y, mm, Math.min(1 + idx * 7, last)), label: `${mm + 1}월 ${wk[2]}째 주` };
  }
  let mo = s.match(/(\d{1,2})\s*월/);
  const enMo = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  if (mo || enMo) {
    let mm: number;
    if (mo) mm = Math.min(12, Math.max(1, +mo[1])) - 1;
    else mm = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(enMo![1]);
    let y = today.getFullYear(); if (mm < today.getMonth()) y++;
    return { date: mk(y, mm, 1), label: `${mm + 1}월` };
  }

  // 데이터 기반 — 회의/발표/일정 있는 날: 가장 가까운 미래 일정
  if (/회의|미팅|발표|일정|약속|meeting|event/.test(s) && events.length) {
    const future = events.map((e) => new Date(e)).filter((e) => e >= today).sort((a, b) => a.getTime() - b.getTime());
    if (future.length) return { date: future[0], label: "다가오는 일정" };
  }
  return null;
}
