"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ArrowUp, CalendarDays, Cloud, CloudRain, CloudSnow,
  ChevronDown, LogOut, Search, Settings as SettingsIcon, Sparkles, Sun, Users, X,
} from "lucide-react";

import { useWorkspace } from "@/lib/store";
import { fmtTime, fmtDate } from "@/lib/format";
// 백엔드 주소는 환경변수로 — 배포(Vercel)에서 localhost 를 부르면 안 된다.
import { API_BASE, saveItems } from "@/lib/api";
import type { TodoPriority } from "@/lib/types";

/**
 * Comein · Reimagined Workspace — 대시보드가 아니라 '살아있는 편집적 워크스페이스'.
 * 하나의 통합 구성: Hero → Today's context → Quick capture → AI timeline (시선이 아래로 흐른다).
 * 문은 패널이 아니라 환경의 보이지 않는 심장 — 평소엔 사라지고, AI가 일하면 열려 빛이 흐른다.
 * 보라색은 오직 AI 활동의 언어. 배경은 아주 옅게 숨쉰다(래디얼·그레인·미세 입자). 구조는 타이포·여백으로.
 */

type View = "today" | "calendar" | "people";
const NAV: { key: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "today", label: "Today", icon: Sparkles },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "people", label: "People", icon: Users },
];

// AI는 두 갈래로만 정리한다 — 시간 위의 일(일정) · 시간 밖의 일(할 일).
// 회의·메모 분류는 걷어냈다: 갈래가 적을수록 사용자가 분류를 의식하지 않는다.
type Kind = "일정" | "할 일";
// 영수증 — AI가 한 모든 일: 무엇 + 어디(목적지) + 언제. 즉시 실행하되 자취를 남긴다.
type Receipt = { id: number; at: number; title: string; kind: Kind; destView: View; destLabel: string; time: string | null; date?: Date; note?: string; priority?: TodoPriority };
// AI가 이해한 한 건. 확인 단계 없이 그대로 목적지로 배정된다(= 영수증이 된다).
type Parsed = { title: string; kind: Kind; time: string | null; date?: Date; note: string; priority?: TodoPriority };
// 할 일 뷰를 걷어냈으므로 시간 밖의 일은 '오늘'로 모인다 — 오늘 화면의 할 일 수에 그대로 반영된다.
const DEST: Record<Kind, { view: View; label: string }> = {
  일정: { view: "calendar", label: "캘린더" },
  "할 일": { view: "today", label: "오늘" },
};
const VIEW_LABEL: Record<View, string> = { today: "오늘", calendar: "캘린더", people: "사람" };
const pad = (n: number | string) => String(n).padStart(2, "0");

/** 백엔드(`/api/chat`)의 item 하나 → 화면이 쓰는 Parsed.
 *  모르는 필드는 버리고, 없으면 입력 원문으로 메꾼다 — AI가 흔들려도 화면은 안 흔들린다. */
