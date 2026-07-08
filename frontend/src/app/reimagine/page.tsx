"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  ArrowUp, Bell, CalendarDays, Check, CheckCircle2, Cloud, CloudRain, CloudSnow,
  LogOut, Moon, Sparkles, StickyNote, Sun, Users, Video, X,
} from "lucide-react";

import { useWorkspace } from "@/lib/store";
import { fmtTime, fmtDate } from "@/lib/format";

/**
 * Comein · Reimagined Workspace — 대시보드가 아니라 '살아있는 편집적 워크스페이스'.
 * 하나의 통합 구성: Hero → Today's context → Quick capture → AI timeline (시선이 아래로 흐른다).
 * 문은 패널이 아니라 환경의 보이지 않는 심장 — 평소엔 사라지고, AI가 일하면 열려 빛이 흐른다.
 * 보라색은 오직 AI 활동의 언어. 배경은 아주 옅게 숨쉰다(래디얼·그레인·미세 입자). 구조는 타이포·여백으로.
 */

type View = "today" | "calendar" | "tasks" | "notes" | "meetings" | "people";
const NAV: { key: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "today", label: "Today", icon: Sparkles },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "tasks", label: "Tasks", icon: CheckCircle2 },
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "meetings", label: "Meetings", icon: Video },
  { key: "people", label: "People", icon: Users },
];

type Kind = "일정" | "회의" | "할 일" | "메모";
// 영수증 — AI가 한 모든 일: 무엇 + 어디(목적지) + 언제. 즉시 실행하되 자취를 남긴다.
type Receipt = { id: number; at: number; title: string; kind: Kind; destView: View; destLabel: string; time: string | null; isAction?: boolean };
const DEST: Record<Kind, { view: View; label: string }> = {
  일정: { view: "calendar", label: "캘린더" },
  회의: { view: "meetings", label: "회의" },
  "할 일": { view: "tasks", label: "할 일" },
  메모: { view: "notes", label: "메모" },
};
const VIEW_LABEL: Record<View, string> = { today: "오늘", calendar: "캘린더", tasks: "할 일", notes: "메모", meetings: "회의", people: "사람" };
const pad = (n: number | string) => String(n).padStart(2, "0");

