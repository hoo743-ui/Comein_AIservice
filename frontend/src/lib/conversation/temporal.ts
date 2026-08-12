// 대화 속의 시간 — 말에서 시각을 읽어 내는 자리.
//
// 여기서 AI 를 부르지 않는다. "내일 3시 이후" 같은 말은 규칙으로 충분히 읽히고,
// 규칙은 공짜이며 언제나 같은 답을 준다(§27 — 사실은 결정론적 코드가 정한다).
// 읽지 못하면 조용히 빈 손으로 돌아온다. 어림짐작으로 시각을 지어내지 않는다.

/** 말 한 조각이 시간에 대해 건 조건. */
export type ConstraintKind =
  | "after"   // "3시 이후", "3시부터"
  | "before"  // "5시 전", "5시까지"
  | "at"      // "3시에"
  | "day";    // 날짜만 짚은 말 — "내일", "금요일"

export interface TemporalConstraint {
  kind: ConstraintKind;
  /** 기준 시각(로컬). kind=day 면 그 날의 자정. */
  at: Date;
  /** 이 조건을 읽어 낸 원문 조각 — 사람에게 되돌려 보여 줄 때 쓴다. */
  text: string;
  /** 날짜를 말에서 직접 짚었는가.
   *  "3시 이후" 는 날짜가 없다 — 앞선 "내일" 에 얹혀야 하고, 그 판단은 위층이 한다.
   *  이 칸이 없으면 "내일 언제 볼까 / 3시 이후 괜찮아" 가 서로 다른 날로 갈린다(실제로 그랬다). */
  hasDay: boolean;
}

const DAY_WORDS: Record<string, number> = { "그저께": -2, "어제": -1, "오늘": 0, "내일": 1, "모레": 2, "글피": 3 };
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 날짜를 말하지 않은 조건을, 앞서 정해진 날 위로 옮긴다.
 * "내일 언제 볼까" → "3시 이후 괜찮아" 의 3시는 오늘이 아니라 내일 3시다.
 */
export function anchorToDay(c: TemporalConstraint, day: Date): TemporalConstraint {
  if (c.hasDay || c.kind === "day") return c;
  const at = new Date(day);
  at.setHours(c.at.getHours(), c.at.getMinutes(), 0, 0);
  return { ...c, at };
}

/** 자정으로 내린 사본 — 원본을 건드리지 않는다. */
const atMidnight = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** 기준일로부터 며칠 뒤 — 날짜만 옮기고 시각은 유지한다. */
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/**
 * 텍스트에서 '어느 날' 을 읽는다. 못 읽으면 null.
 * 요일은 늘 앞으로 본다 — "금요일에 보자" 가 지난 금요일일 리 없다.
 */
export function readDay(text: string, now: Date): { day: Date; text: string } | null {
  for (const [word, delta] of Object.entries(DAY_WORDS)) {
    if (text.includes(word)) return { day: atMidnight(addDays(now, delta)), text: word };
  }
  const wd = text.match(/(다음\s*주\s*)?([일월화수목금토])요일/);
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[2]);
    let delta = (target - now.getDay() + 7) % 7;
    if (delta === 0) delta = 7;                 // "화요일에 보자" 를 오늘로 읽지 않는다
    if (wd[1]) delta += 7;                      // 다음 주
    return { day: atMidnight(addDays(now, delta)), text: wd[0] };
  }
  const md = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (md) {
    const m = Number(md[1]), d = Number(md[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const x = atMidnight(now);
      x.setMonth(m - 1, d);
      // 이미 지난 날짜를 말했다면 내년으로 — 12월에 "1월 3일" 은 다음 해다.
      if (+x < +atMidnight(now)) x.setFullYear(x.getFullYear() + 1);
      return { day: x, text: md[0] };
    }
  }
  return null;
}