function toParsed(raw: unknown, fallbackTitle: string): Parsed {
  const it = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  // 백엔드는 아직 네 갈래(schedule/meeting/todo/memo)로 준다 → 화면의 두 갈래로 접는다.
  // 시각이 있는 것(일정·회의)은 캘린더로, 시각 밖의 것(할 일·메모)은 할 일로.
  const kind: Kind =
    it.category === "schedule" || it.category === "meeting" ? "일정" : "할 일";

  let time: string | null = null;
  let date: Date | undefined;
  const when = str(it.start) ?? str(it.due);
  if (when) {
    const d = new Date(when);
    if (!Number.isNaN(d.getTime())) {
      date = d;
      time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }

  // 메모류는 백엔드가 title 없이 content 만 주는 경우가 많다 → 본문 첫 줄을 제목으로 세운다.
  const body = str(it.content) ?? str(it.notes) ?? str(it.summary);
  const title = str(it.title) ?? (body ? body.split("\n")[0].slice(0, 40) : null) ?? fallbackTitle;
  const priority = it.priority === "high" || it.priority === "low" || it.priority === "mid"
    ? (it.priority as TodoPriority)
    : undefined;

  return {
    title,
    kind,
    time,
    date,
    // 일정은 장소가, 할 일은 본문이 부가 정보다.
    note: (kind === "일정" ? str(it.location) : null) ?? body ?? str(it.location) ?? "",
    priority,
  };
}

// 백엔드가 잠들었을 때만 쓰는 로컬 폴백. 시각·약속의 낌새가 있으면 일정, 아니면 전부 할 일.
function classify(text: string): Kind {
  if (/회의|미팅|\d\s*시|\d:\d|내일|오늘|모레|다음\s*주|요일|약속|일정/.test(text)) return "일정";
  return "할 일";
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
const EN_VIEW: Record<View, string> = { today: "Today", calendar: "Calendar", people: "People" };
const EN_PLACEHOLDER: Record<View, string> = {
  today: "Write anything — I'll tidy the rest",
  calendar: "Say a new event — e.g. Meeting tomorrow 3pm",
  people: "Who should we connect with?",
};
const EN_HINTS = ["Ask Comein…", "Meet the professor tomorrow 3pm", "Prep the deck — as a task", "Organize this week"];

function L(lang: Lang) {
  const en = lang === "en";
  return {
    place: en ? "Seongnam" : "성남",
    viewLabel: (v: View) => (en ? EN_VIEW[v] : VIEW_LABEL[v]),
    navDesc: (v: View) => (en
      ? ({ today: "Today's flow", calendar: "Events & conflicts", people: "People & contacts" } as Record<View, string>)[v]
      : ({ today: "오늘의 흐름", calendar: "일정과 충돌", people: "연결된 사람" } as Record<View, string>)[v]),
    upNext: en ? "Up next" : "다가오는 순간",
    todayFlow: en ? "Today's flow" : "오늘의 흐름",
    aiThought: en ? "Today's Insight" : "오늘의 브리핑",
    noUpcoming: en ? "Nothing scheduled yet." : "예정된 일정이 없어요",
    pace: (n: number, tight: boolean) => (en ? `${n} left · ${tight ? "a full flow" : "an easy flow"}` : `남은 일 ${n}가지 · ${tight ? "촘촘한 흐름" : "여유로운 흐름"}`),
    paceEmpty: en ? "Nothing today — feels light" : "오늘은 비어 있어요 — 마음이 가볍네요",
    reflect: (c: string | null) => (en ? reflectEn(c) : reflection(c)),
    todaysContextEye: en ? "Today’s context" : "오늘의 맥락",
    organizing: en ? "Organizing" : "정리 중",
    open: en ? "Open" : "열기",
    undo: en ? "Undo" : "되돌리기",
    startingSoon: en ? "Starting soon" : "곧 시작하는 일정",
    importantTask: en ? "Important task" : "중요한 할 일",
    noNotif: en ? "No new notifications." : "새로운 알림이 없어요.",
    topCalendar: en ? "Calendar" : "캘린더",
    topSettings: en ? "Settings" : "설정",
    themeToggle: en ? "Toggle theme" : "테마 전환",
    liveWorkspace: "Live workspace",
    placeholder: (v: View) => (en ? EN_PLACEHOLDER[v] : PLACEHOLDER[v]),
    hints: () => (en ? EN_HINTS : HINTS),
    priority: (p: string) => (en ? ({ high: "High", mid: "Mid", low: "Low" } as Record<string, string>)[p] : ({ high: "높음", mid: "보통", low: "낮음" } as Record<string, string>)[p]),
    emptyCal: en ? "Nothing scheduled." : "예정된 일정이 없어요.",
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
  const contacts = useWorkspace((s) => s.contacts);
  const addSchedule = useWorkspace((s) => s.addSchedule);
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
  // 방금 정리한 한 건 — 목록으로 쌓지 않고 잠깐 스쳤다 사라진다(자취는 목적지 뷰에 남는다).
  const [flash, setFlash] = React.useState<{ text: string; dest: View | null; ids: number[] } | null>(null);
  const [flashOut, setFlashOut] = React.useState(false);
  const [organizing, setOrganizing] = React.useState(false);
  const [weather, setWeather] = React.useState<{ temp: number; condition: string } | null>(null);
  const [calDay, setCalDay] = React.useState<Date | null>(null);
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
  const flashTimers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
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
    for (const r of receipts) if (r.destView === "calendar") arr.push({ date: r.date ?? b, title: r.title, time: r.time ?? "미정" });
    return arr;
  }, [schedules, receipts, now]);
  const dayItems = React.useMemo(() => {
    if (!calDay) return [];
    const k = `${calDay.getFullYear()}-${calDay.getMonth()}-${calDay.getDate()}`;
    return calItems
      .filter((i) => `${i.date.getFullYear()}-${i.date.getMonth()}-${i.date.getDate()}` === k)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [calItems, calDay]);

  const ignite = React.useCallback(() => {
    if (orgTimer.current) clearTimeout(orgTimer.current);
    setOrganizing(true);
    orgTimer.current = setTimeout(() => setOrganizing(false), 1600);
  }, []);

  // 캡처 — 확인 단계 없이 바로 정리한다.
  // "나는 아무것도 정리하지 않았는데, 알아서 정리되어 있었다" (CLAUDE.md) — 사용자에게
  // 폼도, 쌓이는 로그도 내밀지 않는다. 결과는 목적지 뷰에 조용히 놓이고,
  // 방금 한 일만 잠깐 스쳤다 사라진다(아래 flash).
  const file = React.useCallback((items: Parsed[]): Receipt[] => {
    const fresh = items.filter((p) => p.title.trim());
    if (!fresh.length) return [];
    const at = Date.now();
    const rows: Receipt[] = fresh.map((p) => {
      seq.current += 1;
      const dest = DEST[p.kind];
      return {
        id: seq.current, at, title: p.title.trim(), kind: p.kind,
        destView: dest.view, destLabel: dest.label,
        time: p.time, date: p.date, note: p.note.trim() || undefined,
        priority: p.priority,
      };
    });
    setReceipts((prev) => [...[...rows].reverse(), ...prev].slice(0, 12));
    return rows;
  }, []);

  // 스침 — 6초 뒤 옅어지고 6.5초 뒤 사라진다. 화면에 남지 않는 게 요점.
  const showFlash = React.useCallback((rows: Receipt[], text?: string) => {
    if (!rows.length) return;
    for (const timer of flashTimers.current) clearTimeout(timer);
    const head = rows[0];
    const more = rows.length > 1 ? ` 외 ${rows.length - 1}건` : "";
    setFlashOut(false);
    setFlash({
      text: text || `${head.title}${more} · ${head.destLabel}`,
      dest: head.destView,
      ids: rows.map((r) => r.id),
    });
    flashTimers.current = [
      setTimeout(() => setFlashOut(true), 6000),
      setTimeout(() => setFlash(null), 6500),
    ];
  }, []);

  const capture = async (v: string) => {
    const t = v.trim();
    if (!t) return;

    // 응답이 올 때까지 '정리 중' 상태를 유지한다 (콜드스타트면 수십 초가 걸릴 수 있다).
    if (orgTimer.current) clearTimeout(orgTimer.current);
    for (const timer of flashTimers.current) clearTimeout(timer);
    setOrganizing(true);
    setFlash(null);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: t }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);

      const data = await res.json();
      const items: unknown[] = Array.isArray(data.items) ? data.items : [];

      // AI가 한 문장에서 여러 건을 뽑았으면 전부 각자의 목적지로 보낸다.
      // ("내일 3시 미팅 잡고 자료도 준비해야 해" → 일정 + 할 일)
      const parsed = items.slice(0, 4).map((raw) => toParsed(raw, t));
      const rows = file(parsed.length ? parsed : [{ title: t, kind: classify(t), time: parseTime(t), note: "" }]);
      const said = typeof data.reply === "string" ? data.reply.trim() : "";
      showFlash(rows, said || undefined);

      // Supabase 영속화 — /api/chat 의 items 는 이미 ParsedItem 형태라 그대로 저장한다.
      // 저장에 실패해도 화면 흐름(flash)은 막지 않는다(로컬 폴백 철학과 동일).
      void saveItems(items.slice(0, 4)).catch((e) => console.error("항목 저장 실패:", e));
    } catch (err) {
      // 백엔드가 자거나 죽어도 입력은 삼키지 않는다 — 로컬 규칙으로라도 정리한다.
      console.error("AI 파싱 실패 → 로컬 폴백:", err);
      showFlash(file([{ title: t, kind: classify(t), time: parseTime(t), note: "" }]));
    } finally {
      ignite();
    }
  };

  const undoReceipt = (id: number) => setReceipts((prev) => prev.filter((r) => r.id !== id));

  // 타임테이블에서 직접 적어 넣은 한 줄 — 캡처바를 거치지 않는 유일한 입력이라 AI 표식을 달지 않는다.
  const addScheduleAt = React.useCallback((title: string, start: Date) => {
    addSchedule({ title, start: start.toISOString(), end: new Date(+start + 3_600_000).toISOString(), status: "confirmed" });
    ignite();
  }, [addSchedule]);

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
      case "people": return en ? `${followUp} to follow up` : `오늘 확인할 사람 ${followUp}명`;
      default: return null;
    }
  })();
  const WeatherIcon = weather ? weatherIconOf(weather.condition) : Cloud;
  const rc = (v: View) => receipts.filter((r) => r.destView === v).length;
  const taskCount = openTodos.length + rc("today");
  const eventCount = upcoming.length + rc("calendar");
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
  const navActive = panel === null ? navViewIndex : -1;
  const navIndPos = navActive >= 0 ? navActive : navViewIndex;

  return (
    <div className={`rmg ${railOpen || panel ? "rail-open" : ""} ${railIntro ? "rail-intro" : ""} ${panel ? "panel-open" : ""} view-${shownView}`} style={{ ["--rmg-fs" as string]: String(textScale) } as React.CSSProperties}>
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
              const on = panel === null && view === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => { setPanel(null); setView(n.key); }}
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

        {/* Workspace Status — 우측 상단은 시각만 남긴다(알림 벨은 걷어냈다). */}
        <div className="rmg-status">
          <StatusTime lang={lang} />
        </div>

        {/* 왼쪽 여백의 상시 캘린더 — 모든 화면에서 시간 맥락.
            단, 캘린더 뷰에서는 같은 달력이 캔버스 한복판에 있으므로 비운다(두 번 보여주지 않는다). */}
        <aside className="rmg-calrail" aria-label={t.topCalendar} data-hidden={shownView === "calendar"}>
          {mounted && calDay && now && shownView !== "calendar" && (
            <>
              {/* 날짜를 누르면 그 날을 고른 채 캘린더로 건너간다 — 이 달력은 장식이 아니라 입구다. */}
              <MonthCalendar
                base={now}
                events={calItems.map((i) => i.date)}
                selected={calDay}
                onSelect={(d) => { setCalDay(d); setPanel(null); setView("calendar"); }}
                lang={lang}
              />
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

        {/* 캘린더만 넓게 — 달력과 24시간 원이 나란히 서려면 600px로는 좁다(좌측 상시 달력을 비운 자리를 쓴다). */}
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
                  <span className="rmg-count"><b className="rmg-count-n">{eventCount}</b><span className="rmg-count-l">{lang === "en" ? "Events" : "일정"}</span></span>
                  <span className="rmg-count"><b className="rmg-count-n">{taskCount}</b><span className="rmg-count-l">{lang === "en" ? "Tasks" : "할 일"}</span></span>
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
              contacts={contacts}
              mounted={mounted}
              receipts={receipts}
              now={now}
              onRemoveReceipt={undoReceipt}
              onAddSchedule={addScheduleAt}
              selectedDay={calDay}
              onSelectDay={setCalDay}
            />
          )}

        </div>

        {/* 스침 — 정리된 결과는 목적지 뷰에 놓이고, 여기엔 방금 한 일만 잠깐 머물다 사라진다.
            기록을 쌓아 보여주면 대시보드가 된다. Comein은 자취를 남기되 진열하지 않는다. */}
        {!panel && (organizing || flash) && (
          <div className={`rmg-flash ${flashOut ? "out" : ""}`} role="status" aria-live="polite">
            <AiDoor active className="rmg-flash-door" />
            {organizing ? (
              <span className="rmg-flash-text">{t.organizing}…</span>
            ) : flash ? (
              <>
                <span className="rmg-flash-text">{flash.text}</span>
                {flash.dest && (
                  <button type="button" className="rmg-flash-act" onClick={() => { setView(flash.dest!); setFlash(null); }}>{t.open}</button>
                )}
                <button
                  type="button"
                  className="rmg-flash-act"
                  onClick={() => { flash.ids.forEach(undoReceipt); setFlash(null); }}
                >
                  {t.undo}
                </button>
              </>
            ) : null}
          </div>
        )}

        {/* 앰비언트 AI — 상주 챗박스가 아니라, 필요할 때만 펼쳐지는 떠다니는 문 (⌘K).
            전체 패널(캘린더·설정·가이드)이 열리면 컴포저는 물러난다(⌘K 충돌 방지).
            입력하면 확인 절차 없이 바로 정리된다 — 결과는 위 영수증에 남는다. */}
        {!panel && <DoorInvoke view={view} lang={lang} organizing={organizing} onSubmit={capture} />}

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
  people: "누구를 연결할까요?",
};
// 회전하는 예시 — 무엇을 할 수 있는지 조용히 가르친다.
const HINTS = [
  "Ask Comein…",
  "내일 3시 교수님 미팅 잡아줘",
  "발표 자료 준비 — 할 일로",
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
  view: View; lang: Lang; schedules: any[]; todos: any[]; contacts: any[];
  mounted: boolean; receipts: Receipt[]; now: Date | null;
  onRemoveReceipt: (id: number) => void;
  onAddSchedule: (title: string, start: Date) => void;
  selectedDay: Date | null; onSelectDay: (d: Date) => void;
}) {
  const { view, lang, receipts } = props;
  const t = L(lang);
  const mine = receipts.filter((r) => r.destView === view);

  return (
    <section className="rmg-a1">
      <div className="rmg-feat-head">
        <p className="rmg-feat-title">{t.viewLabel(view)}</p>
      </div>

      {view === "calendar" && <CalendarView {...props} mine={mine} />}
      {view === "people" && <PeopleView {...props} />}
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

/** 하루의 일정을 그 날짜 안의 분(分) 구간으로 — 스케줄과 AI 영수증을 한 모양으로 합친다.
 *
 *  자정 넘김(23:00~01:00)은 날짜마다 걸치는 부분만 잘라 담는다 → 그 일정은 두 날 모두에 나타난다.
 *  종일(24시간 이상)은 특정 시간대의 arc 로 그리면 거짓말이 되므로 따로 표시한다(allDay).
 *  시각은 모두 사용자의 로컬 시간 — Date 의 getHours 계열이 곧 로컬 기준이다. */
type Span = {
  id: string; title: string;
  from: number; to: number;      // 그 날 자정으로부터의 분. 0 ≤ from < to ≤ 1440
  pending: boolean; allDay: boolean;
  startAt: Date; endAt: Date;    // 원래의 시각(잘리기 전) — 툴팁은 이걸 보여준다
  cutStart: boolean; cutEnd: boolean; // 전날/다음날에서 이어지는가
};
const MIN_ARC = 6; // 아주 짧은 일정도 원 위에서 사라지지 않을 최소 폭(분)

function spansOf(day: Date, schedules: any[], mine: Receipt[], base: Date | null): Span[] {
  const d0 = new Date(day); d0.setHours(0, 0, 0, 0);
  const dayStart = +d0, dayEnd = dayStart + 86_400_000;
  const out: Span[] = [];

  const add = (id: string, title: string, st: Date, en: Date, pending: boolean) => {
    if (!(+st < dayEnd && +en > dayStart)) return; // 이 날에 걸치지 않음
    const allDay = +en - +st >= 86_400_000;
    const from = Math.max(0, Math.round((+st - dayStart) / 60_000));
    const rawTo = Math.min(1440, Math.round((+en - dayStart) / 60_000));
    out.push({
      id, title, from, to: Math.max(rawTo, Math.min(1440, from + MIN_ARC)),
      pending, allDay, startAt: st, endAt: en,
      cutStart: +st < dayStart, cutEnd: +en > dayEnd,
    });
  };

  for (const s of schedules) {
    const st = new Date(s.start);
    if (Number.isNaN(+st)) continue;
    // 종료가 없으면 1시간으로 본다 — 원도 표도 '면적'이 있어야 보인다.
    const en = s.end ? new Date(s.end) : new Date(+st + 3_600_000);
    add(String(s.id), s.title, st, Number.isNaN(+en) || +en <= +st ? new Date(+st + 3_600_000) : en, s.status === "pending");
  }
  for (const r of mine) {
    const d = r.date ?? base;
    // 시각을 모르면 원 위에 놓을 자리가 없다 — 시간 없는 건은 원에서 빠진다.
    if (!d || !r.time) continue;
    const [hh, mm] = r.time.split(":").map(Number);
    const st = new Date(d); st.setHours(hh, mm, 0, 0);
    add(`r-${r.id}`, r.title, st, new Date(+st + 3_600_000), true);
  }
  return out.sort((a, b) => a.from - b.from || a.to - b.to);
}

const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** 툴팁에 쓸 시간 범위. 자정을 넘겼으면 어느 쪽으로 이어지는지 함께 알린다. */
function spanRange(s: Span, lang: Lang): string {
  if (s.allDay) return lang === "en" ? "All day" : "종일";
  const a = hhmm(s.startAt), b = hhmm(s.endAt);
  if (s.cutStart) return `${lang === "en" ? "from prev. day" : "전날부터"} · ${a} – ${b}`;
  if (s.cutEnd) return `${a} – ${b} ${lang === "en" ? "(next day)" : "(다음 날)"}`;
  return `${a} – ${b}`;
}

/** Calendar — 월(月)과 그날의 24시간 원이 나란히. 날짜를 고르면 화면은 그대로 두고 오른쪽 원만 바뀐다.
 *  타임테이블(표)은 화면을 갈아치우는 일이므로 사용자가 스스로 눌렀을 때만 연다. */
function CalendarView({ schedules, mounted, now, mine, lang, onAddSchedule, selectedDay, onSelectDay }: any) {
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
        <div className="rmg-cv-head">
          <button type="button" className="rmg-cv-back" onClick={() => setTimetable(false)}>
            ‹ {t.topCalendar}
          </button>
          <p className="rmg-cv-title">{fmtDate(day)}</p>
          <span className="rmg-cv-spacer" />
        </div>
        <DayTimetable day={day} spans={spans} now={base} lang={lang} onAdd={onAddSchedule} />
      </div>
    );
  }

  // ── 월(月) 화면 — 왼쪽은 '어느 날', 오른쪽은 '그 하루의 모양'. ──
  const upcoming = [...schedules]
    .map((s: any) => ({ id: String(s.id), date: new Date(s.start), title: s.title }))
    .filter((s) => +s.date >= +base - 3_600_000)
    .sort((a, b) => +a.date - +b.date)
    .slice(0, 4);

  return (
    <div className="rmg-cv" key="month">
      <p className="rmg-cv-eyebrow">
        {lang === "en"
          ? "Pick a day — its 24 hours fill in on the right · press it again for the timetable"
          : "날짜를 누르면 오른쪽 24시간이 그 날로 바뀌어요 · 한 번 더 누르면 시간표"}
      </p>
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
          />
          <div className="rmg-cv-up">
            <p className="rmg-cv-eyebrow">{t.upNext}</p>
            <ul className="rmg-cv-uplist">
              {upcoming.length ? upcoming.map((s) => (
                <li key={s.id} className="rmg-cv-uprow" onClick={() => { setSelected(s.date); setTimetable(true); }}>
                  <span className="rmg-cv-uptime">{fmtTime(s.date)}</span>
                  <span className="rmg-cv-uptitle">{s.title}</span>
                </li>
              )) : <li className="rmg-cv-upempty">{t.noUpcoming}</li>}
            </ul>
          </div>
        </div>
        <div className="rmg-cv-col">
          <div className="rmg-cv-ringhead">
            <p className="rmg-cv-eyebrow">{dayLabel} · {lang === "en" ? "24 hours" : "24시간"}</p>
            <button type="button" className="rmg-cv-tolist" onClick={() => setTimetable(true)}>
              {lang === "en" ? "Timetable" : "시간표로 보기"}
            </button>
          </div>
          <DayDial spans={spans} day={day} now={base} lang={lang} />
        </div>
      </div>
    </div>
  );
}

