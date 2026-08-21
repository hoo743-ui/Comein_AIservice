"use client";

/**
 * Comein · 하루를 보는 두 방식.
 *
 *   DayDial       모양으로 — 24시간 원. 하루의 밀도와 '비어 있는 자리'가 한눈에 보인다.
 *   DayTimetable  순서로 — 시간축 위의 판. 무엇이 언제, 얼마나 걸리는지 정확히 읽힌다.
 *
 * 둘은 같은 것을 그린다. 재료(`Span`)도 좌표 계산도 `../spans` 한 곳에서 나온다 —
 * 원과 시간표가 서로 다른 하루를 그리는 일이 없도록.
 *
 * CalendarView 는 그 둘과 달력을 한 화면에 앉히는 자리다.
 */

import * as React from "react";

import { fmtDate } from "@/lib/format";
import { MODE_CONFIG, classifyEvent, useCurrentMode } from "@/lib/mode";
import type { EventParticipant } from "@/lib/types";
import { MonthCalendar } from "./MonthCalendar";
import { dayKey, hhmm, pad } from "../datetime";
import { L, type Lang } from "../i18n";
import type { Receipt } from "../nav";
import {
  TT_FOLD_FROM, TT_FROM, TT_GAP, TT_MIN_H, TT_ROW, TT_TO,
  eventDurationToHeight, eventToPosition, layoutClusters, layoutSpans, spanRange, spansOf, timeToPosition,
  type Span, type SpanCluster,
} from "../spans";

/** 자정으로부터의 분 → "HH:MM". 접힌 덩어리는 Date 가 아니라 분으로 범위를 들고 있다. */
const minHHMM = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

/** Calendar — 월(月)과 그날의 24시간 원이 나란히. 날짜를 고르면 화면은 그대로 두고 오른쪽 원만 바뀐다.
 *  타임테이블(표)은 화면을 갈아치우는 일이므로 사용자가 스스로 눌렀을 때만 연다. */
export function CalendarView({ schedules, mounted, now, mine, lang, onAddSchedule, selectedDay, onSelectDay, participantsOf, onOpenEvent, onSearchDay, focusDay }: any) {
  const t = L(lang as Lang);
  const base = (now as Date | null) ?? null;
  // 선택 날짜는 워크스페이스가 쥔다 — 왼쪽 상시 달력·가운데 큰 달력·오른쪽 24시간 원이 같은 하루를 본다.
  const setSelected = onSelectDay as (d: Date) => void;
  const [timetable, setTimetable] = React.useState(false);

  if (!mounted || !base) return null;
  const day = (selectedDay as Date | null) ?? base;

  const allDates = [
    ...schedules.map((s: any) => new Date(s.start)),
    ...mine.map((r: Receipt) => r.date ?? base),
  ];
  const spans = spansOf(day, schedules, mine, base);
  const isToday = dayKey(day) === dayKey(base);
  const dayLabel = isToday ? (lang === "en" ? "Today" : "오늘") : fmtDate(day);

  // ── 타임테이블(표) — '시간표로 보기'를 눌렀을 때만 ──
  if (timetable) {
    return (
      <div className="rmg-cv" key="timetable">
        {/* 제목은 페이지 헤더가 이미 '캘린더' 라고 말했다 — 여기서 또 쓰지 않는다.
            남는 건 두 가지: 어디로 돌아가는지, 그리고 지금 보고 있는 하루가 언제인지.
            날짜 양옆의 화살표로 하루씩 옮긴다(달력으로 나갔다 다시 들어올 이유가 없다). */}
        <div className="rmg-cv-head">
          <button type="button" className="rmg-cv-back" onClick={() => setTimetable(false)}>
            ‹ {lang === "en" ? "Month" : "달력"}
          </button>
          <div className="rmg-cv-daynav">
            <button
              type="button"
              className="rmg-tl-nav"
              onClick={() => { const d = new Date(day); d.setDate(d.getDate() - 1); onSelectDay?.(d); }}
              aria-label={lang === "en" ? "Previous day" : "이전 날"}
            >‹</button>
            <p className="rmg-cv-title">
              {fmtDate(day)}
              {isToday && <span className="rmg-cv-todaytag">{lang === "en" ? "Today" : "오늘"}</span>}
            </p>
            <button
              type="button"
              className="rmg-tl-nav"
              onClick={() => { const d = new Date(day); d.setDate(d.getDate() + 1); onSelectDay?.(d); }}
              aria-label={lang === "en" ? "Next day" : "다음 날"}
            >›</button>
          </div>
          <span className="rmg-cv-spacer" />
        </div>
        <DayTimetable day={day} spans={spans} now={base} lang={lang} onAdd={onAddSchedule} onOpenEvent={onOpenEvent} participantsOf={participantsOf} onDay={onSelectDay} />
      </div>
    );
  }

  // ── 월(月) 화면 — 왼쪽은 '어느 날', 오른쪽은 '그 하루의 모양'. ──
  return (
    <div className="rmg-cv" key="month">
      <div className="rmg-cv-split">
        <div className="rmg-cv-col">
          <MonthCalendar
            big
            base={base}
            events={allDates}
            selected={day}
            /* 고른 날을 다시 누르면 그 날 안으로 들어간다 — 선택과 진입을 한 손짓으로 잇는다. */
            onSelect={(d: Date) => (dayKey(d) === dayKey(day) ? setTimetable(true) : setSelected(d))}
            lang={lang}
            /* 말로 날짜 찾기 — "다음 학기", "8월 둘째 주" 처럼 적으면 그 달로 옮겨 간다. */
            onSearch={onSearchDay}
            focusDate={focusDay}
          />
        </div>
        <div className="rmg-cv-col">
          <div className="rmg-cv-ringhead">
            {/* 시간표로 가는 길은 달력에 남겨둔다 — 고른 날을 한 번 더 누르면 그 날 안으로 들어간다.
                버튼을 따로 두지 않아 화면에 남는 말이 하나 줄었다. */}
            <p className="rmg-cv-eyebrow">{dayLabel} · {lang === "en" ? "24 hours" : "24시간"}</p>
          </div>
          {/* 원의 범례에서 일정을 누르면 그 일정의 상세·대화로 들어간다.
              ('다가오는 순간' 목록을 걷어낸 자리를 이 길이 대신한다.) */}
          <DayDial spans={spans} day={day} now={base} lang={lang} onOpenEvent={onOpenEvent} participantsOf={participantsOf} />
        </div>
      </div>
    </div>
  );
}

