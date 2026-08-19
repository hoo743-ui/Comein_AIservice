"use client";

/**
 * Comein · 달 하나, 그리고 날짜를 말로 찾는 길.
 *
 * 두 조각이 한 파일에 있는 이유는 둘이 같은 것을 다룬다는 데 있다 — '어느 날인가'.
 * 달력은 눈으로 짚고(MonthCalendar), 검색은 말로 짚는다(CalSearch).
 * 날짜 형식을 기억할 필요가 없어야 한다는 것이 이 화면의 약속이라, 둘은 늘 함께 고쳐진다.
 *
 * 말을 하루로 옮기는 규칙 자체는 여기 없다 — `../calendarDate` 가 쥔다.
 */

import * as React from "react";
import { ChevronDown, Search } from "lucide-react";

import { fmtDate } from "@/lib/format";
import { MONTHS_EN, WEEKDAYS, WEEKDAYS_EN, parseNaturalDate } from "../calendarDate";
import type { Lang } from "../i18n";

export function MonthCalendar({ base, events, selected, onSelect, big = false, lang = "ko", focusDate, onSearch, dayEventsOf }: {
  base: Date; events: Date[]; selected: Date; onSelect: (d: Date) => void; big?: boolean; lang?: Lang;
  focusDate?: Date | null; onSearch?: () => void;
  /** 날짜에 마우스를 올렸을 때 옆에 띄울 그 날의 일정. 없으면 미리보기를 만들지 않는다. */
  dayEventsOf?: (d: Date) => { time: string; title: string }[];
}) {
  const en = lang === "en";
  // 어느 칸 위에 있는가 — 미리보기는 그 칸 오른쪽에 붙는다.
  const [peek, setPeek] = React.useState<{ day: Date; top: number; left: number } | null>(null);
  const [ym, setYm] = React.useState({ y: base.getFullYear(), m: base.getMonth() });
  const [picker, setPicker] = React.useState(false);
  const [anim, setAnim] = React.useState<"" | "l" | "r">("");

  // AI 탐색 등 외부에서 지정한 날짜의 달로 이동
  React.useEffect(() => {
    if (!focusDate) return;
    setAnim("");
    setYm({ y: focusDate.getFullYear(), m: focusDate.getMonth() });
  }, [focusDate]);

  const startDow = new Date(ym.y, ym.m, 1).getDay();
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const evSet = React.useMemo(
    () => new Set(events.map((d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)),
    [events]
  );
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  const isDay = (d: number, x: Date) => x.getFullYear() === ym.y && x.getMonth() === ym.m && x.getDate() === d;

  const go = (y: number, m: number, dir: "" | "l" | "r") => { setAnim(dir); setYm({ y, m }); };
  const shift = (n: number) => {
    const m = ym.m + n;
    const ny = m < 0 ? ym.y - 1 : m > 11 ? ym.y + 1 : ym.y;
    go(ny, (m + 12) % 12, n > 0 ? "r" : "l");
  };
  const goToday = () => { const d = new Date(); go(d.getFullYear(), d.getMonth(), "r"); onSelect(new Date(d.getFullYear(), d.getMonth(), d.getDate())); };
  const pickMonth = (mm: number) => { go(ym.y, mm, mm >= ym.m ? "r" : "l"); setPicker(false); };
  const shiftYear = (n: number) => setYm((s) => ({ ...s, y: s.y + n }));

  const title = en ? `${MONTHS_EN[ym.m]} ${ym.y}` : `${ym.y}년 ${ym.m + 1}월`;
  const monthsShort = en
    ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    : ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

  return (
    <div className={`rmg-mc ${big ? "big" : ""}`}>
      <div className="rmg-mc-head">
        <button type="button" className={`rmg-mc-title ${picker ? "on" : ""}`} onClick={() => setPicker((p) => !p)} aria-expanded={picker}>
          {title}<ChevronDown className="rmg-mc-title-ic" />
        </button>
        <div className="rmg-mc-nav">
          {/* '오늘' 버튼은 큰 달력(캘린더 탭)에만. 작은 맥락 달력에서는 제목이 이미 이번 달을 말한다. */}
          {big && <button type="button" className="rmg-mc-today" onClick={goToday}>{en ? "Today" : "오늘"}</button>}
          <button type="button" className="rmg-mc-arrow" onClick={() => shift(-1)} aria-label={en ? "Previous month" : "이전 달"}>‹</button>
          <button type="button" className="rmg-mc-arrow" onClick={() => shift(1)} aria-label={en ? "Next month" : "다음 달"}>›</button>
          {/* ⌘K 라고 적어 두지 않는다 — 그 단축키는 캡처바의 것이고, 여기서 누르면
              두 곳이 함께 반응한다. 이 자리는 눌러서 여는 문 하나로 충분하다.
              덤으로, 낱말은 키보드가 없는 기기에서도 그대로 읽힌다(키캡은 그렇지 않아 감춘다). */}
          {onSearch && (
            <button type="button" className="rmg-mc-search" onClick={onSearch} aria-label={en ? "Find a date" : "날짜 찾기"}>
              <Search className="rmg-mc-search-ic" />
              <span className="rmg-mc-kbd">{en ? "Find" : "찾기"}</span>
            </button>
          )}
        </div>
      </div>

      {picker && (
        <div className="rmg-mc-picker">
          <div className="rmg-mc-yr">
            <button type="button" className="rmg-mc-arrow" onClick={() => shiftYear(-1)} aria-label={en ? "Previous year" : "이전 해"}>‹</button>
            <span className="rmg-mc-yr-v">{ym.y}</span>
            <button type="button" className="rmg-mc-arrow" onClick={() => shiftYear(1)} aria-label={en ? "Next year" : "다음 해"}>›</button>
          </div>
          <div className="rmg-mc-months">
            {monthsShort.map((mn, i) => (
              <button key={i} type="button" className={`rmg-mc-mo ${i === ym.m ? "on" : ""}`} onClick={() => pickMonth(i)}>{mn}</button>
            ))}
          </div>
        </div>
      )}

      <div className="rmg-mc-wd">{(en ? WEEKDAYS_EN : WEEKDAYS).map((w, i) => <span key={i}>{w}</span>)}</div>
      <div key={`${ym.y}-${ym.m}`} className={`rmg-mc-grid ${anim === "l" ? "in-l" : anim === "r" ? "in-r" : ""}`}>
        {cells.map((d, i) =>
          d === null ? (
            <span key={i} className="rmg-mc-cell empty" />
          ) : (
            <button
              key={i}
              type="button"
              className={`rmg-mc-cell ${isDay(d, base) ? "today" : ""} ${isDay(d, selected) ? "sel" : ""}`}
              onClick={() => onSelect(new Date(ym.y, ym.m, d))}
              onMouseEnter={(e) => {
                if (!dayEventsOf) return;
                const cell = e.currentTarget.getBoundingClientRect();
                const box = e.currentTarget.closest(".rmg-mc")!.getBoundingClientRect();
                // 달력 바깥(오른쪽)에 세운다 — 칸 옆에 붙이면 다음 날 숫자를 가린다.
                setPeek({ day: new Date(ym.y, ym.m, d), top: cell.top - box.top, left: box.width + 10 });
              }}
              onMouseLeave={() => setPeek(null)}
            >
              {d}
              {evSet.has(`${ym.y}-${ym.m}-${d}`) && <span className="rmg-mc-dot" />}
            </button>
          )
        )}
      </div>

      {/* 날짜에 손을 올리면 그 날이 옆에서 살짝 열린다 — 누르지 않고도 하루를 엿본다. */}
      {peek && dayEventsOf && (() => {
        const list = dayEventsOf(peek.day);
        return (
          <div className="rmg-mc-peek" style={{ top: peek.top, left: peek.left }} aria-hidden>
            <p className="rmg-mc-peek-d">{fmtDate(peek.day)}</p>
            {list.length === 0 ? (
              <p className="rmg-mc-peek-none">{en ? "Nothing planned." : "비어 있어요"}</p>
            ) : (
              <ul className="rmg-mc-peek-list">
                {list.slice(0, 5).map((it, k) => (
                  <li key={k} className="rmg-mc-peek-row">
                    <span className="rmg-mc-peek-t">{it.time}</span>
                    <span className="rmg-mc-peek-x">{it.title}</span>
                  </li>
                ))}
                {list.length > 5 && <li className="rmg-mc-peek-none">{en ? `+${list.length - 5} more` : `외 ${list.length - 5}건`}</li>}
              </ul>
            )}
          </div>
        );
      })()}
    </div>
  );
}

/** AI Calendar Search — Spotlight 스타일. 날짜 형식을 기억할 필요 없이 말로 이동한다. */
export function CalSearch({ open, onClose, onJump, events, now, lang }: {
  open: boolean; onClose: () => void; onJump: (d: Date, label: string) => void; events: Date[]; now: Date | null; lang: Lang;
}) {
  const en = lang === "en";
  const [q, setQ] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (open) { setQ(""); const t = setTimeout(() => inputRef.current?.focus(), 70); return () => clearTimeout(t); }
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;

  const sugg = en
    ? ["today", "tomorrow", "this week", "next month", "next semester", "meeting days", "christmas"]
    : ["오늘", "내일", "이번 주", "다음 달", "다음 학기", "회의 있는 날", "크리스마스"];
  const run = (text: string) => {
    const r = parseNaturalDate(text, now ?? new Date(), events);
    if (r) { onJump(r.date, r.label); onClose(); }
    else setQ(text);
  };
  const preview = q.trim() ? parseNaturalDate(q, now ?? new Date(), events) : null;
  const fmtHit = (d: Date) => (en
    ? d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`);

  return (
    <div className="rmg-cs-scrim" onClick={onClose}>
      <div className="rmg-cs" role="dialog" aria-label={en ? "Calendar search" : "캘린더 탐색"} onClick={(e) => e.stopPropagation()}>
        <form className="rmg-cs-bar" onSubmit={(e) => { e.preventDefault(); run(q); }}>
          <Search className="rmg-cs-ic" />
          <input
            ref={inputRef}
            className="rmg-cs-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={en ? "Type a date or event…" : "원하는 날짜나 일정을 입력하세요..."}
            aria-label={en ? "Search dates" : "날짜 탐색"}
          />
          <kbd className="rmg-cs-esc">esc</kbd>
        </form>
        {q.trim() ? (
          preview ? (
            <button type="button" className="rmg-cs-hit" onClick={() => run(q)}>
              <span className="rmg-cs-hit-l">{preview.label}</span>
              <span className="rmg-cs-hit-d">{fmtHit(preview.date)}</span>
            </button>
          ) : (
            <p className="rmg-cs-none">{en ? "Couldn’t place that. Try “next month” or “Aug week 2”." : "그 날짜를 찾지 못했어요. 예: 다음 달 · 8월 둘째 주"}</p>
          )
        ) : (
          <div className="rmg-cs-sugg">
            <p className="rmg-cs-eye">{en ? "Try" : "추천"}</p>
            <div className="rmg-cs-chips">
              {sugg.map((x) => (
                <button key={x} type="button" className="rmg-cs-chip" onClick={() => run(x)}>{x}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 각 기능은 '익숙한' 인터페이스로 — AI는 강화만. (제안 배너 + 귀속 마크 + 행 액션)
