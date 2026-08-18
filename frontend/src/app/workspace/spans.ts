/**
 * Comein · 하루 위에 놓인 구간들.
 *
 * 일정 하나는 시각 하나가 아니라 '시작과 끝을 가진 구간' 이다. 원(24시간 지도)과
 * 세로 시간표가 같은 구간을 다르게 그리므로, 구간을 만드는 일은 한자리에서 한다.
 */

import { fmtTime } from "@/lib/format";
import { dayKey, hhmm } from "./datetime";
import type { EventCategory } from "@/lib/mode";
import type { Receipt } from "./nav";
import type { Lang } from "./i18n";

/** 하루의 일정을 그 날짜 안의 분(分) 구간으로 — 스케줄과 AI 영수증을 한 모양으로 합친다.
 *
 *  자정 넘김(23:00~01:00)은 날짜마다 걸치는 부분만 잘라 담는다 → 그 일정은 두 날 모두에 나타난다.
 *  종일(24시간 이상)은 특정 시간대의 arc 로 그리면 거짓말이 되므로 따로 표시한다(allDay).
 *  시각은 모두 사용자의 로컬 시간 — Date 의 getHours 계열이 곧 로컬 기준이다. */
export type Span = {
  id: string; title: string;
  from: number; to: number;      // 그 날 자정으로부터의 분. 0 ≤ from < to ≤ 1440
  pending: boolean; allDay: boolean;
  startAt: Date; endAt: Date;    // 원래의 시각(잘리기 전) — 툴팁은 이걸 보여준다
  cutStart: boolean; cutEnd: boolean; // 전날/다음날에서 이어지는가
  /** 데이터에 끝 시각이 있었는가. 없으면 원 위에 '점'으로만 찍는다 —
   *  없는 길이를 그려 넣으면 화면이 데이터에 없는 말을 하게 된다. */
  hasEnd: boolean;
  /** 이 일정의 갈래. 유형(Context)에 따라 다른 이름으로 읽히지만 값은 하나다. */
  category?: EventCategory;
};

export const MIN_ARC = 6; // 아주 짧은 일정도 원 위에서 사라지지 않을 최소 폭(분)

export function spansOf(day: Date, schedules: any[], mine: Receipt[], base: Date | null): Span[] {
  const d0 = new Date(day); d0.setHours(0, 0, 0, 0);
  const dayStart = +d0, dayEnd = dayStart + 86_400_000;
  const out: Span[] = [];

  const add = (id: string, title: string, st: Date, en: Date, pending: boolean, hasEnd = true, category?: EventCategory) => {
    if (!(+st < dayEnd && +en > dayStart)) return; // 이 날에 걸치지 않음
    const allDay = +en - +st >= 86_400_000;
    const from = Math.max(0, Math.round((+st - dayStart) / 60_000));
    const rawTo = Math.min(1440, Math.round((+en - dayStart) / 60_000));
    out.push({
      id, title, from, to: Math.max(rawTo, Math.min(1440, from + MIN_ARC)),
      pending, allDay, startAt: st, endAt: en, hasEnd, category,
      cutStart: +st < dayStart, cutEnd: +en > dayEnd,
    });
  };

  for (const s of schedules) {
    const st = new Date(s.start);
    if (Number.isNaN(+st)) continue;
    // 표(시간표)는 면적이 있어야 보이므로 1시간으로 두되, 그게 데이터가 아니라는 사실은 남긴다.
    const raw = s.end ? new Date(s.end) : null;
    const ok = raw && !Number.isNaN(+raw) && +raw > +st;
    add(String(s.id), s.title, st, ok ? raw! : new Date(+st + 3_600_000), s.status === "pending", !!ok, s.category);
  }
  // 영수증은 여기에 얹지 않는다.
  // 시각이 있는 캡처는 이미 addSchedule 로 진짜 일정이 되어 위 반복문에 들어와 있다 —
  // 여기서 한 번 더 그리면 같은 일정이 두 줄로 보인다("19:00 팀 회식" 이 두 번 뜨던 것).
  // (calItems 는 같은 이유로 이미 영수증을 뺐는데, 원·시간표를 그리는 이쪽만 남아 있었다.)
  return out.sort((a, b) => a.from - b.from || a.to - b.to);
}

/** 툴팁에 쓸 시간 범위. 자정을 넘겼으면 어느 쪽으로 이어지는지 함께 알린다. */
export function spanRange(s: Span, lang: Lang): string {
  if (s.allDay) return lang === "en" ? "All day" : "종일";
  const a = hhmm(s.startAt), b = hhmm(s.endAt);
  if (s.cutStart) return `${lang === "en" ? "from prev. day" : "전날부터"} · ${a} – ${b}`;
  if (s.cutEnd) return `${a} – ${b} ${lang === "en" ? "(next day)" : "(다음 날)"}`;
  return `${a} – ${b}`;
}

// ── 하루 타임테이블의 좌표계 ──
// 시간 ↔ 화면 위치를 잇는 규칙은 여기 셋뿐이다. 어떤 카드도 top/height 를 손으로 갖지 않는다.
// 하루는 자정에서 자정까지다. 06시부터 그리면 새벽에 일하는 사람의 하루가 화면에서 사라진다
// — 데이터에는 있는데 볼 수 없는 시간대를 만들지 않는다. 대신 열 때 '지금' 근처로 스크롤한다.
export const TT_FROM = 0, TT_TO = 24;   // 00:00 ~ 24:00

export const TT_ROW = 56;               // 1시간 = 56px. 화면이 커져도 이 간격은 변하지 않는다.

export const TT_MIN_H = 24;             // 아주 짧은 일정도 제목이 깨지지 않을 최소 높이

export const TT_GAP = 6;                // 나란히 선 카드 사이

/** 겹치는 일정을 가로로 나눈다.
 *  서로 걸치는 것끼리 한 덩어리로 묶고, 그 덩어리 안에서만 열을 쪼갠다 →
 *  하루에 겹치는 일정이 하나라도 있다고 해서 나머지 일정까지 좁아지지 않는다. */
export function layoutSpans(spans: Span[]): Map<string, { col: number; cols: number }> {
  const out = new Map<string, { col: number; cols: number }>();
  const sorted = [...spans].sort((a, b) => a.from - b.from || a.to - b.to);
  let cluster: Span[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const colEnd: number[] = [];       // 열별 마지막 끝 시각
    const colOf = new Map<string, number>();
    for (const s of cluster) {
      let c = colEnd.findIndex((e) => e <= s.from);
      if (c === -1) { c = colEnd.length; colEnd.push(0); }
      colEnd[c] = s.to;
      colOf.set(s.id, c);
    }
    for (const s of cluster) out.set(s.id, { col: colOf.get(s.id) ?? 0, cols: colEnd.length });
    cluster = [];
    clusterEnd = -1;
  };

  for (const s of sorted) {
    if (cluster.length && s.from >= clusterEnd) flush();
    cluster.push(s);
    clusterEnd = Math.max(clusterEnd, s.to);
  }
  flush();
  return out;
}

/** 그 날 자정으로부터의 분 → 캔버스 세로 위치(px) */
export const timeToPosition = (minutes: number) => ((minutes - TT_FROM * 60) / 60) * TT_ROW;

/** 일정 → 시작 위치(px) */
export const eventToPosition = (s: Span) => timeToPosition(s.from);

/** 일정 → 높이(px). 길수록 길어지되, 너무 짧으면 최소 높이를 지킨다. */
export const eventDurationToHeight = (s: Span) => Math.max(((s.to - s.from) / 60) * TT_ROW, TT_MIN_H);
