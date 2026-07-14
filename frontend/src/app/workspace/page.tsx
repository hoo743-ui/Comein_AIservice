"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ArrowUp, Bell, CalendarDays, Check, Cloud, CloudRain, CloudSnow,
  ChevronDown, LogOut, MessagesSquare, Search, Settings as SettingsIcon, Sparkles, StickyNote, Sun, Users, X,
} from "lucide-react";

import { useWorkspace } from "@/lib/store";
import { fmtTime, fmtDate } from "@/lib/format";

/**
 * Comein · Reimagined Workspace — 대시보드가 아니라 '살아있는 편집적 워크스페이스'.
 * 하나의 통합 구성: Hero → Today's context → Quick capture → AI timeline (시선이 아래로 흐른다).
 * 문은 패널이 아니라 환경의 보이지 않는 심장 — 평소엔 사라지고, AI가 일하면 열려 빛이 흐른다.
 * 보라색은 오직 AI 활동의 언어. 배경은 아주 옅게 숨쉰다(래디얼·그레인·미세 입자). 구조는 타이포·여백으로.
 */

// 할 일(Tasks) 레일 아이콘 — 원 안의 리스트(사용자 지정 이미지 기준). lucide와 동일한 stroke 규격.
function TaskListIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9.25" />
      <circle cx="8.7" cy="9" r="1" />
      <circle cx="8.7" cy="12" r="1" />
      <circle cx="8.7" cy="15" r="1" />
      <line x1="11.7" y1="9" x2="16.3" y2="9" />
      <line x1="11.7" y1="12" x2="16.3" y2="12" />
      <line x1="11.7" y1="15" x2="16.3" y2="15" />
    </svg>
  );
}

type View = "today" | "calendar" | "tasks" | "notes" | "meetings" | "people";
const NAV: { key: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "today", label: "Today", icon: Sparkles },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "tasks", label: "Tasks", icon: TaskListIcon },
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "meetings", label: "Meetings", icon: MessagesSquare },
  { key: "people", label: "People", icon: Users },
];

type Kind = "일정" | "회의" | "할 일" | "메모";
// 영수증 — AI가 한 모든 일: 무엇 + 어디(목적지) + 언제. 즉시 실행하되 자취를 남긴다.
type Receipt = { id: number; at: number; title: string; kind: Kind; destView: View; destLabel: string; time: string | null; note?: string; isAction?: boolean };
// 초안(pending) — AI가 이해한 결과. 사용자가 확인/정제 후 확정(confirmed)하면 영수증이 된다.
type Draft = { title: string; kind: Kind; time: string | null; note: string };
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
function weatherWord(c: string | null, en: boolean) {
  if (!c) return en ? "Calm" : "잔잔함";
  if (/맑/.test(c)) return en ? "Clear" : "맑음";
  if (/비|소나기|이슬|뇌우/.test(c)) return en ? "Rainy" : "비";
  if (/눈/.test(c)) return en ? "Snow" : "눈";
  return en ? "Cloudy" : "흐림";
}
function reflection(c: string | null) {
  if (!c) return "오늘 하루도 차근히 정리해 둘게요.";
  if (/맑/.test(c)) return "집중하기 좋은 하루예요. 중요한 일에 먼저 몰입해보세요.";
  if (/비|소나기|뇌우/.test(c)) return "차분히 몰입하기 좋은 날이에요. 하나씩 정리해 둘게요.";
  if (/눈/.test(c)) return "고요한 하루예요. 마음이 흩어지지 않게 곁에서 정리할게요.";
  return "잔잔한 하루예요. 흐름이 끊기지 않게 정리해 둘게요.";
}

function reflectEn(c: string | null) {
  if (!c) return "I'll tidy today, step by step.";
  if (/맑/.test(c)) return "A good day to focus. Dive into what matters first.";
  if (/비|소나기|뇌우/.test(c)) return "A calm day for deep focus. I'll sort things one by one.";
  if (/눈/.test(c)) return "A quiet day. I'll keep things from scattering.";
  return "A gentle day. I'll keep the flow unbroken.";
}

// ── reimagine 전용 번역 레이어 (settings.language 에 연결) ──
type Lang = "ko" | "en";
const EN_VIEW: Record<View, string> = { today: "Today", calendar: "Calendar", tasks: "Tasks", notes: "Notes", meetings: "Meetings", people: "People" };
const EN_PLACEHOLDER: Record<View, string> = {
  today: "Write anything — I'll tidy the rest",
  calendar: "Say a new event — e.g. Meeting tomorrow 3pm",
  tasks: "Add a task — e.g. Prepare the deck",
  notes: "Leave a passing thought",
  meetings: "Schedule or wrap up a meeting",
  people: "Who should we connect with?",
};
const EN_HINTS = ["Ask Comein…", "Meet the professor tomorrow 3pm", "Prep the deck — as a task", "Note a meeting idea", "Organize this week"];

function L(lang: Lang) {
  const en = lang === "en";
  return {
    place: en ? "Seongnam" : "성남",
    viewLabel: (v: View) => (en ? EN_VIEW[v] : VIEW_LABEL[v]),
    navDesc: (v: View) => (en
      ? ({ today: "Today's flow", calendar: "Events & conflicts", tasks: "Tasks & priority", notes: "Notes & ideas", meetings: "Meetings & summaries", people: "People & contacts" } as Record<View, string>)[v]
      : ({ today: "오늘의 흐름", calendar: "일정과 충돌", tasks: "할 일과 우선순위", notes: "생각을 메모로", meetings: "회의와 요약", people: "연결된 사람" } as Record<View, string>)[v]),
    upNext: en ? "Up next" : "다가오는 순간",
    todayFlow: en ? "Today's flow" : "오늘의 흐름",
    aiThought: en ? "Today's Insight" : "오늘의 브리핑",
    noUpcoming: en ? "Nothing scheduled yet." : "예정된 일정이 없어요",
    pace: (n: number, tight: boolean) => (en ? `${n} left · ${tight ? "a full flow" : "an easy flow"}` : `남은 일 ${n}가지 · ${tight ? "촘촘한 흐름" : "여유로운 흐름"}`),
    paceEmpty: en ? "Nothing today — feels light" : "오늘은 비어 있어요 — 마음이 가볍네요",
    reflect: (c: string | null) => (en ? reflectEn(c) : reflection(c)),
    todaysContextEye: en ? "Today’s context" : "오늘의 맥락",
    justOrganized: en ? "Just organized" : "방금 정리한 것",
    organizing: en ? "organizing" : "정리 중",
    open: en ? "Open" : "열기",
    undo: en ? "Undo" : "되돌리기",
    captureHint: en
      ? (<>Write anything with <kbd className="rmg-kbd">⌘K</kbd> — Comein files it in the right place and notes <b>where it went</b> here.</>)
      : (<><kbd className="rmg-kbd">⌘K</kbd>로 무엇이든 적으면 — AI가 알맞은 곳에 넣고, 여기에 <b>어디에 뒀는지</b> 남깁니다.</>),
    notif: en ? "Notifications" : "알림",
    startingSoon: en ? "Starting soon" : "곧 시작하는 일정",
    importantTask: en ? "Important task" : "중요한 할 일",
    noNotif: en ? "No new notifications." : "새로운 알림이 없어요.",
    topCalendar: en ? "Calendar" : "캘린더",
    topSettings: en ? "Settings" : "설정",
    themeToggle: en ? "Toggle theme" : "테마 전환",
    liveWorkspace: "Live workspace",
    placeholder: (v: View) => (en ? EN_PLACEHOLDER[v] : PLACEHOLDER[v]),
    hints: () => (en ? EN_HINTS : HINTS),
    viewAI: (v: Exclude<View, "today">) => (en ? EN_VIEW_AI[v] : VIEW_AI[v]),
    priority: (p: string) => (en ? ({ high: "High", mid: "Mid", low: "Low" } as Record<string, string>)[p] : ({ high: "높음", mid: "보통", low: "낮음" } as Record<string, string>)[p]),
    emptyCal: en ? "Nothing scheduled." : "예정된 일정이 없어요.",
    emptyTasks: en ? "No tasks right now." : "지금은 할 일이 없어요.",
    emptyNotes: en ? "No thoughts saved yet." : "아직 담아둔 생각이 없어요.",
    emptyMeetings: en ? "No meetings scheduled." : "예정된 회의가 없어요.",
    emptyPeople: en ? "No one connected yet." : "연결된 사람이 없어요.",
    dayLabel: (d: Date, base: Date | null) => {
      if (base) {
        const diff = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(base.getFullYear(), base.getMonth(), base.getDate())) / 86_400_000);
        if (diff === 0) return en ? "Today" : "오늘";
        if (diff === 1) return en ? "Tomorrow" : "내일";
        if (diff === -1) return en ? "Yesterday" : "어제";
      }
      return fmtDate(d);
    },
    dayNoEvent: en ? "Nothing today — add one with ⌘K." : "오늘은 비어 있습니다 — ⌘K로 추가해보세요.",
    asLineNext: en ? "One moment to prepare today." : "오늘 준비해 둘 순간이 하나 있어요.",
    asLineQuiet: (w: number) => (en ? `Someone's been quiet for ${w} week${w > 1 ? "s" : ""}.` : `${w}주째 조용한 분이 있어요.`),
    asLineLight: en ? "Today feels lighter than yesterday." : "오늘은 어제보다 가벼워요.",
    asLineCalm: en ? "Today's flow is calm." : "오늘의 흐름은 잔잔해요.",
    asCtx: (time: string, title: string) => (en ? `Soon ${time}, ${title}.` : `곧 ${time}, ${title}.`),
    asCtxEmpty: en ? "Today is open — feels light." : "오늘은 비어 있어요 — 마음이 가볍네요.",
    asMemUnsum: en ? "The last meeting isn't wrapped up yet." : "지난 회의가 아직 정리되지 않았어요.",
    asMemNote: (t: string) => (en ? `I still remember ‘${t}’.` : `얼마 전 '${t}', 기억하고 있어요.`),
    asMemNone: en ? "No memories saved yet." : "아직 담아둔 기억이 없어요.",
    asInsBusy: en ? "It's a full day — I'll keep room to breathe." : "일정이 촘촘해요 — 사이에 숨 쉴 틈을 남겨둘게요.",
    asInsFree: en ? "The afternoon is fairly open — good for focus." : "오후가 비교적 비어 있어요 — 몰입하기 좋아요.",
    actOrganize: en ? "Tidy up today" : "오늘 준비해 두기",
    actMeeting: en ? "Wrap meeting into tasks" : "회의 정리해서 할 일로",
    actWeek: en ? "Preview this week" : "이번 주 미리 살펴보기",
    quietNote: (w: number) => (en ? `quiet for ${w} week${w > 1 ? "s" : ""}` : `${w}주째 조용해요`),
    setName: en ? "Name" : "이름", setNameD: en ? "Display name in greetings and profile" : "인사와 프로필에 쓰이는 표시 이름",
    setLang: en ? "Language" : "언어", setLangD: en ? "Interface language" : "인터페이스 언어",
    setMode: en ? "Usage type" : "사용 유형", setModeD: en ? "Reflected in default places & labels" : "기본 장소·라벨 프리셋에 반영",
    setWeek: en ? "Week starts" : "주 시작", setWeekD: en ? "First day of the calendar week" : "캘린더 한 주의 시작 요일",
    setTheme: en ? "Theme" : "테마", setThemeD: en ? "Light and dark" : "밝은 화면과 어두운 화면",
    setSize: en ? "Text size" : "글자 크기", setSizeD: en ? "Enlarge text across the screen" : "화면 전체 글자를 키워요",
    setNotif: en ? "Notifications" : "알림", setNotifD: en ? "We'll flag upcoming events and key tasks" : "다가오는 일정·중요한 할 일을 알려드려요",
    setAuto: en ? "AI auto-confirm" : "AI 자동 확정", setAutoD: en ? "Register AI-suggested events without asking" : "AI가 제안한 일정을 확인 없이 바로 등록",
    segStudent: en ? "Student" : "학생", segOffice: en ? "Office" : "직장인", segGeneral: en ? "General" : "일반",
    segSun: en ? "Sunday" : "일요일", segMon: en ? "Monday" : "월요일",
    segMd: en ? "Normal" : "보통", segLg: en ? "Large" : "크게", segXl: en ? "Larger" : "더 크게",
  };
}