/** 24시간 원 — 초등학교 생활계획표의 그 원. 0시가 위, 시계 방향. 하루의 밀도를 한눈에 보는 시간 지도.
 *  색으로 구분하지 않는다(모노크롬 원칙) — 액센트 한 색의 농도 계단으로 인접 구간을 가른다. */
export function DayDial({ spans, day, now, lang, onOpenEvent }: {
  spans: Span[]; day: Date; now: Date; lang: Lang;
  onOpenEvent?: (id: string) => void;
  participantsOf?: (id: string) => EventParticipant[];
}) {
  // ── 좌표계 ──
  // 하루(1440분)를 한 바퀴로 편다. 0시가 위, 시계 방향 → 06시 오른쪽, 12시 아래, 18시 왼쪽.
  const C = 120;              // 중심 (viewBox 240)
  const R_RING = 92;          // 시간축 원
  const R_EVENT = 84;         // 일정 arc 가 앉는 반지름
  const EV_W = 7;             // arc 두께 — 원의 구조가 먼저 보이도록 얇게
  const R_LABEL = 108;        // 숫자는 원에서 충분히 떨어뜨린다

  /** 시각(분) → 각도(rad). 분 단위까지 그대로 반영한다 — 23:00 과 23:16 은 다른 각이다. */
  const timeToAngle = (min: number) => (min / 1440) * 2 * Math.PI - Math.PI / 2;
  const pt = (min: number, r: number) => {
    const a = timeToAngle(min);
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  /** 일정 → 원 위의 호. 시각의 경계를 또렷하게 긋는 획. */
  const eventToArc = (from: number, to: number, r: number) => {
    const [x1, y1] = pt(from, r), [x2, y2] = pt(to, r);
    const large = to - from > 720 ? 1 : 0;
    return `M${x1} ${y1}A${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };
  /** 일정 → 중심에서 뻗어 나간 부채꼴. 하루라는 면에서 '차지한 넓이' 를 그대로 보여 준다.
   *  획이 시각을 말한다면 면은 분량을 말한다 — 둘을 겹쳐야 "언제, 얼마나" 가 한 번에 읽힌다.
   *  면은 아주 옅게만 둔다. 진해지는 순간 이 화면은 차트가 되고 차분함을 잃는다. */
  const eventToWedge = (from: number, to: number, r: number) => {
    const [x1, y1] = pt(from, r), [x2, y2] = pt(to, r);
    const large = to - from > 720 ? 1 : 0;
    return `M${C} ${C}L${x1} ${y1}A${r} ${r} 0 ${large} 1 ${x2} ${y2}Z`;
  };

  // Context 는 훅으로 직접 읽는다 — 위에서 아래로 mode 를 계속 넘겨 주면
  // 이 컴포넌트를 어디에 놓든 부모가 그 사실을 알아야 한다.
  const mode = useCurrentMode();
  const [hover, setHover] = React.useState<string | null>(null);
  const [pinned, setPinned] = React.useState<string | null>(null);
  const activeId = pinned ?? hover;
  /** 펴 둔 시각 묶음(자정으로부터의 분). 하루가 바뀌면 비운다. */
  const [openDialTimes, setOpenDialTimes] = React.useState<Set<number>>(new Set());
  React.useEffect(() => setOpenDialTimes(new Set()), [day]);
  React.useEffect(() => { setPinned(null); setHover(null); }, [day]);

  const timed = spans.filter((s) => !s.allDay);
  const allDay = spans.filter((s) => s.allDay);

  // 여럿이 있어도 안쪽으로 물리지 않는다 — 모두 같은 반지름에 앉고, 서로는 색으로 갈린다.
  // (겹칠 때마다 반지름을 줄이면 같은 한 시간이 사건마다 다른 굵기로 그려져,
  //  '몇 시부터 몇 시까지' 를 읽는 기준이 매번 달라진다.)
  //
  // 색은 순서가 아니라 뜻으로 갈린다 — 같은 갈래(수업·회의·약속…)는 늘 같은 색이다.
  // 그래서 사용자 Context 가 바뀌면 같은 하루가 다른 무늬로 읽힌다: 화면을 복제하지 않고도.
  // 갈래를 못 읽은 것만 순서로 흩어 둔다(붙일 이름이 없을 뿐, 서로는 구분되어야 하므로).
  const cats = MODE_CONFIG[mode].eventCategories;
  const hueOf = new Map<string, number>();
  timed.forEach((s, i) => {
    const k = classifyEvent(s, mode);
    const at = cats.findIndex((c) => c.key === k);
    hueOf.set(s.id, at >= 0 ? at % 4 : i % 4);
  });

  const isToday = dayKey(day) === dayKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  /** 지금바늘은 좌표가 아니라 각도로 둔다 — 좌표를 다시 계산하면 갱신마다 툭 옮겨지지만,
   *  각도는 transform 이라 CSS 가 그 사이를 메워 준다(시계 초침처럼 미끄러진다). */
  const nowDeg = (nowMin / 1440) * 360;

  /** 둥근 끝을 쓰면 획 굵기의 절반만큼 양끝이 삐져나온다 — 그만큼 일정이 길어 보인다.
   *  그래서 그 길이(분)를 미리 깎고 둥글린다. 그러면 칠해진 끝이 실제 시각에 정확히 닿는다.
   *  일정의 길이가 곧 정보인 화면이라, 부드러움을 위해 길이를 속이지는 않는다. */
  const capMin = (r: number) => ((EV_W / 2) / (2 * Math.PI * r)) * 1440;

  const active = spans.find((s) => s.id === activeId) ?? null;
  const tipAt = active ? pt(active.allDay ? 0 : (active.from + active.to) / 2, R_EVENT) : null;

  return (
    <div className="rmg-dial" data-tour="dial">
      <div className="rmg-dial-stage">
        <svg viewBox="0 0 240 240" className="rmg-dial-svg"
          aria-label={lang === "en" ? "24-hour timeline" : "24시간 타임라인"}
          onMouseLeave={() => setHover(null)}
        >
          {/* 시간축 — 원 하나와 중앙의 점 하나. 살(spoke)을 중심까지 긋지 않는다:
              그 순간 이 그림은 시간 지도가 아니라 시계 문자판이 된다.
              중앙은 원이 아니라 점이다 — 원을 두면 그게 시계의 축으로 읽히고,
              점은 '여기가 하루의 한가운데' 라는 기준점으로만 남는다. */}
          <circle cx={C} cy={C} r={R_RING} className="rmg-dial-ring" />
          <circle cx={C} cy={C} r={2} className="rmg-dial-center" />


          {/* 눈금은 축 위에 얹힌 짧은 표식뿐이다. 15분 눈금은 두지 않는다 —
              베젤처럼 촘촘해지는 순간 시계로 읽힌다. 정시는 아주 짧고 옅게,
              3시간(00·03·…·21)만 조금 길게 긋고 숫자를 붙인다. */}
          {Array.from({ length: 24 }, (_, hh) => {
            const major = hh % 3 === 0;
            const [ax, ay] = pt(hh * 60, R_RING + (major ? 3 : 1.5));
            const [bx, by] = pt(hh * 60, R_RING - (major ? 3 : 1.5));
            const [lx, ly] = pt(hh * 60, R_LABEL);
            return (
              <g key={hh}>
                <line x1={ax} y1={ay} x2={bx} y2={by} className={`rmg-dial-tick ${major ? "major" : ""}`} />
                {major && <text x={lx} y={ly} className="rmg-dial-num">{pad(hh)}</text>}
              </g>
            );
          })}

          {/* 종일 — 시간대가 없으니 바깥을 한 바퀴 두르는 실선 */}
          {allDay.map((s, i) => (
            <circle
              key={s.id} cx={C} cy={C} r={R_RING + 6 + i * 4}
              className={`rmg-dial-allday ${activeId === s.id ? "on" : ""}`}
              onMouseEnter={() => setHover(s.id)}
              onClick={() => setPinned((p) => (p === s.id ? null : s.id))}
            />
          ))}

          {timed.map((s) => {
            const r = R_EVENT;
            const on = activeId === s.id;
            const dim = !!activeId && !on;
            const nowInside = isToday && nowMin >= s.from && nowMin <= s.to;
            const hue = `h${hueOf.get(s.id) ?? 0}`;
            const cls = `rmg-dial-arc ${hue} ${s.pending ? "pending" : ""} ${on ? "on" : ""} ${dim ? "dim" : ""} ${nowInside ? "current" : ""}`;
            const handlers = {
              onMouseEnter: () => setHover(s.id),
              onClick: () => setPinned((p) => (p === s.id ? null : s.id)),
            };
            const ci = capMin(r);
            // 끝 시각이 없거나, 둥근 끝 두 개보다 짧은 일정 — 없는 길이를 지어내지 않고 점으로 둔다.
            if (!s.hasEnd || s.to - s.from <= ci * 2.2) {
              const [px, py] = pt(s.hasEnd ? (s.from + s.to) / 2 : s.from, r);
              return (
                <g key={s.id} className="rmg-dial-ev">
                  <circle cx={px} cy={py} r={EV_W / 2.4} className={`${cls} point`} {...handlers} />
                </g>
              );
            }
            const [sx, sy] = pt(s.from, r), [ex, ey] = pt(s.to, r);
            // 시각축 위의 시작·끝 표식 — arc 만 있으면 "몇 시부터 몇 시까지인지" 를
            // 눈으로 되짚을 기준이 없다. 축을 가로지르는 짧은 선 두 개가 그 다리를 놓는다.
            // 정시 눈금보다 조금 더 또렷하되, 붙잡기 전까지는 여전히 조용하다.
            const edge = (min: number, key: string) => {
              const [ax, ay] = pt(min, R_RING + 3.5);
              const [bx, by] = pt(min, R_RING - 3.5);
              return <line key={key} x1={ax} y1={ay} x2={bx} y2={by} className={`rmg-dial-edge ${on ? "on" : ""} ${dim ? "dim" : ""}`} />;
            };
            return (
              <g key={s.id} className="rmg-dial-ev">
                {/* 그림에도 말을 붙인다 — 원을 못 보는 사람에게도 이 띠가 무엇인지 남는다(§37).
                    아래 목록이 본래의 텍스트 대안이지만, 원 자체가 침묵할 이유는 없다. */}
                <title>{`${s.title} · ${spanRange(s, lang)}`}</title>
                {edge(s.from, "from")}
                {edge(s.to, "to")}
                {/* 면 — 중심까지 채운 부채꼴. 하루에서 이 일정이 차지한 몫이 그대로 보인다.
                    끝을 깎지 않는다: 면의 두 변이 곧 시작·끝 시각의 선이어야 한다. */}
                <path
                  d={eventToWedge(s.from, s.to, r + EV_W / 2)}
                  className={`rmg-dial-wedge ${hue} ${on ? "on" : ""} ${dim ? "dim" : ""}`}
                  {...handlers}
                />
                {/* 획 — 바깥 테두리. 양끝을 둥글린 만큼 미리 깎아 둔다(칠해진 끝이 곧 실제 시각이다). */}
                <path d={eventToArc(s.from + ci, s.to - ci, r)} className={cls} strokeWidth={EV_W} {...handlers} />
                {/* 시작·끝 손잡이는 붙잡았을 때만 — 평소엔 띠 하나로 조용하다. */}
                {on && (
                  <>
                    <circle cx={sx} cy={sy} r={2.2} className="rmg-dial-handle" />
                    <circle cx={ex} cy={ey} r={2.2} className="rmg-dial-handle" />
                  </>
                )}
              </g>
            );
          })}

          {/* 지금 — 중심에서 테두리까지 한 줄로 잇는다.
              예전엔 반지름 77~97 구간만 그어 두어, 중심에도 닿지 않고 원에도 닿지 않은
              토막 하나가 허공에 떠 있었다. 무엇에 매인 표식인지 읽히지 않는다.
              시계처럼 보이는 것을 피하려던 것이었는데, 끊어 두는 것으로는 피해지지 않고
              어중간한 획만 남았다. 대신 농도로 푼다: 안쪽은 거의 보이지 않고 바깥 끝만
              또렷하다 — 눈은 '지금이 원의 어디인가' 에 머물고, 중심은 그저 이어져 있을 뿐이다.
              좌표가 아니라 회전으로 두어, 갱신될 때 그 사이를 CSS 가 메운다. */}
          {isToday && (
            <g className="rmg-dial-hand" style={{ transform: `rotate(${nowDeg}deg)`, transformOrigin: `${C}px ${C}px` }}>
              <line x1={C} y1={C} x2={C} y2={C - (R_EVENT - EV_W)} className="rmg-dial-now-in" />
              <line x1={C} y1={C - (R_EVENT - EV_W)} x2={C} y2={C - (R_RING + 5)} className="rmg-dial-now" />
            </g>
          )}
        </svg>

        {active && tipAt && (
          <div
            className={`rmg-dial-tip ${pinned ? "pinned" : ""}`}
            style={{ left: `${(tipAt[0] / 240) * 100}%`, top: `${(tipAt[1] / 240) * 100}%` }}
            role="status"
          >
            <span className="rmg-dial-tip-t">{active.title}</span>
            <span className="rmg-dial-tip-r">{spanRange(active, lang)}</span>
          </div>
        )}
      </div>

      {spans.length === 0 ? (
        <p className="rmg-dial-empty">{lang === "en" ? "Nothing planned." : "이 날은 비어 있어요."}</p>
      ) : (
        <ul className="rmg-dial-key">
          {spans.map((s, i) => {
            // 캡처로 만들어진 임시 항목(r-…)은 아직 일정이 아니라 열 상세가 없다.
            const eventId = s.id.startsWith("r-") ? null : s.id;

            // 같은 시각이 셋 이상 이어지면 첫 줄에서 한 번에 접는다(시간표·그날 목록과 같은 규칙).
            // 이 목록은 원(다이얼)이 그린 것을 말로 옮긴 것이라, 원에서 한 겹으로 겹쳐 보이는
            // 것을 여기서만 여섯 줄로 늘어놓으면 둘이 서로 다른 하루를 말하게 된다.
            const sameTime = (a: Span, b: Span) => !a.allDay && !b.allDay && a.from === b.from;
            const prevSame = i > 0 && sameTime(spans[i - 1], s);
            let runLen = 1;
            while (i + runLen < spans.length && sameTime(s, spans[i + runLen])) runLen++;
            const foldHere = !prevSame && runLen >= TT_FOLD_FROM && !openDialTimes.has(s.from);
            if (!prevSame && foldHere) {
              return (
                <li key={`fold-${s.from}`}>
                  <button
                    type="button"
                    className="rmg-dial-keyrow rmg-dial-fold"
                    aria-expanded={false}
                    onClick={() => setOpenDialTimes((p) => new Set(p).add(s.from))}
                  >
                    <span className={`rmg-dial-chip h${hueOf.get(s.id) ?? 0}`} />
                    <span className="rmg-dial-keytime">{hhmm(s.startAt)}</span>
                    <span className="rmg-dial-keytitle">
                      {lang === "en" ? `${s.title} +${runLen - 1} more` : `${s.title} 외 ${runLen - 1}건`}
                    </span>
                  </button>
                </li>
              );
            }
            // 접혀 있는 묶음의 나머지 줄들은 그리지 않는다 — 위의 한 줄이 대신 서 있다.
            if (prevSame) {
              let head = i;
              while (head > 0 && sameTime(spans[head - 1], spans[head])) head--;
              let len = 1;
              while (head + len < spans.length && sameTime(spans[head], spans[head + len])) len++;
              if (len >= TT_FOLD_FROM && !openDialTimes.has(spans[head].from)) return null;
            }
            return (
              // 원은 눈으로 읽는 그림이고, 이 목록이 그 그림의 말(text alternative)이다.
              // 그래서 목록은 반드시 키보드로 닿아야 한다 — 캘린더에서 일정을 여는 길이
              // 여기뿐이기 때문이다. 예전엔 li 에 onClick 만 걸려 있어 마우스로만 열렸다(§37).
              <li key={s.id}>
                <button
                  type="button"
                  className={`rmg-dial-keyrow ${activeId === s.id ? "on" : ""}`}
                  aria-current={activeId === s.id}
                  onMouseEnter={() => setHover(s.id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(s.id)}
                  onBlur={() => setHover(null)}
                  onClick={() => (eventId && onOpenEvent ? onOpenEvent(eventId) : setPinned((p) => (p === s.id ? null : s.id)))}
                >
                  {/* 목록의 표식과 원의 띠는 같은 색 — 눈이 둘을 하나로 잇는다. */}
                  <span className={`rmg-dial-chip h${hueOf.get(s.id) ?? 0} ${s.pending ? "pending" : ""} ${s.allDay ? "allday" : ""}`} />
                  <span className="rmg-dial-keytime">{s.allDay ? (lang === "en" ? "All day" : "종일") : hhmm(s.startAt)}</span>
                  {/* 접힌 상태에서 말하는 것은 시각과 제목뿐이다 — 참여자·메모·대화는
                      눌러서 열었을 때 그 일정의 맥락으로 한꺼번에 따라온다. */}
                  <span className="rmg-dial-keytitle">{s.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** 하루 타임테이블 — 왼쪽은 시간축(Time Gutter), 오른쪽은 일정이 놓이는 판(Event Canvas).
 *  빈 자리를 누르면 그 시각에 바로 한 줄 적어 넣고, 일정을 누르면 그 일정의 상세·대화로 간다. */
export function DayTimetable({ day, spans, now, lang, onAdd, onOpenEvent, participantsOf, onDay }: {
  day: Date; spans: Span[]; now: Date; lang: Lang;
  onAdd?: (title: string, start: Date) => void;
  onOpenEvent?: (id: string) => void;
  participantsOf?: (id: string) => EventParticipant[];
  /** 하루의 끝을 지나면 다음 날로 — 없으면 그냥 멈춘다. */
  onDay?: (d: Date) => void;
}) {
  const [openHour, setOpenHour] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (openHour !== null) inputRef.current?.focus(); }, [openHour]);

  const hours = Array.from({ length: TT_TO - TT_FROM }, (_, i) => i + TT_FROM);
  const isToday = dayKey(now) === dayKey(day);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowInRange = isToday && nowMin >= TT_FROM * 60 && nowMin <= TT_TO * 60;
  const { lay, clusters, clusterOf } = React.useMemo(() => layoutClusters(spans), [spans]);

  /** 펴 둔 덩어리. 접힌 칸을 누르면 그 덩어리만 열로 갈라진다(다시 누르면 접힌다).
   *  날이 바뀌면 비운다 — 어제 펴 둔 것을 오늘까지 들고 가면 왜 열려 있는지 알 수 없다. */
  const [opened, setOpened] = React.useState<Set<string>>(new Set());
  React.useEffect(() => setOpened(new Set()), [day]);
  const toggleCluster = (id: string) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  /** 지금 접혀 있는 덩어리들 — 셋 이상 겹쳤고, 아직 펴지 않은 것. */
  const folded = React.useMemo(() => {
    const m = new Map<string, SpanCluster>();
    for (const c of clusters) {
      if (c.ids.length >= TT_FOLD_FROM && !opened.has(c.id)) m.set(c.id, c);
    }
    return m;
  }, [clusters, opened]);

  const titleOf = React.useCallback(
    (id: string) => spans.find((s) => s.id === id)?.title ?? "",
    [spans],
  );
  const canvasH = (TT_TO - TT_FROM) * TT_ROW;

  /** 굴려서 날을 넘겼을 때 어느 끝에 세울 것인가. 버튼으로 넘어왔으면 null 이다. */
  const edge = React.useRef<"top" | "bottom" | null>(null);

  // 열자마자 지금 시각이 보이게 — 하루의 시작(06:00)부터 훑어 내려오게 하지 않는다.
  //
  // 자리를 잡는 일이 **여기 한 곳**에 있어야 하는 이유 — 굴려서 넘어온 경우를 onWheel 쪽에서
  // 따로 잡으면 둘이 경쟁한다. 실제로 그랬다: onWheel 의 rAF 가 React 의 리렌더보다 먼저
  // 돌아 옛 화면 위에 자리를 잡고, 뒤늦게 이 효과가 그것을 덮었다. 그래서 위로 거슬러
  // 올라가면 전날의 **23시**가 아니라 00시에 서 있었다 — 읽던 방향이 끊긴 것이다.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const from = edge.current;
    edge.current = null;
    // 다음 날은 위에서부터, 전날은 아래에서부터 — 읽던 방향이 이어진다.
    if (from) { el.scrollTop = from === "top" ? 0 : el.scrollHeight; return; }
    const target = nowInRange ? timeToPosition(nowMin) : spans.length ? eventToPosition(spans[0]) : 0;
    el.scrollTop = Math.max(0, target - el.clientHeight / 3);
  }, [day]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 하루의 끝에서 한 번 더 굴리면 다음 날로, 시작에서 거슬러 올리면 전날로.
   *
   *  시간표는 하루짜리인데 시간은 하루에서 끊기지 않는다. 23시를 보다가 자정 너머를
   *  보려면 지금까지는 위로 돌아가 날짜 버튼을 눌러야 했다 — 읽던 자리를 잃고 손이 멀어진다.
   *  끝에 닿았을 때 **한 번 더** 굴리는 것을 '넘긴다' 로 읽는다(닿자마자 넘기면 스크롤이
   *  미끄러질 때마다 날이 바뀐다). 넘어간 뒤에는 이어서 읽던 쪽 끝에 세운다. */
  const turning = React.useRef(false);
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || !onDay || turning.current) return;
    const atTop = el.scrollTop <= 0;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    const dir = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0;
    if (!dir || (dir > 0 && !atEnd) || (dir < 0 && !atTop)) return;
    turning.current = true;
    const next = new Date(day);
    next.setDate(next.getDate() + dir);
    edge.current = dir > 0 ? "top" : "bottom";   // 자리는 위 효과가 잡는다
    onDay(next);
    // 한 번의 손짓이 여러 날을 넘기지 않게 잠깐 잠근다.
    window.setTimeout(() => { turning.current = false; }, 320);
  };

  const submit = (h: number) => {
    const title = draft.trim();
    setOpenHour(null);
    setDraft("");
    if (!title || !onAdd) return;
    const start = new Date(day);
    start.setHours(h, 0, 0, 0);
    onAdd(title, start);
  };

  return (
    <div className="rmg-tt">
      <div className="rmg-tt-scroll" ref={scrollRef} onWheel={onWheel}>
        <div className="rmg-tt-grid" style={{ height: `${canvasH}px` }}>
          {hours.map((h) => (
            <React.Fragment key={h}>
              {/* 시각은 선 위에 걸터앉는다 — 선과 겹치지 않게 살짝 올려 둔다. */}
              <span className={`rmg-tt-label ${h === 0 || h === 12 ? "mark" : ""}`} style={{ top: `${timeToPosition(h * 60)}px` }}>{pad(h)}:00</span>
              <div className="rmg-tt-line" style={{ top: `${timeToPosition(h * 60)}px` }} />
              {/* 30분 선은 한 단계 더 옅게 — 있는지 없는지 모를 만큼만. */}
              <div className="rmg-tt-line half" style={{ top: `${timeToPosition(h * 60 + 30)}px` }} />
            </React.Fragment>
          ))}

          {/* 일정이 놓이는 판. 빈 자리를 누르면 그 시각에 한 줄. */}
          <div className="rmg-tt-canvas">
            {hours.map((h) => (
              <div
                key={h}
                className="rmg-tt-slot"
                style={{ top: `${timeToPosition(h * 60)}px`, height: `${TT_ROW}px` }}
                onClick={() => onAdd && setOpenHour(h)}
              >
                {openHour === h && (
                  <input
                    ref={inputRef}
                    className="rmg-tt-input"
                    value={draft}
                    placeholder={lang === "en" ? "Title, then Enter" : "제목 입력 후 Enter"}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit(h);
                      if (e.key === "Escape") { setOpenHour(null); setDraft(""); }
                    }}
                    onBlur={() => submit(h)}
                  />
                )}
              </div>
            ))}

            {/* 접힌 덩어리 — 셋 이상이 겹친 자리는 열로 쪼개지 않고 한 칸으로 둔다.
                "OO 외 2건". 누르면 그 자리만 펴진다. */}
            {[...folded.values()].map((c) => {
              const h = Math.max(((c.to - c.from) / 60) * TT_ROW, TT_MIN_H);
              const head = titleOf(c.id);
              const rest = c.ids.length - 1;
              return (
                <button
                  key={`fold-${c.id}`}
                  type="button"
                  className={`rmg-tt-block rmg-tt-fold ${h <= TT_MIN_H + 8 ? "tight" : ""}`}
                  style={{ top: `${timeToPosition(c.from)}px`, height: `${h}px`, left: 0, width: `calc(100% - ${TT_GAP}px)` }}
                  aria-expanded={false}
                  onClick={(e) => { e.stopPropagation(); toggleCluster(c.id); }}
                >
                  <span className="rmg-tt-block-title">
                    {lang === "en" ? `${head} +${rest} more` : `${head} 외 ${rest}건`}
                  </span>
                  {/* 덩어리 전체가 걸친 시간 — 접혀 있어도 '언제쯤 붐비는가'는 남긴다. */}
                  <span className="rmg-tt-block-meta">
                    {minHHMM(c.from)}–{minHHMM(c.to)}
                  </span>
                </button>
              );
            })}

            {/* 펴 둔 덩어리 위의 '접기' — 편 사람이 되돌릴 길을 같은 자리에 둔다.
                이게 없으면 한 번 편 것은 날을 넘기기 전까지 접히지 않는다. */}
            {clusters
              .filter((c) => c.ids.length >= TT_FOLD_FROM && opened.has(c.id))
              .map((c) => (
                <button
                  key={`unfold-${c.id}`}
                  type="button"
                  className="rmg-tt-unfold"
                  style={{ top: `${timeToPosition(c.from)}px` }}
                  onClick={(e) => { e.stopPropagation(); toggleCluster(c.id); }}
                >
                  {lang === "en" ? `▲ fold ${c.ids.length}` : `▲ ${c.ids.length}건 접기`}
                </button>
              ))}

            {spans.map((s) => {
              // 접혀 있는 덩어리에 속한 일정은 그리지 않는다 — 위의 한 칸이 대신 서 있다.
              const cid = clusterOf.get(s.id);
              if (cid && folded.has(cid)) return null;
              const { col, cols } = lay.get(s.id) ?? { col: 0, cols: 1 };
              const eventId = s.id.startsWith("r-") ? null : s.id;
              const n = eventId && participantsOf ? participantsOf(eventId).length : 0;
              const h = eventDurationToHeight(s);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`rmg-tt-block ${s.pending ? "pending" : ""} ${h <= TT_MIN_H + 8 ? "tight" : ""}`}
                  style={{
                    top: `${eventToPosition(s)}px`,
                    height: `${h}px`,
                    left: `calc(${(col / cols) * 100}% )`,
                    width: `calc(${100 / cols}% - ${TT_GAP}px)`,
                  }}
                  onClick={(e) => { e.stopPropagation(); if (eventId && onOpenEvent) onOpenEvent(eventId); }}
                >
                  <span className="rmg-tt-block-title">{s.title}</span>
                  <span className="rmg-tt-block-meta">
                    {hhmm(s.startAt)}–{hhmm(s.endAt)}{n > 1 ? ` · ${n}${lang === "en" ? "" : "명"}` : ""}
                  </span>
                </button>
              );
            })}

            {/* 지금 — 빨간 줄 대신 잉크색 실선 한 줄과 점. 일정 위를 지나도 묻히지 않는다. */}
            {nowInRange && (
              <div className="rmg-tt-now" style={{ top: `${timeToPosition(nowMin)}px` }} aria-hidden>
                <span className="rmg-tt-now-dot" />
              </div>
            )}
          </div>
        </div>
        {/* 캡처바에 마지막 시간대가 잠기지 않도록 비워 두는 자리 */}
        <div className="rmg-tt-safe" aria-hidden />
      </div>
    </div>
  );
}