function classify(text: string): Kind {
  if (/회의|미팅/.test(text)) return "회의";
  if (/\d\s*시|\d:\d|내일|오늘|모레|다음\s*주|요일|약속|일정/.test(text)) return "일정";
  if (/해야|하기|사기|제출|끝내|마감|todo|할\s*일|처리|보내/.test(text)) return "할 일";
  return "메모";
}
function parseTime(text: string): string | null {
  const hm = text.match(/(\d{1,2}):(\d{2})/);
  if (hm) return `${pad(hm[1])}:${hm[2]}`;
  const k = text.match(/(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
  if (k) {
    let hr = +k[2];
    if (k[1] === "오후" && hr < 12) hr += 12;
    if (k[1] === "오전" && hr === 12) hr = 0;
    return `${pad(hr)}:${pad(k[3] ?? 0)}`;
  }
  return null;
}
function greetingFor(h: number) {
  if (h < 5) return "Good Night";
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  if (h < 22) return "Good Evening";
  return "Good Night";
}
function partOfDay(h: number) {
  if (h < 5) return "night";
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  if (h < 22) return "evening";
  return "night";
}
const WCODE: Record<number, string> = {
  0: "맑음", 1: "대체로 맑음", 2: "구름 조금", 3: "흐림", 45: "안개", 48: "안개",
  51: "이슬비", 53: "이슬비", 55: "이슬비", 61: "비", 63: "비", 65: "강한 비",
  71: "눈", 73: "눈", 75: "많은 눈", 80: "소나기", 81: "소나기", 82: "강한 소나기", 95: "뇌우",
};
const conditionOf = (code: number) => WCODE[code] ?? "흐림";
function weatherIconOf(c: string) {
  if (/맑/.test(c)) return Sun;
  if (/비|소나기|이슬/.test(c)) return CloudRain;
  if (/눈/.test(c)) return CloudSnow;
  return Cloud;
}
function moodEn(h: number, c: string | null) {
  const adj = !c ? "calm" : /맑/.test(c) ? "clear" : /비|소나기|뇌우/.test(c) ? "rainy" : /눈/.test(c) ? "quiet" : "calm";
  return `A ${adj} ${partOfDay(h)}.`;
}
function reflection(c: string | null) {
  if (!c) return "오늘 하루도 차근히 정리해 둘게요.";
  if (/맑/.test(c)) return "집중하기 좋은 하루예요. 중요한 일에 먼저 몰입해보세요.";
  if (/비|소나기|뇌우/.test(c)) return "차분히 몰입하기 좋은 날이에요. 하나씩 정리해 둘게요.";
  if (/눈/.test(c)) return "고요한 하루예요. 마음이 흩어지지 않게 곁에서 정리할게요.";
  return "잔잔한 하루예요. 흐름이 끊기지 않게 정리해 둘게요.";
}

export default function Reimagine() {
  const { resolvedTheme, setTheme } = useTheme();
  const schedules = useWorkspace((s) => s.schedules);
  const todos = useWorkspace((s) => s.todos);
  const memos = useWorkspace((s) => s.memos);
  const meetings = useWorkspace((s) => s.meetings);
  const contacts = useWorkspace((s) => s.contacts);
  const moveTodo = useWorkspace((s) => s.moveTodo);

  const [mounted, setMounted] = React.useState(false);
  const [now, setNow] = React.useState<Date | null>(null);
  const [view, setView] = React.useState<View>("today");
  const [receipts, setReceipts] = React.useState<Receipt[]>([]);
  const [organizing, setOrganizing] = React.useState(false);
  const [weather, setWeather] = React.useState<{ temp: number; condition: string } | null>(null);
  const [calDay, setCalDay] = React.useState<Date | null>(null);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [bigCal, setBigCal] = React.useState(false);
  const [entered, setEntered] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

  const seq = React.useRef(0);
  const orgTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const enterNow = React.useCallback(() => {
    try { sessionStorage.setItem("comein:reimagine", "1"); } catch {}
    setLeaving(true);
    setTimeout(() => setEntered(true), 900);
  }, []);

  React.useEffect(() => {
    setMounted(true);
    setNow(new Date());
    setCalDay(new Date());
    const clock = setInterval(() => setNow(new Date()), 30_000);
    let already = false;
    try { already = sessionStorage.getItem("comein:reimagine") === "1"; } catch {}
    let t: ReturnType<typeof setTimeout> | undefined;
    if (already) setEntered(true);
    else t = setTimeout(() => enterNow(), 3000);
    return () => { clearInterval(clock); if (t) clearTimeout(t); };
  }, [enterNow]);

  React.useEffect(() => {
    let cancelled = false;
    fetch("https://api.open-meteo.com/v1/forecast?latitude=37.4449&longitude=127.1389&current=temperature_2m,weather_code&timezone=Asia%2FSeoul")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d?.current) setWeather({ temp: Math.round(d.current.temperature_2m), condition: conditionOf(d.current.weather_code) }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const upcoming = React.useMemo(() => {
    if (!now) return [];
    const t = +now - 3_600_000;
    return [...schedules].filter((s) => +new Date(s.start) >= t).sort((a, b) => +new Date(a.start) - +new Date(b.start));
  }, [schedules, now]);
  const openTodos = React.useMemo(() => todos.filter((t) => t.status !== "done"), [todos]);
  const next = upcoming[0];

  // 왼쪽 캘린더 — 실제 일정 + AI가 넣은 일정
  const calItems = React.useMemo(() => {
    const b = now ?? new Date(2026, 6, 8);
    const arr: { date: Date; title: string; time: string }[] = schedules.map((s) => ({ date: new Date(s.start), title: s.title, time: fmtTime(s.start) }));
    for (const r of receipts) if (!r.isAction && r.destView === "calendar") arr.push({ date: b, title: r.title, time: r.time ?? "미정" });
    return arr;
  }, [schedules, receipts, now]);
  const dayItems = React.useMemo(() => {
    if (!calDay) return [];
    const k = `${calDay.getFullYear()}-${calDay.getMonth()}-${calDay.getDate()}`;
    return calItems
      .filter((i) => `${i.date.getFullYear()}-${i.date.getMonth()}-${i.date.getDate()}` === k)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [calItems, calDay]);

  // 알림 — 다가오는 일정 + 중요 할 일
  const notifs = React.useMemo(() => {
    if (!now) return [] as { id: string; title: string; detail: string }[];
    const list: { id: string; title: string; detail: string }[] = [];
    for (const s of upcoming.slice(0, 3)) list.push({ id: `s${s.id}`, title: "곧 시작하는 일정", detail: `${fmtTime(s.start)} · ${s.title}` });
    for (const t of openTodos.filter((t) => t.priority === "high").slice(0, 2)) list.push({ id: `t${t.id}`, title: "중요한 할 일", detail: t.title });
    return list;
  }, [upcoming, openTodos, now]);

  const ignite = React.useCallback(() => {
    if (orgTimer.current) clearTimeout(orgTimer.current);
    setOrganizing(true);
    orgTimer.current = setTimeout(() => setOrganizing(false), 1600);
  }, []);

  // 캡처 — 즉시 실행하고 목적지로 라우팅한 '영수증'을 남긴다.
  const capture = (v: string) => {
    const t = v.trim();
    if (!t) return;
    const kind = classify(t);
    const d = DEST[kind];
    seq.current += 1;
    setReceipts((prev) => [{ id: seq.current, at: Date.now(), title: t, kind, destView: d.view, destLabel: d.label, time: parseTime(t) }, ...prev].slice(0, 8));
    ignite();
  };

  // 뷰 안의 컨텍스트 AI 액션 — 실행 즉시 그 목적지 기준으로 영수증을 남긴다.
  const aiAction = (label: string) => {
    seq.current += 1;
    const r: Receipt = { id: seq.current, at: Date.now(), title: label, kind: "메모", destView: view, destLabel: VIEW_LABEL[view], time: null, isAction: true };
    setReceipts((prev) => [r, ...prev].slice(0, 8));
    ignite();
  };

  const undoReceipt = (id: number) => setReceipts((prev) => prev.filter((r) => r.id !== id));

  const clock = now ? fmtTime(now) : "";
  const h = now?.getHours() ?? 9;
  const WeatherIcon = weather ? weatherIconOf(weather.condition) : Cloud;
  const rc = (v: View) => receipts.filter((r) => !r.isAction && r.destView === v).length;
  const taskCount = openTodos.length + rc("tasks");
  const noteCount = memos.length + rc("notes");
  const paceLine = taskCount > 0
    ? `남은 일 ${taskCount}가지 · ${upcoming.length > 2 ? "촘촘한 흐름" : "여유로운 흐름"}`
    : "오늘은 비어 있어요 — 마음이 가볍네요";

  return (
    <div className="rmg">
      <style>{CSS}</style>

      {/* 문턱 */}
      {!entered && (
        <div className={`rmg-thr ${leaving ? "leaving" : ""}`} onClick={enterNow} role="button" aria-label="들어가기">
          <div className="rmg-thr-in">
            <AiDoor active={leaving} className="rmg-thr-door" />
            <p className="rmg-phil-1">생각은 흩어집니다.</p>
            <p className="rmg-phil-2">질서는 만들어집니다.</p>
            <span className="rmg-thr-cta">들어가기 · Come in</span>
          </div>
        </div>
      )}

      {/* 슬림 레일 */}
      <aside className="rmg-rail">
        <div className="rmg-rail-mark"><AiDoor active={organizing} className="rmg-rail-door" /></div>
        <nav className="rmg-rail-nav">
          {NAV.map((n) => (
            <button key={n.key} onClick={() => setView(n.key)} className={`rmg-railbtn ${view === n.key ? "on" : ""}`} title={n.label} aria-label={n.label}>
              <n.icon className="rmg-railicon" />
            </button>
          ))}
        </nav>
        <div className="rmg-rail-foot">
          <button type="button" className="rmg-railbtn" title="테마 전환" aria-label="테마 전환" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            {mounted && resolvedTheme === "dark" ? <Sun className="rmg-railicon" /> : <Moon className="rmg-railicon" />}
          </button>
          <Link href="/workspace" className="rmg-railbtn" title="Live workspace" aria-label="Live workspace"><LogOut className="rmg-railicon" /></Link>
        </div>
      </aside>

      {/* 하나의 살아있는 구성 */}
      <main className="rmg-canvas">
        {/* 환경 — 심장(문)·그레인·입자·래디얼. 평소 거의 사라짐. */}
        <div className="rmg-env" aria-hidden>
          <div className="rmg-grain" />
          <Ambient active={organizing} />
          <div className={`rmg-heart ${organizing ? "on" : ""}`}><AiDoor active={organizing} className="rmg-heart-door" /></div>
        </div>

        {/* 최상단 가로 옵션 바 + 우측 알림 */}
        <header className="rmg-topbar">
          <div className="rmg-topopts">
            <span className="rmg-topbrand">{VIEW_LABEL[view]}</span>
            <button type="button" className="rmg-topopt" onClick={() => setBigCal(true)}>
              <CalendarDays className="rmg-topopt-ic" /> 캘린더 확대
            </button>
          </div>
          <div className="rmg-topbar-right">
            <div className="rmg-notif">
              <button type="button" className={`rmg-notif-btn ${notifOpen ? "on" : ""}`} onClick={() => setNotifOpen((o) => !o)} aria-label={`알림 ${notifs.length}건`}>
                <Bell className="rmg-notif-ic" />
                {notifs.length > 0 && <span className="rmg-notif-badge">{notifs.length}</span>}
              </button>
              {notifOpen && (
                <>
                  <div className="rmg-notif-scrim" onClick={() => setNotifOpen(false)} aria-hidden />
                  <div className="rmg-notif-panel">
                    <p className="rmg-notif-head">알림</p>
                    {notifs.length > 0 ? (
                      <ul className="rmg-notif-list">
                        {notifs.map((n) => (
                          <li key={n.id} className="rmg-notif-row">
                            <span className="rmg-notif-dot" />
                            <div>
                              <p className="rmg-notif-title">{n.title}</p>
                              <p className="rmg-notif-detail">{n.detail}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rmg-notif-empty">새로운 알림이 없어요.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* 왼쪽 여백의 상시 캘린더 — 모든 화면에서 시간 맥락. */}
        <aside className="rmg-calrail" aria-label="캘린더">
          {mounted && calDay && now && (
            <>
              <MonthCalendar base={now} events={calItems.map((i) => i.date)} selected={calDay} onSelect={setCalDay} />
              <div className="rmg-calday">
                <p className="rmg-calday-date">{fmtDate(calDay)}</p>
                <ul className="rmg-calday-list">
                  {dayItems.map((it, idx) => (
                    <li key={idx} className="rmg-calday-row">
                      <span className="rmg-calday-time">{it.time}</span>
                      <span className="rmg-calday-title">{it.title}</span>
                    </li>
                  ))}
                  {dayItems.length === 0 && <li className="rmg-calday-empty">일정 없음</li>}
                </ul>
              </div>
            </>
          )}
        </aside>

        <div className="rmg-flow">
          {view === "today" ? (
            <>
              {/* HERO — 감정의 중심 */}
              <section className="rmg-hero rmg-a1">
                <p className="rmg-greet">{mounted ? greetingFor(h) : " "}.</p>
                <p className="rmg-mood">{mounted ? moodEn(h, weather?.condition ?? null) : ""}</p>
                <p className="rmg-env-line">
                  <WeatherIcon className="rmg-env-icon" /> 성남{weather ? ` · ${weather.temp}°` : ""}
                </p>
                <div className="rmg-counts">
                  <span className="rmg-count"><b>{meetings.length}</b> Meetings</span>
                  <span className="rmg-count-sep" />
                  <span className="rmg-count"><b>{taskCount}</b> Tasks</span>
                  <span className="rmg-count-sep" />
                  <span className="rmg-count"><b>{noteCount}</b> Notes</span>
                </div>
              </section>

              {/* CONTEXT — 큐레이션 (위젯 아님) */}
              <section className="rmg-ctx rmg-a2">
                <p className="rmg-eyebrow">Today’s context</p>
                <div className="rmg-ctx-line">
                  <span className="rmg-ctx-k">다가오는 순간</span>
                  <span className="rmg-ctx-v">
                    {next ? <><em>{mounted ? fmtTime(next.start) : ""}</em> · {next.title}</> : "예정된 일정이 없어요"}
                  </span>
                </div>
                <div className="rmg-ctx-line">
                  <span className="rmg-ctx-k">오늘의 흐름</span>
                  <span className="rmg-ctx-v">{paceLine}</span>
                </div>
                <div className="rmg-ctx-line">
                  <span className="rmg-ctx-k">AI의 생각</span>
                  <span className="rmg-ctx-v rmg-ctx-reflect">{reflection(weather?.condition ?? null)}</span>
                </div>
              </section>
            </>
          ) : (
            <Feature
              view={view}
              schedules={schedules}
              todos={openTodos}
              memos={memos}
              meetings={meetings}
              contacts={contacts}
              mounted={mounted}
              receipts={receipts}
              now={now}
              onAction={aiAction}
              onToggleTodo={(id) => { moveTodo(id, "done"); ignite(); }}
              onRemoveReceipt={undoReceipt}
            />
          )}

          {view === "today" && (
            /* REVIEW — AI가 방금 한 일: 무엇 + 어디 + [열기]/[되돌리기] (영수증) */
            <section className="rmg-review rmg-a4">
              <p className="rmg-eyebrow">방금 정리한 것 {organizing && <span className="rmg-org">· 정리 중</span>}</p>
              {receipts.length > 0 ? (
                <ul className="rmg-rcpt-list">
                  {receipts.map((r) => (
                    <li key={r.id} className="rmg-rcpt">
                      <span className="rmg-rcpt-mark" title="AI가 처리했어요"><AiDoor className="rmg-rcpt-door" /></span>
                      <span className="rmg-rcpt-dest">{r.destLabel}{r.time ? ` · ${r.time}` : ""}</span>
                      <span className="rmg-rcpt-title">{r.title}</span>
                      <span className="rmg-rcpt-time">{mounted ? fmtTime(new Date(r.at)) : ""}</span>
                      {!r.isAction && (
                        <button type="button" className="rmg-rcpt-open" onClick={() => setView(r.destView)}>열기</button>
                      )}
                      <button type="button" className="rmg-rcpt-undo" onClick={() => undoReceipt(r.id)}>되돌리기</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rmg-empty">
                  <kbd className="rmg-kbd">⌘K</kbd>로 무엇이든 적으면 — AI가 알맞은 곳에 넣고, 여기에 <b>어디에 뒀는지</b> 남깁니다.
                </p>
              )}
            </section>
          )}
        </div>

        <span className="rmg-clock">{mounted ? clock : " "}</span>

        {/* 앰비언트 AI — 상주 챗박스가 아니라, 필요할 때만 펼쳐지는 떠다니는 문 (⌘K) */}
        <DoorInvoke view={view} organizing={organizing} onSubmit={capture} />

        {/* 큰 캘린더 — 왼쪽 미니에서 확대 */}
        {bigCal && mounted && calDay && now && (
          <div className="rmg-bigcal-scrim" onClick={() => setBigCal(false)}>
            <div className="rmg-bigcal" onClick={(e) => e.stopPropagation()}>
              <div className="rmg-bigcal-head">
                <p className="rmg-bigcal-title">캘린더</p>
                <button type="button" className="rmg-bigcal-close" onClick={() => setBigCal(false)} aria-label="닫기"><X className="rmg-notif-ic" /></button>
              </div>
              <div className="rmg-bigcal-body">
                <div className="rmg-bigcal-cal">
                  <MonthCalendar base={now} events={calItems.map((i) => i.date)} selected={calDay} onSelect={setCalDay} big />
                </div>
                <div className="rmg-bigcal-day">
                  <p className="rmg-calday-date">{fmtDate(calDay)}</p>
                  <ul className="rmg-calday-list">
                    {dayItems.map((it, idx) => (
                      <li key={idx} className="rmg-calday-row">
                        <span className="rmg-calday-time">{it.time}</span>
                        <span className="rmg-calday-title">{it.title}</span>
                      </li>
                    ))}
                    {dayItems.length === 0 && <li className="rmg-calday-empty">일정 없음</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const PLACEHOLDER: Record<View, string> = {
  today: "무엇이든 적어보세요 — 나머지는 정리해 둘게요",
  calendar: "새 일정을 말해보세요 — 예: 내일 3시 미팅",
  tasks: "할 일을 적어보세요 — 예: 발표 자료 준비",
  notes: "떠오른 생각을 남겨보세요",
  meetings: "회의를 잡거나 정리해보세요",
  people: "누구를 연결할까요?",
};
// 회전하는 예시 — 무엇을 할 수 있는지 조용히 가르친다.
const HINTS = [
  "Ask Comein…",
  "내일 3시 교수님 미팅 잡아줘",
  "발표 자료 준비 — 할 일로",
  "회의 아이디어 메모해줘",
  "이번 주 일정 정리해줘",
];

/** Ask Comein — 항상 보이는 주 입력. 문(브랜드) + 명확한 필드 + 회전 예시. 1초 안에 '여기서 시작'임을 안다. */
function DoorInvoke({ view, organizing, onSubmit }: { view: View; organizing: boolean; onSubmit: (v: string) => void }) {
  const [draft, setDraft] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const [hi, setHi] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inputRef.current?.focus(); }
      else if (e.key === "Escape") inputRef.current?.blur();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  React.useEffect(() => {
    if (focused || draft) return;
    const t = setInterval(() => setHi((i) => (i + 1) % HINTS.length), 3400);
    return () => clearInterval(t);
  }, [focused, draft]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    onSubmit(v);
    setDraft("");
  };
  const placeholder = focused ? PLACEHOLDER[view] : HINTS[hi];

  return (
    <form onSubmit={submit} className={`rmg-ask ${focused ? "focus" : ""}`}>
      <span className="rmg-ask-door" aria-hidden><AiDoor active={organizing || focused} className="rmg-ask-doormark" /></span>
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="rmg-ask-input"
        aria-label="Comein에게 입력"
      />
      {draft.trim() ? (
        <button type="submit" className="rmg-ask-send" aria-label="보내기"><ArrowUp className="rmg-railicon" /></button>
      ) : (
        <span className="rmg-ask-kbd">⌘K</span>
      )}
    </form>
  );
}

/** 환경 입자 — 평소 중립·faint, AI가 일하면 문에서 보라 빛이 흐른다. */
function Ambient({ active }: { active: boolean }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const activeRef = React.useRef(active);
  activeRef.current = active;
  React.useEffect(() => {
    const canvas = ref.current; const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, hh = 0, raf = 0, flow: { x: number; y: number; vx: number; vy: number; len: number; a: number }[] = [];
    const resize = () => { const r = canvas.getBoundingClientRect(); w = r.width; hh = r.height; canvas.width = Math.max(1, w * dpr); canvas.height = Math.max(1, hh * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(canvas);
    const amb = Array.from({ length: 16 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random(), a: 0.04 + Math.random() * 0.05, dx: (Math.random() - 0.5) * 0.00005, dy: (Math.random() - 0.5) * 0.00005 }));
    const srcX = () => w * 0.72, srcY = () => hh * 0.4;
    const spawn = () => ({ x: srcX() + (Math.random() * 14 - 7), y: srcY() + (Math.random() * hh * 0.24 - hh * 0.12), vx: -(0.3 + Math.random() * 0.9), vy: (Math.random() - 0.5) * 0.1, len: 8 + Math.random() * 26, a: 0.14 + Math.random() * 0.4 });
    const frame = () => {
      ctx.clearRect(0, 0, w, hh);
      for (const p of amb) { p.x += p.dx; p.y += p.dy; if (p.x < 0 || p.x > 1) p.dx *= -1; if (p.y < 0 || p.y > 1) p.dy *= -1; ctx.fillStyle = `rgba(157,163,179,${p.a})`; ctx.beginPath(); ctx.arc(p.x * w, p.y * hh, p.s, 0, Math.PI * 2); ctx.fill(); }
      if (activeRef.current) { if (flow.length < 30) flow.push(spawn() as any); }
      flow = flow.filter((p) => p.x > -30 && p.a > 0.01);
      for (const p of flow) { p.x += p.vx; p.y += p.vy; if (!activeRef.current) p.a *= 0.94; const g = ctx.createLinearGradient(p.x + p.len, p.y, p.x, p.y); g.addColorStop(0, "rgba(139,125,255,0)"); g.addColorStop(1, `rgba(139,125,255,${Math.min(0.7, p.a)})`); ctx.strokeStyle = g; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x + p.len, p.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }
      raf = requestAnimationFrame(frame);
    };
    if (!reduce) raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} className="rmg-ambient-canvas" aria-hidden />;
}

function AiDoor({ active = false, className }: { active?: boolean; className?: string }) {
  return (
    <div className={`aidoor ${active ? "active" : ""} ${className ?? ""}`}>
      <svg className="aidoor-svg" viewBox="0 0 40 52" fill="none" aria-hidden>
        <rect x="3" y="3" width="34" height="46" rx="2.5" className="aidoor-frame" strokeWidth="1.6" />
        <path d="M20 7 L31 10 V42 L20 45 Z" className="aidoor-panel" strokeWidth="1.6" />
        <circle cx="23.5" cy="26" r="1.1" className="aidoor-handle" />
      </svg>
    </div>
  );
}

// 뷰별 컨텍스트 AI — 제안(상단) + 행 액션(hover). "AI가 필요한 곳에 나타난다."
const VIEW_AI: Record<Exclude<View, "today">, {
  suggest: { text: string; action: string; done: string };
  row: { label: string; done: (t: string) => string };
}> = {
  calendar: { suggest: { text: "이번 주 발표 준비 시간이 비어 있어요.", action: "시간 잡기", done: "발표 준비 시간을 캘린더에 잡았어요" }, row: { label: "이동시간", done: (t) => `${t}에 이동시간을 더했어요` } },
  tasks: { suggest: { text: "마감이 가까운 일 두 가지가 있어요.", action: "오늘로 정리", done: "임박한 할 일을 오늘로 정리했어요" }, row: { label: "일정으로", done: (t) => `‘${t}’를 일정으로 옮겼어요` } },
  notes: { suggest: { text: "이어질 수 있는 비슷한 메모가 있어요.", action: "연결", done: "관련 메모를 연결했어요" }, row: { label: "요약", done: (t) => `‘${t}’를 요약했어요` } },
  meetings: { suggest: { text: "지난 회의의 액션아이템이 정리되지 않았어요.", action: "할 일로", done: "회의 액션아이템을 할 일로 옮겼어요" }, row: { label: "요약", done: (t) => `‘${t}’ 회의를 요약했어요` } },
  people: { suggest: { text: "2주간 연락이 뜸한 분이 있어요.", action: "안부 남기기", done: "안부 리마인드를 만들었어요" }, row: { label: "미팅 제안", done: (t) => `${t}님과 미팅을 제안했어요` } },
};

const AiTag = () => <span className="rmg-tag-ai" title="AI가 방금 추가했어요"><AiDoor className="rmg-tag-door" /></span>;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
/** 왼쪽 여백의 월간 캘린더 — 익숙한 그리드, 오늘 표시, 일정 있는 날 점, 날짜 클릭 선택. */
function MonthCalendar({ base, events, selected, onSelect, big = false }: {
  base: Date; events: Date[]; selected: Date; onSelect: (d: Date) => void; big?: boolean;
}) {
  const [ym, setYm] = React.useState({ y: base.getFullYear(), m: base.getMonth() });
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
  const shift = (n: number) => setYm((s) => {
    const m = s.m + n;
    if (m < 0) return { y: s.y - 1, m: 11 };
    if (m > 11) return { y: s.y + 1, m: 0 };
    return { y: s.y, m };
  });

  return (
    <div className={`rmg-mc ${big ? "big" : ""}`}>
      <div className="rmg-mc-head">
        <span className="rmg-mc-title">{ym.y}년 {ym.m + 1}월</span>
        <div className="rmg-mc-nav">
          <button type="button" onClick={() => shift(-1)} aria-label="이전 달">‹</button>
          <button type="button" onClick={() => shift(1)} aria-label="다음 달">›</button>
        </div>
      </div>
      <div className="rmg-mc-wd">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
      <div className="rmg-mc-grid">
        {cells.map((d, i) =>
          d === null ? (
            <span key={i} className="rmg-mc-cell empty" />
          ) : (
            <button
              key={i}
              type="button"
              className={`rmg-mc-cell ${isDay(d, base) ? "today" : ""} ${isDay(d, selected) ? "sel" : ""}`}
              onClick={() => onSelect(new Date(ym.y, ym.m, d))}
            >
              {d}
              {evSet.has(`${ym.y}-${ym.m}-${d}`) && <span className="rmg-mc-dot" />}
            </button>
          )
        )}
      </div>
    </div>
  );
}

// 각 기능은 '익숙한' 인터페이스로 — AI는 강화만. (제안 배너 + 귀속 마크 + 행 액션)
function Feature(props: {
  view: View; schedules: any[]; todos: any[]; memos: any[]; meetings: any[]; contacts: any[];
  mounted: boolean; receipts: Receipt[]; now: Date | null;
  onAction: (label: string) => void; onToggleTodo: (id: string) => void; onRemoveReceipt: (id: number) => void;
}) {
  const { view, receipts, onAction } = props;
  const ai = view === "today" ? null : VIEW_AI[view];
  const mine = receipts.filter((r) => !r.isAction && r.destView === view);

  return (
    <section className="rmg-a1">
      <div className="rmg-feat-head">
        <p className="rmg-feat-title">{VIEW_LABEL[view]}</p>
      </div>

      {ai && (
        <div className="rmg-suggest">
          <AiDoor className="rmg-suggest-door" />
          <span className="rmg-suggest-text">{ai.suggest.text}</span>
          <button type="button" className="rmg-suggest-act" onClick={() => onAction(ai.suggest.done)}>{ai.suggest.action}</button>
        </div>
      )}

      {view === "calendar" && <CalendarView {...props} mine={mine} ai={ai!} />}
      {view === "tasks" && <TasksView {...props} mine={mine} ai={ai!} />}
      {view === "notes" && <NotesView {...props} mine={mine} ai={ai!} />}
      {view === "meetings" && <MeetingsView {...props} mine={mine} ai={ai!} />}
      {view === "people" && <PeopleView {...props} ai={ai!} />}
    </section>
  );
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
function dayLabel(d: Date, base: Date | null) {
  if (base) {
    const diff = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(base.getFullYear(), base.getMonth(), base.getDate())) / 86_400_000);
    if (diff === 0) return "오늘";
    if (diff === 1) return "내일";
    if (diff === -1) return "어제";
  }
  return fmtDate(d);
}

/** Calendar — 날짜별 아젠다(익숙한 '일정' 뷰). */
function CalendarView({ schedules, mounted, now, mine, ai, onAction }: any) {
  const base = now as Date | null;
  const items = [
    ...schedules.map((s: any) => ({ id: s.id, date: new Date(s.start), title: s.title, ai: false })),
    ...mine.map((r: Receipt) => ({ id: `r-${r.id}`, date: base ?? new Date(2026, 6, 8), title: r.title, time: r.time, ai: true })),
  ];
  const groups = new Map<string, { date: Date; rows: any[] }>();
  for (const it of items) {
    const k = dayKey(it.date);
    if (!groups.has(k)) groups.set(k, { date: it.date, rows: [] });
    groups.get(k)!.rows.push(it);
  }
  const ordered = [...groups.values()].sort((a, b) => +a.date - +b.date);

  if (items.length === 0) return <p className="rmg-empty">예정된 일정이 없어요.</p>;
  return (
    <div className="rmg-cal">
      {ordered.map((g) => (
        <div key={dayKey(g.date)} className="rmg-cal-day">
          <p className="rmg-cal-date">{mounted ? dayLabel(g.date, base) : ""}</p>
          <ul className="rmg-cal-list">
            {g.rows.map((r: any) => (
              <li key={r.id} className="rmg-cal-row">
                <span className="rmg-cal-time">{r.ai ? (r.time ?? "미정") : (mounted ? fmtTime(r.date) : "")}</span>
                <span className="rmg-cal-bar" />
                <span className="rmg-cal-title">{r.title}</span>
                {r.ai && <AiTag />}
                <button type="button" className="rmg-vact" onClick={() => onAction(ai.row.done(r.title))}>{ai.row.label}</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Tasks — 체크리스트(익숙한 '할 일'). 체크 시 완료. */
function TasksView({ todos, mine, ai, onToggleTodo, onRemoveReceipt, onAction }: any) {
  const prio: Record<string, string> = { high: "높음", mid: "보통", low: "낮음" };
  const rows = [
    ...mine.map((r: Receipt) => ({ id: r.id, rid: true, title: r.title, priority: "mid" })),
    ...todos.map((t: any) => ({ id: t.id, rid: false, title: t.title, priority: t.priority })),
  ];
  if (rows.length === 0) return <p className="rmg-empty">지금은 할 일이 없어요.</p>;
  return (
    <ul className="rmg-task-list">
      {rows.map((r: any) => (
        <li key={`${r.rid ? "r" : "t"}-${r.id}`} className="rmg-task">
          <button
            type="button"
            className="rmg-task-box"
            aria-label="완료"
            onClick={() => (r.rid ? onRemoveReceipt(r.id) : onToggleTodo(r.id))}
          >
            <Check className="rmg-task-check" />
          </button>
          <span className="rmg-task-title">{r.title}</span>
          {r.rid && <AiTag />}
          <span className={`rmg-task-prio ${r.priority}`}>{prio[r.priority]}</span>
          {!r.rid && <button type="button" className="rmg-vact" onClick={() => onAction(ai.row.done(r.title))}>{ai.row.label}</button>}
        </li>
      ))}
    </ul>
  );
}

/** Notes — 노트 그리드(익숙한 '메모'). */
function NotesView({ memos, mine, ai, onAction }: any) {
  const tiles = [
    ...mine.map((r: Receipt) => ({ id: `r-${r.id}`, title: r.title, content: "", tags: [], ai: true })),
    ...memos.map((m: any) => ({ id: m.id, title: m.title, content: m.content ?? "", tags: m.tags ?? [], ai: false })),
  ];
  if (tiles.length === 0) return <p className="rmg-empty">아직 담아둔 생각이 없어요.</p>;
  return (
    <div className="rmg-notes">
      {tiles.map((t: any) => (
        <div key={t.id} className="rmg-note">
          <div className="rmg-note-top">
            <span className="rmg-note-title">{t.title}</span>
            {t.ai && <AiTag />}
          </div>
          {t.content && <p className="rmg-note-body">{t.content}</p>}
          <div className="rmg-note-foot">
            {t.tags.slice(0, 3).map((x: string) => <span key={x} className="rmg-note-tag">#{x}</span>)}
            <button type="button" className="rmg-vact rmg-note-act" onClick={() => onAction(ai.row.done(t.title))}>{ai.row.label}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Meetings — 회의 리스트(익숙한 '회의'). */
function MeetingsView({ meetings, mounted, ai, onAction }: any) {
  if (!meetings || meetings.length === 0) return <p className="rmg-empty">예정된 회의가 없어요.</p>;
  return (
    <ul className="rmg-mtg-list">
      {meetings.map((m: any) => (
        <li key={m.id} className="rmg-mtg">
          <div className="rmg-mtg-top">
            <span className="rmg-mtg-title">{m.title}</span>
            <span className="rmg-mtg-time">{mounted ? fmtDate(new Date(m.start)) : ""} · {mounted ? fmtTime(m.start) : ""}</span>
          </div>
          {m.participants?.length > 0 && (
            <div className="rmg-mtg-people">
              {m.participants.map((p: string) => <span key={p} className="rmg-mtg-chip">{p}</span>)}
            </div>
          )}
          {m.summary && <p className="rmg-mtg-sum">{m.summary}</p>}
          <button type="button" className="rmg-vact" onClick={() => onAction(ai.row.done(m.title))}>{ai.row.label}</button>
        </li>
      ))}
    </ul>
  );
}

/** People — 연락처(익숙한). */
function PeopleView({ contacts, ai, onAction }: any) {
  if (contacts.length === 0) return <p className="rmg-empty">연결된 사람이 없어요.</p>;
  return (
    <ul className="rmg-ppl-list">
      {contacts.map((c: any) => (
        <li key={c.id} className="rmg-ppl">
          <span className="rmg-ppl-av">{c.name?.slice(0, 1) ?? "·"}</span>
          <div className="rmg-ppl-txt">
            <span className="rmg-ppl-name">{c.name}</span>
            {c.org && <span className="rmg-ppl-org">{c.org}</span>}
          </div>
          <button type="button" className="rmg-vact" onClick={() => onAction(ai.row.done(c.name))}>{ai.row.label}</button>
        </li>
      ))}
    </ul>
  );
}

const CSS = `
.rmg {
  --paper: #0B0C12; --surface: #11131B; --ink: #F4F5F7; --muted: #9DA3B3; --faint: #5C6273; --hair: #1E212C; --accent: #8B7DFF; --glow: rgba(139,125,255,0.18);
  position: relative; display: grid; grid-template-columns: 64px minmax(0, 1fr);
  height: 100vh; height: 100dvh; background: var(--paper); color: var(--ink);
  font-family: var(--font-sans), "Pretendard Variable", -apple-system, system-ui, sans-serif; -webkit-font-smoothing: antialiased;
}
:root:not(.dark) .rmg { --paper: #F6F7F9; --surface: #FFFFFF; --ink: #14161D; --muted: #5A606E; --faint: #A2A8B4; --hair: #E6E8EE; --accent: #6D5EF0; --glow: rgba(109,94,240,0.14); }
.rmg-eyebrow { margin: 0 0 18px; font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--faint); }
.rmg-org { color: var(--accent); font-weight: 600; }

/* AiDoor */
.aidoor { position: relative; display: inline-grid; place-items: center; }
.aidoor-svg { width: 100%; height: 100%; display: block; overflow: visible; animation: aidoor-breathe 6.5s ease-in-out infinite; }
.aidoor-frame { stroke: var(--muted); opacity: 0.5; transition: stroke 0.8s, opacity 0.8s; }
.aidoor-panel { stroke: var(--muted); fill: var(--accent); fill-opacity: 0; opacity: 0.62; transform-origin: 20px 26px; transition: all 0.8s cubic-bezier(0.22,1,0.36,1); }
.aidoor-handle { fill: var(--muted); transition: fill 0.8s; }
.aidoor.active .aidoor-frame { stroke: var(--accent); opacity: 0.9; }
.aidoor.active .aidoor-panel { stroke: var(--accent); fill-opacity: 0.16; opacity: 1; transform: scaleX(0.82); }
.aidoor.active .aidoor-handle { fill: var(--accent); }
.aidoor.active .aidoor-svg { filter: drop-shadow(0 0 10px var(--glow)) drop-shadow(0 0 22px var(--glow)); }
@keyframes aidoor-breathe { 0%,100% { opacity: 0.9; } 50% { opacity: 1; } }

/* 문턱 */
.rmg-thr { position: fixed; inset: 0; z-index: 60; cursor: pointer; display: grid; place-items: center; background: var(--paper); animation: rmg-thr-in 1s ease both; }
.rmg-thr.leaving { animation: rmg-thr-out 0.9s cubic-bezier(0.4,0,0.2,1) both; }
.rmg-thr-in { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; padding: 24px; }
.rmg-thr-door { width: 42px; height: 55px; margin-bottom: 40px; }
.rmg-phil-1 { margin: 0; font-size: clamp(1.5rem, 4vw, 2.1rem); font-weight: 300; line-height: 1.28; letter-spacing: 0.01em; color: var(--faint); animation: rmg-rise 1s cubic-bezier(0.22,1,0.36,1) 0.25s both; }
.rmg-phil-2 { margin: 0; font-size: clamp(1.5rem, 4vw, 2.1rem); font-weight: 600; line-height: 1.28; letter-spacing: -0.025em; color: var(--ink); animation: rmg-rise 1s cubic-bezier(0.22,1,0.36,1) 0.45s both; }
.rmg-thr-cta { margin-top: 40px; font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--faint); animation: rmg-fade 1.2s ease 1s both; }
@keyframes rmg-thr-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes rmg-thr-out { to { opacity: 0; transform: scale(1.015); } }
@keyframes rmg-fade { from { opacity: 0; } to { opacity: 1; } }

/* 레일 */
.rmg-rail { position: relative; z-index: 3; display: flex; flex-direction: column; align-items: center; gap: 20px; border-right: 1px solid var(--hair); padding: 22px 0; }
.rmg-rail-mark { color: var(--ink); }
.rmg-rail-door { width: 22px; height: 28px; }
.rmg-rail-nav { display: flex; flex-direction: column; gap: 6px; }
.rmg-rail-foot { margin-top: auto; display: flex; flex-direction: column; gap: 6px; }
.rmg-railbtn { display: grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 11px; background: none; color: var(--faint); cursor: pointer; text-decoration: none; transition: background 0.25s, color 0.25s; }
.rmg-railbtn:hover { background: var(--surface); color: var(--ink); }
.rmg-railbtn.on { background: var(--surface); color: var(--ink); }
.rmg-railbtn:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
.rmg-railicon { width: 19px; height: 19px; stroke-width: 1.6; }

/* 캔버스 · 환경 */
.rmg-canvas { position: relative; overflow-y: auto; overflow-x: hidden; display: flex; justify-content: center; background: radial-gradient(90% 70% at 68% 34%, #12131d 0%, transparent 60%); }
:root:not(.dark) .rmg-canvas { background: radial-gradient(90% 70% at 68% 34%, #ffffff 0%, transparent 60%); }
.rmg-env { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.rmg-ambient-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.rmg-grain { position: absolute; inset: 0; opacity: 0.03; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
.rmg-heart { position: absolute; right: 8%; top: 30%; width: clamp(120px, 16vw, 220px); aspect-ratio: 40/52; opacity: 0.05; transition: opacity 1.2s ease; }
.rmg-heart.on { opacity: 0.5; }
.rmg-heart-door { width: 100%; height: 100%; }

/* 최상단 옵션 바 + 알림 */
.rmg-topbar { position: absolute; top: 0; left: 0; right: 0; z-index: 6; height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 clamp(16px, 3vw, 32px); }
.rmg-topopts { display: flex; align-items: center; gap: 8px; }
.rmg-topbrand { font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--faint); margin-right: 6px; }
.rmg-topopt { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--hair); background: color-mix(in srgb, var(--surface) 60%, transparent); color: var(--muted); font-family: inherit; font-size: 12px; font-weight: 500; padding: 6px 12px; border-radius: 999px; cursor: pointer; transition: color 0.25s, border-color 0.25s, background 0.25s; }
.rmg-topopt:hover { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 14%, var(--hair)); }
.rmg-topopt-ic { width: 14px; height: 14px; stroke-width: 1.7; }
.rmg-topbar-right { display: flex; align-items: center; gap: 8px; }
.rmg-notif { position: relative; }
.rmg-notif-btn { position: relative; display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid var(--hair); background: color-mix(in srgb, var(--surface) 60%, transparent); color: var(--muted); border-radius: 11px; cursor: pointer; transition: color 0.25s, border-color 0.25s; }
.rmg-notif-btn:hover, .rmg-notif-btn.on { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 16%, var(--hair)); }
.rmg-notif-btn:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
.rmg-notif-ic { width: 17px; height: 17px; stroke-width: 1.7; }
.rmg-notif-badge { position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; display: grid; place-items: center; padding: 0 4px; border-radius: 999px; background: var(--accent); color: #0B0C12; font-size: 10px; font-weight: 700; }
.rmg-notif-scrim { position: fixed; inset: 0; z-index: 40; }
.rmg-notif-panel { position: absolute; top: 46px; right: 0; z-index: 41; width: 300px; padding: 8px; border: 1px solid var(--hair); border-radius: 16px; background: color-mix(in srgb, var(--surface) 92%, transparent); backdrop-filter: blur(12px); box-shadow: 0 20px 50px -20px rgba(0,0,0,0.6); animation: rmg-rise 0.25s cubic-bezier(0.22,1,0.36,1) both; }
.rmg-notif-head { margin: 6px 10px 8px; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); }
.rmg-notif-list { list-style: none; margin: 0; padding: 0; }
.rmg-notif-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px; border-radius: 10px; transition: background 0.2s; }
.rmg-notif-row:hover { background: color-mix(in srgb, var(--ink) 5%, transparent); }
.rmg-notif-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); margin-top: 6px; flex-shrink: 0; }
.rmg-notif-title { margin: 0; font-size: 0.86rem; font-weight: 500; color: var(--ink); }
.rmg-notif-detail { margin: 2px 0 0; font-size: 0.78rem; font-weight: 300; color: var(--muted); }
.rmg-notif-empty { margin: 0; padding: 18px 10px; text-align: center; font-size: 0.85rem; color: var(--faint); }

/* 왼쪽 상시 캘린더 */
.rmg-calrail { display: none; }
@media (min-width: 1240px) {
  .rmg-calrail { display: block; position: absolute; left: 0; top: 52px; bottom: 0; width: 288px; z-index: 4; overflow-y: auto; padding: clamp(20px, 4vh, 44px) 22px 40px 30px; }
}
.rmg-mc { user-select: none; }
.rmg-mc-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.rmg-mc-title { font-size: 0.92rem; font-weight: 600; letter-spacing: -0.01em; color: var(--ink); }
.rmg-mc-nav { display: flex; gap: 2px; }
.rmg-mc-nav button { width: 26px; height: 26px; display: grid; place-items: center; border: 0; background: none; color: var(--muted); font-size: 1.1rem; line-height: 1; cursor: pointer; border-radius: 8px; transition: background 0.2s, color 0.2s; }
.rmg-mc-nav button:hover { background: color-mix(in srgb, var(--ink) 7%, transparent); color: var(--ink); }
.rmg-mc-wd { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 4px; }
.rmg-mc-wd span { text-align: center; font-size: 0.68rem; font-weight: 500; color: var(--faint); padding: 4px 0; }
.rmg-mc-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.rmg-mc-cell { position: relative; aspect-ratio: 1; display: grid; place-items: center; border: 0; background: none; color: var(--muted); font-family: inherit; font-size: 0.8rem; font-weight: 400; border-radius: 8px; cursor: pointer; transition: background 0.2s, color 0.2s; }
.rmg-mc-cell.empty { pointer-events: none; }
.rmg-mc-cell:not(.empty):hover { background: color-mix(in srgb, var(--ink) 7%, transparent); color: var(--ink); }
.rmg-mc-cell.today { color: var(--ink); font-weight: 700; }
.rmg-mc-cell.sel { background: var(--ink); color: var(--paper); font-weight: 600; }
.rmg-mc-cell.sel.today { color: var(--paper); }
.rmg-mc-dot { position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 3px; height: 3px; border-radius: 50%; background: var(--accent); }
.rmg-mc-cell.sel .rmg-mc-dot { background: var(--paper); }
.rmg-calday { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--hair); }
.rmg-calday-date { margin: 0 0 12px; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.02em; color: var(--faint); }
.rmg-calday-list { list-style: none; margin: 0; padding: 0; }
.rmg-calday-row { display: flex; align-items: baseline; gap: 10px; padding: 8px 0; }
.rmg-calday-time { font-family: ui-monospace, "SF Mono", monospace; font-size: 0.72rem; font-weight: 500; color: var(--accent); min-width: 3.2em; }
.rmg-calday-title { font-size: 0.86rem; font-weight: 300; color: var(--ink); line-height: 1.4; }
.rmg-calday-empty { font-size: 0.82rem; color: var(--faint); padding: 4px 0; }

/* 큰 캘린더 모달 */
.rmg-bigcal-scrim { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 24px; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); animation: rmg-fadein 0.25s ease both; }
@keyframes rmg-fadein { from { opacity: 0; } to { opacity: 1; } }
.rmg-bigcal { width: min(760px, 96vw); max-height: 88vh; overflow: auto; border: 1px solid var(--hair); border-radius: 22px; background: var(--surface); box-shadow: 0 40px 90px -30px rgba(0,0,0,0.7); animation: rmg-rise 0.3s cubic-bezier(0.22,1,0.36,1) both; }
.rmg-bigcal-head { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--hair); }
.rmg-bigcal-title { margin: 0; font-size: 1.05rem; font-weight: 500; color: var(--ink); }
.rmg-bigcal-close { display: grid; place-items: center; width: 34px; height: 34px; border: 0; background: none; color: var(--muted); border-radius: 9px; cursor: pointer; transition: background 0.2s, color 0.2s; }
.rmg-bigcal-close:hover { background: color-mix(in srgb, var(--ink) 8%, transparent); color: var(--ink); }
.rmg-bigcal-body { display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; padding: 24px; }
@media (max-width: 680px) { .rmg-bigcal-body { grid-template-columns: 1fr; } }
.rmg-mc.big .rmg-mc-title { font-size: 1.1rem; }
.rmg-mc.big .rmg-mc-cell { font-size: 0.95rem; border-radius: 10px; }
.rmg-mc.big .rmg-mc-wd span { font-size: 0.76rem; }
.rmg-bigcal-day { border-left: 1px solid var(--hair); padding-left: 24px; }
@media (max-width: 680px) { .rmg-bigcal-day { border-left: 0; padding-left: 0; border-top: 1px solid var(--hair); padding-top: 20px; } }

/* 하나의 흐름 (단일 컬럼) */
.rmg-flow { position: relative; z-index: 2; width: 100%; max-width: 600px; display: flex; flex-direction: column; gap: clamp(40px, 7vh, 80px); padding: clamp(48px, 12vh, 128px) clamp(28px, 5vw, 56px) 128px; }

/* HERO */
.rmg-hero { display: flex; flex-direction: column; }
.rmg-greet { margin: 0; font-size: clamp(2.4rem, 6vw, 3.6rem); font-weight: 300; letter-spacing: -0.035em; line-height: 1.02; color: var(--ink); }
.rmg-mood { margin: 12px 0 0; font-size: clamp(1.1rem, 2.6vw, 1.4rem); font-weight: 300; letter-spacing: -0.015em; color: var(--muted); }
.rmg-env-line { margin: 20px 0 0; display: inline-flex; align-items: center; gap: 7px; font-size: 0.9rem; font-weight: 400; color: var(--faint); }
.rmg-env-icon { width: 15px; height: 15px; stroke-width: 1.7; }
.rmg-counts { margin-top: 28px; display: flex; align-items: baseline; gap: 18px; }
.rmg-count { font-size: 0.98rem; font-weight: 300; color: var(--muted); letter-spacing: -0.01em; }
.rmg-count b { font-size: 1.5rem; font-weight: 500; color: var(--ink); letter-spacing: -0.03em; margin-right: 5px; font-variant-numeric: tabular-nums; }
.rmg-count-sep { width: 3px; height: 3px; border-radius: 50%; background: var(--hair); align-self: center; }

/* CONTEXT (큐레이션) */
.rmg-ctx-line { display: grid; grid-template-columns: 6.5em 1fr; gap: 18px; align-items: baseline; padding: 15px 0; border-top: 1px solid var(--hair); }
.rmg-ctx-line:first-of-type { border-top: 0; padding-top: 4px; }
.rmg-ctx-k { font-size: 0.8rem; font-weight: 500; letter-spacing: 0.02em; color: var(--faint); }
.rmg-ctx-v { font-size: 1.06rem; font-weight: 300; letter-spacing: -0.01em; color: var(--ink); line-height: 1.5; }
.rmg-ctx-v em { font-family: ui-monospace, "SF Mono", monospace; font-style: normal; font-weight: 500; color: var(--muted); }
.rmg-ctx-reflect { color: var(--muted); }

/* Ask Comein · 항상 보이는 주 입력 (문 + 명확한 필드 + 회전 예시) */
.rmg-ask { position: absolute; bottom: 26px; left: 50%; transform: translateX(-50%); z-index: 20;
  display: flex; align-items: center; gap: 12px;
  width: min(560px, calc(100% - 48px));
  padding: 9px 12px 9px 16px; border-radius: 16px;
  background: color-mix(in srgb, var(--surface) 84%, transparent); border: 1px solid var(--hair);
  backdrop-filter: blur(12px); box-shadow: 0 14px 42px -18px rgba(0,0,0,0.6);
  transition: border-color 0.3s, box-shadow 0.3s; }
.rmg-ask.focus { border-color: color-mix(in srgb, var(--accent) 40%, var(--hair)); box-shadow: 0 16px 46px -18px rgba(0,0,0,0.65), 0 0 0 3px var(--glow); }
.rmg-ask-door { display: grid; place-items: center; width: 24px; flex-shrink: 0; }
.rmg-ask-doormark { width: 19px; height: 25px; }
.rmg-ask-input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; padding: 9px 0; font-family: inherit; font-size: 1.04rem; font-weight: 400; letter-spacing: -0.01em; color: var(--ink); caret-color: var(--accent); }
.rmg-ask-input::placeholder { color: var(--muted); font-weight: 300; opacity: 1; }
.rmg-ask-kbd { font-family: ui-monospace, "SF Mono", monospace; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; color: var(--faint); border: 1px solid var(--hair); border-radius: 6px; padding: 3px 7px; flex-shrink: 0; }
.rmg-ask-send { display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 10px; background: var(--accent); color: #0B0C12; cursor: pointer; flex-shrink: 0; transition: transform 0.15s cubic-bezier(0.22,1,0.36,1); }
.rmg-ask-send:hover { transform: translateY(-1px); }
.rmg-ask-send:active { transform: scale(0.95); }
.rmg-ask-send:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 3px; }

/* REVIEW · 영수증 (무엇 + 어디 + 열기/되돌리기) */
.rmg-rcpt-list { list-style: none; margin: 0; padding: 0; }
.rmg-rcpt { display: flex; align-items: center; gap: 12px; padding: 13px 0; border-bottom: 1px solid var(--hair); }
.rmg-rcpt:last-child { border-bottom: 0; }
.rmg-rcpt-mark { display: grid; place-items: center; width: 18px; flex-shrink: 0; color: var(--muted); }
.rmg-rcpt-door { width: 14px; height: 18px; }
.rmg-rcpt-dest { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); min-width: 5.4em; }
.rmg-rcpt-title { flex: 1; min-width: 0; font-size: 0.98rem; font-weight: 300; letter-spacing: -0.01em; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rmg-rcpt-time { font-family: ui-monospace, "SF Mono", monospace; font-size: 0.7rem; font-weight: 500; color: var(--faint); white-space: nowrap; }
.rmg-rcpt-open, .rmg-rcpt-undo { border: 0; background: none; font-family: inherit; font-size: 0.78rem; font-weight: 600; cursor: pointer; padding: 4px 8px; border-radius: 8px; white-space: nowrap; transition: color 0.2s, background 0.2s; }
.rmg-rcpt-open { color: var(--ink); }
.rmg-rcpt-open:hover { background: color-mix(in srgb, var(--ink) 8%, transparent); }
.rmg-rcpt-undo { color: var(--faint); }
.rmg-rcpt-undo:hover { color: var(--muted); }
.rmg-rcpt-open:focus-visible, .rmg-rcpt-undo:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
.rmg-empty { margin: 0; font-size: 0.92rem; font-weight: 300; color: var(--muted); line-height: 1.7; }
.rmg-empty b { color: var(--ink); font-weight: 500; }
.rmg-kbd { font-family: ui-monospace, "SF Mono", monospace; font-size: 0.78rem; font-weight: 600; color: var(--ink); background: var(--surface); border: 1px solid var(--hair); border-radius: 6px; padding: 1px 6px; }

/* facet 리스트 + 컨텍스트 AI */
.rmg-suggest { display: flex; align-items: center; gap: 12px; margin: 0 0 10px; padding: 13px 16px; border-radius: 14px; background: color-mix(in srgb, var(--surface) 55%, transparent); border: 1px solid var(--hair); }
.rmg-suggest-door { width: 18px; height: 23px; flex-shrink: 0; }
.rmg-suggest-text { flex: 1; font-size: 0.92rem; font-weight: 300; letter-spacing: -0.01em; color: var(--muted); }
.rmg-suggest-act { border: 0; background: var(--ink); color: var(--paper); font-family: inherit; font-size: 0.8rem; font-weight: 600; padding: 8px 15px; border-radius: 999px; cursor: pointer; transition: transform 0.15s cubic-bezier(0.22,1,0.36,1); white-space: nowrap; }
.rmg-suggest-act:hover { transform: translateY(-1px); }
.rmg-suggest-act:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 2px; }
.rmg-vlist { list-style: none; margin: 0; padding: 0; }
.rmg-vrow { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--hair); font-size: 1.1rem; font-weight: 300; letter-spacing: -0.02em; }
.rmg-vrow:last-child { border-bottom: 0; }
.rmg-vrow.rmg-dim { color: var(--faint); border-bottom: 0; }
.rmg-vtime { font-family: ui-monospace, "SF Mono", monospace; font-size: 0.82rem; font-weight: 500; color: var(--muted); min-width: 3.6em; }
.rmg-vdot { width: 7px; height: 7px; border-radius: 50%; border: 1px solid var(--faint); }
.rmg-vdot.hi { background: var(--muted); border-color: var(--muted); }
.rmg-vtitle { flex: 1; color: var(--ink); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rmg-vai { display: inline-grid; place-items: center; width: 15px; color: var(--muted); flex-shrink: 0; }
.rmg-vai-door { width: 12px; height: 15px; }
.rmg-vtrail { font-size: 0.76rem; color: var(--faint); font-weight: 400; flex-shrink: 0; }
.rmg-vact { opacity: 0; border: 1px solid var(--hair); background: none; color: var(--muted); font-family: inherit; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.02em; padding: 5px 11px; border-radius: 999px; cursor: pointer; white-space: nowrap; transition: opacity 0.25s, color 0.25s, border-color 0.25s; flex-shrink: 0; }
.rmg-vrow:hover .rmg-vact, .rmg-cal-row:hover .rmg-vact, .rmg-task:hover .rmg-vact, .rmg-note:hover .rmg-vact, .rmg-mtg:hover .rmg-vact, .rmg-ppl:hover .rmg-vact, .rmg-vact:focus-visible { opacity: 1; }
.rmg-vact:hover { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, var(--hair)); }
.rmg-vact:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; opacity: 1; }

/* 공통 · 기능 헤더 · AI 귀속 태그 */
.rmg-feat-head { margin-bottom: 22px; }
.rmg-feat-title { margin: 0; font-size: clamp(1.5rem, 3vw, 1.9rem); font-weight: 400; letter-spacing: -0.03em; color: var(--ink); }
.rmg-tag-ai { display: inline-grid; place-items: center; width: 14px; color: var(--muted); flex-shrink: 0; }
.rmg-tag-door { width: 11px; height: 14px; }

/* Calendar · 아젠다 */
.rmg-cal { display: flex; flex-direction: column; gap: 26px; }
.rmg-cal-date { margin: 0 0 10px; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.04em; color: var(--faint); }
.rmg-cal-list { list-style: none; margin: 0; padding: 0; }
.rmg-cal-row { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-top: 1px solid var(--hair); }
.rmg-cal-row:first-child { border-top: 0; }
.rmg-cal-time { font-family: ui-monospace, "SF Mono", monospace; font-size: 0.86rem; font-weight: 500; color: var(--muted); min-width: 3.6em; }
.rmg-cal-bar { width: 2px; align-self: stretch; border-radius: 2px; background: var(--hair); }
.rmg-cal-title { flex: 1; min-width: 0; font-size: 1.02rem; font-weight: 400; letter-spacing: -0.01em; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Tasks · 체크리스트 */
.rmg-task-list { list-style: none; margin: 0; padding: 0; }
.rmg-task { display: flex; align-items: center; gap: 13px; padding: 13px 0; border-bottom: 1px solid var(--hair); }
.rmg-task:last-child { border-bottom: 0; }
.rmg-task-box { display: grid; place-items: center; width: 21px; height: 21px; border: 1.5px solid var(--faint); border-radius: 7px; background: none; cursor: pointer; flex-shrink: 0; transition: border-color 0.2s, background 0.2s; }
.rmg-task-box:hover { border-color: var(--accent); }
.rmg-task-box:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
.rmg-task-check { width: 13px; height: 13px; stroke-width: 2.4; color: transparent; transition: color 0.2s; }
.rmg-task-box:hover .rmg-task-check { color: var(--faint); }
.rmg-task-title { flex: 1; min-width: 0; font-size: 1.02rem; font-weight: 300; letter-spacing: -0.01em; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rmg-task-prio { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.02em; color: var(--faint); padding: 3px 9px; border: 1px solid var(--hair); border-radius: 999px; flex-shrink: 0; }
.rmg-task-prio.high { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 22%, var(--hair)); }

/* Notes · 그리드 */
.rmg-notes { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
.rmg-note { display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid var(--hair); border-radius: 14px; background: color-mix(in srgb, var(--surface) 45%, transparent); min-height: 120px; transition: border-color 0.3s; }
.rmg-note:hover { border-color: color-mix(in srgb, var(--ink) 12%, var(--hair)); }
.rmg-note-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.rmg-note-title { font-size: 0.98rem; font-weight: 500; letter-spacing: -0.01em; color: var(--ink); }
.rmg-note-body { margin: 0; flex: 1; font-size: 0.86rem; font-weight: 300; line-height: 1.55; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.rmg-note-foot { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.rmg-note-tag { font-size: 0.72rem; font-weight: 400; color: var(--faint); }
.rmg-note-act { margin-left: auto; }

/* Meetings · 리스트 */
.rmg-mtg-list { list-style: none; margin: 0; padding: 0; }
.rmg-mtg { display: flex; flex-direction: column; gap: 10px; padding: 18px 0; border-bottom: 1px solid var(--hair); }
.rmg-mtg:last-child { border-bottom: 0; }
.rmg-mtg-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.rmg-mtg-title { font-size: 1.06rem; font-weight: 500; letter-spacing: -0.02em; color: var(--ink); }
.rmg-mtg-time { font-family: ui-monospace, "SF Mono", monospace; font-size: 0.76rem; font-weight: 500; color: var(--faint); white-space: nowrap; }
.rmg-mtg-people { display: flex; flex-wrap: wrap; gap: 6px; }
.rmg-mtg-chip { font-size: 0.76rem; font-weight: 400; color: var(--muted); padding: 3px 10px; border: 1px solid var(--hair); border-radius: 999px; }
.rmg-mtg-sum { margin: 0; font-size: 0.9rem; font-weight: 300; line-height: 1.6; color: var(--muted); }

/* People · 연락처 */
.rmg-ppl-list { list-style: none; margin: 0; padding: 0; }
.rmg-ppl { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--hair); }
.rmg-ppl:last-child { border-bottom: 0; }
.rmg-ppl-av { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: var(--surface); border: 1px solid var(--hair); font-size: 0.9rem; font-weight: 600; color: var(--muted); flex-shrink: 0; }
.rmg-ppl-txt { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.rmg-ppl-name { font-size: 1rem; font-weight: 400; color: var(--ink); letter-spacing: -0.01em; }
.rmg-ppl-org { font-size: 0.8rem; font-weight: 300; color: var(--faint); }

.rmg-clock { position: absolute; top: 30px; right: 34px; z-index: 2; font-family: ui-monospace, "SF Mono", monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.06em; color: var(--faint); }

/* 등장 */
.rmg-a1 { animation: rmg-rise 0.6s cubic-bezier(0.22,1,0.36,1) both; }
.rmg-a2 { animation: rmg-rise 0.6s cubic-bezier(0.22,1,0.36,1) 0.08s both; }
.rmg-a3 { animation: rmg-rise 0.6s cubic-bezier(0.22,1,0.36,1) 0.16s both; }
.rmg-a4 { animation: rmg-rise 0.6s cubic-bezier(0.22,1,0.36,1) 0.24s both; }
@keyframes rmg-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

@media (prefers-reduced-motion: reduce) {
  .rmg-a1,.rmg-a2,.rmg-a3,.rmg-a4,.rmg-thr,.rmg-thr.leaving,.rmg-phil-1,.rmg-phil-2,.rmg-thr-cta,.aidoor-svg { animation: none; }
}
`;