export default function Reimagine() {
  const { resolvedTheme, setTheme } = useTheme();
  const schedules = useWorkspace((s) => s.schedules);
  const todos = useWorkspace((s) => s.todos);
  const memos = useWorkspace((s) => s.memos);
  const meetings = useWorkspace((s) => s.meetings);
  const contacts = useWorkspace((s) => s.contacts);
  const moveTodo = useWorkspace((s) => s.moveTodo);
  const settings = useWorkspace((s) => s.settings);
  const updateSettings = useWorkspace((s) => s.updateSettings);
  const lang: Lang = settings.language;
  const t = L(lang);

  const [mounted, setMounted] = React.useState(false);
  const [now, setNow] = React.useState<Date | null>(null);
  const [view, setView] = React.useState<View>("today");
  const [shownView, setShownView] = React.useState<View>("today"); // 실제 렌더 중인 뷰 — 전환 시 이전 뷰를 잠깐 더 붙잡아 크로스페이드
  const [flowExit, setFlowExit] = React.useState(false); // 탭 전환: 이전 내용 페이드아웃 단계
  const [receipts, setReceipts] = React.useState<Receipt[]>([]);
  const [draft, setDraft] = React.useState<Draft | null>(null); // 확인/정제 카드 — 캡처 후 확정 전 pending 상태
  const [organizing, setOrganizing] = React.useState(false);
  const [weather, setWeather] = React.useState<{ temp: number; condition: string } | null>(null);
  const [calDay, setCalDay] = React.useState<Date | null>(null);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [panel, setPanel] = React.useState<null | "calendar" | "settings">(null);
  const [entered, setEntered] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const [arriving, setArriving] = React.useState(false); // opening 에서 막 넘어옴 — 페이드인으로 부드럽게 받는다
  const [toOpening, setToOpening] = React.useState(false); // 첫 진입 → opening 로그인 시네마틱으로 리디렉트 중
  const [railOpen, setRailOpen] = React.useState(false); // 슬림 레일 확장(호버/첫실행) — "공간이 열리는" 느낌
  const [railIntro, setRailIntro] = React.useState(false); // 첫 방문 1회 자동 펼침 안내
  const [calFocus, setCalFocus] = React.useState<Date | null>(null); // AI 탐색이 지정한 캘린더 이동 대상
  const [calSearchOpen, setCalSearchOpen] = React.useState(false); // 캘린더 AI 탐색(⌘K)
  const router = useRouter();

  const seq = React.useRef(0);
  const orgTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const railTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // 레일 확장: 호버 인텐트(살짝 지연 → 툴팁이 먼저 뜨고, 머무르면 열림). 첫실행 자동안내 중엔 무시.
  const openRail = React.useCallback(() => {
    if (railTimer.current) clearTimeout(railTimer.current);
    railTimer.current = setTimeout(() => setRailOpen(true), 140);
  }, []);
  const closeRail = React.useCallback(() => {
    if (railTimer.current) clearTimeout(railTimer.current);
    if (railIntro) return;
    // 짧은 그레이스 딜레이 — 가장자리 지터로 접히는 깜빡임 방지(hover 유지)
    railTimer.current = setTimeout(() => setRailOpen(false), 120);
  }, [railIntro]);

  // 첫 실행 UX — 최초 1회만 2.6초 펼쳐 보여준 뒤 조용히 접힘(localStorage)
  React.useEffect(() => {
    let seen = true;
    try { seen = localStorage.getItem("comein:railIntro") === "1"; } catch {}
    if (seen) return;
    const start = setTimeout(() => { setRailIntro(true); setRailOpen(true); }, 900); // 문턱 연출이 끝난 뒤 자연스럽게
    const end = setTimeout(() => {
      setRailIntro(false); setRailOpen(false);
      try { localStorage.setItem("comein:railIntro", "1"); } catch {}
    }, 900 + 2600);
    return () => { clearTimeout(start); clearTimeout(end); };
  }, []);

  React.useEffect(() => () => { if (railTimer.current) clearTimeout(railTimer.current); }, []);

  // 탭 전환 크로스페이드 — 이전 뷰를 잠깐 페이드아웃한 뒤 새 뷰로 교체(툭 끊기지 않게)
  React.useEffect(() => {
    if (view === shownView) return;
    setFlowExit(true);
    const t = setTimeout(() => { setShownView(view); setFlowExit(false); }, 200);
    return () => clearTimeout(t);
  }, [view, shownView]);

  // 캘린더 패널이 열려 있을 때만 ⌘K/Ctrl+K 로 AI 날짜 탐색을 연다(컴포저는 패널 중 언마운트되어 충돌 없음)
  React.useEffect(() => {
    if (panel !== "calendar") { setCalSearchOpen(false); return; }
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCalSearchOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

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
    let justEntered = false;
    try {
      already = sessionStorage.getItem("comein:reimagine") === "1";
      justEntered = sessionStorage.getItem("comein:justEntered") === "1";
      if (justEntered) sessionStorage.removeItem("comein:justEntered");
    } catch {}
    let a: ReturnType<typeof setTimeout> | undefined;
    if (already) {
      setEntered(true);
      if (justEntered) { setArriving(true); a = setTimeout(() => setArriving(false), 1300); }
    } else {
      // 처음 들어옴 — 문턱 대신 opening 로그인 시네마틱을 관문으로.
      setToOpening(true);
      router.replace("/experience");
    }
    return () => { clearInterval(clock); if (a) clearTimeout(a); };
  }, [router]);

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
    const tl = L(lang);
    const list: { id: string; title: string; detail: string }[] = [];
    for (const s of upcoming.slice(0, 3)) list.push({ id: `s${s.id}`, title: tl.startingSoon, detail: `${fmtTime(s.start)} · ${s.title}` });
    for (const td of openTodos.filter((x) => x.priority === "high").slice(0, 2)) list.push({ id: `t${td.id}`, title: tl.importantTask, detail: td.title });
    return list;
  }, [upcoming, openTodos, now, lang]);

  const ignite = React.useCallback(() => {
    if (orgTimer.current) clearTimeout(orgTimer.current);
    setOrganizing(true);
    orgTimer.current = setTimeout(() => setOrganizing(false), 1600);
  }, []);

  // 캡처 — 즉시 확정하지 않고, AI가 이해한 결과를 확인/정제 카드(pending)로 띄운다.
  const capture = (v: string) => {
    const t = v.trim();
    if (!t) return;
    setDraft({ title: t, kind: classify(t), time: parseTime(t), note: "" });
  };
  // 확정(confirmed) — 카드에서 확정해야 목적지로 라우팅한 '영수증'을 남긴다.
  const commitDraft = (d: Draft) => {
    const t = d.title.trim();
    if (!t) return;
    const dest = DEST[d.kind];
    seq.current += 1;
    setReceipts((prev) => [{ id: seq.current, at: Date.now(), title: t, kind: d.kind, destView: dest.view, destLabel: dest.label, time: d.time, note: d.note.trim() || undefined }, ...prev].slice(0, 8));
    setDraft(null);
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

  // ── Invisible AI · 조용한 비서 — 데이터가 아니라 '사람다운 한 문장'으로. ──
  const h = now?.getHours() ?? 9;
  const dateLine = now
    ? (lang === "en"
        ? `${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · ${now.toLocaleDateString("en-US", { weekday: "long" })}`
        : `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 · ${["일", "월", "화", "수", "목", "금", "토"][now.getDay()]}요일`)
    : "";
  // 헤더 중앙 Workspace Context — 탭별 '오늘의 상태' 한 줄 (패널 열림 시 숨김)
  const headerCtx = ((): string | null => {
    if (panel) return null;
    const en = lang === "en";
    const hiTasks = openTodos.filter((x) => x.priority === "high").length;
    const followUp = now
      ? contacts.filter((c: any) => c.lastMet && Math.floor((+now - +new Date(c.lastMet)) / 86_400_000) >= 14).length
      : 0;
    switch (view) {
      case "today": return en ? `${greetingFor(h)} · Workspace ready` : `${greetingFor(h)} · 오늘도 준비됐어요`;
      case "calendar": return en ? `${upcoming.length} coming up` : `다가오는 일정 ${upcoming.length}개`;
      case "tasks": return en ? `${hiTasks} high priority` : `우선순위 높은 작업 ${hiTasks}개`;
      case "notes": return en ? `${memos.length} notes` : `메모 ${memos.length}개`;
      case "meetings": return en ? `${meetings.length} meetings today` : `오늘 회의 ${meetings.length}개`;
      case "people": return en ? `${followUp} to follow up` : `오늘 확인할 사람 ${followUp}명`;
      default: return null;
    }
  })();
  const WeatherIcon = weather ? weatherIconOf(weather.condition) : Cloud;
  const rc = (v: View) => receipts.filter((r) => !r.isAction && r.destView === v).length;
  const taskCount = openTodos.length + rc("tasks");
  const noteCount = memos.length + rc("notes");
  const paceLine = taskCount > 0 ? t.pace(taskCount, upcoming.length > 2) : t.paceEmpty;

  const textScale = ({ md: 1, lg: 1.12, xl: 1.24 } as const)[settings.textScale] ?? 1;

  // 첫 진입 → opening 으로 리디렉트 중엔 빈 배경만 (깜빡임 없이 넘어간다)
  if (toOpening) {
    return (
      <div className="rmg" style={{ ["--rmg-fs" as string]: String(textScale) } as React.CSSProperties}>
        <style>{CSS}</style>
      </div>
    );
  }

  // 레일 활성 인디케이터 위치 — 캘린더 패널이면 캘린더 칸, 패널 없으면 현재 뷰 칸. 설정/가이드(패널)일 땐 숨김(위치는 마지막 뷰 유지 → 튐 없이 페이드).
  const navViewIndex = NAV.findIndex((n) => n.key === view);
  const navActive = panel === "calendar" ? NAV.findIndex((n) => n.key === "calendar") : panel === null ? navViewIndex : -1;
  const navIndPos = navActive >= 0 ? navActive : navViewIndex;

  return (
    <div className={`rmg ${railOpen || panel ? "rail-open" : ""} ${railIntro ? "rail-intro" : ""} ${panel ? "panel-open" : ""}`} style={{ ["--rmg-fs" as string]: String(textScale) } as React.CSSProperties}>
      <style>{CSS}</style>
      {arriving && <div className="rmg-arrive" aria-hidden />}

      {/* 문턱 */}
      {!entered && (
        <div className={`rmg-thr ${leaving ? "leaving" : ""}`} onClick={enterNow} role="button" aria-label="들어가기">
          <div className="rmg-thr-in">
            <AiDoor active={leaving} className="rmg-thr-door" />
            <p className="rmg-phil-1">{lang === "en" ? "Thoughts scatter." : "생각은 흩어집니다."}</p>
            <p className="rmg-phil-2">{lang === "en" ? "Order is made." : "질서는 만들어집니다."}</p>
            <span className="rmg-thr-cta">{lang === "en" ? "Enter · Come in" : "들어가기 · Come in"}</span>
          </div>
        </div>
      )}

      {/* 슬림 레일 — 호버 시 사이드바+콘텐츠가 함께 밀리며 공간 확장(오버레이 아님) · 첫 방문 자동 안내 */}
      <aside
        className="rmg-rail"
        onMouseEnter={openRail}
        onMouseLeave={closeRail}
      >
        <div className="rmg-rail-panel">
          <div className="rmg-rail-mark" aria-hidden>
            <AiDoor active={organizing} className="rmg-rail-door" />
            <span className="rmg-rail-word">Comein</span>
          </div>
          <nav className="rmg-rail-nav" style={{ ["--active" as string]: String(navIndPos) } as React.CSSProperties}>
            <span className="rmg-rail-ind" aria-hidden data-hidden={navActive < 0} />
            {NAV.map((n, i) => {
              const on = n.key === "calendar" ? panel === "calendar" : panel === null && view === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => (n.key === "calendar" ? setPanel("calendar") : (setPanel(null), setView(n.key)))}
                  className={`rmg-railbtn ${on ? "on" : ""}`}
                  style={{ ["--i" as string]: i } as React.CSSProperties}
                  aria-label={t.viewLabel(n.key)}
                >
                  <n.icon className="rmg-railicon" />
                  <span className="rmg-raillabel">{t.viewLabel(n.key)}</span>
                </button>
              );
            })}
          </nav>
          <div className="rmg-rail-foot">
            <button
              type="button"
              className={`rmg-railbtn ${panel === "settings" ? "on" : ""}`}
              aria-label={t.topSettings}
              onClick={() => setPanel((p) => (p === "settings" ? null : "settings"))}
            >
              <SettingsIcon className="rmg-railicon" />
              <span className="rmg-raillabel">{t.topSettings}</span>
            </button>
            <Link href="/" className="rmg-railbtn" aria-label={lang === "en" ? "Exit" : "나가기"}>
              <LogOut className="rmg-railicon" />
              <span className="rmg-raillabel">{lang === "en" ? "Exit" : "나가기"}</span>
            </Link>
          </div>
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

        {/* 최상단 — 우측 알림 / 중앙 컨텍스트 한 줄 (좌상단 탭 이름은 제거) */}
        <header className="rmg-topbar">
          {mounted && headerCtx && <span key={headerCtx} className="rmg-topctx">{headerCtx}</span>}
        </header>

        {/* Workspace Status — 시간 · 알림 · 문(브랜드) · 오늘의 상태를 하나의 우측 영역으로 */}
        <div className="rmg-status">
          <StatusTime lang={lang} />
          <div className="rmg-notif">
            <button type="button" className={`rmg-notif-btn ${notifOpen ? "on" : ""}`} onClick={() => setNotifOpen((o) => !o)} aria-label={lang === "en" ? `${notifs.length} notifications` : `알림 ${notifs.length}건`}>
              <Bell className="rmg-notif-ic" />
              {notifs.length > 0 && <span className="rmg-notif-badge">{notifs.length}</span>}
            </button>
            {notifOpen && (
              <>
                <div className="rmg-notif-scrim" onClick={() => setNotifOpen(false)} aria-hidden />
                <div className="rmg-notif-panel">
                  <p className="rmg-notif-head">{t.notif}</p>
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
                    <p className="rmg-notif-empty">{t.noNotif}</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 왼쪽 여백의 상시 캘린더 — 모든 화면에서 시간 맥락. */}
        <aside className="rmg-calrail" aria-label={t.topCalendar}>
          {mounted && calDay && now && (
            <>
              <MonthCalendar base={now} events={calItems.map((i) => i.date)} selected={calDay} onSelect={setCalDay} lang={lang} />
              <div className="rmg-calday">
                <p className="rmg-calday-date">{fmtDate(calDay)}</p>
                <ul className="rmg-calday-list">
                  {dayItems.map((it, idx) => (
                    <li key={idx} className="rmg-calday-row">
                      <span className="rmg-calday-time">{it.time}</span>
                      <span className="rmg-calday-title">{it.title}</span>
                    </li>
                  ))}
                  {dayItems.length === 0 && <li className="rmg-calday-empty">{t.dayNoEvent}</li>}
                </ul>
              </div>
            </>
          )}
        </aside>

        <div className={`rmg-flow ${flowExit ? "flow-exit" : ""}`} key={shownView}>
          {shownView === "today" ? (
            <>
              {/* HERO — 감정의 중심 */}
              <section className="rmg-hero rmg-a1">
                <p className="rmg-greet">{mounted ? greetingFor(h) : " "}.</p>
                {mounted && <p className="rmg-date">{dateLine}</p>}
                <p className="rmg-mood">{mounted ? moodEn(h, weather?.condition ?? null) : ""}</p>
                <p className="rmg-env-line">
                  <WeatherIcon className="rmg-env-icon" />
                  {mounted ? ` ${weatherWord(weather?.condition ?? null, lang === "en")} · ${t.place}${weather ? ` · ${weather.temp}°C` : ""}` : ""}
                </p>
                <div className="rmg-counts">
                  <span className="rmg-count"><b className="rmg-count-n">{meetings.length}</b><span className="rmg-count-l">{lang === "en" ? "Meetings" : "회의"}</span></span>
                  <span className="rmg-count"><b className="rmg-count-n">{taskCount}</b><span className="rmg-count-l">{lang === "en" ? "Tasks" : "할 일"}</span></span>
                  <span className="rmg-count"><b className="rmg-count-n">{noteCount}</b><span className="rmg-count-l">{lang === "en" ? "Notes" : "메모"}</span></span>
                </div>
              </section>

              {/* CONTEXT — 큐레이션 (위젯 아님) */}
              <section className="rmg-ctx rmg-a2">
                <p className="rmg-eyebrow">{t.todaysContextEye}</p>
                <div className="rmg-ctx-line">
                  <span className="rmg-ctx-k">{t.upNext}</span>
                  <span className="rmg-ctx-v">
                    {next ? <><em>{mounted ? fmtTime(next.start) : ""}</em> · {next.title}</> : t.noUpcoming}
                  </span>
                </div>
                <div className="rmg-ctx-line">
                  <span className="rmg-ctx-k">{t.todayFlow}</span>
                  <span className="rmg-ctx-v">{paceLine}</span>
                </div>
                <div className="rmg-ctx-line">
                  <span className="rmg-ctx-k">{t.aiThought}</span>
                  <span className="rmg-ctx-v rmg-ctx-reflect">{t.reflect(weather?.condition ?? null)}</span>
                </div>
              </section>
            </>
          ) : (
            <Feature
              view={shownView}
              lang={lang}
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

          {shownView === "today" && (
            /* REVIEW — AI가 방금 한 일: 무엇 + 어디 + [열기]/[되돌리기] (영수증) */
            <section className="rmg-review rmg-a4">
              <p className="rmg-eyebrow">{t.justOrganized} {organizing && <span className="rmg-org">· {t.organizing}</span>}</p>
              {receipts.length > 0 ? (
                <ul className="rmg-rcpt-list">
                  {receipts.map((r) => (
                    <li key={r.id} className="rmg-rcpt">
                      <span className="rmg-rcpt-time">{mounted ? fmtTime(new Date(r.at)) : ""}</span>
                      <span className="rmg-rcpt-body">
                        <span className="rmg-rcpt-mark"><AiDoor className="rmg-rcpt-door" /></span>
                        <span className="rmg-rcpt-desc">
                          <b className="rmg-rcpt-title">{r.title}</b>
                          <span className="rmg-rcpt-dest">{t.viewLabel(r.destView)}{r.time ? ` · ${r.time}` : ""}{r.note ? ` · ${r.note}` : ""}</span>
                        </span>
                      </span>
                      <span className="rmg-rcpt-acts">
                        {!r.isAction && (
                          <button type="button" className="rmg-rcpt-open" onClick={() => setView(r.destView)}>{t.open}</button>
                        )}
                        <button type="button" className="rmg-rcpt-undo" onClick={() => undoReceipt(r.id)}>{t.undo}</button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rmg-empty">{t.captureHint}</p>
              )}
            </section>
          )}
        </div>

        {/* 앰비언트 AI — 상주 챗박스가 아니라, 필요할 때만 펼쳐지는 떠다니는 문 (⌘K).
            전체 패널(캘린더·설정·가이드)이 열리면 컴포저는 물러난다(⌘K 충돌 방지).
            초안(pending)이 있으면 컴포저 대신 확인/정제 카드를 그 자리에 띄운다. */}
        {!panel && !draft && <DoorInvoke view={view} lang={lang} organizing={organizing} onSubmit={capture} />}
        {!panel && draft && (
          <ConfirmCard draft={draft} lang={lang} onConfirm={commitDraft} onCancel={() => setDraft(null)} />
        )}

        {/* 가로 옵션에서 여는 전체 화면 란 — 캘린더 전체 / 설정 (모달 아님, 캔버스 위 큰 판) */}
        {panel && mounted && (
          <section className="rmg-panel" key={panel} aria-label={panel === "calendar" ? t.topCalendar : t.topSettings}>
            <div className="rmg-panel-head">
              <p className="rmg-panel-title">{panel === "calendar" ? t.topCalendar : t.topSettings}</p>
              <button type="button" className="rmg-panel-close" onClick={() => setPanel(null)} aria-label={lang === "en" ? "Close" : "닫기"}>
                <X className="rmg-notif-ic" />
              </button>
            </div>
            <div className="rmg-panel-body">
              {panel === "calendar" && calDay && now && (
                <div className="rmg-fullcal">
                  <div className="rmg-fullcal-cal">
                    <MonthCalendar
                      base={now}
                      events={calItems.map((i) => i.date)}
                      selected={calDay}
                      onSelect={setCalDay}
                      big
                      lang={lang}
                      focusDate={calFocus}
                      onSearch={() => setCalSearchOpen(true)}
                    />
                  </div>
                  <div className="rmg-fullcal-day">
                    <p className="rmg-calday-date">{fmtDate(calDay)}</p>
                    <ul className="rmg-calday-list">
                      {dayItems.map((it, idx) => (
                        <li key={idx} className="rmg-calday-row">
                          <span className="rmg-calday-time">{it.time}</span>
                          <span className="rmg-calday-title">{it.title}</span>
                        </li>
                      ))}
                      {dayItems.length === 0 && <li className="rmg-calday-empty">{t.dayNoEvent}</li>}
                    </ul>

                    <div className="rmg-calup">
                      <p className="rmg-eyebrow">{lang === "en" ? "Upcoming" : "다가오는 일정"}</p>
                      <ul className="rmg-calday-list">
                        {upcoming.slice(0, 6).map((s) => (
                          <li key={s.id} className="rmg-calup-row" onClick={() => setCalDay(new Date(s.start))}>
                            <span className="rmg-calup-date">{t.dayLabel(new Date(s.start), now)}</span>
                            <span className="rmg-calday-time">{fmtTime(s.start)}</span>
                            <span className="rmg-calday-title">{s.title}</span>
                          </li>
                        ))}
                        {upcoming.length === 0 && <li className="rmg-calday-empty">{t.noUpcoming}</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              {panel === "settings" && (
                <SettingsPanel
                  settings={settings}
                  onChange={updateSettings}
                  theme={resolvedTheme}
                  onTheme={(th) => setTheme(th)}
                  mounted={mounted}
                  lang={lang}
                />
              )}
            </div>
          </section>
        )}
      </main>

      {/* AI Calendar Search — 말로 날짜를 탐색 (⌘K, 캘린더 열림 상태) */}
      <CalSearch
        open={calSearchOpen}
        onClose={() => setCalSearchOpen(false)}
        onJump={(d) => { setCalDay(d); setCalFocus(new Date(d.getFullYear(), d.getMonth(), d.getDate())); }}
        events={calItems.map((i) => i.date)}
        now={now}
        lang={lang}
      />
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
function DoorInvoke({ view, lang, organizing, onSubmit }: { view: View; lang: Lang; organizing: boolean; onSubmit: (v: string) => void }) {
  const tt = L(lang);
  const hints = tt.hints();
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
    const iv = setInterval(() => setHi((i) => (i + 1) % hints.length), 3400);
    return () => clearInterval(iv);
  }, [focused, draft, hints.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    onSubmit(v);
    setDraft("");
  };
  const placeholder = focused ? tt.placeholder(view) : hints[hi];

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
        aria-label={lang === "en" ? "Ask Comein" : "Comein에게 입력"}
      />
      {draft.trim() ? (
        <button type="submit" className="rmg-ask-send" aria-label={lang === "en" ? "Send" : "보내기"}><ArrowUp className="rmg-railicon" /></button>
      ) : (
        <span className="rmg-ask-kbd">⌘K</span>
      )}
    </form>
  );
}

/** 확인/정제 카드 — 캡처 직후, AI가 이해한 결과(pending)를 조용히 제시하고 살짝 손보게 한다.
 *  폼을 채우는 게 아니라 'AI가 채운 걸 사용자가 끄덕이는' 경험. 확정하면 목적지로 배정된다. */
function ConfirmCard({ draft, lang, onConfirm, onCancel }: {
  draft: Draft; lang: Lang; onConfirm: (d: Draft) => void; onCancel: () => void;
}) {
  const t = L(lang);
  const en = lang === "en";
  const [d, setD] = React.useState<Draft>(draft);
  const titleRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { setD(draft); }, [draft]);
  React.useEffect(() => { titleRef.current?.focus(); titleRef.current?.select(); }, []);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); onConfirm({ ...d, time: d.time?.trim() || null }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [d, onConfirm, onCancel]);

  const KINDS: Kind[] = ["일정", "회의", "할 일", "메모"];
  const kindLabel: Record<Kind, string> = en
    ? { 일정: "Event", 회의: "Meeting", "할 일": "Task", 메모: "Note" }
    : { 일정: "일정", 회의: "회의", "할 일": "할 일", 메모: "메모" };
  const dest = DEST[d.kind];
  const noteLabel = d.kind === "회의" ? (en ? "Participants" : "참석자")
    : d.kind === "일정" ? (en ? "Location" : "장소")
    : d.kind === "할 일" ? (en ? "Detail" : "메모")
    : (en ? "Tags" : "태그");
  const notePlaceholder = d.kind === "회의" ? (en ? "e.g. Prof. Kim" : "예: 김 교수님")
    : d.kind === "일정" ? (en ? "e.g. Room 401" : "예: 401호")
    : (en ? "optional" : "선택");

  return (
    <div className="rmg-confirm" role="dialog" aria-label={en ? "Confirm capture" : "입력 확인"}>
      <div className="rmg-confirm-head">
        <span className="rmg-confirm-mark" aria-hidden><AiDoor active className="rmg-confirm-door" /></span>
        <span className="rmg-confirm-eye">{en ? "Comein understood" : "Comein이 이해했어요"}</span>
        <span className="rmg-confirm-dest">→ {t.viewLabel(dest.view)}</span>
      </div>

      <input
        ref={titleRef}
        className="rmg-confirm-title"
        value={d.title}
        onChange={(e) => setD((s) => ({ ...s, title: e.target.value }))}
        aria-label={en ? "Title" : "제목"}
      />

      <div className="rmg-confirm-chips" role="group" aria-label={en ? "Type" : "종류"}>
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className={`rmg-confirm-chip ${d.kind === k ? "on" : ""}`}
            onClick={() => setD((s) => ({ ...s, kind: k }))}
            aria-pressed={d.kind === k}
          >
            {kindLabel[k]}
          </button>
        ))}
      </div>

      <div className="rmg-confirm-fields">
        <label className="rmg-confirm-field">
          <span className="rmg-confirm-flabel">{en ? "Time" : "시간"}</span>
          <input
            className="rmg-confirm-finput"
            value={d.time ?? ""}
            placeholder={en ? "e.g. 15:00" : "예: 15:00"}
            onChange={(e) => setD((s) => ({ ...s, time: e.target.value }))}
          />
        </label>
        {d.kind !== "메모" && (
          <label className="rmg-confirm-field">
            <span className="rmg-confirm-flabel">{noteLabel}</span>
            <input
              className="rmg-confirm-finput"
              value={d.note}
              placeholder={notePlaceholder}
              onChange={(e) => setD((s) => ({ ...s, note: e.target.value }))}
            />
          </label>
        )}
      </div>

      <div className="rmg-confirm-acts">
        <button type="button" className="rmg-confirm-cancel" onClick={onCancel}>{en ? "Cancel" : "취소"}</button>
        <button type="button" className="rmg-confirm-ok" onClick={() => onConfirm({ ...d, time: d.time?.trim() || null })}>
          {en ? "Confirm" : "확정"}
        </button>
      </div>
    </div>
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
      for (const p of amb) { p.x += p.dx; p.y += p.dy; if (p.x < 0 || p.x > 1) p.dx *= -1; if (p.y < 0 || p.y > 1) p.dy *= -1; ctx.fillStyle = `rgba(150,143,132,${p.a})`; ctx.beginPath(); ctx.arc(p.x * w, p.y * hh, p.s, 0, Math.PI * 2); ctx.fill(); }
      if (activeRef.current) { if (flow.length < 30) flow.push(spawn() as any); }
      flow = flow.filter((p) => p.x > -30 && p.a > 0.01);
      for (const p of flow) { p.x += p.vx; p.y += p.vy; if (!activeRef.current) p.a *= 0.94; const g = ctx.createLinearGradient(p.x + p.len, p.y, p.x, p.y); g.addColorStop(0, "rgba(155,142,134,0)"); g.addColorStop(1, `rgba(155,142,134,${Math.min(0.7, p.a)})`); ctx.strokeStyle = g; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x + p.len, p.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }
      raf = requestAnimationFrame(frame);
    };
    if (!reduce) raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} className="rmg-ambient-canvas" aria-hidden />;
}

/** Workspace Status 시간 — HH:MM(초 없음) + 요일. 분이 바뀔 때만 미세 페이드로 갱신.
 *  자체 인터벌로 자기만 리렌더(페이지 전체 X). key=hh:mm 이라 분 경계에서만 재마운트되어 페이드가 재생된다. */
function StatusTime({ lang }: { lang: Lang }) {
  const [t, setT] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setT(new Date());
    const iv = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  if (!t) return <div className="rmg-status-time-wrap"><span className="rmg-status-time"> </span></div>;
  const p = (n: number) => String(n).padStart(2, "0");
  const en = lang === "en";
  const hhmm = `${p(t.getHours())}:${p(t.getMinutes())}`;
  const dateStr = en
    ? t.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : `${t.getFullYear()}년 ${t.getMonth() + 1}월 ${t.getDate()}일`;
  const weekday = t.toLocaleDateString(en ? "en-US" : "ko-KR", { weekday: "long" });
  return (
    <div className="rmg-status-time-wrap">
      <span key={hhmm} className="rmg-status-time" aria-label={hhmm}>{hhmm}</span>
      <span className="rmg-status-date">{dateStr}</span>
      <span className="rmg-status-day">{weekday}</span>
    </div>
  );
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
const EN_VIEW_AI: typeof VIEW_AI = {
  calendar: { suggest: { text: "There's an open slot to prep this week's talk.", action: "Hold time", done: "Held prep time on your calendar" }, row: { label: "Add travel", done: (t) => `Added travel time to ${t}` } },
  tasks: { suggest: { text: "Two things are close to due.", action: "Bring to today", done: "Moved due-soon tasks to today" }, row: { label: "To event", done: (t) => `Moved ‘${t}’ to an event` } },
  notes: { suggest: { text: "A similar note could connect.", action: "Link", done: "Linked related notes" }, row: { label: "Summarize", done: (t) => `Summarized ‘${t}’` } },
  meetings: { suggest: { text: "Last meeting's action items aren't sorted.", action: "To tasks", done: "Moved action items to tasks" }, row: { label: "Summarize", done: (t) => `Summarized the ‘${t}’ meeting` } },
  people: { suggest: { text: "Someone's been quiet for two weeks.", action: "Say hi", done: "Made a reminder to reach out" }, row: { label: "Suggest meeting", done: (t) => `Suggested a meeting with ${t}` } },
};

const AiTag = () => <span className="rmg-tag-ai" title="AI가 방금 추가했어요"><AiDoor className="rmg-tag-door" /></span>;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
/** 왼쪽 여백의 월간 캘린더 — 익숙한 그리드, 오늘 표시, 일정 있는 날 점, 날짜 클릭 선택. */
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS_EN = ["S", "M", "T", "W", "T", "F", "S"];
/** 자연어 → 날짜. Comein의 AI 캘린더 탐색: 날짜 형식을 기억할 필요 없이 말로 이동한다. */
function parseNaturalDate(raw: string, now: Date, events: Date[]): { date: Date; label: string } | null {
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

function MonthCalendar({ base, events, selected, onSelect, big = false, lang = "ko", focusDate, onSearch }: {
  base: Date; events: Date[]; selected: Date; onSelect: (d: Date) => void; big?: boolean; lang?: Lang;
  focusDate?: Date | null; onSearch?: () => void;
}) {
  const en = lang === "en";
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
          <button type="button" className="rmg-mc-today" onClick={goToday}>{en ? "Today" : "오늘"}</button>
          <button type="button" className="rmg-mc-arrow" onClick={() => shift(-1)} aria-label={en ? "Previous month" : "이전 달"}>‹</button>
          <button type="button" className="rmg-mc-arrow" onClick={() => shift(1)} aria-label={en ? "Next month" : "다음 달"}>›</button>
          {onSearch && (
            <button type="button" className="rmg-mc-search" onClick={onSearch} aria-label={en ? "Search dates (Cmd K)" : "날짜 탐색 (⌘K)"}>
              <Search className="rmg-mc-search-ic" />
              <span className="rmg-mc-kbd">⌘K</span>
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

/** AI Calendar Search — Spotlight 스타일. 날짜 형식을 기억할 필요 없이 말로 이동한다. */
function CalSearch({ open, onClose, onJump, events, now, lang }: {
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
function Feature(props: {
  view: View; lang: Lang; schedules: any[]; todos: any[]; memos: any[]; meetings: any[]; contacts: any[];
  mounted: boolean; receipts: Receipt[]; now: Date | null;
  onAction: (label: string) => void; onToggleTodo: (id: string) => void; onRemoveReceipt: (id: number) => void;
}) {
  const { view, lang, receipts, onAction } = props;
  const t = L(lang);
  const ai = view === "today" ? null : t.viewAI(view as Exclude<View, "today">);
  const mine = receipts.filter((r) => !r.isAction && r.destView === view);

  return (
    <section className="rmg-a1">
      <div className="rmg-feat-head">
        <p className="rmg-feat-title">{t.viewLabel(view)}</p>
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
function CalendarView({ schedules, mounted, now, mine, ai, onAction, lang }: any) {
  const t = L(lang as Lang);
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

  if (items.length === 0) return <p className="rmg-empty">{t.emptyCal}</p>;
  return (
    <div className="rmg-cal">
      {ordered.map((g) => (
        <div key={dayKey(g.date)} className="rmg-cal-day">
          <p className="rmg-cal-date">{mounted ? t.dayLabel(g.date, base) : ""}</p>
          <ul className="rmg-cal-list">
            {g.rows.map((r: any) => (
              <li key={r.id} className="rmg-cal-row">
                <span className="rmg-cal-time">{r.ai ? (r.time ?? (lang === "en" ? "TBD" : "미정")) : (mounted ? fmtTime(r.date) : "")}</span>
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
function TasksView({ todos, mine, ai, onToggleTodo, onRemoveReceipt, onAction, lang }: any) {
  const t = L(lang as Lang);
  const rows = [
    ...mine.map((r: Receipt) => ({ id: r.id, rid: true, title: r.title, priority: "mid" })),
    ...todos.map((td: any) => ({ id: td.id, rid: false, title: td.title, priority: td.priority })),
  ];
  if (rows.length === 0) return <p className="rmg-empty">{t.emptyTasks}</p>;
  return (
    <ul className="rmg-task-list">
      {rows.map((r: any) => (
        <li key={`${r.rid ? "r" : "t"}-${r.id}`} className="rmg-task">
          <button
            type="button"
            className="rmg-task-box"
            aria-label={lang === "en" ? "Done" : "완료"}
            onClick={() => (r.rid ? onRemoveReceipt(r.id) : onToggleTodo(r.id))}
          >
            <Check className="rmg-task-check" />
          </button>
          <span className="rmg-task-title">{r.title}</span>
          {r.rid && <AiTag />}
          <span className={`rmg-task-prio ${r.priority}`}>{t.priority(r.priority)}</span>
          {!r.rid && <button type="button" className="rmg-vact" onClick={() => onAction(ai.row.done(r.title))}>{ai.row.label}</button>}
        </li>
      ))}
    </ul>
  );
}

/** Notes — 노트 그리드(익숙한 '메모'). */
function NotesView({ memos, mine, ai, onAction, lang }: any) {
  const tiles = [
    ...mine.map((r: Receipt) => ({ id: `r-${r.id}`, title: r.title, content: "", tags: [], ai: true })),
    ...memos.map((m: any) => ({ id: m.id, title: m.title, content: m.content ?? "", tags: m.tags ?? [], ai: false })),
  ];
  if (tiles.length === 0) return <p className="rmg-empty">{L(lang as Lang).emptyNotes}</p>;
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
function MeetingsView({ meetings, mounted, ai, onAction, lang }: any) {
  if (!meetings || meetings.length === 0) return <p className="rmg-empty">{L(lang as Lang).emptyMeetings}</p>;
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
function PeopleView({ contacts, ai, onAction, lang }: any) {
  if (contacts.length === 0) return <p className="rmg-empty">{L(lang as Lang).emptyPeople}</p>;
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

/** 설정 — 가로 옵션의 '설정 란'. 워크스페이스 스토어 설정을 그대로 편집(이름·언어·유형·주 시작·테마·알림). */
function SettingsPanel({ settings, onChange, theme, onTheme, mounted, lang }: {
  settings: { name: string; language: "ko" | "en"; mode: "student" | "office" | "general"; weekStart: "sun" | "mon"; notifications: boolean; autoConfirm: boolean; textScale: "md" | "lg" | "xl" };
  onChange: (patch: Partial<SettingsPanelProps>) => void;
  theme: string | undefined;
  onTheme: (t: "light" | "dark") => void;
  mounted: boolean;
  lang: Lang;
}) {
  const t = L(lang);
  return (
    <div className="rmg-set">
      <div className="rmg-set-row">
        <div className="rmg-set-label"><p className="rmg-set-k">{t.setName}</p><p className="rmg-set-d">{t.setNameD}</p></div>
        <input
          className="rmg-set-input"
          value={settings.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t.setName}
          aria-label={t.setName}
        />
      </div>

      <div className="rmg-set-row">
        <div className="rmg-set-label"><p className="rmg-set-k">{t.setLang}</p><p className="rmg-set-d">{t.setLangD}</p></div>
        <div className="rmg-seg" role="group" aria-label={t.setLang}>
          {([["ko", "한국어"], ["en", "English"]] as const).map(([v, l]) => (
            <button key={v} type="button" className={`rmg-seg-btn ${settings.language === v ? "on" : ""}`} onClick={() => onChange({ language: v })}>{l}</button>
          ))}
        </div>
      </div>

      <div className="rmg-set-row">
        <div className="rmg-set-label"><p className="rmg-set-k">{t.setMode}</p><p className="rmg-set-d">{t.setModeD}</p></div>
        <div className="rmg-seg" role="group" aria-label={t.setMode}>
          {([["student", t.segStudent], ["office", t.segOffice], ["general", t.segGeneral]] as const).map(([v, l]) => (
            <button key={v} type="button" className={`rmg-seg-btn ${settings.mode === v ? "on" : ""}`} onClick={() => onChange({ mode: v })}>{l}</button>
          ))}
        </div>
      </div>

      <div className="rmg-set-row">
        <div className="rmg-set-label"><p className="rmg-set-k">{t.setWeek}</p><p className="rmg-set-d">{t.setWeekD}</p></div>
        <div className="rmg-seg" role="group" aria-label={t.setWeek}>
          {([["sun", t.segSun], ["mon", t.segMon]] as const).map(([v, l]) => (
            <button key={v} type="button" className={`rmg-seg-btn ${settings.weekStart === v ? "on" : ""}`} onClick={() => onChange({ weekStart: v })}>{l}</button>
          ))}
        </div>
      </div>

      <div className="rmg-set-row">
        <div className="rmg-set-label"><p className="rmg-set-k">{t.setTheme}</p><p className="rmg-set-d">{t.setThemeD}</p></div>
        <div className="rmg-seg" role="group" aria-label={t.setTheme}>
          {([["light", "Light"], ["dark", "Dark"]] as const).map(([v, l]) => (
            <button key={v} type="button" className={`rmg-seg-btn ${mounted && theme === v ? "on" : ""}`} onClick={() => onTheme(v)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="rmg-set-row">
        <div className="rmg-set-label"><p className="rmg-set-k">{t.setSize}</p><p className="rmg-set-d">{t.setSizeD}</p></div>
        <div className="rmg-seg" role="group" aria-label={t.setSize}>
          {([["md", t.segMd], ["lg", t.segLg], ["xl", t.segXl]] as const).map(([v, l]) => (
            <button key={v} type="button" className={`rmg-seg-btn ${settings.textScale === v ? "on" : ""}`} onClick={() => onChange({ textScale: v })}>{l}</button>
          ))}
        </div>
      </div>

      <div className="rmg-set-row">
        <div className="rmg-set-label"><p className="rmg-set-k">{t.setNotif}</p><p className="rmg-set-d">{t.setNotifD}</p></div>
        <button type="button" role="switch" aria-checked={settings.notifications} className={`rmg-switch ${settings.notifications ? "on" : ""}`} onClick={() => onChange({ notifications: !settings.notifications })}><span className="rmg-switch-dot" /></button>
      </div>

      <div className="rmg-set-row">
        <div className="rmg-set-label"><p className="rmg-set-k">{t.setAuto}</p><p className="rmg-set-d">{t.setAutoD}</p></div>
        <button type="button" role="switch" aria-checked={settings.autoConfirm} className={`rmg-switch ${settings.autoConfirm ? "on" : ""}`} onClick={() => onChange({ autoConfirm: !settings.autoConfirm })}><span className="rmg-switch-dot" /></button>
      </div>
    </div>
  );
}
type SettingsPanelProps = { name: string; language: "ko" | "en"; mode: "student" | "office" | "general"; weekStart: "sun" | "mon"; notifications: boolean; autoConfirm: boolean; textScale: "md" | "lg" | "xl" };

const CSS = `
.rmg {
  --paper: #141210; --surface: #1B1813; --ink: #F2F0EC; --muted: #98938A; --faint: #5E574C; --hair: #262019; --accent: #9B8E86; --glow: rgba(155,142,134,0.16);
  position: relative; display: grid; grid-template-columns: 64px minmax(0, 1fr);
  height: 100vh; height: 100dvh; color: var(--ink);
  background:
    radial-gradient(120% 120% at 18% -6%, rgba(88,76,58,0.5) 0%, rgba(88,76,58,0) 52%),
    radial-gradient(100% 80% at 50% 34%, rgba(64,56,44,0.28) 0%, transparent 62%),
    linear-gradient(108deg, transparent 44%, rgba(0,0,0,0.2) 60%, transparent 76%),
    radial-gradient(120% 90% at 96% 112%, rgba(0,0,0,0.32) 0%, transparent 50%),
    radial-gradient(110% 84% at 2% 110%, rgba(0,0,0,0.18) 0%, transparent 48%),
    var(--paper);
  background-attachment: fixed;
  font-family: var(--font-sans), "Pretendard Variable", -apple-system, system-ui, sans-serif; -webkit-font-smoothing: antialiased;
  /* 레일 확장은 첫 컬럼 트랙만 넓혀 콘텐츠를 함께 밀어낸다(오버레이 아님·reflow). 사이드바+콘텐츠가 하나의 모션. */
  transition: grid-template-columns 280ms cubic-bezier(0.22, 1, 0.36, 1);
}
.rmg.rail-open { grid-template-columns: 236px minmax(0, 1fr); }
@media (prefers-reduced-motion: reduce) { .rmg { transition: none; } }
:root:not(.dark) .rmg { --paper: #F7F6F3; --surface: #FCFBF9; --ink: #26221D; --muted: #6E675C; --faint: #A9A294; --hair: #E7E2D8; --accent: #8C7E6E; --glow: rgba(140,126,110,0.16); }
/* 배경 — flat white 금지. 웜 오프화이트 위에 대형 확산광 + 은은한 건축 그림자(창빛·커튼). 느끼되 알아채지 못하게.
   명도 대비 강화판: 하이라이트는 더 밝게, 코너 그림자는 한 단계 더 깊게 — 채도/색상은 유지, 중앙은 밝게 남겨 가독성 확보(돔형 입체감). */
:root:not(.dark) .rmg {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.66) 0%, transparent 26%),
    radial-gradient(125% 120% at 16% -10%, rgba(255,255,252,1) 0%, rgba(255,255,252,0) 50%),
    radial-gradient(100% 78% at 50% 36%, rgba(255,254,250,0.5) 0%, transparent 60%),
    linear-gradient(106deg, transparent 40%, rgba(58,43,28,0.092) 56%, transparent 70%),
    linear-gradient(106deg, transparent 60%, rgba(58,43,28,0.072) 72%, transparent 85%),
    radial-gradient(120% 86% at 94% 110%, rgba(52,38,23,0.17) 0%, transparent 50%),
    radial-gradient(110% 82% at 2% 110%, rgba(58,43,28,0.08) 0%, transparent 46%),
    var(--paper);
  background-attachment: fixed;
}
/* 글자 크기 설정 — 주요 텍스트 영역을 배율로 확대 (보통 · 크게 · 더 크게) */
.rmg-flow, .rmg-topbar, .rmg-calrail, .rmg-panel-head, .rmg-panel-body { zoom: var(--rmg-fs, 1); }

/* opening → 워크스페이스 도착 — opening 다크 톤에서 서서히 밝아오며 나타난다 (확 넘어가지 않게) */
.rmg-arrive { position: fixed; inset: 0; z-index: 100; pointer-events: none;
  background: radial-gradient(circle at 50% 46%, rgba(232,216,196,0.22) 0%, transparent 55%), #0E0D12;
  animation: rmg-arrive-out 1.3s cubic-bezier(0.4,0,0.2,1) both; }
@keyframes rmg-arrive-out { from { opacity: 1; } to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .rmg-arrive { display: none; } }
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

/* 레일 — 그리드 첫 컬럼(64→236px)이 커지며 콘텐츠를 함께 밀어낸다(오버레이 아님·reflow).
   레일은 컬럼을 가득 채우고, 라벨은 폭이 늘어난 만큼 조용히 드러난다. */
.rmg-rail { position: relative; z-index: 2; width: 100%; height: 100%; overflow: hidden; }
.rmg-rail-panel {
  width: 100%; height: 100%; box-sizing: border-box;
  display: flex; flex-direction: column; align-items: stretch; gap: 16px;
  padding: 22px 12px; border-right: 1px solid var(--hair);
  transition: background 280ms ease, border-color 280ms ease;
}
/* 확장 시 표면이 아주 은은하게 올라오고, 문틈 같은 액센트 헤어라인(공간이 열리는 감각) */
.rmg.rail-open .rmg-rail-panel {
  background: color-mix(in srgb, var(--surface) 55%, transparent);
  border-right-color: color-mix(in srgb, var(--accent) 18%, var(--hair));
}

/* 브랜드 마크(문) + Comein 워드마크 리빌 — 아주 은은한 글로우 */
/* 브랜드 마크 — 클릭 불가(가이드 제거). 레일 펼침 시 문에 은은한 숨결만. */
.rmg-rail-mark { display: flex; align-items: center; gap: 15px; height: 42px; padding: 0 9px; border-radius: 12px; color: var(--ink); overflow: hidden; }
.rmg.rail-open .rmg-rail-mark .aidoor-svg { filter: drop-shadow(0 0 7px var(--glow)); }
.rmg-rail-door { width: 22px; height: 28px; flex: 0 0 22px; }
.rmg-rail-word { font-size: 0.98rem; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); }

.rmg-rail-nav { position: relative; display: flex; flex-direction: column; gap: 4px; }
.rmg-rail-foot { margin-top: auto; display: flex; flex-direction: column; gap: 4px; }
/* 활성 인디케이터 — 선택 항목 사이를 미끄러지듯 이동(morph). 아이템 높이 40 + gap 4 = 44px 스텝 */
.rmg-rail-ind { position: absolute; left: 0; right: 0; top: 0; height: 40px; border-radius: 11px; z-index: 0; pointer-events: none;
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  transform: translateY(calc(var(--active, 0) * 44px));
  transition: transform 280ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease;
  will-change: transform; }
.rmg-rail-ind::before { content: ""; position: absolute; left: 1px; top: 50%; transform: translateY(-50%); width: 3px; height: 18px; border-radius: 0 3px 3px 0; background: var(--accent); box-shadow: 0 0 10px -1px color-mix(in srgb, var(--accent) 55%, transparent); }
.rmg-rail-ind[data-hidden="true"] { opacity: 0; }
.rmg-railbtn { position: relative; z-index: 1; display: flex; align-items: center; gap: 15px; width: 100%; height: 40px; padding: 0 11px; box-sizing: border-box; border: 0; border-radius: 11px; background: none; color: var(--faint); cursor: pointer; text-decoration: none;
  transition: background 220ms ease, color 220ms ease, transform 200ms cubic-bezier(0.22,1,0.36,1); }
.rmg-railbtn > .rmg-railicon { flex: 0 0 19px; }
/* Hover — 살짝 밝아지고 1px 떠오른다 */
.rmg-railbtn:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); color: var(--ink); transform: translateY(-1px); }
/* Click — 아주 약한 스케일(리플 없음) */
.rmg-railbtn:active { transform: scale(0.97); }
.rmg-railbtn.on { color: var(--ink); }
.rmg-railbtn.on .rmg-railicon { color: var(--accent); }
/* nav 항목의 활성 배경/바는 슬라이딩 인디케이터가 대신한다(중복 제거) */
.rmg-rail-nav .rmg-railbtn.on { background: none; }
.rmg-rail-nav .rmg-railbtn.on:hover { background: color-mix(in srgb, var(--ink) 5%, transparent); }
/* foot(설정)은 nav 밖 — 기존 액센트 틴트 + 좌측 바 유지 */
.rmg-rail-foot .rmg-railbtn.on { background: color-mix(in srgb, var(--accent) 13%, transparent); }
.rmg-rail-foot .rmg-railbtn.on:hover { background: color-mix(in srgb, var(--accent) 17%, transparent); }
.rmg-rail-foot .rmg-railbtn.on::before { content: ""; position: absolute; left: 1px; top: 50%; transform: translateY(-50%); width: 3px; height: 18px; border-radius: 0 3px 3px 0; background: var(--accent); box-shadow: 0 0 10px -1px color-mix(in srgb, var(--accent) 55%, transparent); }
.rmg-railbtn:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }

/* 인라인 라벨 — 폭 확장에 맞춰 opacity + translateX 로 조용히 등장(ease-out), 미세한 순차 */
.rmg-rail-word, .rmg-raillabel { white-space: nowrap; overflow: hidden; opacity: 0; max-width: 0; transform: translateX(-8px); transition: opacity 260ms cubic-bezier(0.22,1,0.36,1), max-width 280ms cubic-bezier(0.22,1,0.36,1), transform 260ms cubic-bezier(0.22,1,0.36,1); }
.rmg-raillabel { font-size: 0.9rem; font-weight: 500; letter-spacing: -0.005em; color: inherit; }
.rmg.rail-open .rmg-rail-word, .rmg.rail-open .rmg-raillabel { opacity: 1; max-width: 160px; transform: none; }
.rmg.rail-open .rmg-rail-nav .rmg-raillabel { transition-delay: calc(var(--i, 0) * 26ms + 30ms); }

.rmg-railicon { width: 19px; height: 19px; stroke-width: 1.6; }

@media (prefers-reduced-motion: reduce) {
  .rmg-rail-word, .rmg-raillabel { transition: none; }
  .rmg.rail-open .rmg-rail-nav .rmg-raillabel { transition-delay: 0ms; }
}

/* 캔버스 · 환경 */
.rmg-canvas { position: relative; overflow-y: auto; overflow-x: hidden; display: flex; justify-content: center; background: transparent; }
.rmg-env { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.rmg-ambient-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.rmg-grain { position: absolute; inset: 0; opacity: 0.026; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
.rmg-heart { position: absolute; right: 8%; top: 30%; width: clamp(120px, 16vw, 220px); aspect-ratio: 40/52; opacity: 0.05; transition: opacity 1.2s ease; }
.rmg-heart.on { opacity: 0.5; }
/* light 모드: --muted가 어두운 회색이라 흰 배경 위 실효 ~2% 불투명도로는 문이 사라져 보임 → 휴식 가시성 보강(다크는 유지). .on보다 특이성이 높아 조직화 글로우도 유지. */
:root:not(.dark) .rmg-heart { opacity: 0.3; }
:root:not(.dark) .rmg-heart.on { opacity: 0.62; }
.rmg-heart-door { width: 100%; height: 100%; }

/* 최상단 옵션 바 + 알림 */
.rmg-topbar { position: absolute; top: 0; left: 0; right: 0; z-index: 6; height: 52px; display: flex; align-items: center; justify-content: flex-end; gap: 16px; padding: 0 clamp(16px, 3vw, 32px); }
.rmg-notif { position: relative; }
.rmg-notif-btn { position: relative; display: grid; place-items: center; width: 42px; height: 42px; border: 1px solid var(--hair); background: color-mix(in srgb, var(--surface) 60%, transparent); color: var(--muted); border-radius: 12px; cursor: pointer; transition: color 0.25s, border-color 0.25s; }
.rmg-notif-btn:hover, .rmg-notif-btn.on { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 16%, var(--hair)); }
.rmg-notif-btn:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
.rmg-notif-ic { width: 18.5px; height: 18.5px; stroke-width: 1.7; }
.rmg-notif-badge { position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; display: grid; place-items: center; padding: 0 4px; border-radius: 999px; background: var(--accent); color: #141210; font-size: 10px; font-weight: 700; }
.rmg-notif-scrim { position: fixed; inset: 0; z-index: 40; background: color-mix(in srgb, #000 22%, transparent); backdrop-filter: blur(1.5px); animation: rmg-cs-fade 0.18s ease both; }
.rmg-notif-panel { position: absolute; top: 52px; right: 0; z-index: 41; width: 324px; padding: 10px; border: 1px solid var(--hair); border-radius: 16px; background: color-mix(in srgb, var(--surface) 97%, transparent); backdrop-filter: blur(16px); box-shadow: 0 24px 60px -22px rgba(0,0,0,0.7); animation: rmg-rise 0.25s cubic-bezier(0.22,1,0.36,1) both; }
.rmg-notif-head { margin: 6px 10px 8px; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); }
.rmg-notif-list { list-style: none; margin: 0; padding: 0; }
.rmg-notif-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px; border-radius: 10px; transition: background 0.2s; }
.rmg-notif-row:hover { background: color-mix(in srgb, var(--ink) 5%, transparent); }
.rmg-notif-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); margin-top: 6px; flex-shrink: 0; }
.rmg-notif-title { margin: 0; font-size: 0.92rem; font-weight: 500; color: var(--ink); }
.rmg-notif-detail { margin: 2px 0 0; font-size: 0.84rem; font-weight: 300; color: var(--muted); }
.rmg-notif-empty { margin: 0; padding: 18px 10px; text-align: center; font-size: 0.85rem; color: var(--faint); }

/* 왼쪽 상시 캘린더 */
.rmg-calrail { display: none; }
@media (min-width: 1240px) {
  /* 상단 라인을 메인 인사말(.rmg-flow 상단 여백)에 맞춤 — 월 헤더 윗선이 Good morning. 첫 줄과 같은 높이. +6px는 큰 글자 대비 광학 보정. */
  .rmg-calrail { display: block; position: absolute; left: 0; top: 0; bottom: 0; width: 288px; z-index: 4; overflow-y: auto; padding: calc(clamp(48px, 12vh, 128px) + 6px) 22px 40px 30px; }
}
.rmg-mc { user-select: none; }
.rmg-mc-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
.rmg-mc-title { display: inline-flex; align-items: center; gap: 5px; border: 0; background: none; font-family: inherit; font-size: 0.92rem; font-weight: 600; letter-spacing: -0.01em; color: var(--ink); cursor: pointer; padding: 4px 6px; margin: -4px -6px; border-radius: 9px; transition: background 0.2s; }
.rmg-mc-title:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
.rmg-mc-title-ic { width: 14px; height: 14px; stroke-width: 2; color: var(--faint); transition: transform 0.25s cubic-bezier(0.22,1,0.36,1); }
.rmg-mc-title.on .rmg-mc-title-ic { transform: rotate(180deg); }
.rmg-mc-nav { display: flex; align-items: center; gap: 2px; }
.rmg-mc-today { border: 1px solid var(--hair); background: color-mix(in srgb, var(--surface) 55%, transparent); color: var(--muted); font-family: inherit; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.01em; padding: 5px 11px; border-radius: 999px; cursor: pointer; margin-right: 4px; transition: color 0.2s, border-color 0.2s, background 0.2s; }
.rmg-mc-today:hover { color: var(--ink); border-color: color-mix(in srgb, var(--accent) 40%, var(--hair)); }
.rmg-mc-arrow { width: 26px; height: 26px; display: grid; place-items: center; border: 0; background: none; color: var(--muted); font-size: 1.1rem; line-height: 1; cursor: pointer; border-radius: 8px; transition: background 0.2s, color 0.2s; }
.rmg-mc-arrow:hover { background: color-mix(in srgb, var(--ink) 7%, transparent); color: var(--ink); }
.rmg-mc-search { display: inline-flex; align-items: center; gap: 6px; margin-left: 6px; padding: 5px 10px 5px 9px; border: 1px solid var(--hair); background: color-mix(in srgb, var(--surface) 55%, transparent); color: var(--muted); border-radius: 9px; cursor: pointer; transition: color 0.2s, border-color 0.2s, background 0.2s; }
.rmg-mc-search:hover { color: var(--ink); border-color: color-mix(in srgb, var(--accent) 40%, var(--hair)); }
.rmg-mc-search-ic { width: 15px; height: 15px; stroke-width: 1.8; }
.rmg-mc-kbd { font-family: ui-monospace, "SF Mono", monospace; font-size: 0.66rem; font-weight: 600; letter-spacing: 0.02em; color: var(--faint); }

/* 월/연 피커 — 제목 클릭 시 */
.rmg-mc-picker { margin-bottom: 14px; padding: 12px; border: 1px solid var(--hair); border-radius: 14px; background: color-mix(in srgb, var(--surface) 60%, transparent); animation: rmg-cs-pop 0.18s cubic-bezier(0.22,1,0.36,1) both; }
.rmg-mc-yr { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 10px; }
.rmg-mc-yr-v { font-size: 0.95rem; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; min-width: 3.4em; text-align: center; }
.rmg-mc-months { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.rmg-mc-mo { border: 0; background: none; font-family: inherit; font-size: 0.8rem; font-weight: 500; color: var(--muted); padding: 9px 0; border-radius: 9px; cursor: pointer; transition: background 0.2s, color 0.2s; }
.rmg-mc-mo:hover { background: color-mix(in srgb, var(--ink) 7%, transparent); color: var(--ink); }
.rmg-mc-mo.on { background: var(--accent); color: #141210; font-weight: 600; }

.rmg-mc-wd { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 4px; }
.rmg-mc-wd span { text-align: center; font-size: 0.68rem; font-weight: 500; color: var(--faint); padding: 4px 0; }
.rmg-mc-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; animation: rmg-mc-fade 0.19s ease both; }
.rmg-mc-grid.in-l { animation: rmg-mc-slide-l 0.2s cubic-bezier(0.22,1,0.36,1) both; }
.rmg-mc-grid.in-r { animation: rmg-mc-slide-r 0.2s cubic-bezier(0.22,1,0.36,1) both; }
@keyframes rmg-mc-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes rmg-mc-slide-l { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: none; } }
@keyframes rmg-mc-slide-r { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: none; } }
.rmg-mc-cell { position: relative; isolation: isolate; aspect-ratio: 1; display: grid; place-items: center; border: 0; background: none; color: var(--muted); font-family: inherit; font-size: 0.8rem; font-weight: 400; border-radius: 8px; cursor: pointer; transition: background 0.2s, color 0.2s; }
.rmg-mc-cell.empty { pointer-events: none; }
.rmg-mc-cell:not(.empty):hover { background: color-mix(in srgb, var(--ink) 8%, transparent); color: var(--ink); }
/* 오늘 — 강한 primary 대신 은은한 액센트 필드 서클 (팔레트 유지) */
.rmg-mc-cell.today { color: var(--accent); font-weight: 700; }
.rmg-mc-cell.today::before { content: ""; position: absolute; inset: 14%; border-radius: 50%; background: color-mix(in srgb, var(--accent) 16%, transparent); z-index: -1; }
.rmg-mc-cell.sel { background: var(--ink); color: var(--paper); font-weight: 600; }
.rmg-mc-cell.sel.today { color: var(--paper); }
.rmg-mc-cell.sel.today::before { display: none; }
.rmg-mc-dot { position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 3px; height: 3px; border-radius: 50%; background: var(--accent); z-index: 1; }
.rmg-mc-cell.sel .rmg-mc-dot { background: var(--paper); }
@media (prefers-reduced-motion: reduce) { .rmg-mc-grid, .rmg-mc-grid.in-l, .rmg-mc-grid.in-r, .rmg-mc-picker { animation: none; } }
.rmg-calday { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--hair); }
.rmg-calday-date { margin: 0 0 12px; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.02em; color: var(--faint); }
.rmg-calday-list { list-style: none; margin: 0; padding: 0; }
.rmg-calday-row { display: flex; align-items: baseline; gap: 10px; padding: 8px 0; }
/* 시간 — 디지털 시계 느낌 제거. 본문과 동일한 sans + 비례숫자(proportional) + secondary 색으로 하나의 시스템처럼. */
.rmg-calday-time { font-family: inherit; font-variant-numeric: proportional-nums; font-feature-settings: "tnum" 0; font-size: 0.82rem; font-weight: 450; letter-spacing: -0.01em; line-height: 1.4; color: var(--muted); min-width: 3.6em; }
.rmg-calday-title { font-size: 0.86rem; font-weight: 300; color: var(--ink); line-height: 1.4; }
.rmg-calday-empty { font-size: 0.82rem; color: var(--faint); padding: 4px 0; }

/* 전체 화면 란 — 가로 옵션에서 여는 캘린더/설정 (모달 아님, 캔버스를 채우는 큰 판) */
/* 패널 — Workspace 가 한 겹 확장되는 레이어. 좌측에서 슬라이드 + 은은한 깊이(블러·섀도우). transform/opacity 중심(60fps). */
.rmg-panel { position: absolute; left: 0; right: 138px; top: 52px; bottom: 0; z-index: 5; display: flex; flex-direction: column;
  background: color-mix(in srgb, var(--paper) 88%, transparent);
  backdrop-filter: blur(20px) saturate(1.04); -webkit-backdrop-filter: blur(20px) saturate(1.04);
  box-shadow: 22px 0 54px -34px rgba(0,0,0,0.34), 0 26px 70px -56px rgba(0,0,0,0.4);
  transform-origin: left center; will-change: transform, opacity;
  animation: rmg-panel-in 280ms cubic-bezier(0.22,1,0.36,1) both; }
@media (max-width: 940px) { .rmg-panel { right: 0; } }
@keyframes rmg-panel-in { from { opacity: 0; transform: translateX(-26px) scale(0.986); } to { opacity: 1; transform: translateX(0) scale(1); } }
/* 스태거 — 헤더 → 그리드 → 오늘 일정, 40~60ms 간격 Fade + Slide Up (content 220ms) */
@keyframes rmg-stag { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.rmg-panel-head { display: flex; align-items: center; justify-content: space-between; padding: 20px clamp(24px, 5vw, 64px) 14px; animation: rmg-stag 220ms cubic-bezier(0.22,1,0.36,1) 60ms both; }
.rmg-panel-title { margin: 0; font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 300; letter-spacing: -0.03em; color: var(--ink); }
.rmg-panel-close { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid var(--hair); background: color-mix(in srgb, var(--surface) 60%, transparent); color: var(--muted); border-radius: 11px; cursor: pointer; transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.2s cubic-bezier(0.22,1,0.36,1); }
.rmg-panel-close:hover { background: color-mix(in srgb, var(--ink) 8%, transparent); color: var(--ink); border-color: color-mix(in srgb, var(--ink) 14%, var(--hair)); transform: translateY(-1px); }
.rmg-panel-close:active { transform: scale(0.96); }
.rmg-panel-close:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
.rmg-panel-body { flex: 1; min-height: 0; overflow-y: auto; padding: clamp(8px, 2vh, 24px) clamp(24px, 5vw, 64px) clamp(48px, 8vh, 96px); animation: rmg-panel-body-fade 240ms ease 40ms both; }
@keyframes rmg-panel-body-fade { from { opacity: 0; } to { opacity: 1; } }
/* 캘린더 내부 순차 — 그리드(120ms) → 오늘 일정(180ms) */
.rmg-fullcal-cal { animation: rmg-stag 220ms cubic-bezier(0.22,1,0.36,1) 120ms both; }
.rmg-fullcal-day { animation: rmg-stag 220ms cubic-bezier(0.22,1,0.36,1) 180ms both; }
@media (prefers-reduced-motion: reduce) {
  .rmg-panel, .rmg-panel-head, .rmg-panel-body, .rmg-fullcal-cal, .rmg-fullcal-day { animation: none; }
  .rmg-rail-ind, .rmg-railbtn { transition: none; }
}

/* 캘린더 전체 — 크게 띄운 월간 그리드 + 선택 날짜 아젠다 */
.rmg-fullcal { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(240px, 0.85fr); gap: clamp(24px, 4vw, 56px); align-items: start; max-width: 1100px; margin: 0 auto; }
@media (max-width: 860px) { .rmg-fullcal { grid-template-columns: 1fr; } }
.rmg-fullcal-day { border-left: 1px solid var(--hair); padding-left: clamp(24px, 4vw, 48px); }
@media (max-width: 860px) { .rmg-fullcal-day { border-left: 0; padding-left: 0; border-top: 1px solid var(--hair); padding-top: 24px; } }
/* 캘린더 우측 — 다가오는 일정 (아젠다 흡수) */
.rmg-calup { margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--hair); }
.rmg-calup-row { display: grid; grid-template-columns: 4.4em 3.4em 1fr; align-items: baseline; gap: 10px; padding: 8px 6px; margin: 0 -6px; cursor: pointer; border-radius: 9px; transition: background 0.2s; }
.rmg-calup-row:hover { background: color-mix(in srgb, var(--ink) 5%, transparent); }
.rmg-calup-date { font-size: 0.74rem; font-weight: 600; letter-spacing: 0.01em; color: var(--faint); }
.rmg-mc.big .rmg-mc-title { font-size: 1.25rem; }
.rmg-mc.big .rmg-mc-title-ic { width: 17px; height: 17px; }
.rmg-mc.big .rmg-mc-head { margin-bottom: 20px; }
.rmg-mc.big .rmg-mc-cell { font-size: 1.02rem; border-radius: 12px; }
.rmg-mc.big .rmg-mc-wd span { font-size: 0.82rem; padding: 8px 0; }
.rmg-mc.big .rmg-mc-grid { gap: 4px; }
.rmg-mc.big .rmg-mc-dot { width: 4px; height: 4px; bottom: 6px; }
.rmg-mc.big .rmg-mc-months { gap: 6px; }
.rmg-mc.big .rmg-mc-mo { font-size: 0.9rem; padding: 12px 0; }

/* AI Calendar Search — Apple Spotlight 스타일 (fade + scale) */
.rmg-cs-scrim { position: fixed; inset: 0; z-index: 80; display: flex; align-items: flex-start; justify-content: center; padding-top: 15vh; background: color-mix(in srgb, #000 40%, transparent); backdrop-filter: blur(3px); animation: rmg-cs-fade 0.16s ease both; }
.rmg-cs { width: min(540px, 92vw); border: 1px solid var(--hair); border-radius: 18px; background: color-mix(in srgb, var(--surface) 96%, transparent); backdrop-filter: blur(20px); box-shadow: 0 40px 100px -40px rgba(0,0,0,0.7); overflow: hidden; animation: rmg-cs-pop 0.18s cubic-bezier(0.22,1,0.36,1) both; }
@keyframes rmg-cs-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes rmg-cs-pop { from { opacity: 0; transform: translateY(-6px) scale(0.98); } to { opacity: 1; transform: none; } }
.rmg-cs-bar { display: flex; align-items: center; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--hair); }
.rmg-cs-ic { width: 19px; height: 19px; stroke-width: 1.8; color: var(--muted); flex-shrink: 0; }
.rmg-cs-input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; font-family: inherit; font-size: 1.02rem; font-weight: 400; color: var(--ink); caret-color: var(--accent); }
.rmg-cs-input::placeholder { color: var(--faint); }
.rmg-cs-esc { font-family: ui-monospace, "SF Mono", monospace; font-size: 0.64rem; font-weight: 600; color: var(--faint); border: 1px solid var(--hair); border-radius: 6px; padding: 2px 6px; text-transform: uppercase; }
.rmg-cs-hit { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; padding: 15px 18px; border: 0; background: none; font-family: inherit; text-align: left; cursor: pointer; transition: background 0.18s; }
.rmg-cs-hit:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.rmg-cs-hit-l { font-size: 0.98rem; font-weight: 500; color: var(--ink); }
.rmg-cs-hit-d { font-size: 0.85rem; font-weight: 300; color: var(--muted); font-variant-numeric: tabular-nums; }
.rmg-cs-none { margin: 0; padding: 20px 18px; font-size: 0.9rem; font-weight: 300; color: var(--faint); text-align: center; }
.rmg-cs-sugg { padding: 14px 16px 16px; }
.rmg-cs-eye { margin: 0 0 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint); }
.rmg-cs-chips { display: flex; flex-wrap: wrap; gap: 7px; }
.rmg-cs-chip { border: 1px solid var(--hair); background: color-mix(in srgb, var(--surface) 55%, transparent); color: var(--muted); font-family: inherit; font-size: 13px; font-weight: 400; padding: 7px 13px; border-radius: 999px; cursor: pointer; transition: color 0.2s, border-color 0.2s, background 0.2s; }
.rmg-cs-chip:hover { color: var(--ink); border-color: color-mix(in srgb, var(--accent) 40%, var(--hair)); background: color-mix(in srgb, var(--surface) 80%, transparent); }
@media (prefers-reduced-motion: reduce) { .rmg-cs-scrim, .rmg-cs { animation: none; } }

/* 설정 란 — 스토어 설정을 편집 (에디토리얼 행 · 세그먼트 · 스위치) */
.rmg-set { max-width: 620px; margin: 0 auto; }
.rmg-set-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 20px 0; border-top: 1px solid var(--hair); }
.rmg-set-row:first-child { border-top: 0; }
.rmg-set-label { min-width: 0; }
.rmg-set-k { margin: 0; font-size: 1rem; font-weight: 500; letter-spacing: -0.01em; color: var(--ink); }
.rmg-set-d { margin: 4px 0 0; font-size: 0.84rem; font-weight: 300; line-height: 1.4; color: var(--muted); }
.rmg-set-input { width: min(240px, 46vw); padding: 10px 14px; border-radius: 11px; background: color-mix(in srgb, var(--surface) 60%, transparent); border: 1px solid var(--hair); font-family: inherit; font-size: 0.94rem; color: var(--ink); outline: none; transition: border-color 0.25s, box-shadow 0.25s; }
.rmg-set-input:focus { border-color: color-mix(in srgb, var(--accent) 40%, var(--hair)); box-shadow: 0 0 0 3px var(--glow); }
.rmg-seg { display: inline-flex; padding: 3px; border-radius: 11px; background: color-mix(in srgb, var(--surface) 55%, transparent); border: 1px solid var(--hair); flex-shrink: 0; }
.rmg-seg-btn { border: 0; background: none; font-family: inherit; font-size: 0.84rem; font-weight: 500; color: var(--muted); padding: 7px 14px; border-radius: 8px; cursor: pointer; white-space: nowrap; transition: background 0.2s, color 0.2s; }
.rmg-seg-btn:hover { color: var(--ink); }
.rmg-seg-btn.on { background: var(--ink); color: var(--paper); }
.rmg-seg-btn:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
.rmg-switch { position: relative; width: 46px; height: 27px; border: 0; border-radius: 999px; background: color-mix(in srgb, var(--ink) 16%, var(--hair)); cursor: pointer; flex-shrink: 0; transition: background 0.25s; }
.rmg-switch.on { background: var(--accent); }
.rmg-switch:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
.rmg-switch-dot { position: absolute; top: 3px; left: 3px; width: 21px; height: 21px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: transform 0.25s cubic-bezier(0.22,1,0.36,1); }
.rmg-switch.on .rmg-switch-dot { transform: translateX(19px); }

/* 하나의 흐름 (단일 컬럼) */
.rmg-flow { position: relative; z-index: 2; width: 100%; max-width: 600px; display: flex; flex-direction: column; gap: clamp(40px, 7vh, 80px); padding: clamp(48px, 12vh, 128px) clamp(28px, 5vw, 56px) 128px;
  transition: opacity 0.34s cubic-bezier(0.22,1,0.36,1), transform 0.34s cubic-bezier(0.22,1,0.36,1); will-change: opacity, transform; }
/* 탭 전환: 이전 뷰가 아래로 살짝 가라앉으며 사라진 뒤, 새 뷰가 rmg-a* 로 떠오른다 */
.rmg-flow.flow-exit { opacity: 0; transform: translateY(-6px); }

/* HERO */
.rmg-hero { display: flex; flex-direction: column; }
.rmg-greet { margin: 0; font-size: clamp(2.4rem, 6vw, 3.6rem); font-weight: 300; letter-spacing: -0.035em; line-height: 1.02; color: var(--ink); }
.rmg-date { margin: 14px 0 0; font-size: 0.92rem; font-weight: 500; letter-spacing: 0.01em; color: var(--muted); font-variant-numeric: tabular-nums; animation: rmg-fade 0.5s ease both; }
.rmg-mood { margin: 10px 0 0; font-size: clamp(1.1rem, 2.6vw, 1.4rem); font-weight: 300; letter-spacing: -0.015em; color: var(--muted); }
.rmg-env-line { margin: 20px 0 0; display: inline-flex; align-items: center; gap: 7px; font-size: 0.9rem; font-weight: 400; color: var(--faint); }
.rmg-env-icon { width: 15px; height: 15px; stroke-width: 1.7; }
.rmg-counts { margin-top: 30px; display: flex; gap: clamp(30px, 5vw, 54px); }
.rmg-count { display: flex; flex-direction: column; gap: 4px; }
.rmg-count-n { font-size: 1.75rem; font-weight: 300; color: var(--ink); letter-spacing: -0.02em; line-height: 1; font-variant-numeric: tabular-nums; }
.rmg-count-l { font-size: 0.74rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }

/* CONTEXT (큐레이션) */
.rmg-ctx-line { display: grid; grid-template-columns: 6.5em 1fr; gap: 18px; align-items: baseline; padding: 15px 0; border-top: 1px solid var(--hair); }
.rmg-ctx-line:first-of-type { border-top: 0; padding-top: 4px; }
.rmg-ctx-k { font-size: 0.8rem; font-weight: 500; letter-spacing: 0.02em; color: var(--faint); }
.rmg-ctx-v { font-size: 1.06rem; font-weight: 300; letter-spacing: -0.01em; color: var(--ink); line-height: 1.5; }
.rmg-ctx-v em { font-family: inherit; font-variant-numeric: proportional-nums; font-feature-settings: "tnum" 0; font-style: normal; font-weight: 450; letter-spacing: -0.01em; color: var(--muted); }
.rmg-ctx-reflect { color: var(--muted); }

/* 확인/정제 카드 — 캡처 후 확정 전(pending). 폼이 아니라 'AI가 채운 걸 끄덕이는' 카드. */
.rmg-confirm { position: absolute; bottom: 26px; left: 50%; transform: translateX(-50%); z-index: 21;
  display: flex; flex-direction: column; gap: 12px;
  width: min(520px, calc(100% - 48px));
  padding: 16px 18px 15px; border-radius: 18px;
  background: color-mix(in srgb, var(--surface) 94%, transparent); border: 1px solid var(--hair);
  backdrop-filter: blur(16px); box-shadow: 0 24px 60px -22px rgba(0,0,0,0.7), 0 0 0 3px var(--glow);
  animation: rmg-rise 0.28s cubic-bezier(0.22,1,0.36,1) both; }
.rmg-confirm-head { display: flex; align-items: center; gap: 9px; }
.rmg-confirm-mark { display: grid; place-items: center; width: 16px; flex-shrink: 0; color: var(--accent); }
.rmg-confirm-door { width: 13px; height: 17px; }
.rmg-confirm-eye { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
.rmg-confirm-dest { margin-left: auto; font-size: 0.74rem; font-weight: 600; letter-spacing: 0.02em; color: var(--accent); }
.rmg-confirm-title { width: 100%; background: transparent; border: 0; outline: none; padding: 2px 0;
  font-family: inherit; font-size: 1.18rem; font-weight: 400; letter-spacing: -0.015em; color: var(--ink); caret-color: var(--accent); }
.rmg-confirm-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.rmg-confirm-chip { border: 1px solid var(--hair); background: color-mix(in srgb, var(--surface) 55%, transparent);
  color: var(--muted); font-family: inherit; font-size: 0.8rem; font-weight: 500; letter-spacing: -0.005em;
  padding: 5px 12px; border-radius: 999px; cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s; }
.rmg-confirm-chip:hover { color: var(--ink); border-color: color-mix(in srgb, var(--accent) 40%, var(--hair)); }
.rmg-confirm-chip.on { color: var(--ink); border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  background: color-mix(in srgb, var(--accent) 13%, transparent); }
.rmg-confirm-chip:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
.rmg-confirm-fields { display: flex; flex-wrap: wrap; gap: 8px; }
.rmg-confirm-field { display: flex; align-items: center; gap: 8px; flex: 1 1 160px; min-width: 0;
  border: 1px solid var(--hair); border-radius: 11px; padding: 7px 11px;
  background: color-mix(in srgb, var(--surface) 50%, transparent); transition: border-color 0.2s; }
.rmg-confirm-field:focus-within { border-color: color-mix(in srgb, var(--accent) 40%, var(--hair)); }
.rmg-confirm-flabel { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--faint); white-space: nowrap; flex-shrink: 0; }
.rmg-confirm-finput { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; padding: 0;
  font-family: inherit; font-size: 0.92rem; font-weight: 400; letter-spacing: -0.01em; color: var(--ink); caret-color: var(--accent); }
.rmg-confirm-finput::placeholder { color: var(--faint); font-weight: 300; }
.rmg-confirm-acts { display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin-top: 2px; }
.rmg-confirm-cancel { border: 0; background: none; font-family: inherit; font-size: 0.86rem; font-weight: 500;
  color: var(--faint); cursor: pointer; padding: 8px 14px; border-radius: 10px; transition: color 0.2s, background 0.2s; }
.rmg-confirm-cancel:hover { color: var(--muted); background: color-mix(in srgb, var(--ink) 6%, transparent); }
.rmg-confirm-ok { border: 0; font-family: inherit; font-size: 0.86rem; font-weight: 600; letter-spacing: -0.005em;
  color: #141210; background: var(--accent); cursor: pointer; padding: 8px 18px; border-radius: 10px;
  transition: transform 0.15s cubic-bezier(0.22,1,0.36,1), filter 0.2s; }
.rmg-confirm-ok:hover { transform: translateY(-1px); filter: brightness(1.05); }
.rmg-confirm-ok:active { transform: scale(0.97); }
.rmg-confirm-cancel:focus-visible, .rmg-confirm-ok:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 2px; }

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
.rmg-ask-send { display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 10px; background: var(--accent); color: #141210; cursor: pointer; flex-shrink: 0; transition: transform 0.15s cubic-bezier(0.22,1,0.36,1); }
.rmg-ask-send:hover { transform: translateY(-1px); }
.rmg-ask-send:active { transform: scale(0.95); }
.rmg-ask-send:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 3px; }

/* REVIEW · 영수증 (무엇 + 어디 + 열기/되돌리기) */
.rmg-rcpt-list { list-style: none; margin: 0; padding: 0; }
/* 타임라인 — 시간(좌) · 커넥터 · 동작 설명 · 액션(우) */
.rmg-rcpt { display: grid; grid-template-columns: 3.6em 1fr auto; align-items: center; gap: 14px; padding: 13px 0; border-bottom: 1px solid var(--hair); }
.rmg-rcpt:last-child { border-bottom: 0; }
.rmg-rcpt-time { font-family: inherit; font-variant-numeric: proportional-nums; font-feature-settings: "tnum" 0; font-size: 0.82rem; font-weight: 450; letter-spacing: -0.01em; color: var(--muted); white-space: nowrap; }
.rmg-rcpt-body { display: flex; align-items: center; gap: 11px; min-width: 0; }
.rmg-rcpt-mark { display: grid; place-items: center; width: 16px; flex-shrink: 0; color: var(--muted); }
.rmg-rcpt-door { width: 13px; height: 17px; }
.rmg-rcpt-desc { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.rmg-rcpt-title { font-size: 0.96rem; font-weight: 400; letter-spacing: -0.01em; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rmg-rcpt-dest { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--faint); }
.rmg-rcpt-acts { display: flex; align-items: center; gap: 2px; }
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
.rmg-vtime { font-family: inherit; font-variant-numeric: proportional-nums; font-feature-settings: "tnum" 0; font-size: 0.82rem; font-weight: 450; letter-spacing: -0.01em; color: var(--muted); min-width: 3.6em; }
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
.rmg-cal-time { font-family: inherit; font-variant-numeric: proportional-nums; font-feature-settings: "tnum" 0; font-size: 0.86rem; font-weight: 450; letter-spacing: -0.01em; color: var(--muted); min-width: 3.6em; }
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
.rmg-mtg-time { font-family: inherit; font-variant-numeric: proportional-nums; font-feature-settings: "tnum" 0; font-size: 0.8rem; font-weight: 450; letter-spacing: -0.01em; color: var(--muted); white-space: nowrap; }
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

/* Workspace Status — 우상단 세로 스택(시간 · 알림 · 문 · 상태문구). 시스템 시계가 아니라 '오늘의 상태' 공간. */
.rmg-status { position: absolute; top: 18px; right: clamp(16px, 3vw, 34px); z-index: 8; display: flex; flex-direction: column; align-items: flex-end; text-align: right; gap: 18px; pointer-events: none; }
.rmg-status > * { pointer-events: auto; }
.rmg-status-time-wrap { display: flex; flex-direction: column; align-items: flex-end; line-height: 1; }
.rmg-status-time { font-size: clamp(1.7rem, 2.4vw, 2.05rem); font-weight: 300; letter-spacing: -0.02em; color: var(--ink); font-variant-numeric: tabular-nums; animation: rmg-status-fade 180ms ease both; }
.rmg-status-date { margin-top: 8px; font-size: 12px; font-weight: 500; letter-spacing: -0.005em; color: var(--muted); font-variant-numeric: tabular-nums; }
.rmg-status-day { margin-top: 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--faint); }
@keyframes rmg-status-fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .rmg-status-time { animation: none; } }

/* 헤더 중앙 — Workspace Context (탭별로 오늘의 상태 한 줄) */
.rmg-topctx { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); max-width: 46%; font-size: 13px; font-weight: 400; letter-spacing: -0.01em; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; animation: rmg-ctx-in 0.2s ease both; }
@keyframes rmg-ctx-in { from { opacity: 0; transform: translate(-50%, calc(-50% + 4px)); } to { opacity: 1; transform: translate(-50%, -50%); } }
@media (max-width: 1080px) { .rmg-topctx { display: none; } }

/* 등장 */
.rmg-a1 { animation: rmg-rise 0.62s cubic-bezier(0.22,1,0.36,1) 0.04s both; }
.rmg-a2 { animation: rmg-rise 0.62s cubic-bezier(0.22,1,0.36,1) 0.1s both; }
.rmg-a3 { animation: rmg-rise 0.62s cubic-bezier(0.22,1,0.36,1) 0.16s both; }
.rmg-a4 { animation: rmg-rise 0.62s cubic-bezier(0.22,1,0.36,1) 0.22s both; }
@keyframes rmg-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

@media (prefers-reduced-motion: reduce) {
  .rmg-a1,.rmg-a2,.rmg-a3,.rmg-a4,.rmg-thr,.rmg-thr.leaving,.rmg-phil-1,.rmg-phil-2,.rmg-thr-cta,.aidoor-svg { animation: none; }
  .rmg-flow { transition: none; }
  .rmg-flow.flow-exit { opacity: 1; transform: none; }
}
`;