/** 텍스트에서 '몇 시' 를 읽는다. 분까지. 못 읽으면 null. */
export function readClock(text: string): { hour: number; minute: number; text: string } | null {
  const m = text.match(/(오전|오후|아침|점심|저녁|밤)?\s*(\d{1,2})\s*(?::(\d{2})|시(?:\s*(\d{1,2})\s*분)?)/);
  if (!m) return null;
  let hour = Number(m[2]);
  const minute = Number(m[3] ?? m[4] ?? 0);
  if (hour > 23 || minute > 59) return null;
  const pm = m[1] === "오후" || m[1] === "저녁" || m[1] === "밤";
  const am = m[1] === "오전" || m[1] === "아침";
  if (pm && hour < 12) hour += 12;
  else if (am && hour === 12) hour = 0;
  // 오전·오후를 붙이지 않은 한 자리 시각은 대개 오후다 — "3시에 보자" 는 새벽 3시가 아니다.
  // 다만 ':' 로 적은 시각(15:00)은 사람이 이미 24시간으로 말한 것이므로 건드리지 않는다.
  else if (!m[1] && !m[3] && hour >= 1 && hour <= 7) hour += 12;
  return { hour, minute, text: m[0] };
}

/**
 * 한 문장이 건 시간 조건들. 조건이 없으면 빈 배열.
 *
 * "3시 이후 괜찮아"        → [after 15:00]
 * "5시까지는 가능해"        → [before 17:00]
 * "내일 3시 어때"           → [at 내일 15:00]
 * "내일 언제 볼까"          → [day 내일]
 */
export function readConstraints(text: string, now: Date): TemporalConstraint[] {
  const out: TemporalConstraint[] = [];
  const dayHit = readDay(text, now);
  const base = dayHit?.day ?? atMidnight(now);
  const clock = readClock(text);

  if (clock) {
    const at = new Date(base);
    at.setHours(clock.hour, clock.minute, 0, 0);
    // 날짜를 말하지 않았는데 이미 지난 시각이면 다음 날로 — 지나간 시각을 잡을 리 없다.
    if (!dayHit && +at < +now) at.setDate(at.getDate() + 1);

    const tail = text.slice(text.indexOf(clock.text) + clock.text.length, text.indexOf(clock.text) + clock.text.length + 8);
    const kind: ConstraintKind =
      /이후|부터|넘어서|지나서/.test(tail) ? "after"
        : /이전|전에|까지|안으로/.test(tail) ? "before"
          : "at";
    out.push({ kind, at, text: `${dayHit ? dayHit.text + " " : ""}${clock.text}`, hasDay: !!dayHit });
    return out;
  }

  if (dayHit) out.push({ kind: "day", at: dayHit.day, text: dayHit.text, hasDay: true });
  return out;
}

/** 지금을, 사용자가 보고 있는 벽시계 그대로 적는다.
 *
 * `toISOString()` 은 언제나 UTC(`…Z`)로 적는다 — 같은 순간을 가리키지만 **벽시계가 사라진다.**
 * 그 값을 AI 에게 "지금" 이라고 건네면 "내일 3시" 가 UTC 3시로 잡힌다. 서울에서는 9시간 어긋나
 * 다음 날 자정이 된다(실제로 그랬다: `2026-08-13T15:00:00+00:00`).
 *
 * 그래서 날짜·시각은 로컬로 적고, 오프셋을 뒤에 붙여 어느 자리의 시각인지 함께 보낸다.
 * 시간대 이름(`Asia/Seoul`)만 보내는 것으로는 부족하다 — 받는 쪽이 그 이름을 풀 수 있어야 하고,
 * 서버 OS 에 따라 그러지 못한다. 오프셋은 어디서나 읽힌다.
 */
export function localIsoNow(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const offMin = -now.getTimezoneOffset();          // 분 단위, 동쪽이 +
  const sign = offMin >= 0 ? "+" : "-";
  const abs = Math.abs(offMin);
  return (
    `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}` +
    `T${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}` +
    `${sign}${p(Math.floor(abs / 60))}:${p(abs % 60)}`
  );
}