/** 24시간 원 — 초등학교 생활계획표의 그 원. 0시가 위, 시계 방향. 하루의 밀도를 한눈에 보는 시간 지도.
 *  색으로 구분하지 않는다(모노크롬 원칙) — 액센트 한 색의 농도 계단으로 인접 구간을 가른다. */
function DayDial({ spans, day, now, lang }: { spans: Span[]; day: Date; now: Date; lang: Lang }) {
  const R = 96, RI = 46, C = 110;   // 바깥/안쪽 반지름, 중심
  const RING = R + 7;               // 종일 일정을 얹는 바깥 링
  // hover 는 스쳐 지나가고, click 은 붙잡는다. 붙잡힌 게 있으면 그게 우선.
  const [hover, setHover] = React.useState<string | null>(null);
  const [pinned, setPinned] = React.useState<string | null>(null);
  const activeId = pinned ?? hover;
  React.useEffect(() => { setPinned(null); setHover(null); }, [day]);

  const pt = (min: number, r: number) => {
    const a = (min / 1440) * 2 * Math.PI - Math.PI / 2; // 0시 = 12시 방향
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  const sector = (from: number, to: number, rOut: number, rIn: number) => {
    const [x1, y1] = pt(from, rOut), [x2, y2] = pt(to, rOut);
    const [x3, y3] = pt(to, rIn), [x4, y4] = pt(from, rIn);
    const large = to - from > 720 ? 1 : 0;
    return `M${x1} ${y1}A${rOut} ${rOut} 0 ${large} 1 ${x2} ${y2}L${x3} ${y3}A${rIn} ${rIn} 0 ${large} 0 ${x4} ${y4}Z`;
  };

  // 겹치는 일정은 같은 자리를 다투므로 안쪽으로 한 겹씩 물린다 — 서로를 덮지 않게.
  const timed = spans.filter((s) => !s.allDay);
  const allDay = spans.filter((s) => s.allDay);
  const lanes: number[] = [];       // lane 별 마지막 끝 시각
  const laneOf = new Map<string, number>();
  for (const s of timed) {
    let ln = lanes.findIndex((end) => end <= s.from);
    if (ln === -1) { ln = lanes.length; lanes.push(0); }
    lanes[ln] = s.to;
    laneOf.set(s.id, Math.min(ln, 2)); // 3겹까지만 — 그 이상은 같은 겹에 얹는다
  }
  const band = (R - RI) / (Math.min(lanes.length, 3) || 1);

  // 지금 바늘은 '오늘'일 때만 — 다른 날 원에 현재 시각을 그리면 거짓말이 된다.
  const isToday = dayKey(day) === dayKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [nx, ny] = pt(nowMin, R - 4);

  const active = spans.find((s) => s.id === activeId) ?? null;
  // 툴팁은 그 구간의 한가운데(반지름 중간)에 붙는다 — viewBox 좌표를 %로 환산.
  const tipAt = active
    ? pt(active.allDay ? 0 : (active.from + active.to) / 2, active.allDay ? RING : (R + RI) / 2)
    : null;

  return (
    <div className="rmg-dial">
      <div className="rmg-dial-stage">
        <svg viewBox="0 0 220 220" className="rmg-dial-svg"
          aria-label={lang === "en" ? "24-hour plan" : "24시간 계획"}
          onMouseLeave={() => setHover(null)}
        >
          <circle cx={C} cy={C} r={R} className="rmg-dial-ring" />
          <circle cx={C} cy={C} r={RI} className="rmg-dial-ring" />
          {/* 시각 눈금 — 3시간마다 숫자, 나머지는 짧은 선 */}
          {Array.from({ length: 24 }, (_, hh) => {
            const [ax, ay] = pt(hh * 60, R);
            const [bx, by] = pt(hh * 60, hh % 3 === 0 ? RI : R - 6);
            const [lx, ly] = pt(hh * 60, R + 13);
            return (
              <g key={hh}>
                <line x1={ax} y1={ay} x2={bx} y2={by} className={`rmg-dial-tick ${hh % 3 === 0 ? "major" : ""}`} />
                {hh % 3 === 0 && <text x={lx} y={ly} className="rmg-dial-num">{hh}</text>}
              </g>
            );
          })}

          {/* 종일 — 시간대가 없으므로 바깥을 한 바퀴 두르는 얇은 띠로. */}
          {allDay.map((s, i) => (
            <circle
              key={s.id} cx={C} cy={C} r={RING + i * 4}
              className={`rmg-dial-allday ${activeId === s.id ? "on" : ""}`}
              onMouseEnter={() => setHover(s.id)}
              onClick={() => setPinned((p) => (p === s.id ? null : s.id))}
            />
          ))}

          {timed.map((s, i) => {
            const ln = laneOf.get(s.id) ?? 0;
            const rOut = R - ln * band, rIn = rOut - band;
            return (
              <path
                key={s.id}
                d={sector(s.from, s.to, rOut, rIn)}
                className={`rmg-dial-slice ${s.pending ? "pending" : ""} ${activeId === s.id ? "on" : ""} ${activeId && activeId !== s.id ? "dim" : ""}`}
                style={{ ["--step" as string]: String(i % 3) } as React.CSSProperties}
                onMouseEnter={() => setHover(s.id)}
                onClick={() => setPinned((p) => (p === s.id ? null : s.id))}
              />
            );
          })}

          {/* 바늘은 항상 arc 위에 — 일정 한가운데를 지나도 가려지지 않게 밑선을 깔아준다. */}
          {isToday && (
            <>
              <line x1={C} y1={C} x2={nx} y2={ny} className="rmg-dial-hand-halo" />
              <line x1={C} y1={C} x2={nx} y2={ny} className="rmg-dial-hand" />
            </>
          )}
          <circle cx={C} cy={C} r={3.5} className="rmg-dial-hub" />
        </svg>

        {active && tipAt && (
          <div
            className={`rmg-dial-tip ${pinned ? "pinned" : ""}`}
            style={{ left: `${(tipAt[0] / 220) * 100}%`, top: `${(tipAt[1] / 220) * 100}%` }}
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
          {spans.map((s, i) => (
            <li
              key={s.id}
              className={`rmg-dial-keyrow ${activeId === s.id ? "on" : ""}`}
              onMouseEnter={() => setHover(s.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setPinned((p) => (p === s.id ? null : s.id))}
            >
              <span className={`rmg-dial-chip ${s.pending ? "pending" : ""} ${s.allDay ? "allday" : ""}`} style={{ ["--step" as string]: String(i % 3) } as React.CSSProperties} />
              <span className="rmg-dial-keytime">{s.allDay ? (lang === "en" ? "All day" : "종일") : hhmm(s.startAt)}</span>
              <span className="rmg-dial-keytitle">{s.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const TT_FROM = 6, TT_TO = 24, TT_ROW = 52; // 06:00 ~ 23:00, 한 시간 = 52px

/** 하루 타임테이블 — 시간이 아래로 흐르는 표. 빈 행을 누르면 그 시각에 바로 한 줄 적어 넣는다. */
function DayTimetable({ day, spans, now, lang, onAdd }: {
  day: Date; spans: Span[]; now: Date; lang: Lang; onAdd?: (title: string, start: Date) => void;
}) {
  const [openHour, setOpenHour] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { if (openHour !== null) inputRef.current?.focus(); }, [openHour]);

  const hours = Array.from({ length: TT_TO - TT_FROM }, (_, i) => i + TT_FROM);
  const top = TT_FROM * 60;

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
    <div className="rmg-tt" style={{ ["--row" as string]: `${TT_ROW}px` } as React.CSSProperties}>
      <div className="rmg-tt-rows">
        {hours.map((h) => {
          const isNow = dayKey(now) === dayKey(day) && now.getHours() === h;
          return (
            <div key={h} className={`rmg-tt-row ${isNow ? "now" : ""}`} onClick={() => onAdd && setOpenHour(h)}>
              <span className="rmg-tt-hour">{pad(h)}:00</span>
              <div className="rmg-tt-cell">
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
            </div>
          );
        })}
      </div>
      <div className="rmg-tt-blocks">
        {spans.map((s) => (
          <div
            key={s.id}
            className={`rmg-tt-block ${s.pending ? "pending" : ""}`}
            style={{
              top: `calc(${s.from - top} / 60 * var(--row))`,
              height: `calc(${s.to - s.from} / 60 * var(--row))`,
            }}
          >
            <span className="rmg-tt-block-title">{s.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** People — 연락처(익숙한). */
function PeopleView({ contacts, lang }: any) {
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
  --rail-w: 64px;  /* 레일 폭 — fixed 로 떠 있는 캡처바가 캔버스 기준으로 가운데를 잡는 데 쓴다 */

  /* ── 간격 체계 — 8px 배수 하나로 통일. 임의값을 쓰지 않는다. ── */
  --sp-1: 8px; --sp-2: 16px; --sp-3: 24px; --sp-4: 32px; --sp-5: 40px; --sp-6: 48px;
  /* 모서리도 토큰으로 — 컴포넌트마다 다른 반경을 쓰지 않는다. */
  --r-sm: 8px; --r: 12px; --r-lg: 16px;
  /* 화면 가장자리 여백 — 넓어질수록 함께 자라되 88px 에서 멈춘다. */
  --gutter: clamp(32px, 4vw, 88px);
  /* 본문 기준 폭. 뷰마다 하나만 정하고, 시계·상단 문구·캡처바·배경 문양이 전부 이 폭에 맞춰 선다. */
  --content: 640px;                     /* 글이 중심인 뷰 — 읽기 좋은 한 칸 */
  /* 캘린더는 작업대다. 화면을 따라 넓어지되 1440px 에서 멈춘다(그 이상은 눈이 따라가기 어렵다).
     64px 은 레일 폭 — 캔버스가 쓰는 실제 가로를 계산에 반영한다. */
  --content-wide: min(1440px, calc(100vw - 64px - 2 * var(--gutter)));
  --ring-gap: clamp(32px, 3vw, 72px);   /* 달력과 링 사이 */
  --dial-w: 400px;                      /* 원의 최대 지름 — 컬럼이 넓어져도 원은 여기서 멈추고 가운데 선다 */
  --measure: var(--content);
  /* 캔버스 오른쪽 끝에서 본문 컬럼 오른쪽 끝까지의 거리. 화면이 좁으면 최소 여백으로 떨어진다. */
  --edge: max(var(--gutter), calc((100% - var(--measure)) / 2));
  --flow-top: clamp(56px, 7vh, 88px);
  /* 캡처바(높이 61 + bottom 32)가 콘텐츠를 가리지 않을 만큼만. 예전 160px 은 하단을 과하게 비웠다. */
  --flow-bottom: 128px;
  /* 섹션 사이 — 화면이 높아지면 조금 벌어지되 72px 에서 멈춘다(무한정 늘어나지 않게). */
  --flow-gap: clamp(48px, 5vh, 72px);
  --heart-w: clamp(112px, 12vw, 176px);

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
/* 그리드 값은 리터럴로 둔다 — custom property 는 보간되지 않아 레일 확장 모션이 끊긴다. */
.rmg.rail-open { --rail-w: 216px; grid-template-columns: 216px minmax(0, 1fr); }
/* 캘린더 뷰만 본문 기준 폭이 넓다 — 파생되는 모든 정렬(시계·문양·상단 문구)이 함께 따라간다. */
.rmg.view-calendar { --measure: var(--content-wide); }
/* 사람은 '목록'이다 — 항목이 적어도 화면 한가운데로 내려앉지 않고 위에서부터 읽힌다. */
.rmg.view-people .rmg-flow { justify-content: safe start; }
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
.rmg-eyebrow { margin: 0 0 var(--sp-3); font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--faint); }

/* 스침 — 캡처바 바로 위, 한 줄. 6초 뒤 스스로 옅어진다. 카드도 목록도 아니다. */
.rmg-flash { position: fixed; bottom: 96px; left: var(--rail-w, 64px); right: 0; margin: 0 auto; z-index: 19;
  display: flex; align-items: center; gap: 10px;
  width: min(560px, var(--measure), calc(100% - 2 * var(--gutter))); padding: var(--sp-1) 14px; border-radius: var(--r);
  background: color-mix(in srgb, var(--surface) 86%, transparent); border: 1px solid var(--hair);
  backdrop-filter: blur(12px); box-shadow: 0 10px 30px -16px rgba(0,0,0,0.55);
  animation: rmg-rise 0.34s cubic-bezier(0.22,1,0.36,1) both;
  transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.22,1,0.36,1), left 280ms cubic-bezier(0.22,1,0.36,1); }
.rmg-flash.out { opacity: 0; transform: translateY(4px); }
.rmg-flash-door { width: 13px; height: 17px; color: var(--accent); flex-shrink: 0; }
.rmg-flash-text { flex: 1; min-width: 0; font-size: 0.9rem; font-weight: 300; letter-spacing: -0.01em;
  color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rmg-flash-act { border: 0; background: none; font-family: inherit; font-size: 0.82rem; font-weight: 500;
  color: var(--faint); padding: 3px 7px; border-radius: 7px; cursor: pointer; flex-shrink: 0;
  transition: color 0.2s, background 0.2s; }
.rmg-flash-act:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 7%, transparent); }
.rmg-flash-act:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .rmg-flash { animation: none; transition: opacity 0.5s ease; } }

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
  display: flex; flex-direction: column; align-items: stretch; gap: var(--sp-3);
  padding: var(--sp-3) 12px; border-right: 1px solid var(--hair);
  transition: background 280ms ease, border-color 280ms ease;
}
/* 확장 시 표면이 아주 은은하게 올라오고, 문틈 같은 액센트 헤어라인(공간이 열리는 감각) */
.rmg.rail-open .rmg-rail-panel {
  background: color-mix(in srgb, var(--surface) 55%, transparent);
  border-right-color: color-mix(in srgb, var(--accent) 18%, var(--hair));
}

/* 브랜드 마크(문) + Comein 워드마크 리빌 — 아주 은은한 글로우 */
/* 브랜드 마크 — 클릭 불가(가이드 제거). 레일 펼침 시 문에 은은한 숨결만. */
/* 마크와 메뉴가 같은 행 규격(높이 40 · 좌우 패딩 10 · 아이콘 폭 19)을 써야 아이콘·라벨이 한 줄에 선다. */
.rmg-rail-mark { display: flex; align-items: center; gap: 12px; height: 40px; padding: 0 10px; border-radius: var(--r); color: var(--ink); overflow: hidden; }
.rmg.rail-open .rmg-rail-mark .aidoor-svg { filter: drop-shadow(0 0 7px var(--glow)); }
.rmg-rail-door { width: 19px; height: 24px; flex: 0 0 19px; }
.rmg-rail-word { font-size: 0.98rem; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); }

.rmg-rail-nav { position: relative; display: flex; flex-direction: column; gap: 4px; }
.rmg-rail-foot { margin-top: auto; display: flex; flex-direction: column; gap: 4px; }
/* 활성 인디케이터 — 선택 항목 사이를 미끄러지듯 이동(morph). 아이템 높이 40 + gap 4 = 44px 스텝 */
.rmg-rail-ind { position: absolute; left: 0; right: 0; top: 0; height: 40px; border-radius: var(--r); z-index: 0; pointer-events: none;
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  transform: translateY(calc(var(--active, 0) * 44px));
  transition: transform 280ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease;
  will-change: transform; }
.rmg-rail-ind::before { content: ""; position: absolute; left: 1px; top: 50%; transform: translateY(-50%); width: 3px; height: 18px; border-radius: 0 3px 3px 0; background: var(--accent); box-shadow: 0 0 10px -1px color-mix(in srgb, var(--accent) 55%, transparent); }
.rmg-rail-ind[data-hidden="true"] { opacity: 0; }
.rmg-railbtn { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; width: 100%; height: 40px; padding: 0 10px; box-sizing: border-box; border: 0; border-radius: var(--r); background: none; color: var(--faint); cursor: pointer; text-decoration: none;
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
/* 스크롤바 자리를 양쪽에 늘 비워둔다 — 한쪽만 비우면 본문 중심선이 fixed 로 뜬 캡처바와 어긋나고,
   뷰마다 스크롤 유무가 달라 기준선 자체가 흔들린다. */
.rmg-canvas { position: relative; overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable both-edges; display: flex; justify-content: center; background: transparent; }
.rmg-env { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.rmg-ambient-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.rmg-grain { position: absolute; inset: 0; opacity: 0.026; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
/* 문 문양 — 규칙은 하나다: 본문 컬럼 바깥 오른쪽 여백의 한가운데.
   가로는 그 여백의 중앙, 세로는 본문과 같은 중심선. 뷰마다 다른 오프셋을 주지 않는다
   (그렇게 땜질하면 화면을 옮길 때마다 문이 제 자리를 잃는다). */
.rmg-heart { position: absolute; right: calc((var(--edge) - var(--heart-w)) / 2); top: 50%; transform: translateY(-50%); width: var(--heart-w); aspect-ratio: 40/52; color: var(--ink); opacity: 0.12; transition: opacity 1.2s ease; }
/* 문양이 들어갈 바깥 여백이 없으면 아예 물러난다 — 장식이 본문 위로 올라오지 않는다.
   본문이 넓은 캘린더에서는 대개 여기에 해당해, 오른쪽은 24시간 링이 대신 채운다. */
@media (max-width: 1500px) { .rmg-heart { display: none; } }
.rmg.view-calendar .rmg-heart { display: none; }
.rmg-heart.on { opacity: 0.5; }
/* light 모드: --muted가 어두운 회색이라 흰 배경 위 실효 ~2% 불투명도로는 문이 사라져 보임 → 휴식 가시성 보강(다크는 유지). .on보다 특이성이 높아 조직화 글로우도 유지. */
/* 빈 상태 일러스트 — 링과 같은 뉴트럴 계열. 윤곽이 사라지지 않을 만큼만 올린다(튀지 않게). */
:root:not(.dark) .rmg-heart { opacity: 0.38; }
:root:not(.dark) .rmg-heart.on { opacity: 0.62; }
.rmg-heart-door { width: 100%; height: 100%; }

/* 최상단 옵션 바 + 알림 */
.rmg-topbar { position: absolute; top: 0; left: 0; right: 0; z-index: 6; height: 56px; display: flex; align-items: center; justify-content: flex-end; gap: var(--sp-2); padding: 0 var(--edge); }
/* 패널 닫기 아이콘 규격 (알림 벨은 제거됐지만 이 크기는 설정·캘린더 패널이 함께 쓴다) */
.rmg-notif-ic { width: 18.5px; height: 18.5px; stroke-width: 1.7; }

/* 왼쪽 상시 캘린더 */
.rmg-calrail { display: none; }
@media (min-width: 1240px) {
  /* 상단 라인을 메인 인사말(.rmg-flow 상단 여백)에 맞춤 — 월 헤더 윗선이 Good morning. 첫 줄과 같은 높이. +6px는 큰 글자 대비 광학 보정. */
  .rmg-calrail { display: block; position: absolute; left: 0; top: 0; bottom: 0; width: 288px; z-index: 4; overflow-y: auto; padding: calc(var(--flow-top) + 6px) var(--sp-3) var(--sp-6) var(--sp-4); }
  .rmg-calrail[data-hidden="true"] { display: none; }
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

/* 요일 행과 날짜 그리드는 같은 컬럼 규격 + 같은 gap 이어야 한 격자 위에 선다. */
.rmg-mc-wd { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; margin-bottom: 4px; }
.rmg-mc-wd span { text-align: center; font-size: 0.68rem; font-weight: 500; color: var(--faint); padding: 4px 0; }
.rmg-mc-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; animation: rmg-mc-fade 0.19s ease both; }
.rmg-mc-grid.in-l { animation: rmg-mc-slide-l 0.2s cubic-bezier(0.22,1,0.36,1) both; }
.rmg-mc-grid.in-r { animation: rmg-mc-slide-r 0.2s cubic-bezier(0.22,1,0.36,1) both; }
@keyframes rmg-mc-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes rmg-mc-slide-l { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: none; } }
@keyframes rmg-mc-slide-r { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: none; } }
/* color 에는 전환을 걸지 않는다 — 선택 카드는 즉시 깔리는데 글자색만 0.2s 뒤따라오면
   그 사이 어두운 카드 위에 어두운 글자가 겹쳐 숫자가 잠깐 사라져 보인다. */
.rmg-mc-cell { position: relative; isolation: isolate; aspect-ratio: 1; display: grid; place-items: center; border: 0; background: none; color: var(--muted); font-family: inherit; font-size: 0.8rem; font-weight: 400; border-radius: var(--r-sm); cursor: pointer; transition: background 0.2s; }
.rmg-mc-cell.empty { pointer-events: none; }
.rmg-mc-cell:not(.empty):hover { background: color-mix(in srgb, var(--ink) 8%, transparent); color: var(--ink); }
/* 오늘 — 강한 primary 대신 은은한 액센트 필드 서클 (팔레트 유지) */
.rmg-mc-cell.today { color: var(--accent); font-weight: 700; }
.rmg-mc-cell.today::before { content: ""; position: absolute; inset: 14%; border-radius: 50%; background: color-mix(in srgb, var(--accent) 16%, transparent); z-index: -1; }
/* 선택 표식은 셀 전체가 아니라 안쪽 사각형 — 칸이 커져도 카드 크기가 함께 부풀지 않고 숫자는 늘 가운데 있다. */
.rmg-mc-cell.sel { background: none; color: var(--paper); font-weight: 600; }
/* 카드는 살짝 부풀며 자리를 잡는다(불투명도는 건드리지 않는다 — 옅어지면 글자가 또 묻힌다). */
.rmg-mc-cell.sel::after { content: ""; position: absolute; inset: 10%; border-radius: var(--r-sm); background: var(--ink); z-index: -1; animation: rmg-mc-pick 0.2s cubic-bezier(0.22,1,0.36,1) both; }
@keyframes rmg-mc-pick { from { transform: scale(0.86); } to { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .rmg-mc-cell.sel::after { animation: none; } }
.rmg-mc.big .rmg-mc-cell.sel::after { border-radius: var(--r); }
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
.rmg-mc.big .rmg-mc-head { margin-bottom: var(--sp-2); }
/* 칸을 아주 살짝 가로로 눕힌다 — 넓힌 행 간격(8px)만큼 세로를 돌려주어
   달력이 길어져 '다가오는 순간'을 화면 밖으로 밀어내지 않게. 정사각과 구분되지 않을 정도. */
/* 칸이 가로로 넓어진 만큼 세로는 눕힌다 — 안 그러면 달력이 길어져 하단(다가오는 순간)이 캡처바에 잠긴다.
   숫자는 늘 칸 한가운데라 3:2 비율에서도 눌려 보이지 않는다. */
.rmg-mc.big .rmg-mc-cell { aspect-ratio: 1.5; font-size: 1.02rem; border-radius: var(--r); }
.rmg-mc.big .rmg-mc-wd span { font-size: 0.82rem; padding: var(--sp-1) 0; }
/* 열 간격은 요일 행과 같아야 격자가 맞고, 행 간격만 넓혀 날짜가 눌려 보이지 않게 한다. */
.rmg-mc.big .rmg-mc-wd { column-gap: 6px; }
.rmg-mc.big .rmg-mc-grid { column-gap: 6px; row-gap: var(--sp-1); }
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
/* 본문 컬럼 — 가로 패딩을 두지 않는다. 폭 자체가 기준선이라야 시계·문양이 같은 선에 설 수 있다.
   세로로는 남는 공간을 위아래로 나눠 갖는다(safe center) — 위에만 쌓이고 아래가 텅 비지 않게.
   'safe' 는 콘텐츠가 화면보다 길 때 위가 잘려 스크롤로도 못 보는 사고를 막는다. */
.rmg-flow { position: relative; z-index: 2; width: min(var(--measure), calc(100% - 2 * var(--gutter))); min-height: 100%; display: flex; flex-direction: column; justify-content: safe center; gap: var(--flow-gap); padding: var(--flow-top) 0 var(--flow-bottom);
  transition: opacity 0.34s cubic-bezier(0.22,1,0.36,1), transform 0.34s cubic-bezier(0.22,1,0.36,1); will-change: opacity, transform; }
/* 탭 전환: 이전 뷰가 아래로 살짝 가라앉으며 사라진 뒤, 새 뷰가 rmg-a* 로 떠오른다 */
.rmg-flow.flow-exit { opacity: 0; transform: translateY(-6px); }

/* HERO */
.rmg-hero { display: flex; flex-direction: column; }
.rmg-greet { margin: 0; font-size: clamp(2.4rem, 6vw, 3.6rem); font-weight: 300; letter-spacing: -0.035em; line-height: 1.02; color: var(--ink); }
.rmg-date { margin: var(--sp-2) 0 0; font-size: 0.92rem; font-weight: 500; letter-spacing: 0.01em; color: var(--muted); font-variant-numeric: tabular-nums; animation: rmg-fade 0.5s ease both; }
.rmg-mood { margin: var(--sp-2) 0 0; font-size: clamp(1.1rem, 2.6vw, 1.4rem); font-weight: 300; letter-spacing: -0.015em; color: var(--muted); }
.rmg-env-line { margin: var(--sp-3) 0 0; display: inline-flex; align-items: center; gap: var(--sp-1); font-size: 0.9rem; font-weight: 400; color: var(--faint); }
.rmg-env-icon { width: 15px; height: 15px; stroke-width: 1.7; }
.rmg-counts { margin-top: var(--sp-5); display: flex; gap: var(--sp-6); }
.rmg-count { display: flex; flex-direction: column; gap: var(--sp-1); }
.rmg-count-n { font-size: 1.75rem; font-weight: 300; color: var(--ink); letter-spacing: -0.02em; line-height: 1; font-variant-numeric: tabular-nums; }
.rmg-count-l { font-size: 0.74rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }

/* CONTEXT (큐레이션) */
/* 세 줄이 하나의 정보 덩어리 — 줄 사이를 넓혀 숨 쉬게 하되 묶임은 유지한다. */
.rmg-ctx-line { display: grid; grid-template-columns: 6.5em 1fr; gap: var(--sp-3); align-items: baseline; padding: var(--sp-3) 0; border-top: 1px solid var(--hair); }
.rmg-ctx-line:first-of-type { border-top: 0; padding-top: var(--sp-1); }
.rmg-ctx-k { font-size: 0.8rem; font-weight: 500; letter-spacing: 0.02em; color: var(--faint); }
.rmg-ctx-v { font-size: 1.06rem; font-weight: 300; letter-spacing: -0.01em; color: var(--ink); line-height: 1.5; }
.rmg-ctx-v em { font-family: inherit; font-variant-numeric: proportional-nums; font-feature-settings: "tnum" 0; font-style: normal; font-weight: 450; letter-spacing: -0.01em; color: var(--muted); }
.rmg-ctx-reflect { color: var(--muted); }


/* Ask Comein · 항상 보이는 주 입력 (문 + 명확한 필드 + 회전 예시) */
/* 캡처바는 캔버스 스크롤과 무관하게 항상 같은 자리에 있어야 한다.
   (absolute 였을 때는 스크롤 컨테이너의 '콘텐츠 바닥'에 붙어 목록 위로 겹쳐 올라왔다.)
   fixed + 레일 폭만큼 left 를 밀어 캔버스 기준으로 가운데. 레일이 열리면 같이 미끄러진다. */
.rmg-ask { position: fixed; bottom: var(--sp-4); left: var(--rail-w, 64px); right: 0; margin: 0 auto; z-index: 20;
  display: flex; align-items: center; gap: 12px;
  width: min(560px, var(--measure), calc(100% - 2 * var(--gutter)));
  padding: var(--sp-1) 12px var(--sp-1) var(--sp-2); border-radius: var(--r-lg);
  background: color-mix(in srgb, var(--surface) 84%, transparent); border: 1px solid var(--hair);
  backdrop-filter: blur(12px); box-shadow: 0 10px 30px -20px rgba(0,0,0,0.5);
  transition: border-color 0.3s, box-shadow 0.3s, left 280ms cubic-bezier(0.22, 1, 0.36, 1); }
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
/* 타임라인 — 시간(좌) · 커넥터 · 동작 설명 · 액션(우) */
.rmg-empty { margin: 0; font-size: 0.92rem; font-weight: 300; color: var(--muted); line-height: 1.7; }
.rmg-empty b { color: var(--ink); font-weight: 500; }
.rmg-kbd { font-family: ui-monospace, "SF Mono", monospace; font-size: 0.78rem; font-weight: 600; color: var(--ink); background: var(--surface); border: 1px solid var(--hair); border-radius: 6px; padding: 1px 6px; }

/* facet 리스트 + 컨텍스트 AI */
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

/* 공통 · 기능 헤더 · AI 귀속 태그 */
.rmg-feat-head { margin-bottom: var(--sp-2); }
.rmg-feat-title { margin: 0; font-size: clamp(1.5rem, 3vw, 1.9rem); font-weight: 400; letter-spacing: -0.03em; color: var(--ink); }
.rmg-tag-ai { display: inline-grid; place-items: center; width: 14px; color: var(--muted); flex-shrink: 0; }
.rmg-tag-door { width: 11px; height: 14px; }

/* Calendar 뷰 · 월(月) → 일(日) */
/* 달(月) ↔ 하루(시간표) 전환은 툭 갈아끼우지 않고 한 호흡으로 떠오른다. */
.rmg-cv { display: flex; flex-direction: column; gap: var(--sp-3); animation: rmg-cv-in 0.26s cubic-bezier(0.22,1,0.36,1) both; }
@keyframes rmg-cv-in { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .rmg-cv { animation: none; } }
/* 달력 ‖ 24시간 원 — 링은 296px 고정, 남는 폭은 달력이 가진다.
   좁아지면 링이 아래로 내려가되 두 요소의 좌우 기준선은 그대로 유지된다. */
.rmg-cv-split { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: var(--ring-gap); align-items: start; }
/* 오른쪽 컬럼의 라벨은 왼쪽 '연·월' 헤더와 같은 높이의 칸을 차지한다 →
   두 라벨의 세로 중심이 맞고, 그 아래 요일 행과 링 상단도 같은 선에서 시작한다. */
.rmg-cv-col > .rmg-cv-eyebrow { display: flex; align-items: center; min-height: 30px; }
@media (max-width: 1000px) { .rmg-cv-split { grid-template-columns: minmax(0, 1fr); gap: var(--sp-4); } }
.rmg-cv-col { display: flex; flex-direction: column; gap: var(--sp-2); min-width: 0; }
.rmg-cv-eyebrow { margin: 0; font-size: 0.74rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); }
/* 일(日) 화면 — 달력 컬럼과 같은 폭을 쓴다. 월↔일을 오갈 때 좌우 기준선과 무게가 그대로다. */
.rmg-cv-head, .rmg-tt { max-width: 640px; }
.rmg-cv-head { display: flex; align-items: center; gap: var(--sp-2); }
.rmg-cv-back { display: inline-flex; align-items: center; gap: var(--sp-1); flex: 0 0 auto; height: 40px; padding: 0 var(--sp-2); border-radius: var(--r); border: 1px solid var(--hair); background: var(--surface); color: var(--muted); font: inherit; font-size: 0.84rem; cursor: pointer; transition: color 0.15s, border-color 0.15s; }
.rmg-cv-back:hover { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 22%, var(--hair)); }
.rmg-cv-title { flex: 1; text-align: center; margin: 0; font-weight: 300; font-size: 1.3rem; letter-spacing: -0.02em; color: var(--ink); }
.rmg-cv-spacer { flex: 0 0 auto; width: 40px; }
.rmg-cv-up { padding-top: var(--sp-2); border-top: 1px solid var(--hair); display: flex; flex-direction: column; gap: var(--sp-1); }
.rmg-cv-uplist { list-style: none; margin: 0; padding: 0; }
.rmg-cv-uprow { display: flex; align-items: baseline; gap: 12px; padding: 8px 0; cursor: pointer; border-radius: 6px; transition: background 0.15s ease; }
.rmg-cv-uprow:hover { background: color-mix(in srgb, var(--ink) 5%, transparent); }
.rmg-cv-uptime { min-width: 5.4em; font-variant-numeric: tabular-nums; font-size: 0.82rem; color: var(--muted); }
.rmg-cv-uptitle { font-size: 0.9rem; color: var(--ink); }
.rmg-cv-upempty { font-size: 0.86rem; color: var(--faint); padding: 4px 0; }

/* 오른쪽 컬럼 머리 — 선택한 날짜 라벨 + 시간표 진입(명시적 액션) */
/* 오른쪽 컬럼이 넓어져도 라벨·원·범례는 한 폭(--dial-w)으로 묶여 컬럼 가운데에 선다. */
.rmg-cv-ringhead { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); min-height: 30px; width: 100%; max-width: var(--dial-w); margin: 0 auto; }
.rmg-cv-ringhead .rmg-cv-eyebrow { min-height: 0; }
.rmg-cv-tolist { flex: 0 0 auto; border: 1px solid var(--hair); background: color-mix(in srgb, var(--surface) 55%, transparent); color: var(--muted); font: inherit; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.01em; padding: 5px 11px; border-radius: 999px; cursor: pointer; transition: color 0.2s, border-color 0.2s; }
.rmg-cv-tolist:hover { color: var(--ink); border-color: color-mix(in srgb, var(--accent) 40%, var(--hair)); }

/* 생활계획표 · 24시간 원 */
.rmg-dial { display: flex; flex-direction: column; align-items: stretch; gap: var(--sp-2); width: 100%; max-width: var(--dial-w); margin: 0 auto; }
.rmg-dial-stage { position: relative; align-self: center; width: 100%; }
.rmg-dial-svg { display: block; width: 100%; overflow: visible; }
/* 같은 뉴트럴 계열 안에서 농도만 한 단계씩 올린다 — 배경에 묻히지 않을 만큼만. */
.rmg-dial-ring { fill: none; stroke: color-mix(in srgb, var(--ink) 14%, var(--hair)); stroke-width: 1; }
.rmg-dial-tick { stroke: color-mix(in srgb, var(--ink) 10%, var(--hair)); stroke-width: 1; }
.rmg-dial-tick.major { stroke: color-mix(in srgb, var(--ink) 30%, var(--hair)); }
.rmg-dial-num { fill: var(--muted); font-size: 10px; font-weight: 500; text-anchor: middle; dominant-baseline: middle; font-variant-numeric: tabular-nums; }
/* 색이 아니라 농도로 가른다 — 인접한 구간끼리만 구별되면 충분하다. */
.rmg-dial-slice { fill: color-mix(in srgb, var(--accent) calc(30% - var(--step) * 8%), transparent); stroke: var(--paper); stroke-width: 1; cursor: pointer; transition: fill 0.2s, opacity 0.2s; }
.rmg-dial-slice:hover, .rmg-dial-slice.on { fill: color-mix(in srgb, var(--accent) 52%, transparent); }
/* 하나를 붙잡으면 나머지는 물러난다 — 지워지지는 않게. */
.rmg-dial-slice.dim { opacity: 0.45; }
.rmg-dial-slice.pending { fill: color-mix(in srgb, var(--accent) 12%, transparent); stroke-dasharray: 3 2; stroke: color-mix(in srgb, var(--accent) 55%, transparent); }
/* 종일 — 시간대가 없으니 바깥을 한 바퀴 두른다. */
.rmg-dial-allday { fill: none; stroke: color-mix(in srgb, var(--accent) 42%, transparent); stroke-width: 2.5; cursor: pointer; transition: stroke 0.2s; }
.rmg-dial-allday:hover, .rmg-dial-allday.on { stroke: color-mix(in srgb, var(--accent) 75%, transparent); }
/* 지금 바늘만 한 단계 더 또렷하게 — 눈이 먼저 닿아야 하는 하나.
   halo 는 일정 arc 위를 지날 때 바늘이 묻히지 않도록 깔아주는 배경색 밑선. */
.rmg-dial-hand-halo { stroke: var(--paper); stroke-width: 4; stroke-linecap: round; opacity: 0.85; }
.rmg-dial-hand { stroke: var(--ink); stroke-width: 1.7; stroke-linecap: round; }
.rmg-dial-hub { fill: var(--ink); }
.rmg-dial-empty { margin: 0; font-size: 0.86rem; color: var(--faint); }

/* 툴팁 — 구간 한가운데에 붙는 한 줄. 클릭하면 붙잡힌다(popover). */
.rmg-dial-tip { position: absolute; z-index: 3; transform: translate(-50%, -50%); pointer-events: none;
  display: flex; flex-direction: column; gap: 2px; white-space: nowrap;
  padding: 6px var(--sp-1); border: 1px solid var(--hair); border-radius: var(--r-sm);
  background: color-mix(in srgb, var(--surface) 96%, transparent); backdrop-filter: blur(6px);
  box-shadow: 0 6px 18px -12px rgba(0,0,0,0.5); animation: rmg-fade 0.14s ease both; }
.rmg-dial-tip.pinned { border-color: color-mix(in srgb, var(--accent) 40%, var(--hair)); }
.rmg-dial-tip-t { font-size: 0.8rem; font-weight: 500; color: var(--ink); }
.rmg-dial-tip-r { font-size: 0.72rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.rmg-dial-key { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-1); }
.rmg-dial-keyrow { display: flex; align-items: baseline; gap: var(--sp-1); cursor: pointer; border-radius: var(--r-sm); padding: 2px 4px; margin: 0 -4px; transition: background 0.15s; }
.rmg-dial-keyrow:hover, .rmg-dial-keyrow.on { background: color-mix(in srgb, var(--ink) 5%, transparent); }
.rmg-dial-chip { flex: 0 0 auto; width: 10px; height: 10px; border-radius: 3px; background: color-mix(in srgb, var(--accent) calc(30% - var(--step) * 8%), transparent); border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); }
.rmg-dial-chip.pending { border-style: dashed; }
.rmg-dial-chip.allday { border-radius: 50%; background: none; border-width: 2px; }
.rmg-dial-keytime { font-variant-numeric: tabular-nums; font-size: 0.78rem; color: var(--muted); min-width: 3.4em; }
.rmg-dial-keytitle { font-size: 0.86rem; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 타임테이블 · 시간이 아래로 흐르는 표 */
.rmg-tt { position: relative; }
.rmg-tt-rows { position: relative; }
.rmg-tt-row { display: flex; align-items: flex-start; gap: 12px; height: var(--row); border-top: 1px solid var(--hair); cursor: pointer; transition: background 0.15s ease; }
.rmg-tt-row:first-child { border-top: 0; }
.rmg-tt-row:hover { background: color-mix(in srgb, var(--ink) 4%, transparent); }
.rmg-tt-row.now { background: color-mix(in srgb, var(--accent) 9%, transparent); }
.rmg-tt-hour { flex: 0 0 3.6em; padding-top: 6px; font-variant-numeric: tabular-nums; font-size: 0.76rem; color: var(--faint); user-select: none; }
.rmg-tt-cell { flex: 1; min-width: 0; padding: 4px 8px 0 0; }
.rmg-tt-input { width: 100%; border: 0; background: none; font: inherit; font-size: 0.86rem; color: var(--ink); outline: none; padding: 2px 0; border-bottom: 1px solid var(--accent); }
.rmg-tt-input::placeholder { color: var(--faint); }
.rmg-tt-blocks { position: absolute; top: 0; left: calc(3.6em + 12px); right: 0; bottom: 0; pointer-events: none; }
.rmg-tt-block { position: absolute; left: 0; right: var(--sp-1); display: flex; align-items: center; gap: 6px; padding: 4px var(--sp-1); border-radius: var(--r-sm); overflow: hidden; pointer-events: auto; background: color-mix(in srgb, var(--accent) 16%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); }
.rmg-tt-block.pending { background: color-mix(in srgb, var(--accent) 8%, transparent); border-style: dashed; }
.rmg-tt-block-title { font-size: 0.82rem; font-weight: 500; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

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

/* People · 연락처 */
.rmg-ppl-list { list-style: none; margin: 0; padding: 0; }
.rmg-ppl { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--hair); }
.rmg-ppl:last-child { border-bottom: 0; }
.rmg-ppl-av { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: var(--surface); border: 1px solid var(--hair); font-size: 0.9rem; font-weight: 600; color: var(--muted); flex-shrink: 0; }
.rmg-ppl-txt { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.rmg-ppl-name { font-size: 1rem; font-weight: 400; color: var(--ink); letter-spacing: -0.01em; }
.rmg-ppl-org { font-size: 0.8rem; font-weight: 300; color: var(--faint); }

/* Workspace Status — 우상단 세로 스택(시간 · 알림 · 문 · 상태문구). 시스템 시계가 아니라 '오늘의 상태' 공간. */
/* 시계·알림 — 본문 컬럼의 오른쪽 기준선에 맞춰 선다(캔버스 가장자리가 아니라). */
.rmg-status { position: absolute; top: var(--sp-3); right: var(--edge); z-index: 8; display: flex; flex-direction: column; align-items: flex-end; text-align: right; gap: var(--sp-2); pointer-events: none; }
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
