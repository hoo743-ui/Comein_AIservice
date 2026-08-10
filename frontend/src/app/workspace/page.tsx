"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ArrowUp, CalendarDays, Cloud, CloudRain, CloudSnow,
  ChevronDown, LogOut, Search, Settings as SettingsIcon, Sparkles, Sun, Users, X,
} from "lucide-react";

import { useWorkspace, TEXT_SCALE_MAX, TEXT_SCALE_MIN } from "@/lib/store";
import { fmtTime, fmtDate } from "@/lib/format";
// 백엔드 주소는 환경변수로 — 배포(Vercel)에서 localhost 를 부르면 안 된다.
import { API_BASE } from "@/lib/api";
import { useRemoteSync, type RemoteState } from "@/lib/useRemoteSync";
import { signInWithEmail, signInWithPassword, signInWithProvider, signOutRemote, signUpWithPassword } from "@/lib/remote";
import type { ChatMessage, Contact, EventParticipant, Schedule, ScheduleProposal, TodoPriority } from "@/lib/types";
import { ME_ID } from "@/lib/types";

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
type Parsed = { title: string; kind: Kind; time: string | null; date?: Date; note: string; priority?: TodoPriority; participants?: string[] };
// 할 일 뷰를 걷어냈으므로 시간 밖의 일은 '오늘'로 모인다 — 오늘 화면의 할 일 수에 그대로 반영된다.
const DEST: Record<Kind, { view: View; label: string }> = {
  일정: { view: "calendar", label: "캘린더" },
  "할 일": { view: "today", label: "오늘" },
};
const VIEW_LABEL: Record<View, string> = { today: "오늘", calendar: "캘린더", people: "사람" };

/** 레일 한 줄의 규격 — 행 높이와 행 사이 간격. CSS 토큰(--nav-row/--nav-gap)과
 *  활성 인디케이터의 이동 거리가 모두 이 두 숫자에서 나온다(어긋날 수 없게).
 *  인디케이터 위치를 px 로 직접 계산하는 이유: transform 값이 var() 안에서만 바뀌면
 *  브라우저가 재계산을 건너뛰어 표식이 이전 칸에 남는다. */
const NAV_ROW = 40;
const NAV_GAP = 4;
const NAV_STEP = NAV_ROW + NAV_GAP;
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

  // 회의에 부른 사람들 — AI 가 "이하늘이랑 회의" 에서 이름을 뽑아 준다.
  const participants = Array.isArray(it.participants)
    ? (it.participants as unknown[]).map((p) => str(p)).filter((p): p is string => !!p)
    : [];

  return {
    title,
    kind,
    time,
    date,
    participants,
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
  // 공유 일정 — 하나의 일정이 캘린더·24시간 원·사람·대화에서 같은 데이터로 쓰인다.
  const eventParticipants = useWorkspace((s) => s.eventParticipants);
  const chatMessages = useWorkspace((s) => s.chatMessages);
  const chatRooms = useWorkspace((s) => s.chatRooms);
  // 읽지 않은 말 — 방마다 몇 개가 쌓였는가.
  const unread = useWorkspace((s) => s.unread);
  const bumpUnread = useWorkspace((s) => s.bumpUnread);
  const markRoomRead = useWorkspace((s) => s.markRoomRead);
  const sharedEventsWith = useWorkspace((s) => s.sharedEventsWith);
  const participantsOf = useWorkspace((s) => s.participantsOf);
  // 사람 찾기·잇기 — 지어낸 이름이 아니라 실재하는 Comein 계정을 고른다.
  const findPeople = useWorkspace((s) => s.findPeople);
  const connectPerson = useWorkspace((s) => s.connectPerson);
  const sendEventMessage = useWorkspace((s) => s.sendEventMessage);
  const sendDirectMessage = useWorkspace((s) => s.sendDirectMessage);
  const setParticipantStatus = useWorkspace((s) => s.setParticipantStatus);
  const rebaseSeeds = useWorkspace((s) => s.rebaseSeeds);
  const addParticipant = useWorkspace((s) => s.addParticipant);
  const removeParticipant = useWorkspace((s) => s.removeParticipant);
  const settings = useWorkspace((s) => s.settings);
  const updateSettings = useWorkspace((s) => s.updateSettings);
  const lang: Lang = settings.language;
  const t = L(lang);

  const [mounted, setMounted] = React.useState(false);
  const [now, setNow] = React.useState<Date | null>(null);
  const [view, setView] = React.useState<View>("today");
  const [shownView, setShownView] = React.useState<View>("today"); // 실제 렌더 중인 뷰 — 전환 시 이전 뷰를 잠깐 더 붙잡아 크로스페이드
  const [flowExit, setFlowExit] = React.useState(false); // 탭 전환: 이전 내용 페이드아웃 단계
  const [switched, setSwitched] = React.useState(false); // 탭을 한 번이라도 옮겼는가 — 첫 입장의 여유로운 등장은 그때만의 것이다
  const [personId, setPersonId] = React.useState<string | null>(null); // People 에서 펼쳐 본 사람
  const [openEventId, setOpenEventId] = React.useState<string | null>(null); // 일정 상세 + 대화 (Drawer)
  const [chatFocus, setChatFocus] = React.useState(false); // '대화'로 들어왔으면 입력에 바로 커서를 둔다
  const [personTab, setPersonTab] = React.useState<"chat" | "events">("chat"); // 사람 패널: 둘만의 대화 / 함께하는 일정
  const [peopleQuery, setPeopleQuery] = React.useState("");
  const [newRoom, setNewRoom] = React.useState(false); // 여러 명과 함께할 자리 만들기
  // AI 가 되묻는 한 줄 — 확신이 없으면 멋대로 만들지 않고 물어본다.
  const [ask, setAsk] = React.useState<{ text: string; dest?: View } | null>(null);
  const [receipts, setReceipts] = React.useState<Receipt[]>([]);
  // 방금 정리한 한 건 — 목록으로 쌓지 않고 잠깐 스쳤다 사라진다(자취는 목적지 뷰에 남는다).
  const [flash, setFlash] = React.useState<{ text: string; dest: View | null; ids: number[] } | null>(null);
  const [flashOut, setFlashOut] = React.useState(false);
  const [organizing, setOrganizing] = React.useState(false);
  const [weather, setWeather] = React.useState<{ temp: number; condition: string } | null>(null);
  const [calDay, setCalDay] = React.useState<Date | null>(null);
  const [panel, setPanel] = React.useState<null | "calendar" | "settings">(null);
  // 오늘 화면 오른쪽의 문 — 누르면 열리는 연출이 한 번 재생된 뒤 그 자리에 안내가 펼쳐진다.
  const [guideOpen, setGuideOpen] = React.useState(false);
  const [doorOpening, setDoorOpening] = React.useState(false);
  const [tourStep, setTourStep] = React.useState<number | null>(null); // 진행 중인 가이드 단계
  const [firstVisit, setFirstVisit] = React.useState(false);           // 처음이면 문에 아주 작은 표식만
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
    const t = setTimeout(() => { setShownView(view); setFlowExit(false); setSwitched(true); }, 170);
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
    const today = new Date();
    setNow(today);
    setCalDay(today);
    // 시드 데모 데이터를 오늘 기준으로 옮긴다 — 여기서(마운트 후) 해야 서버·브라우저가 같은 것을 그린다.
    rebaseSeeds(today);
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
    // 영수증은 '방금 한 일'을 한 줄 스치게 하는 용도일 뿐, 캘린더에 얹지 않는다.
    // 시각이 있는 항목은 이미 진짜 일정(addSchedule)으로 서 있어서 얹으면 같은 게 두 번 보인다.
    return arr;
  }, [schedules, receipts, now]);
  const dayItems = React.useMemo(() => {
    if (!calDay) return [];
    const k = `${calDay.getFullYear()}-${calDay.getMonth()}-${calDay.getDate()}`;
    return calItems
      .filter((i) => `${i.date.getFullYear()}-${i.date.getMonth()}-${i.date.getDate()}` === k)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [calItems, calDay]);

  /** 달력에서 손을 올린 날의 일정 — 누르지 않고도 하루를 엿보게 한다. */
  const peekDay = React.useCallback((d: Date) => {
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return calItems
      .filter((i) => `${i.date.getFullYear()}-${i.date.getMonth()}-${i.date.getDate()}` === k)
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((i) => ({ time: i.time, title: i.title }));
  }, [calItems]);

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

      // ── 말 한 줄이 실제 일정과 대화방이 된다 ──
      // 여기까지 오면 화면에 '스침'만 남기고 끝났었다. 이제 시각이 있는 건 진짜 일정으로 세우고,
      // AI 가 뽑아 준 이름을 아는 사람과 맞춰 참여자로 부른다 → 그 일정의 방이 함께 생긴다.
      const unknownNames: string[] = [];
      for (const p of parsed) {
        if (p.kind !== "일정" || !p.date) continue;
        const eventId = addSchedule({
          title: p.title,
          start: p.date.toISOString(),
          end: new Date(+p.date + 3_600_000).toISOString(),
          location: p.note || undefined,
          status: "confirmed",
        });
        for (const name of p.participants ?? []) {
          // 이름은 사람이 부르는 방식이라 정확히 안 맞는다 — 부분 일치까지 받아준다.
          const key = name.replace(/\s|님/g, "").toLowerCase();
          const hit = contacts.find((c: any) => {
            const n = String(c.name ?? "").replace(/\s|님/g, "").toLowerCase();
            return n === key || n.includes(key) || key.includes(n);
          });
          if (hit) addParticipant(eventId, hit.id);
          else unknownNames.push(name);
        }
      }

      // 모르는 이름이 있으면 조용히 되묻는다 — 멋대로 새 사람을 만들지 않는다.
      if (unknownNames.length) {
        setAsk({
          text: lang === "en"
            ? `I don't know ${unknownNames.join(", ")} yet. Add them to People first?`
            : `${unknownNames.join(", ")}님은 아직 모르는 사람이에요. 사람 탭에 먼저 추가할까요?`,
          dest: "people",
        });
      }

      // 영속화는 이제 스토어가 Supabase 로 직접 한다(addSchedule → pushEvent).
      // 예전의 백엔드 경유 저장(/api/items)은 같은 것을 두 번 쓰게 되어 걷어냈다.
    } catch (err) {
      // 백엔드가 자거나 죽어도 입력은 삼키지 않는다 — 로컬 규칙으로라도 정리한다.
      console.error("AI 파싱 실패 → 로컬 폴백:", err);
      showFlash(file([{ title: t, kind: classify(t), time: parseTime(t), note: "" }]));
    } finally {
      ignite();
    }
  };

  const undoReceipt = (id: number) => setReceipts((prev) => prev.filter((r) => r.id !== id));

  // 일정 하나가 곧 하나의 Context — 캘린더에서 눌러도, 사람에서 눌러도 같은 서랍이 열린다.
  const openEvent = React.useCallback((eventId: string, chat = false) => {
    setOpenEventId(eventId);
    setChatFocus(chat);
  }, []);
  const closeEvent = React.useCallback(() => { setOpenEventId(null); setChatFocus(false); }, []);
  // 사람을 바꾸면 일정 방에서 빠져나온다 — 다른 사람의 화면에 이전 사람의 방이 남아 있으면 헷갈린다.
  const selectPerson = React.useCallback((id: string | null) => {
    setPersonId(id);
    setOpenEventId(null);
    setPersonTab("chat");
  }, []);

  // 서버와의 연결 — 한 번만 건다(자식에서 또 걸면 Realtime 소켓이 두 개 열린다).
  // 새 말이 들어오면: 지금 보고 있는 방이면 그냥 화면에 얹히고(이미 보였다),
  // 다른 방이면 세어 둔다. 큰 팝업으로 가로막지 않는다 — 표식 하나면 충분하다.
  const remote = useRemoteSync({
    onIncoming: (m) => {
      if (m.senderId === ME_ID) return;
      const openRoomId = openEventId ? chatRooms.find((r) => r.eventId === openEventId)?.id : null;
      const openDmId = personId ? chatRooms.find((r) => r.peerId === personId)?.id : null;
      if (m.roomId === openRoomId || m.roomId === openDmId) return;
      bumpUnread(m.roomId);
    },
  });

  // 방을 열면 그 방의 셈은 지운다. 열어 둔 채로 말이 와도 마찬가지다.
  React.useEffect(() => {
    const ids = [
      openEventId ? chatRooms.find((r) => r.eventId === openEventId)?.id : null,
      personId ? chatRooms.find((r) => r.peerId === personId)?.id : null,
    ].filter(Boolean) as string[];
    for (const id of ids) markRoomRead(id);
  }, [openEventId, personId, chatRooms, chatMessages.length, markRoomRead]);

  /** 그 사람과 관련된 읽지 않은 말의 수 — 둘만의 방 + 함께 있는 일정의 방을 합친다.
   *  사람 탭에서는 '이 사람에게 무언가 와 있다'만 알면 되므로 방을 따로 세지 않는다. */
  const unreadOf = React.useCallback((personId: string) => {
    let n = 0;
    for (const r of chatRooms) {
      const c = unread[r.id] ?? 0;
      if (!c) continue;
      if (r.peerId === personId) { n += c; continue; }
      if (r.eventId && eventParticipants.some((p) => p.eventId === r.eventId && p.userId === personId)) n += c;
    }
    return n;
  }, [chatRooms, unread, eventParticipants]);

  const unreadTotal = React.useMemo(
    () => Object.values(unread).reduce((a, b) => a + b, 0),
    [unread],
  );
  // 나가는 중 — 로그아웃과 화면 전환이 겹치지 않게 잡아 두는 빗장.
  // (위쪽 leaving 은 '들어올 때 문이 열리는' 연출이라 뜻이 다르다. 같은 이름을 쓰지 않는다.)
  const [exiting, setExiting] = React.useState(false);

  // 연결이 켜져 있는데 로그인하지 않았다면 문 앞으로 돌려보낸다.
  // ready 를 기다리는 이유: 세션 확인 전에 단정하면 이미 들어와 있는 사람까지 쫓아낸다.
  // exiting 을 빼 두는 이유: 나가는 사람은 세션이 풀리는 순간 이 가드에도 걸려 /enter 로
  // 끌려간다 — 나가려는 곳과 가드가 미는 곳이 달라 화면이 두 번 바뀐다.
  React.useEffect(() => {
    if (exiting) return;
    if (remote.configured && remote.ready && !remote.signedIn) router.replace("/enter");
  }, [exiting, remote.configured, remote.ready, remote.signedIn, router]);

  /** 나가기 — 묻지 않고 그냥 나간다.
   *  "정말 나가시겠어요?" 를 한 겹 세우면 나가는 일이 결심이 된다. 다시 들어오면 되는 일이다.
   *  세션을 먼저 끊고 그 다음에 한 번만 옮긴다(끊기 전에 옮기면 로그아웃이 도중에 잘린다). */
  const exitWorkspace = React.useCallback(() => {
    if (exiting) return;
    setExiting(true);
    // 문턱 연출은 들어올 때의 것이다 — 나갈 때 남겨 두면 다음에 들어올 때 재생되지 않는다.
    try { sessionStorage.removeItem("comein:reimagine"); } catch { /* 사생활 모드 */ }
    void signOutRemote().finally(() => router.replace("/"));
  }, [exiting, router]);

  // 처음 온 사람에게만 문 옆에 작은 표식 하나. 가이드를 강제로 재생하지는 않는다.
  React.useEffect(() => {
    try { setFirstVisit(localStorage.getItem("comein_onboarding_completed") !== "true"); } catch { /* 사파리 사생활 모드 등 */ }
  }, []);

  // 탭을 옮기면 오른쪽 칸은 그 화면의 것만 남는다.
  // (캘린더에서 연 일정이 '오늘'·'사람' 화면까지 따라다니면 지금 어디를 보는지 흐려진다.)
  React.useEffect(() => {
    setOpenEventId(null);
    setChatFocus(false);
    setNewRoom(false);
    if (shownView !== "people") setPersonId(null);
  }, [shownView]);

  const endTour = React.useCallback((completed: boolean) => {
    setTourStep(null);
    // 가이드는 여러 화면을 거쳐 간다 — 끝나면 처음 자리(오늘)로 돌려놓는다.
    setPanel(null);
    setView("today");
    if (!completed) return;
    setFirstVisit(false);
    try { localStorage.setItem("comein_onboarding_completed", "true"); } catch { /* 저장 못 해도 흐름은 막지 않는다 */ }
  }, []);

  // ── 대화에서 시간이 정해지는 길 ──
  const proposals = useWorkspace((s) => s.proposals);
  const loadProposal = useWorkspace((s) => s.loadProposal);
  const proposeTime = useWorkspace((s) => s.proposeTime);
  const answerProposal = useWorkspace((s) => s.answerProposal);
  const [proposalBusy, setProposalBusy] = React.useState(false);

  // 일정을 열면 그 일정에 답을 기다리는 제안이 있는지 확인한다.
  React.useEffect(() => {
    if (openEventId) void loadProposal(openEventId);
  }, [openEventId, loadProposal]);

  /** 일정 대화에 말을 얹는다. 그 말에 시각이 들어 있으면 AI 가 후보를 내놓는다.
   *  말은 먼저 올라가고 제안은 뒤따른다 — AI 를 기다리느라 대화가 멈추지는 않는다.
   *  시각이 없으면 아무 일도 일어나지 않는다. 지어내서 제안하지 않는다. */
  const sendEventMessageAndMaybePropose = React.useCallback((eventId: string, text: string) => {
    sendEventMessage(eventId, text);
    if (!remote.signedIn) return;
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const items: unknown[] = Array.isArray(data?.items) ? data.items : [];
        // 시각이 잡힌 것만 후보로 삼는다.
        for (const raw of items) {
          const p = toParsed(raw, text);
          if (p.kind !== "일정" || !p.date) continue;
          setProposalBusy(true);
          await proposeTime(eventId, p.date, 60, p.title);
          setProposalBusy(false);
          return;
        }
      } catch { /* AI 가 닿지 않아도 대화는 그대로 남는다 */ }
    })();
  }, [sendEventMessage, proposeTime, remote.signedIn]);

  // ── 대화 요약 ──
  // 말이 쌓이면 뒤늦게 들어온 사람이 처음부터 읽어야 한다. 그걸 대신 읽어 준다.
  // 자동으로 계속 고쳐 쓰지는 않는다 — 요약이 스스로 움직이면 대화를 방해한다.
  const [summaries, setSummaries] = React.useState<Record<string, string>>({});
  const [summaryBusy, setSummaryBusy] = React.useState(false);

  const summarizeEvent = React.useCallback(async (eventId: string) => {
    const st = useWorkspace.getState();
    const ev = st.schedules.find((s) => s.id === eventId);
    const msgs = st.messagesOf(eventId);
    if (msgs.length === 0) return;
    const nameOf = (uid: string) =>
      uid === ME_ID ? (st.settings.name || "나") : (st.contacts.find((c) => c.id === uid)?.name ?? "누군가");
    // 뒤쪽 40 개만 넘긴다 — 오래된 말까지 다 보내면 요약이 지금 이야기를 놓친다.
    const transcript = msgs.slice(-40).map((m) => `${nameOf(m.senderId)}: ${m.content}`).join("\n");

    setSummaryBusy(true);
    try {
      // /api/chat 이 아니라 /api/summary 다. 그쪽은 한 마디를 항목으로 가르는 파서라
      // 대화를 통째로 넣으면 요약 대신 "N건을 정리했어요" 가 돌아온다(실제로 그랬다).
      const res = await fetch(`${API_BASE}/api/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, title: ev?.title ?? null, lang: st.settings.language }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const lines: string[] = Array.isArray(data?.lines) ? data.lines.filter((l: unknown) => typeof l === "string" && l.trim()) : [];
      if (lines.length) setSummaries((m) => ({ ...m, [eventId]: lines.join("\n") }));
    } catch { /* 닿지 않으면 조용히 둔다 — 요약은 없어도 대화는 그대로다 */ }
    finally { setSummaryBusy(false); }
  }, []);

  /** 문을 연다 — 문짝이 열리는 동안 기다렸다가 가이드를 시작한다.
   *  문과 미리보기 카드가 같은 자리를 여는 것이므로 손잡이도 하나만 둔다. */
  const openGuideDoor = React.useCallback(() => {
    if (doorOpening) return;
    setDoorOpening(true);
    window.setTimeout(() => { setTourStep(0); setDoorOpening(false); }, 520);
  }, [doorOpening]);

  const person = personId ? contacts.find((c: any) => c.id === personId) ?? null : null;
  /** 방 id 는 반드시 방 목록에서 찾는다.
   *  `dm_${peerId}` · `room_${eventId}` 는 서버가 없을 때 스토어가 붙이는 임시 이름일 뿐이고,
   *  서버에 붙으면 진짜 uuid 로 바뀐다. 규칙을 화면에서 다시 지어내면 서버에서 온 말이
   *  영영 안 맞는다 — 실제로 그랬다(대화는 저장돼 있는데 화면에는 "아직 대화가 없어요").
   *  fallback 을 남기는 이유: 로그인 전에는 여전히 임시 이름으로 도는 방이 있다. */
  const roomIdOfPeer = React.useCallback(
    (pid: string) => chatRooms.find((r) => r.peerId === pid)?.id ?? `dm_${pid}`,
    [chatRooms],
  );
  const roomIdOfEvent = React.useCallback(
    (eid: string) => chatRooms.find((r) => r.eventId === eid)?.id ?? `room_${eid}`,
    [chatRooms],
  );

  const personMsgs = React.useMemo(() => {
    if (!personId) return [];
    const rid = roomIdOfPeer(personId);
    return chatMessages
      .filter((m) => m.roomId === rid)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  }, [chatMessages, personId, roomIdOfPeer]);
  const personEvents = personId ? sharedEventsWith(personId) : [];

  const openEventData = openEventId ? schedules.find((s) => s.id === openEventId) ?? null : null;
  const openEventParts = openEventId ? eventParticipants.filter((p) => p.eventId === openEventId) : [];
  // 메시지는 스토어의 chatMessages 를 직접 읽어 파생시킨다 — 화면이 따로 사본을 갖지 않는다.
  const openEventMsgs = React.useMemo(() => {
    if (!openEventId) return [];
    const rid = roomIdOfEvent(openEventId);
    return chatMessages
      .filter((m) => m.roomId === rid)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  }, [chatMessages, openEventId, roomIdOfEvent]);

  // 타임테이블에서 직접 적어 넣은 한 줄 — 캡처바를 거치지 않는 유일한 입력이라 AI 표식을 달지 않는다.
  const addScheduleAt = React.useCallback((title: string, start: Date) => {
    addSchedule({ title, start: start.toISOString(), end: new Date(+start + 3_600_000).toISOString(), status: "confirmed" });
    ignite();
  }, [addSchedule]);

  /** 여러 사람이 함께할 자리를 새로 만든다 — 일정이 생기면 그 일정의 방도 함께 생긴다.
   *  Comein 에서 '채팅방을 판다' 는 곧 '함께할 자리를 잡는다' 는 뜻이다. */
  const createEventWith = React.useCallback((peerIds: string[], title: string, start: Date) => {
    const id = addSchedule({
      title,
      start: start.toISOString(),
      end: new Date(+start + 3_600_000).toISOString(),
      status: "confirmed",
    });
    for (const p of peerIds) addParticipant(id, p);
    setNewRoom(false);
    setOpenEventId(id);
    setChatFocus(true);
    ignite();
  }, [addSchedule, addParticipant]);

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

  /** 오늘의 브리핑 — 날씨만 보고 말하지 않는다. 실제 일정을 읽고 먼저 알려준다.
   *  붙어 있는 회의, 답하지 않은 초대, 곧 시작하는 일 — 사용자가 묻기 전에 말해 주는 것들. */
  const briefing = React.useMemo(() => {
    const en = lang === "en";
    if (!now) return "";
    const todays = schedules
      .map((s: any) => ({ ...s, at: new Date(s.start) }))
      .filter((s) => !Number.isNaN(+s.at) && dayKey(s.at) === dayKey(now))
      .sort((a, b) => +a.at - +b.at);

    // 1) 아직 답하지 않은 초대가 있으면 그게 가장 먼저 할 일이다.
    const pendingInvite = eventParticipants.find(
      (p) => p.userId === ME_ID && p.status === "invited" && schedules.some((s: any) => s.id === p.eventId),
    );
    if (pendingInvite) {
      const ev = schedules.find((s: any) => s.id === pendingInvite.eventId);
      return en
        ? `You haven't answered "${ev?.title}" yet.`
        : `"${ev?.title}"에 아직 참석 여부를 답하지 않으셨어요.`;
    }

    // 2) 곧 시작하는 일
    const soon = todays.find((s) => +s.at > +now && +s.at - +now <= 60 * 60 * 1000);
    if (soon) {
      const mins = Math.max(1, Math.round((+soon.at - +now) / 60_000));
      return en ? `"${soon.title}" starts in ${mins} min.` : `"${soon.title}"까지 ${mins}분 남았어요.`;
    }

    // 3) 쉬는 틈 없이 붙어 있는 회의 — 미리 알면 사이를 벌릴 수 있다.
    for (let i = 1; i < todays.length; i++) {
      const prevEnd = todays[i - 1].end ? new Date(todays[i - 1].end) : new Date(+todays[i - 1].at + 3_600_000);
      const gap = (+todays[i].at - +prevEnd) / 60_000;
      if (gap >= 0 && gap < 15) {
        return en
          ? `"${todays[i - 1].title}" and "${todays[i].title}" are back to back — barely a breath between them.`
          : `"${todays[i - 1].title}"과 "${todays[i].title}"이 붙어 있어요. 사이에 숨 돌릴 틈이 거의 없네요.`;
      }
    }

    // 4) 남은 일정이 없으면 날씨 한 줄로 — 말할 게 없을 땐 조용한 게 낫다.
    const left = todays.filter((s) => +s.at > +now).length;
    if (left > 0) {
      return en ? `${left} more today. I'll keep the flow unbroken.` : `오늘 남은 일정 ${left}개예요. 흐름이 끊기지 않게 볼게요.`;
    }
    return t.reflect(weather?.condition ?? null);
  }, [now, schedules, eventParticipants, lang, weather, t]);

  // 예전 설정(md/lg/xl)이 남아 있어도 숫자로 받아 준다.
  const textScale = typeof settings.textScale === "number"
    ? settings.textScale
    : ({ md: 1, lg: 1.12, xl: 1.24 } as Record<string, number>)[settings.textScale as string] ?? 1;

  // ── 사용 가이드 여섯 걸음 ──
  // 각 단계는 진짜 화면을 짚는다. 필요한 화면으로 먼저 옮겨 두고 그 위의 요소를 가리킨다.
  const tourSteps = React.useMemo<TourStep[]>(() => {
    const en = lang === "en";
    // 공유 일정이 있는 사람을 하나 골라 둔다 — 5번째 걸음이 가리킬 대상.
    const withShared = contacts.find((c: any) => sharedEventsWith(c.id).length > 0);
    return [
      {
        key: "today", target: "today",
        title: en ? "Today" : "오늘",
        body: en ? "What you need today, and what's coming — in one place." : "오늘 해야 할 일과 지금 필요한 정보를 한곳에서 확인하세요.",
        example: en ? "e.g.  Up next · 14:00 Capstone review" : "예)  다가오는 순간 · 14:00 캡스톤 중간발표",
        before: () => { setPanel(null); setGuideOpen(false); setView("today"); },
      },
      {
        key: "calendar", target: "calendar",
        title: en ? "Calendar" : "캘린더",
        body: en ? "Pick a day to see its 24 hours and everything in it." : "날짜를 선택하면 그날의 24시간 흐름과 일정을 확인할 수 있어요.",
        example: en ? "Press a day once to look in, twice for its timetable." : "날짜를 한 번 누르면 들여다보고, 한 번 더 누르면 시간표로 들어갑니다.",
        before: () => setView("calendar"),
      },
      {
        key: "dial", target: "dial",
        title: en ? "24 hours" : "24시간 시간 지도",
        body: en ? "See where each event sits in the shape of your day." : "일정이 하루의 어느 시간에 놓여 있는지 한눈에 볼 수 있어요.",
        example: en ? "e.g.  15:00 Meeting fills the arc from 3 to 4." : "예)  15:00 회의는 원의 3시~4시 구간을 채웁니다.",
        before: () => setView("calendar"),
      },
      {
        key: "people", target: "people",
        title: en ? "People" : "사람",
        body: en ? "Share events with the people they belong to, and keep them in sync." : "연결된 사람들과 일정을 공유하고 함께 관리할 수 있어요.",
        example: en ? "Pick someone to see what you're doing together." : "사람을 고르면 그와 함께하는 일정이 오른쪽에 열립니다.",
        before: () => { setView("people"); selectPerson(null); },
      },
      {
        key: "shared", target: withShared ? "sharedevent" : "people",
        title: en ? "Talk inside the event" : "일정 안에서 대화",
        body: en ? "Everyone on an event shares its room — the conversation stays with the plan." : "같은 일정에 참여한 사람들과 그 일정 안에서 바로 대화할 수 있어요.",
        example: en ? "e.g.  Capstone review · 14:00 · 3 people → open the room" : "예)  캡스톤 중간발표 · 14:00 · 3명 → 그 일정의 대화방",
        before: () => {
          setView("people");
          if (withShared) { setPersonId(withShared.id); setOpenEventId(null); setPersonTab("events"); }
        },
      },
      {
        key: "capture", target: "capture",
        title: en ? "Just say it" : "말하면 됩니다",
        body: en ? "Type a line and Comein files it where it belongs." : "원하는 것을 그냥 한 줄로 적으면 Comein이 알아서 제자리에 놓습니다.",
        example: en
          ? "e.g.  \"Meet Prof. Kim at 3pm tomorrow\" → event + room"
          : "예)  \"내일 3시에 교수님 미팅 잡아줘\" → 일정 + 대화방까지 한 번에",
      },
    ];
  }, [lang, contacts, sharedEventsWith, selectPerson]);

  // ── 오른쪽 칸 ── 한 번에 하나만 놓인다.
  // 일정을 열었으면 그 일정, 아니면 고른 사람, 아니면 새 자리 만들기.
  // 캘린더에서도 서랍으로 띄우지 않고 같은 칸을 쓴다 — 화면마다 다른 방식으로 열리면 다른 앱처럼 보인다.
  const myName = settings.name || (lang === "en" ? "Me" : "나");
  const aside = (() => {
    // 설정은 이제 캔버스를 그대로 넘겨받는다(옆 칸이 아니라 하나의 화면).
    if (panel === "settings") {
      return (
        // 제목도 돌아가는 길도 이제 페이지 헤더가 갖는다 — 설정은 곁들이는 칸이 아니라
        // 하나의 화면이므로, 안에서 제목을 한 번 더 세우면 머리가 둘이 된다.
        <div className="rmg-evpanel rmg-setpanel">
          <div className="rmg-setpanel-body">
            <SettingsPanel
              settings={settings}
              onChange={updateSettings}
              theme={resolvedTheme}
              onTheme={(th) => setTheme(th)}
              mounted={mounted}
              lang={lang}
              onReplayGuide={() => { setPanel(null); setView("today"); setTourStep(0); }}
              remote={remote}
            />
          </div>
        </div>
      );
    }
    if (openEventData) {
      return (
        <EventPanel
          key={openEventData.id}
          variant="inline"
          event={openEventData}
          participants={openEventParts}
          contacts={contacts}
          messages={openEventMsgs}
          myName={myName}
          lang={lang}
          focusChat={chatFocus}
          proposal={proposals[openEventData.id] ?? null}
          proposalBusy={proposalBusy}
          summary={summaries[openEventData.id] ?? null}
          summaryBusy={summaryBusy}
          onSummarize={() => void summarizeEvent(openEventData.id)}
          onAnswerProposal={(r) => {
            const p = proposals[openEventData.id];
            if (!p) return;
            setProposalBusy(true);
            void answerProposal(openEventData.id, p.id, r).finally(() => setProposalBusy(false));
          }}
          onClose={closeEvent}
          onSend={(text) => sendEventMessageAndMaybePropose(openEventData.id, text)}
          onAddParticipant={(uid) => addParticipant(openEventData.id, uid)}
          onRemoveParticipant={(uid) => removeParticipant(openEventData.id, uid)}
          onRespond={(status) => setParticipantStatus(openEventData.id, ME_ID, status)}
          backLabel={shownView === "people" && person ? person.name : undefined}
          onBack={shownView === "people" && person ? () => { setOpenEventId(null); setPersonTab("events"); } : undefined}
        />
      );
    }
    // 오늘 — 오른쪽 자리에 문이 서 있다. 장식이 아니라 '처음 배우는 입구'다.
    // 누르면 문이 열리고, 그 뒤 진짜 화면 위에서 한 곳씩 짚어 주는 가이드가 시작된다.
    if (shownView === "today") {
      return (
        <div className="rmg-doorway-wrap">
          <button
            type="button"
            className={`rmg-doorway ${doorOpening ? "opening" : ""}`}
            onClick={openGuideDoor}
            aria-label={lang === "en" ? "Start the guide" : "사용 가이드 시작"}
          >
            <AiDoor active={doorOpening} className="rmg-doorway-door" />
            <span className="rmg-doorway-cta">{lang === "en" ? "Come in" : "들어오세요"}</span>
            {/* hover 에서만 드러나는 한 줄 — 평소엔 문이 조용히 서 있기만 한다. */}
            <span className="rmg-doorway-hint">{lang === "en" ? "See the guide →" : "사용 가이드 보기 →"}</span>
            {/* 처음 온 사람에게만 아주 작은 표식. 가이드를 강제로 재생하지는 않는다. */}
            {firstVisit && <span className="rmg-doorway-new" aria-hidden />}
          </button>

          {/* hover 미리보기 — SaaS 툴팁이 아니라 이 화면과 같은 언어로.
              '가이드 시작 →' 이라 적어 놓고 손이 닿으면 사라지던 것을 고친다:
              카드도 같은 문을 여는 자리다(보일 때만 눌린다). */}
          <div className="rmg-doorprev" onClick={openGuideDoor} role="presentation">
            <p className="rmg-doorprev-t">{lang === "en" ? "How Comein works" : "Comein 사용 가이드"}</p>
            <p className="rmg-doorprev-b">
              {lang === "en"
                ? "Pick a day, see its hours, and keep events with the people they belong to."
                : "날짜를 골라 하루의 흐름을 보고, 사람들과 일정을 함께 관리해보세요."}
            </p>
            <p className="rmg-doorprev-cta">{lang === "en" ? "Start the guide →" : "가이드 시작 →"}</p>
          </div>
        </div>
      );
    }
    if (shownView !== "people") return null;
    if (newRoom) {
      return <NewRoomPanel contacts={contacts} lang={lang} onClose={() => setNewRoom(false)} onCreate={createEventWith} />;
    }
    if (person) {
      return (
        <PersonPanel
          key={person.id}
          person={person}
          tab={personTab}
          onTab={setPersonTab}
          messages={personMsgs}
          sharedEvents={personEvents}
          participantsOf={participantsOf}
          myName={myName}
          lang={lang}
          focusChat={chatFocus}
          onClose={() => selectPerson(null)}
          onSend={(text) => sendDirectMessage(person.id, text)}
          onOpenEvent={(id) => openEvent(id, true)}
          onCreateEvent={(title, start) => createEventWith([person.id], title, start)}
        />
      );
    }
    return (
      <p className="rmg-aside-hint">
        {lang === "en" ? "Pick someone to see your conversation and the events you share." : "사람을 고르면 둘만의 대화와 함께하는 일정이 여기 열려요."}
      </p>
    );
  })();

  // 맥락 레일을 세울지 — 한 곳에서만 정한다.
  // 이 판단이 두 군데(격자 컬럼 수 · 레일 렌더)에 따로 적혀 있으면 반드시 어긋난다.
  // 실제로 어긋나 있었다: 설정을 열면 컬럼은 둘로 줄었는데 레일은 계속 그려져,
  // 자식 셋이 칸 둘에 들어가느라 설정 패널이 다음 줄로 떨어졌다.
  const showCtxRail = shownView !== "calendar" && panel !== "settings";

  // 첫 진입 → opening 으로 리디렉트 중엔 빈 배경만 (깜빡임 없이 넘어간다).
  // ★ 이 조기 반환은 반드시 모든 훅 아래에 둔다 — 위에 두면 렌더마다 훅 개수가 달라져
  //   React 가 "Rendered fewer hooks than expected"(#300) 로 화면을 통째로 떨어뜨린다.
  if (toOpening) {
    return (
      <div className="rmg" style={{ ["--rmg-fs" as string]: String(textScale), ["--nav-row" as string]: `${NAV_ROW}px`, ["--nav-gap" as string]: `${NAV_GAP}px` } as React.CSSProperties}>
        <style>{CSS}</style>
      </div>
    );
  }

  // 레일 활성 인디케이터 위치 — 캘린더 패널이면 캘린더 칸, 패널 없으면 현재 뷰 칸. 설정/가이드(패널)일 땐 숨김(위치는 마지막 뷰 유지 → 튐 없이 페이드).
  const navViewIndex = NAV.findIndex((n) => n.key === view);
  const navActive = panel === null ? navViewIndex : -1;
  const navIndPos = navActive >= 0 ? navActive : navViewIndex;

  return (
    <div className={`rmg ${railOpen || panel ? "rail-open" : ""} ${railIntro ? "rail-intro" : ""} ${panel ? "panel-open" : ""} view-${shownView}`} style={{ ["--rmg-fs" as string]: String(textScale), ["--nav-row" as string]: `${NAV_ROW}px`, ["--nav-gap" as string]: `${NAV_GAP}px` } as React.CSSProperties}>
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
          {/* 브랜드 마크 — 클릭 불가. 안내로 들어가는 문은 '오늘' 화면 오른쪽의 큰 문이다. */}
          <div className="rmg-rail-mark" aria-hidden>
            <AiDoor active={organizing} className="rmg-rail-door" />
            <span className="rmg-rail-word">Comein</span>
          </div>
          <nav className="rmg-rail-nav">
            {/* 위치는 인라인 transform 으로 직접 준다 — 커스텀 프로퍼티만 바뀌면
                브라우저가 transform 재계산을 건너뛰어 인디케이터가 한 칸 뒤처진다. */}
            <span
              className="rmg-rail-ind"
              aria-hidden
              data-hidden={navActive < 0}
              style={{ transform: `translateY(${navIndPos * NAV_STEP}px)` }}
            />
            {NAV.map((n, i) => {
              const on = panel === null && view === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => { setPanel(null); setView(n.key); }}
                  className={`rmg-railbtn ${on ? "on" : ""}`}
                  style={{ ["--i" as string]: i } as React.CSSProperties}
                  aria-label={t.viewLabel(n.key)}
                  data-tour={n.key}
                >
                  <n.icon className="rmg-railicon" />
                  <span className="rmg-raillabel">{t.viewLabel(n.key)}</span>
                  {/* 다른 화면에 있을 때만 — 사람 탭을 보고 있으면 목록이 이미 말해 준다.
                      숫자를 달지 않는다. 몇 개인지는 들어가서 알면 되고,
                      여기서 필요한 건 '무언가 와 있다' 하나뿐이다. */}
                  {n.key === "people" && unreadTotal > 0 && shownView !== "people" && (
                    <span className="rmg-raildot" aria-label={lang === "en" ? "New messages" : "새 메시지"} />
                  )}
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
            <button
              type="button"
              className="rmg-railbtn"
              aria-label={lang === "en" ? "Exit" : "나가기"}
              onClick={exitWorkspace}
              disabled={exiting}
            >
              <LogOut className="rmg-railicon" />
              <span className="rmg-raillabel">{lang === "en" ? "Exit" : "나가기"}</span>
            </button>
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

        {/* 최상단 — 비워 둔다. 상태 한 줄은 페이지 헤더와 브리핑이 이미 말하고 있어서
            같은 얘기를 작은 글씨로 한 번 더 할 이유가 없다. */}
        <header className="rmg-topbar" aria-hidden />

        {/* 우측 상단 시계는 걷어냈다 — 운영체제가 이미 시각을 알려주고 있고,
            날짜는 '오늘' 화면의 부제와 달력이 말한다. 같은 것을 세 번 말하지 않는다. */}

        {/* 하나의 작업면 — 세 화면이 같은 폭·같은 좌우 기준선 위에 선다.
            뷰마다 다른 건 이 안의 컬럼 구성뿐이고, 바깥 상자는 절대 움직이지 않는다. */}
        {/* 설정도 하나의 화면이다 — 옆에 곁들이는 칸이 아니라 캔버스를 그대로 넘겨받는다.
            key 에 함께 넣어 두면 탭을 옮길 때와 같은 크로스페이드로 들어오고 나간다. */}
        <div className={`rmg-flow ${flowExit ? "flow-exit" : ""} ${switched ? "switched" : ""}`} key={panel === "settings" ? "settings" : shownView}>

          {/* PAGE HEADER — 제목의 X·Y 는 모든 화면이 같다. 내용만 다르다. */}
          <header className="rmg-pagehead rmg-a1">
            {panel === "settings" ? (
              <>
                {/* 돌아갈 곳을 이름으로 말한다 — X 는 어디로 닫히는지 말해 주지 않는다. */}
                <button type="button" className="rmg-evback rmg-pageback" onClick={() => setPanel(null)}>
                  ‹ {t.viewLabel(shownView)}
                </button>
                <p className="rmg-pagetitle">{t.topSettings}</p>
                <p className="rmg-pagesub">
                  {lang === "en" ? "How this workspace behaves." : "이 워크스페이스가 움직이는 방식."}
                </p>
              </>
            ) : (
              <>
                {/* 세 화면 모두 탭 이름을 그대로 쓴다 — 여기만 인사말이 서면 '오늘'은
                    다른 규격의 화면처럼 보인다. 인사는 본문(A calm night.)이 이미 하고 있다. */}
                <p className="rmg-pagetitle">{t.viewLabel(shownView)}</p>
                {/* 부제는 '오늘'의 날짜뿐이다. 화면 이름을 한 번 더 풀어 쓰는 설명은 두지 않는다
                    — 제목이 이미 말한 것을 작은 글씨로 반복하는 자리가 된다. */}
                {shownView === "today" && <p className="rmg-pagesub">{mounted ? dateLine : ""}</p>}
              </>
            )}
          </header>

          {/* PAGE BODY — Context Rail + 본문 (+ 필요하면 오른쪽 칸).
              캘린더는 큰 달력이 레일 자리를 대신하므로 왼쪽 레일이 없다. */}
          <div className="rmg-pagebody" data-ctx={showCtxRail} data-aside={!!aside} data-settings={panel === "settings"}>

            {/* CONTEXT RAIL — Today·People 이 같은 규격으로 쓰는 시간 맥락.
                날짜를 누르면 그 날을 고른 채 캘린더로 건너간다 — 장식이 아니라 입구다. */}
            {showCtxRail && (
              <aside className="rmg-ctxrail rmg-a2" aria-label={t.topCalendar}>
                {mounted && calDay && now && (
                  <>
                    <MonthCalendar
                      base={now}
                      events={calItems.map((i) => i.date)}
                      selected={calDay}
                      onSelect={(d) => { setCalDay(d); setPanel(null); setView("calendar"); }}
                      lang={lang}
                      dayEventsOf={peekDay}
                    />
                    {/* 그날의 일정 목록은 Today 에서만. 사람 탭에서는 오른쪽 칸이
                        '그 사람과 함께하는 일정'을 말해주므로, 여기서 또 일정을 늘어놓으면
                        같은 얘기를 두 번 하는 셈이 된다(달력은 날짜 맥락으로만 남긴다). */}
                    {shownView === "today" && (
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
                    )}
                  </>
                )}
              </aside>
            )}

            <div className="rmg-pagemain rmg-a3">
              {shownView === "today" ? (
                <>
                  {/* HERO — 인사말은 페이지 헤더로 올라갔다. 여기 남는 건 오늘의 온도와 부피. */}
                  <section className="rmg-hero">
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
                  <section className="rmg-ctx">
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
                      <span className="rmg-ctx-v rmg-ctx-reflect">{briefing}</span>
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
                  personId={personId}
                  onSelectPerson={selectPerson}
                  sharedEventsWith={sharedEventsWith}
                  participantsOf={participantsOf}
                  onOpenEvent={openEvent}
                  query={peopleQuery}
                  onQuery={setPeopleQuery}
                  onNewRoom={() => { selectPerson(null); setNewRoom(true); }}
                  onFind={findPeople}
                  onConnect={connectPerson}
                  unreadOf={unreadOf}
                />
              )}
            </div>

            {/* 오른쪽 칸 — 고른 것의 속내가 여기 그대로 눕는다.
                떠 있는 서랍이 아니라 이 화면의 한 칸이라, 목록·시간표와 같이 보며 움직일 수 있다. */}
            {aside && <div className="rmg-pageaside">{aside}</div>}
          </div>

        </div>

        {/* 되묻기 — 확신이 없을 때만 한 줄. 스침과 달리 스스로 사라지지 않는다(사용자의 답을 기다린다). */}
        {!panel && ask && (
          <div className="rmg-ask-back" role="status" aria-live="polite">
            <AiDoor active className="rmg-flash-door" />
            <span className="rmg-flash-text">{ask.text}</span>
            {ask.dest && (
              <button type="button" className="rmg-flash-act" onClick={() => { setView(ask.dest!); setAsk(null); }}>
                {lang === "en" ? "Go" : "가기"}
              </button>
            )}
            <button type="button" className="rmg-flash-x" onClick={() => setAsk(null)} aria-label={lang === "en" ? "Dismiss" : "닫기"}>
              <X className="rmg-flash-xic" />
            </button>
          </div>
        )}

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

        {/* 전체 화면 란 — 이제 캘린더 하나만 남았다(설정은 오른쪽 칸으로 옮겼다). */}
        {panel === "calendar" && mounted && (
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
            </div>
          </section>
        )}
      </main>

      {/* 사용 가이드 — 화면을 덮지 않고 진짜 요소를 한 곳씩 짚는다 */}
      {tourStep !== null && mounted && (
        <GuideTour steps={tourSteps} index={tourStep} lang={lang} onIndex={setTourStep} onClose={endTour} />
      )}

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
    <form onSubmit={submit} className={`rmg-ask ${focused ? "focus" : ""}`} data-tour="capture">
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
  const ss = p(t.getSeconds());
  const dateStr = en
    ? t.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : `${t.getFullYear()}년 ${t.getMonth() + 1}월 ${t.getDate()}일`;
  const weekday = t.toLocaleDateString(en ? "en-US" : "ko-KR", { weekday: "long" });
  return (
    <div className="rmg-status-time-wrap">
      {/* 분이 바뀔 때만 페이드가 재생된다(key=hh:mm) — 초까지 키에 넣으면 1초마다 깜빡인다.
          초는 한 단계 작고 옅게 옆에 붙어, 시계가 살아 있다는 것만 조용히 알린다. */}
      <span key={hhmm} className="rmg-status-time" aria-label={hhmm}>
        {hhmm}<span className="rmg-status-sec">:{ss}</span>
      </span>
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

function MonthCalendar({ base, events, selected, onSelect, big = false, lang = "ko", focusDate, onSearch, dayEventsOf }: {
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
  personId: string | null; onSelectPerson: (id: string | null) => void;
  sharedEventsWith: (id: string) => Schedule[];
  participantsOf: (id: string) => EventParticipant[];
  onOpenEvent: (eventId: string, chat?: boolean) => void;
  query: string;
  onQuery: (v: string) => void;
  onNewRoom: () => void;
}) {
  const { view, receipts } = props;
  const mine = receipts.filter((r) => r.destView === view);

  return (
    /* 제목은 페이지 헤더가 갖는다 — 뷰가 자기 제목을 또 그리면 세 화면의 기준선이 어긋난다. */
    <section className="rmg-feat">
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
  /** 데이터에 끝 시각이 있었는가. 없으면 원 위에 '점'으로만 찍는다 —
   *  없는 길이를 그려 넣으면 화면이 데이터에 없는 말을 하게 된다. */
  hasEnd: boolean;
};
const MIN_ARC = 6; // 아주 짧은 일정도 원 위에서 사라지지 않을 최소 폭(분)

function spansOf(day: Date, schedules: any[], mine: Receipt[], base: Date | null): Span[] {
  const d0 = new Date(day); d0.setHours(0, 0, 0, 0);
  const dayStart = +d0, dayEnd = dayStart + 86_400_000;
  const out: Span[] = [];

  const add = (id: string, title: string, st: Date, en: Date, pending: boolean, hasEnd = true) => {
    if (!(+st < dayEnd && +en > dayStart)) return; // 이 날에 걸치지 않음
    const allDay = +en - +st >= 86_400_000;
    const from = Math.max(0, Math.round((+st - dayStart) / 60_000));
    const rawTo = Math.min(1440, Math.round((+en - dayStart) / 60_000));
    out.push({
      id, title, from, to: Math.max(rawTo, Math.min(1440, from + MIN_ARC)),
      pending, allDay, startAt: st, endAt: en, hasEnd,
      cutStart: +st < dayStart, cutEnd: +en > dayEnd,
    });
  };

  for (const s of schedules) {
    const st = new Date(s.start);
    if (Number.isNaN(+st)) continue;
    // 표(시간표)는 면적이 있어야 보이므로 1시간으로 두되, 그게 데이터가 아니라는 사실은 남긴다.
    const raw = s.end ? new Date(s.end) : null;
    const ok = raw && !Number.isNaN(+raw) && +raw > +st;
    add(String(s.id), s.title, st, ok ? raw! : new Date(+st + 3_600_000), s.status === "pending", !!ok);
  }
  for (const r of mine) {
    const d = r.date ?? base;
    // 시각을 모르면 원 위에 놓을 자리가 없다 — 시간 없는 건은 원에서 빠진다.
    if (!d || !r.time) continue;
    const [hh, mm] = r.time.split(":").map(Number);
    const st = new Date(d); st.setHours(hh, mm, 0, 0);
    add(`r-${r.id}`, r.title, st, new Date(+st + 3_600_000), true, false);
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
function CalendarView({ schedules, mounted, now, mine, lang, onAddSchedule, selectedDay, onSelectDay, participantsOf, onOpenEvent }: any) {
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
        <DayTimetable day={day} spans={spans} now={base} lang={lang} onAdd={onAddSchedule} onOpenEvent={onOpenEvent} participantsOf={participantsOf} />
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
function DayDial({ spans, day, now, lang, onOpenEvent, participantsOf }: {
  spans: Span[]; day: Date; now: Date; lang: Lang;
  onOpenEvent?: (id: string) => void;
  participantsOf?: (id: string) => EventParticipant[];
}) {
  // ── 좌표계 ──
  // 하루(1440분)를 한 바퀴로 편다. 0시가 위, 시계 방향 → 06시 오른쪽, 12시 아래, 18시 왼쪽.
  const C = 120;              // 중심 (viewBox 240)
  const R_RING = 92;          // 시간축 원
  const R_EVENT = 84;         // 일정 arc 가 앉는 반지름
  const EV_W = 9;             // arc 두께 — 원의 구조가 먼저 보이도록 얇게
  const R_INNER = 34;         // 안쪽 원(아주 옅게)
  const R_LABEL = 108;        // 숫자는 원에서 충분히 떨어뜨린다

  /** 시각(분) → 각도(rad). 분 단위까지 그대로 반영한다 — 23:00 과 23:16 은 다른 각이다. */
  const timeToAngle = (min: number) => (min / 1440) * 2 * Math.PI - Math.PI / 2;
  const pt = (min: number, r: number) => {
    const a = timeToAngle(min);
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  /** 일정 → 원 위의 호. 면적을 잘라내는 wedge 가 아니라 곡률을 따라가는 띠. */
  const eventToArc = (from: number, to: number, r: number) => {
    const [x1, y1] = pt(from, r), [x2, y2] = pt(to, r);
    const large = to - from > 720 ? 1 : 0;
    return `M${x1} ${y1}A${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  const [hover, setHover] = React.useState<string | null>(null);
  const [pinned, setPinned] = React.useState<string | null>(null);
  const activeId = pinned ?? hover;
  React.useEffect(() => { setPinned(null); setHover(null); }, [day]);

  const timed = spans.filter((s) => !s.allDay);
  const allDay = spans.filter((s) => s.allDay);

  // 겹치는 것만 안쪽으로 한 겹 물린다(최대 3겹) — 겹치지 않는 일정은 바깥 링에 그대로 앉는다.
  const laneEnd: number[] = [];
  const laneOf = new Map<string, number>();
  for (const s of timed) {
    let ln = laneEnd.findIndex((e) => e <= s.from);
    if (ln === -1) { ln = laneEnd.length; laneEnd.push(0); }
    laneEnd[ln] = s.to;
    laneOf.set(s.id, Math.min(ln, 2));
  }

  // 색은 원과 목록이 같은 것을 써야 둘이 하나로 읽힌다 — id 로 묶어 둔다.
  const hueOf = new Map<string, number>();
  timed.forEach((s, i) => hueOf.set(s.id, i % 4));

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
  const tipAt = active
    ? pt(active.allDay ? 0 : (active.from + active.to) / 2, R_EVENT - (laneOf.get(active.id) ?? 0) * (EV_W + 3))
    : null;

  return (
    <div className="rmg-dial" data-tour="dial">
      <div className="rmg-dial-stage">
        <svg viewBox="0 0 240 240" className="rmg-dial-svg"
          aria-label={lang === "en" ? "24-hour timeline" : "24시간 타임라인"}
          onMouseLeave={() => setHover(null)}
        >
          {/* 시간축 — 눈이 '축 → 일정 → 지금' 순으로 가도록 농도를 계단으로 둔다. */}
          <circle cx={C} cy={C} r={R_RING} className="rmg-dial-ring" />
          <circle cx={C} cy={C} r={R_INNER} className="rmg-dial-ring inner" />

          {/* 15분 눈금 — 있는지 없는지 모를 만큼만 */}
          {Array.from({ length: 96 }, (_, i) => i).filter((i) => i % 4 !== 0).map((i) => {
            const [ax, ay] = pt(i * 15, R_RING);
            const [bx, by] = pt(i * 15, R_RING - 2.5);
            return <line key={`q${i}`} x1={ax} y1={ay} x2={bx} y2={by} className="rmg-dial-tick quarter" />;
          })}

          {/* 정시 · 3시간 — 3시간만 안쪽까지 길게 긋고 숫자를 붙인다 */}
          {Array.from({ length: 24 }, (_, hh) => {
            const major = hh % 3 === 0;
            const [ax, ay] = pt(hh * 60, R_RING);
            const [bx, by] = pt(hh * 60, major ? R_INNER : R_RING - 5);
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

          {timed.map((s, i) => {
            const r = R_EVENT - (laneOf.get(s.id) ?? 0) * (EV_W + 3);
            const on = activeId === s.id;
            const dim = !!activeId && !on;
            const nowInside = isToday && nowMin >= s.from && nowMin <= s.to;
            const cls = `rmg-dial-arc h${hueOf.get(s.id) ?? 0} ${s.pending ? "pending" : ""} ${on ? "on" : ""} ${dim ? "dim" : ""} ${nowInside ? "current" : ""}`;
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
            return (
              <g key={s.id} className="rmg-dial-ev">
                {/* 양끝을 둥글린 만큼 미리 깎아 둔다 — 칠해진 끝이 곧 실제 시각이다. */}
                <path d={eventToArc(s.from + ci, s.to - ci, r)} className={cls} strokeWidth={EV_W} {...handlers} />
                {/* 시작·끝 표식은 붙잡았을 때만 — 평소엔 띠 하나로 조용하다. */}
                {on && (
                  <>
                    <circle cx={sx} cy={sy} r={2.2} className="rmg-dial-handle" />
                    <circle cx={ex} cy={ey} r={2.2} className="rmg-dial-handle" />
                  </>
                )}
              </g>
            );
          })}

          {/* 지금 — 중심에서 뻗어 나가는 한 줄. 시곗바늘처럼 축에 매여 있어야
              '떠 있는 막대'가 아니라 시간의 흐름으로 읽힌다.
              좌표가 아니라 회전으로 두어, 갱신될 때 그 사이를 CSS 가 메운다. */}
          {isToday && (
            <g className="rmg-dial-hand" style={{ transform: `rotate(${nowDeg}deg)`, transformOrigin: `${C}px ${C}px` }}>
              <line x1={C} y1={C} x2={C} y2={C - R_INNER} className="rmg-dial-now shaft" />
              <line x1={C} y1={C - R_INNER} x2={C} y2={C - (R_RING - 2)} className="rmg-dial-now" />
              <circle cx={C} cy={C} r={1.8} className="rmg-dial-hub" />
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
            const n = eventId && participantsOf ? participantsOf(eventId).length : 0;
            return (
              <li
                key={s.id}
                className={`rmg-dial-keyrow ${activeId === s.id ? "on" : ""}`}
                onMouseEnter={() => setHover(s.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => (eventId && onOpenEvent ? onOpenEvent(eventId) : setPinned((p) => (p === s.id ? null : s.id)))}
              >
                {/* 목록의 표식과 원의 띠는 같은 색 — 눈이 둘을 하나로 잇는다. */}
                <span className={`rmg-dial-chip h${hueOf.get(s.id) ?? 0} ${s.pending ? "pending" : ""} ${s.allDay ? "allday" : ""}`} />
                <span className="rmg-dial-keytime">{s.allDay ? (lang === "en" ? "All day" : "종일") : hhmm(s.startAt)}</span>
                <span className="rmg-dial-keytitle">{s.title}</span>
                {n > 1 && <span className="rmg-dial-keyn">{lang === "en" ? `${n}` : `${n}명`}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── 하루 타임테이블의 좌표계 ──
// 시간 ↔ 화면 위치를 잇는 규칙은 여기 셋뿐이다. 어떤 카드도 top/height 를 손으로 갖지 않는다.
const TT_FROM = 6, TT_TO = 24;   // 06:00 ~ 24:00
const TT_ROW = 56;               // 1시간 = 56px. 화면이 커져도 이 간격은 변하지 않는다.
const TT_MIN_H = 24;             // 아주 짧은 일정도 제목이 깨지지 않을 최소 높이
const TT_GAP = 6;                // 나란히 선 카드 사이

/** 그 날 자정으로부터의 분 → 캔버스 세로 위치(px) */
const timeToPosition = (minutes: number) => ((minutes - TT_FROM * 60) / 60) * TT_ROW;
/** 일정 → 시작 위치(px) */
const eventToPosition = (s: Span) => timeToPosition(s.from);
/** 일정 → 높이(px). 길수록 길어지되, 너무 짧으면 최소 높이를 지킨다. */
const eventDurationToHeight = (s: Span) => Math.max(((s.to - s.from) / 60) * TT_ROW, TT_MIN_H);

/** 겹치는 일정을 가로로 나눈다.
 *  서로 걸치는 것끼리 한 덩어리로 묶고, 그 덩어리 안에서만 열을 쪼갠다 →
 *  하루에 겹치는 일정이 하나라도 있다고 해서 나머지 일정까지 좁아지지 않는다. */
function layoutSpans(spans: Span[]): Map<string, { col: number; cols: number }> {
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

/** 하루 타임테이블 — 왼쪽은 시간축(Time Gutter), 오른쪽은 일정이 놓이는 판(Event Canvas).
 *  빈 자리를 누르면 그 시각에 바로 한 줄 적어 넣고, 일정을 누르면 그 일정의 상세·대화로 간다. */
function DayTimetable({ day, spans, now, lang, onAdd, onOpenEvent, participantsOf }: {
  day: Date; spans: Span[]; now: Date; lang: Lang;
  onAdd?: (title: string, start: Date) => void;
  onOpenEvent?: (id: string) => void;
  participantsOf?: (id: string) => EventParticipant[];
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
  const lay = React.useMemo(() => layoutSpans(spans), [spans]);
  const canvasH = (TT_TO - TT_FROM) * TT_ROW;

  // 열자마자 지금 시각이 보이게 — 하루의 시작(06:00)부터 훑어 내려오게 하지 않는다.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = nowInRange ? timeToPosition(nowMin) : spans.length ? eventToPosition(spans[0]) : 0;
    el.scrollTop = Math.max(0, target - el.clientHeight / 3);
  }, [day]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="rmg-tt-scroll" ref={scrollRef}>
        <div className="rmg-tt-grid" style={{ height: `${canvasH}px` }}>
          {hours.map((h) => (
            <React.Fragment key={h}>
              {/* 시각은 선 위에 걸터앉는다 — 선과 겹치지 않게 살짝 올려 둔다. */}
              <span className="rmg-tt-label" style={{ top: `${timeToPosition(h * 60)}px` }}>{pad(h)}:00</span>
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

            {spans.map((s) => {
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

/** 일정 상세 + 그 일정의 대화 — 일정 하나가 곧 하나의 Context.
 *  People 에서는 목록 옆 빈 자리에 그대로 눕고(inline), 그 자리가 없는 Calendar 에서는
 *  오른쪽에서 한 겹 열린다(drawer). 어느 쪽이든 내용과 규격은 같다.
 *  Slack/Discord 처럼 만들지 않는다 — 말풍선도 아바타 행렬도 없이, 한 사람의 한 마디씩만 조용히 쌓인다. */
/** AI 일정 제안 — 대화에서 나온 시각을 각자의 달력과 대조해 내놓은 한 칸.
 *  AI 는 여기까지만 한다. 확정은 사람들이 한다(전원이 동의해야 일정이 앉는다).
 *  누가 그 시간에 바쁜지는 말하되, 무엇을 하는지는 말하지 않는다 — 서버가 아예 보내지 않는다. */
function ProposalCard({ proposal, participants, nameOf, lang, busy, onAnswer }: {
  proposal: ScheduleProposal;
  participants: EventParticipant[];
  nameOf: (userId: string) => string;
  lang: Lang;
  busy: boolean;
  onAnswer: (r: "accepted" | "declined") => void;
}) {
  const en = lang === "en";
  const start = new Date(proposal.start);
  const end = new Date(proposal.end);
  const avail = new Map(proposal.availability?.map((a) => [a.userId, a.state]));
  const answer = new Map(proposal.responses.map((r) => [r.userId, r.response]));
  const mine = answer.get(ME_ID) ?? "pending";
  const waiting = participants.filter((p) => (answer.get(p.userId) ?? "pending") !== "accepted").length;
  const freeAll = participants.every((p) => avail.get(p.userId) !== "busy");

  const stateWord = (s?: string) =>
    s === "busy" ? (en ? "Busy" : "일정 있음")
      : s === "unknown" ? (en ? "Unknown" : "알 수 없음")
        : (en ? "Free" : "가능");

  return (
    <section className="rmg-prop" aria-label={en ? "Suggested time" : "AI 일정 제안"}>
      <p className="rmg-eyebrow rmg-prop-eye">{en ? "Suggested time" : "AI 일정 제안"}</p>

      <p className="rmg-prop-when">
        {fmtDate(start)} · {fmtTime(start)} – {fmtTime(end)}
      </p>
      {proposal.rationale && <p className="rmg-prop-why">{proposal.rationale}</p>}

      {/* 사람마다 그 시간에 되는지 · 답했는지. 두 가지는 다른 이야기라 나란히 둔다. */}
      <ul className="rmg-prop-people">
        {participants.map((p) => {
          const a = avail.get(p.userId);
          const r = answer.get(p.userId) ?? "pending";
          return (
            <li key={p.userId} className={`rmg-prop-p ${a ?? ""}`}>
              <span className="rmg-prop-pname">{nameOf(p.userId)}</span>
              <span className={`rmg-prop-pav ${a ?? ""}`}>{stateWord(a)}</span>
              <span className={`rmg-prop-pans ${r}`}>
                {r === "accepted" ? (en ? "Agreed" : "동의")
                  : r === "declined" ? (en ? "Declined" : "거절")
                    : (en ? "Waiting" : "대기")}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="rmg-prop-sum">
        {freeAll
          ? (en ? `No conflicts for ${participants.length}.` : `${participants.length}명 모두 일정 충돌 없음`)
          : (en ? "Some have something then." : "일부는 그 시간에 일정이 있어요")}
        {waiting > 0 && (en ? ` · waiting on ${waiting}` : ` · ${waiting}명 대기 중`)}
      </p>

      {/* 이미 답했으면 조용히 상태만 두고, 마음이 바뀌면 다시 누를 수 있게 남겨 둔다. */}
      <div className="rmg-prop-acts">
        <button type="button" className={`rmg-ppl-act ${mine === "accepted" ? "primary" : ""}`} disabled={busy} onClick={() => onAnswer("accepted")}>
          {en ? "Agree" : "동의"}
        </button>
        <button type="button" className={`rmg-ppl-act ${mine === "declined" ? "primary" : ""}`} disabled={busy} onClick={() => onAnswer("declined")}>
          {en ? "Another time" : "다른 시간"}
        </button>
      </div>
    </section>
  );
}

function EventPanel({ event, participants, contacts, messages, myName, lang, focusChat, variant = "drawer", proposal, proposalBusy, onAnswerProposal, summary, summaryBusy, onSummarize, onClose, onSend, onAddParticipant, onRemoveParticipant, onRespond, backLabel, onBack }: {
  event: Schedule;
  participants: EventParticipant[];
  contacts: Contact[];
  messages: ChatMessage[];
  myName: string;
  lang: Lang;
  focusChat: boolean;
  /** inline = 사람 탭의 남는 오른쪽 칸에 그대로 / drawer = 오른쪽에서 한 겹 */
  variant?: "inline" | "drawer";
  /** 이 일정에 열려 있는 AI 제안(없으면 null) */
  proposal?: ScheduleProposal | null;
  proposalBusy?: boolean;
  onAnswerProposal?: (r: "accepted" | "declined") => void;
  /** 대화 요약 — 스스로 갱신하지 않는다. 사람이 부를 때만 다시 읽는다. */
  summary?: string | null;
  summaryBusy?: boolean;
  onSummarize?: () => void;
  onClose: () => void;
  onSend: (text: string) => void;
  onAddParticipant: (userId: string) => void;
  onRemoveParticipant: (userId: string) => void;
  onRespond: (status: "accepted" | "declined") => void;
  /** 사람에서 들어왔으면 어디서 왔는지 남겨둔다 — 방만 덜렁 바뀌면 길을 잃는다. */
  backLabel?: string;
  onBack?: () => void;
}) {
  const en = lang === "en";
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  const nameOf = React.useCallback(
    (userId: string) => (userId === ME_ID ? myName : contacts.find((c) => c.id === userId)?.name ?? (en ? "Unknown" : "알 수 없음")),
    [contacts, myName, en],
  );

  React.useEffect(() => { if (focusChat) inputRef.current?.focus(); }, [focusChat]);
  // 새 메시지가 오면 맨 아래로 — 대화를 열었을 때 마지막 말이 보여야 한다.
  React.useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  // Esc 로 닫는다 — 화면을 가리는 모달이 아니라 잠깐 펼친 한 겹이므로.
  // (inline 은 제자리에 놓인 칸이라 Esc 로 걷어낼 이유가 없다.)
  React.useEffect(() => {
    if (variant === "inline") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, variant]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onSend(text);
  };

  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : null;
  const me = participants.find((p) => p.userId === ME_ID) ?? null;
  const accepted = participants.filter((p) => p.status === "accepted").length;

  return (
    <aside
      className={variant === "inline" ? "rmg-evpanel" : "rmg-drawer"}
      role={variant === "inline" ? "region" : "dialog"}
      aria-label={event.title}
    >
      <div className="rmg-drawer-head">
        <div className="rmg-drawer-when">
          {backLabel && onBack && (
            <button type="button" className="rmg-evback" onClick={onBack}>‹ {backLabel}</button>
          )}
          <p className="rmg-drawer-title">{event.title}</p>
          <p className="rmg-drawer-time">
            {fmtDate(start)} · {fmtTime(start)}{end ? ` – ${fmtTime(end)}` : ""}
            {event.location ? ` · ${event.location}` : ""}
          </p>
        </div>
        <button type="button" className="rmg-panel-close" onClick={onClose} aria-label={en ? "Close" : "닫기"}>
          <X className="rmg-notif-ic" />
        </button>
      </div>

      {/* AI 가 시간을 내놓았으면 대화보다 먼저 — 지금 답을 기다리는 건 이것이다. */}
      {proposal && onAnswerProposal && (
        <ProposalCard
          proposal={proposal}
          participants={participants}
          nameOf={nameOf}
          lang={lang}
          busy={!!proposalBusy}
          onAnswer={onAnswerProposal}
        />
      )}

      {/* 내 참석 여부 — 여럿이 모이는 자리는 '초대됐다'로 끝나면 안 되고 답이 돌아와야 한다.
          이미 답했으면 조용히 상태만 두고, 마음이 바뀌면 다시 누를 수 있게 남겨둔다. */}
      {me && me.role !== "owner" && (
        <div className="rmg-rsvp">
          <p className="rmg-rsvp-q">
            {me.status === "invited"
              ? (en ? "Are you joining?" : "참석하시겠어요?")
              : me.status === "accepted"
                ? (en ? "You're going." : "참석으로 표시했어요.")
                : (en ? "You declined." : "불참으로 표시했어요.")}
          </p>
          <div className="rmg-rsvp-acts">
            <button type="button" className={`rmg-ppl-act ${me.status === "accepted" ? "primary" : ""}`} onClick={() => onRespond("accepted")}>
              {en ? "Going" : "참석"}
            </button>
            <button type="button" className={`rmg-ppl-act ${me.status === "declined" ? "primary" : ""}`} onClick={() => onRespond("declined")}>
              {en ? "Can't" : "불참"}
            </button>
          </div>
        </div>
      )}

      <div className="rmg-drawer-people">
        <div className="rmg-drawer-peoplehead">
          <p className="rmg-eyebrow rmg-drawer-eye">
            {en ? `${accepted}/${participants.length} going` : `참여자 ${participants.length}명 · 참석 ${accepted}`}
          </p>
          <button type="button" className="rmg-ppl-act" onClick={() => setAdding((v) => !v)}>
            {adding ? (en ? "Done" : "완료") : (en ? "Add" : "추가")}
          </button>
        </div>
        <ul className="rmg-drawer-plist">
          {participants.map((p) => (
            <li key={p.userId} className={`rmg-drawer-p ${p.status === "invited" ? "pending" : ""}`}>
              <span className="rmg-drawer-pav">{nameOf(p.userId).slice(0, 1)}</span>
              <span className="rmg-drawer-pname">{nameOf(p.userId)}</span>
              {p.role === "owner" && <span className="rmg-drawer-prole">{en ? "Owner" : "주최"}</span>}
              <span className={`rmg-drawer-prole ${p.status}`}>
                {p.status === "accepted" ? (en ? "Going" : "참석")
                  : p.status === "declined" ? (en ? "Can't" : "불참")
                    : (en ? "Invited" : "미정")}
              </span>
              {/* 주최자는 뺄 수 없다 — 일정의 주인이 사라지면 남는 사람들의 권한이 모호해진다. */}
              {adding && p.role !== "owner" && (
                <button type="button" className="rmg-drawer-px" onClick={() => onRemoveParticipant(p.userId)} aria-label={en ? "Remove" : "제외"}>
                  <X className="rmg-drawer-pxic" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {adding && (
          <div className="rmg-drawer-add">
            {contacts.filter((c) => !participants.some((p) => p.userId === c.id)).length === 0 ? (
              <p className="rmg-drawer-empty">{en ? "Everyone is already here." : "이미 다 들어와 있어요."}</p>
            ) : (
              contacts
                .filter((c) => !participants.some((p) => p.userId === c.id))
                .map((c) => (
                  // 같은 사람을 두 번 눌러도 한 줄만 남는다(스토어에서 멱등 처리).
                  <button key={c.id} type="button" className="rmg-drawer-addbtn" onClick={() => onAddParticipant(c.id)}>
                    + {c.name}
                  </button>
                ))
            )}
          </div>
        )}
      </div>

      <div className="rmg-drawer-chat">
        <div className="rmg-drawer-chathead">
          <p className="rmg-eyebrow rmg-drawer-eye">{en ? "Conversation" : "이 일정의 대화"}</p>
          {/* 말이 몇 마디뿐이면 요약할 것도 없다 — 그때까지는 이 자리를 만들지 않는다. */}
          {onSummarize && messages.length >= 4 && (
            <button type="button" className="rmg-ppl-act" disabled={summaryBusy} onClick={onSummarize}>
              {summaryBusy ? (en ? "Reading…" : "읽는 중…") : summary ? (en ? "Update" : "다시 정리") : (en ? "Summarize" : "요약")}
            </button>
          )}
        </div>

        {/* AI 요약 — 대화를 밀어내지 않게 작게, 위에 한 겹만. 스스로 갱신하지 않는다. */}
        {summary && (
          <div className="rmg-sum">
            <p className="rmg-eyebrow rmg-sum-eye">{en ? "AI summary" : "AI 요약"}</p>
            {summary.split("\n").filter((l) => l.trim()).map((line, i) => (
              <p key={i} className="rmg-sum-line">{line.replace(/^[•\-*]\s*/, "")}</p>
            ))}
          </div>
        )}

        <div className="rmg-drawer-msgs">
          {messages.length === 0 ? (
            <p className="rmg-drawer-empty">{en ? "No messages yet." : "아직 대화가 없어요."}</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`rmg-msg ${m.senderId === ME_ID ? "mine" : ""} ${m.pending ? "pending" : ""}`}>
                <span className="rmg-msg-who">{nameOf(m.senderId)}</span>
                <span className="rmg-msg-body">{m.content}</span>
                <span className="rmg-msg-at">{fmtTime(new Date(m.createdAt))}</span>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
        <form className="rmg-drawer-compose" onSubmit={submit}>
          <input
            ref={inputRef}
            className="rmg-drawer-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={en ? "Write to everyone on this event…" : "이 일정의 사람들에게…"}
            aria-label={en ? "Message" : "메시지"}
          />
          <button type="submit" className="rmg-ask-send" aria-label={en ? "Send" : "보내기"}>
            <ArrowUp className="rmg-railicon" />
          </button>
        </form>
      </div>
    </aside>
  );
}

/** 대화 한 타래 — 1:1 방과 일정 방이 똑같은 모양을 쓴다.
 *  방이 달라도 '말이 쌓이는 방식'까지 달라지면 두 개의 다른 앱처럼 보인다. */
function ChatThread({ messages, nameOf, myName, placeholder, focus, lang, onSend }: {
  messages: ChatMessage[];
  nameOf: (userId: string) => string;
  myName: string;
  placeholder: string;
  focus: boolean;
  lang: Lang;
  onSend: (text: string) => void;
}) {
  const en = lang === "en";
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { if (focus) inputRef.current?.focus(); }, [focus]);
  React.useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onSend(text);
  };

  return (
    <>
      <div className="rmg-drawer-msgs">
        {messages.length === 0 ? (
          <p className="rmg-drawer-empty">{en ? "No messages yet." : "아직 대화가 없어요."}</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`rmg-msg ${m.senderId === ME_ID ? "mine" : ""} ${m.pending ? "pending" : ""}`}>
              <span className="rmg-msg-who">{m.senderId === ME_ID ? myName : nameOf(m.senderId)}</span>
              <span className="rmg-msg-body">{m.content}</span>
              <span className="rmg-msg-at">{fmtTime(new Date(m.createdAt))}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <form className="rmg-drawer-compose" onSubmit={submit}>
        <input
          ref={inputRef}
          className="rmg-drawer-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          aria-label={en ? "Message" : "메시지"}
        />
        <button type="submit" className="rmg-ask-send" aria-label={en ? "Send" : "보내기"}>
          <ArrowUp className="rmg-railicon" />
        </button>
      </form>
    </>
  );
}

/** 여러 사람이 함께할 자리를 새로 만든다 — Comein 에서 '단체방을 판다'는 곧 '자리를 잡는다'는 뜻.
 *  방을 따로 만들지 않는다. 일정이 생기면 그 일정의 방과 멤버가 함께 생긴다. */
function NewRoomPanel({ contacts, lang, onClose, onCreate }: {
  contacts: Contact[];
  lang: Lang;
  onClose: () => void;
  onCreate: (peerIds: string[], title: string, start: Date) => void;
}) {
  const en = lang === "en";
  const [title, setTitle] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [q, setQ] = React.useState("");
  const titleRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setMinutes(0, 0, 0);
    const p = (n: number) => String(n).padStart(2, "0");
    setDate(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    setTime(`${p(d.getHours())}:00`);
    titleRef.current?.focus();
  }, []);

  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const ql = q.trim().toLowerCase();
  const shown = ql ? contacts.filter((c) => [c.name, c.org].filter(Boolean).some((v) => (v as string).toLowerCase().includes(ql))) : contacts;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || !picked.length || !date || !time) return;
    const [y, mo, da] = date.split("-").map(Number);
    const [hh, mi] = time.split(":").map(Number);
    onCreate(picked, t, new Date(y, mo - 1, da, hh, mi, 0, 0));
  };

  return (
    <aside className="rmg-evpanel" role="region" aria-label={en ? "New event" : "새 자리"}>
      <div className="rmg-drawer-head">
        <div className="rmg-drawer-when">
          <p className="rmg-drawer-title">{en ? "New event" : "만들기"}</p>
          <p className="rmg-drawer-time">{en ? "Everyone here gets the room too." : "부른 사람들이 곧 이 자리의 대화 상대가 됩니다"}</p>
        </div>
        <button type="button" className="rmg-panel-close" onClick={onClose} aria-label={en ? "Close" : "닫기"}>
          <X className="rmg-notif-ic" />
        </button>
      </div>

      <form className="rmg-newroom" onSubmit={submit}>
        <input
          ref={titleRef}
          className="rmg-newev-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={en ? "Name this room" : "채팅방 이름 설정하기"}
          aria-label={en ? "Title" : "제목"}
        />
        <div className="rmg-newev-when">
          <input type="date" className="rmg-newev-in" value={date} onChange={(e) => setDate(e.target.value)} aria-label={en ? "Date" : "날짜"} />
          <input type="time" className="rmg-newev-in" value={time} onChange={(e) => setTime(e.target.value)} aria-label={en ? "Time" : "시각"} />
        </div>

        <p className="rmg-eyebrow rmg-drawer-eye">
          {en ? `With ${picked.length}` : `함께할 사람 ${picked.length}명`}
        </p>
        <div className="rmg-ppl-search rmg-newroom-search">
          <Search className="rmg-ppl-searchic" />
          <input className="rmg-ppl-searchin" value={q} onChange={(e) => setQ(e.target.value)} placeholder={en ? "Search" : "이름으로 찾기"} aria-label={en ? "Search" : "찾기"} />
        </div>
        <div className="rmg-newroom-picks">
          {shown.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`rmg-newroom-chip ${picked.includes(c.id) ? "on" : ""}`}
              aria-pressed={picked.includes(c.id)}
              onClick={() => toggle(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="rmg-newev-acts">
          <button type="button" className="rmg-ppl-act" onClick={onClose}>{en ? "Cancel" : "취소"}</button>
          <button type="submit" className="rmg-ppl-act primary" disabled={!title.trim() || picked.length === 0}>
            {en ? "Create" : "만들기"}
          </button>
        </div>
      </form>
    </aside>
  );
}

/** 고른 사람에 대한 모든 것 — 오른쪽 칸의 주인.
 *  둘만의 대화와 함께하는 일정을 한 지붕 아래 두고 위쪽 세그먼트로만 가른다.
 *  (예전처럼 목록 안에 버튼을 늘어놓으면 '대화' 가 두 가지를 뜻해 헷갈린다.) */
function PersonPanel({ person, tab, onTab, messages, sharedEvents, participantsOf, myName, lang, focusChat, onClose, onSend, onOpenEvent, onCreateEvent }: {
  person: Contact;
  tab: "chat" | "events";
  onTab: (t: "chat" | "events") => void;
  messages: ChatMessage[];
  sharedEvents: Schedule[];
  participantsOf: (id: string) => EventParticipant[];
  myName: string;
  lang: Lang;
  focusChat: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
  onOpenEvent: (eventId: string) => void;
  onCreateEvent: (title: string, start: Date) => void;
}) {
  const en = lang === "en";

  // 새 자리 만들기 — 기본값은 '내일 이 시간쯤'. 빈 칸부터 채우게 하지 않는다.
  const [creating, setCreating] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newDate, setNewDate] = React.useState("");
  const [newTime, setNewTime] = React.useState("");
  const newTitleRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!creating) return;
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setMinutes(0, 0, 0);
    const p = (n: number) => String(n).padStart(2, "0");
    setNewDate(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    setNewTime(`${p(d.getHours())}:00`);
    newTitleRef.current?.focus();
  }, [creating]);

  const submitNew = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || !newDate || !newTime) return;
    const [y, mo, da] = newDate.split("-").map(Number);
    const [hh, mi] = newTime.split(":").map(Number);
    setCreating(false);
    setNewTitle("");
    onCreateEvent(title, new Date(y, mo - 1, da, hh, mi, 0, 0));
  };

  return (
    <aside className="rmg-evpanel" role="region" aria-label={person.name}>
      {/* 닫기 버튼을 두지 않는다 — 목록에서 그 사람을 한 번 더 누르면 닫히고,
          다른 사람을 누르면 그대로 넘어간다. 칸이 늘 채워져 있는 편이 조용하다. */}
      <div className="rmg-drawer-head">
        <div className="rmg-drawer-when">
          <p className="rmg-drawer-title">{person.name}</p>
          {person.org && <p className="rmg-drawer-time">{person.org}</p>}
        </div>
      </div>

      {/* 이 사람에 관해 볼 수 있는 두 가지. 라벨이 서로 다른 말이라 헷갈릴 여지가 없다. */}
      <div className="rmg-seg rmg-pseg" role="group" aria-label={en ? "View" : "보기"}>
        <button type="button" className={`rmg-seg-btn ${tab === "chat" ? "on" : ""}`} onClick={() => onTab("chat")}>
          {en ? "Message" : "둘만의 대화"}
        </button>
        <button type="button" className={`rmg-seg-btn ${tab === "events" ? "on" : ""}`} onClick={() => onTab("events")}>
          {en ? `Together ${sharedEvents.length}` : `함께하는 일정 ${sharedEvents.length}`}
        </button>
      </div>

      {tab === "chat" ? (
        <div className="rmg-drawer-chat rmg-drawer-chat-solo">
          <ChatThread
            messages={messages}
            nameOf={() => person.name}
            myName={myName}
            placeholder={en ? `Message ${person.name}…` : `${person.name}님에게…`}
            focus={focusChat}
            lang={lang}
            onSend={onSend}
          />
        </div>
      ) : (
        <div className="rmg-pev">
          {sharedEvents.length === 0 ? (
            <p className="rmg-pev-none">{en ? "No events together yet." : "함께하는 일정이 아직 없어요."}</p>
          ) : (
            <ul className="rmg-pev-list">
              {sharedEvents.map((s) => (
                <li key={s.id}>
                  {/* 일정을 고르면 그 일정의 방으로 들어간다 — 여기서 '대화' 라는 말을 또 쓰지 않는다. */}
                  <button type="button" className="rmg-pev-row" data-tour="sharedevent" onClick={() => onOpenEvent(s.id)}>
                    <span className="rmg-pev-title">{s.title}</span>
                    <span className="rmg-pev-when">{fmtDate(new Date(s.start))} · {fmtTime(new Date(s.start))}</span>
                    <span className="rmg-pev-n">{participantsOf(s.id).length}{en ? "" : "명"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* 함께할 자리를 새로 만든다 — 자리가 생기면 그 자리의 대화도 함께 생긴다. */}
          {creating ? (
            <form className="rmg-newev" onSubmit={submitNew}>
              <input
                ref={newTitleRef}
                className="rmg-newev-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={en ? "Name this room" : "채팅방 이름 설정하기"}
                aria-label={en ? "Title" : "제목"}
              />
              <div className="rmg-newev-when">
                <input type="date" className="rmg-newev-in" value={newDate} onChange={(e) => setNewDate(e.target.value)} aria-label={en ? "Date" : "날짜"} />
                <input type="time" className="rmg-newev-in" value={newTime} onChange={(e) => setNewTime(e.target.value)} aria-label={en ? "Time" : "시각"} />
              </div>
              <p className="rmg-newev-who">
                {en ? `With ${person.name}` : `${person.name}님과 함께 · 참여자는 만든 뒤에 더 부를 수 있어요`}
              </p>
              <div className="rmg-newev-acts">
                <button type="button" className="rmg-ppl-act" onClick={() => setCreating(false)}>{en ? "Cancel" : "취소"}</button>
                <button type="submit" className="rmg-ppl-act primary" disabled={!newTitle.trim()}>{en ? "Create" : "만들기"}</button>
              </div>
            </form>
          ) : (
            <button type="button" className="rmg-newev-open" onClick={() => setCreating(true)}>
              + {en ? "New event with " + person.name : `${person.name}님과 만들기`}
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

/** People — 연락처가 아니라 '일정으로 이어진 사람'.
 *  사람을 누르면 그 사람과 내가 함께 있는 일정이 펼쳐지고, 거기서 바로 그 일정의 대화로 들어간다.
 *  사람 → 일정 → 대화. 1:1 DM 은 만들지 않는다 — Comein 의 대화는 늘 일정에 매여 있다. */
function PeopleView({ contacts, lang, personId, onSelectPerson, sharedEventsWith, query, onQuery, onNewRoom, onFind, onConnect, unreadOf }: any) {
  const t = L(lang as Lang);
  const en = lang === "en";
  const q = (query as string).trim().toLowerCase();
  // 이름·핸들·소속 어디로든 찾는다 — "그 교수님" 을 기억하는 방식은 사람마다 다르다.
  const shown = q
    ? contacts.filter((c: any) => [c.name, c.handle, c.org].filter(Boolean).some((v: string) => v.toLowerCase().includes(q)))
    : contacts;

  // ── Comein 계정에서 찾기 ──
  // 내 목록에 없는 사람은 여기서 찾는다. 이름만 적어 넣는 방식이 아니라 실재하는 계정을
  // 고르는 방식이라, 고른 사람은 곧바로 일정에 부를 수 있고 말을 걸 수 있다.
  const [found, setFound] = React.useState<any[]>([]);
  const [finding, setFinding] = React.useState(false);
  const [joining, setJoining] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!onFind || q.length < 2) { setFound([]); setFinding(false); return; }
    // 한 글자 칠 때마다 서버에 묻지 않는다 — 손이 멈추면 그때 한 번.
    setFinding(true);
    let alive = true;
    const timer = window.setTimeout(async () => {
      const rows = await onFind(q);
      if (!alive) return;
      setFound(rows ?? []);
      setFinding(false);
    }, 280);
    return () => { alive = false; window.clearTimeout(timer); setFinding(false); window.clearTimeout(timer); };
  }, [q, onFind]);

  // 이미 내 목록에 있는 사람은 검색 결과에서 뺀다 — 같은 사람이 두 번 보이면 어느 쪽을 눌러야 할지 모른다.
  const mine = new Set(contacts.map((c: any) => c.id));
  const newcomers = found.filter((p) => !mine.has(p.id));

  const connect = async (id: string) => {
    if (joining) return;
    setJoining(id);
    await onConnect?.(id);
    setJoining(null);
    onQuery("");
  };

  return (
    <div className="rmg-ppl-wrap">
      <div className="rmg-ppl-search">
        <Search className="rmg-ppl-searchic" />
        <input
          className="rmg-ppl-searchin"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={en ? "Name or @handle" : "이름 · @핸들로 찾기"}
          aria-label={en ? "Search people" : "사람 찾기"}
        />
        {q && (
          <button type="button" className="rmg-ppl-searchx" onClick={() => onQuery("")} aria-label={en ? "Clear" : "지우기"}>
            <X className="rmg-drawer-pxic" />
          </button>
        )}
        {/* 여러 명과 함께할 자리 — 사람 한 명을 고르지 않고도 바로 만들 수 있어야 한다. */}
        <button type="button" className="rmg-ppl-act" onClick={onNewRoom}>
          + {en ? "New" : "만들기"}
        </button>
      </div>

      {contacts.length === 0 && !q ? (
        // 큰 그림 대신 다음 한 걸음만 말해 준다.
        <div className="rmg-ppl-blank">
          <p className="rmg-ppl-blank-t">{en ? "No one here yet." : "아직 연결된 사람이 없어요."}</p>
          <p className="rmg-ppl-blank-b">
            {en ? "Find someone on Comein by name or @handle, and start there." : "이름이나 @핸들로 Comein에서 사람을 찾아보세요."}
          </p>
        </div>
      ) : shown.length === 0 && newcomers.length === 0 && !finding ? (
        <p className="rmg-ppl-none">
          {q.length < 2
            ? (en ? "Type two letters or more." : "두 글자 이상 적어 주세요.")
            : (en ? `No one matches "${query}".` : `"${query}"와 맞는 사람이 없어요.`)}
        </p>
      ) : shown.length === 0 ? null : (
        // 펼치지 않는다 — 고르면 오른쪽 칸이 그 사람 이야기로 바뀐다.
        // (예전처럼 목록 안에서 펼치면 아래가 밀려 리스트가 출렁이고, 버튼이 세 개나 겹쳐 보였다.)
        <ul className="rmg-ppl-list">
          {shown.map((c: any) => {
            const on = personId === c.id;
            const n = (sharedEventsWith(c.id) as any[]).length;
            const nu = unreadOf ? unreadOf(c.id) : 0;
            return (
              <li key={c.id} className={`rmg-ppl ${on ? "on" : ""}`}>
                <button type="button" className="rmg-ppl-head" aria-current={on} onClick={() => onSelectPerson(on ? null : c.id)}>
                  <span className="rmg-ppl-av">{c.name?.slice(0, 1) ?? "·"}</span>
                  <span className="rmg-ppl-txt">
                    <span className={`rmg-ppl-name ${nu > 0 ? "unread" : ""}`}>{c.name}</span>
                    {(c.handle || c.org) && <span className="rmg-ppl-org">{c.org ?? `@${c.handle}`}</span>}
                  </span>
                  {/* 읽지 않은 말이 있으면 점 하나. 숫자를 매달면 목록이 알림판이 된다. */}
                  {nu > 0 && <span className="rmg-ppl-dot" aria-label={en ? "New" : "새 메시지"} />}
                  {/* 함께하는 일정이 몇 개인지만 조용히 — 이게 이 사람과 나의 접점이다. */}
                  {n > 0 && <span className="rmg-ppl-n">{en ? `${n}` : `일정 ${n}`}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Comein 계정에서 찾은 사람 — 아직 내 사람이 아니다. 이어야 목록으로 올라온다.
          없는 사람을 지어내 넣지 않는다: 여기 뜨는 건 전부 실재하는 계정이다. */}
      {q.length >= 2 && (finding || newcomers.length > 0) && (
        <div className="rmg-ppl-find">
          <p className="rmg-eyebrow rmg-ppl-findeye">
            {finding ? (en ? "Looking…" : "찾는 중…") : (en ? "On Comein" : "Comein에서")}
          </p>
          <ul className="rmg-ppl-list">
            {newcomers.map((p: any) => (
              <li key={p.id} className="rmg-ppl">
                <div className="rmg-ppl-head rmg-ppl-findrow">
                  <span className="rmg-ppl-av">{p.name?.slice(0, 1) ?? "·"}</span>
                  <span className="rmg-ppl-txt">
                    <span className="rmg-ppl-name">{p.name}</span>
                    <span className="rmg-ppl-org">@{p.handle}</span>
                  </span>
                  {p.connected ? (
                    <span className="rmg-ppl-n">{en ? "Connected" : "연결됨"}</span>
                  ) : (
                    <button type="button" className="rmg-ppl-act" disabled={joining === p.id} onClick={() => connect(p.id)}>
                      {joining === p.id ? (en ? "…" : "…") : (en ? "Connect" : "연결")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** 사용 가이드 투어 — 화면을 덮는 모달이 아니라, 진짜 화면 위에서 한 곳씩 짚어 준다.
 *  각 단계는 실제 요소(data-tour)를 가리키고, 필요하면 그 화면으로 먼저 옮겨 간다.
 *  가짜 UI 를 만들지 않는다 — 사용자가 배우는 건 지금 눈앞의 그 버튼이다. */
type TourStep = { key: string; target: string; title: string; body: string; example?: string; before?: () => void };

function GuideTour({ steps, index, lang, onIndex, onClose }: {
  steps: TourStep[];
  index: number;
  lang: Lang;
  onIndex: (i: number) => void;
  onClose: (completed: boolean) => void;
}) {
  const en = lang === "en";
  const step = steps[index];
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  // 대상이 화면에 나타날 때까지 잠깐 기다린다 — 뷰를 옮긴 직후엔 아직 그려지지 않았을 수 있다.
  React.useEffect(() => {
    step.before?.();
    let raf = 0;
    let tries = 0;
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
        setRect(el.getBoundingClientRect());
        return;
      }
      if (tries++ < 90) raf = requestAnimationFrame(find);
      else setRect(null);
    };
    raf = requestAnimationFrame(find);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  // 창이 바뀌면 자리도 따라간다.
  React.useEffect(() => {
    const sync = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => { window.removeEventListener("resize", sync); window.removeEventListener("scroll", sync, true); };
  }, [step]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
      if (e.key === "ArrowRight") onIndex(Math.min(index + 1, steps.length - 1));
      if (e.key === "ArrowLeft") onIndex(Math.max(index - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, steps.length, onIndex, onClose]);

  const last = index === steps.length - 1;
  const pad = 8;

  // 카드 크기는 재서 쓴다 — 짐작한 값을 쓰면 단계마다 본문 길이가 다른 만큼 어긋나고,
  // 가장 긴 마지막 단계에서 아래가 화면 밖으로 잘린다(실제로 그랬다).
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState({ w: 380, h: 240 });
  React.useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    if (Math.abs(w - box.w) > 1 || Math.abs(h - box.h) > 1) setBox({ w, h });
  });

  // 카드는 대상 옆에 서되 화면 밖으로 나가지 않는다. 오른쪽이 좁으면 왼쪽으로 돈다.
  const card = (() => {
    const { w: W, h: H } = box;
    const M = 20;
    // 화면이 카드보다 낮으면 위쪽에 붙인다 — 가운데 맞추려다 위아래가 같이 잘린다.
    const clampTop = (t: number) => (window.innerHeight - H - M < M ? M : Math.max(M, Math.min(t, window.innerHeight - H - M)));
    if (!rect) return { left: window.innerWidth / 2 - W / 2, top: clampTop(window.innerHeight / 2 - H / 2) };
    let left = rect.right + M;
    if (left + W > window.innerWidth - M) left = rect.left - W - M;
    if (left < M) left = Math.min(Math.max(M, rect.left), window.innerWidth - W - M);
    return { left, top: clampTop(rect.top + rect.height / 2 - H / 2) };
  })();

  return (
    <div className="rmg-tour" role="dialog" aria-label={en ? "Guide" : "사용 가이드"}>
      {/* 나머지 화면을 아주 옅게 눌러 둔다 — 스포트라이트가 아니라 '지금 여기'만 남기는 정도. */}
      {rect && (
        <div
          className="rmg-tour-ring"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      )}
      <div ref={cardRef} className="rmg-tour-card" style={{ left: card.left, top: card.top }}>
        <p className="rmg-tour-title">{step.title}</p>
        <p className="rmg-tour-body">{step.body}</p>
        {/* 아직 아무것도 없는 워크스페이스라 가리킬 실물이 없다 —
            대신 '이런 모습이 된다' 를 한 조각 보여 준다. */}
        {step.example && <p className="rmg-tour-eg">{step.example}</p>}
        <div className="rmg-tour-foot">
          <span className="rmg-tour-dots" aria-label={`${index + 1} / ${steps.length}`}>
            {steps.map((s, i) => <span key={s.key} className={`rmg-tour-dot ${i === index ? "on" : ""}`} />)}
          </span>
          <div className="rmg-tour-acts">
            {index > 0 && (
              <button type="button" className="rmg-ppl-act" onClick={() => onIndex(index - 1)}>{en ? "Back" : "이전"}</button>
            )}
            <button type="button" className="rmg-ppl-act primary" onClick={() => (last ? onClose(true) : onIndex(index + 1))}>
              {last ? (en ? "Start" : "시작하기") : (en ? "Next" : "다음")}
            </button>
          </div>
        </div>
        <button type="button" className="rmg-tour-skip" onClick={() => onClose(true)}>{en ? "Skip" : "건너뛰기"}</button>
      </div>
    </div>
  );
}

/** 계정 — 로그인해야 이 워크스페이스가 이 기기 밖으로 나간다.
 *  연결 전에는 "이 브라우저에만 있습니다" 라고 정직하게 말한다(조용히 안 되는 척하지 않는다). */
function AccountRow({ lang, remote }: { lang: Lang; remote: RemoteState }) {
  const en = lang === "en";
  const [email, setEmail] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const go = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e: any) { setErr(e?.message ?? "실패했어요."); } finally { setBusy(false); }
  };

  return (
    <div className="rmg-set-row">
      <div className="rmg-set-label">
        <p className="rmg-set-k">{en ? "Account" : "계정"}</p>
        <p className="rmg-set-d">
          {!remote.configured
            ? (en ? "Not connected — everything stays in this browser." : "연결되지 않았어요 — 지금 만든 것은 이 브라우저에만 있습니다.")
            : remote.signedIn
              ? (en ? "Connected. Your workspace follows you." : "연결됐어요. 워크스페이스가 기기를 따라옵니다.")
              : (en ? "Sign in to keep your workspace." : "로그인하면 워크스페이스가 저장됩니다.")}
          {remote.error ? ` · ${remote.error}` : ""}
          {err ? ` · ${err}` : ""}
        </p>
      </div>

      {!remote.configured ? (
        <span className="rmg-acct-off">{en ? "Local" : "로컬"}</span>
      ) : remote.signedIn ? (
        <button type="button" className="rmg-ppl-act" disabled={busy} onClick={() => go(signOutRemote)}>
          {en ? "Sign out" : "로그아웃"}
        </button>
      ) : sent ? (
        <span className="rmg-acct-off">{en ? "Check your email" : "메일함을 확인하세요"}</span>
      ) : (
        <div className="rmg-acct">
          <input
            className="rmg-set-input rmg-acct-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={en ? "email" : "이메일"}
            autoComplete="username"
            aria-label={en ? "Email" : "이메일"}
          />
          <input
            className="rmg-set-input rmg-acct-pw"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={en ? "password" : "비밀번호"}
            autoComplete="current-password"
            aria-label={en ? "Password" : "비밀번호"}
          />
          <button
            type="button"
            className="rmg-ppl-act primary"
            disabled={busy || !email.includes("@") || pw.length < 6}
            onClick={() => go(() => signInWithPassword(email, pw))}
          >
            {en ? "Sign in" : "로그인"}
          </button>
          <button
            type="button"
            className="rmg-ppl-act"
            disabled={busy || !email.includes("@") || pw.length < 6}
            onClick={() => go(() => signUpWithPassword(email, pw))}
          >
            {en ? "Sign up" : "가입"}
          </button>
          {/* 비밀번호 없이 들어오는 길도 남겨 둔다 */}
          <button
            type="button"
            className="rmg-ppl-act"
            disabled={busy || !email.includes("@")}
            onClick={() => go(async () => { await signInWithEmail(email); setSent(true); })}
          >
            {en ? "Link" : "링크"}
          </button>
          <button type="button" className="rmg-ppl-act" disabled={busy} onClick={() => go(() => signInWithProvider("github"))}>
            GitHub
          </button>
        </div>
      )}
    </div>
  );
}

/** 안내 — 레일의 문을 누르면 열린다.
 *  기능 설명서가 아니라 '이 공간을 어떻게 쓰는가' 에 대한 짧은 글. 목록을 나열하지 않는다. */
function GuidePanel({ lang }: { lang: Lang }) {
  const en = lang === "en";
  const rows: { k: string; v: string }[] = en
    ? [
        { k: "Just say it", v: "Type a line in the bar at the bottom. Comein decides whether it's an event, a task, a note, or a meeting — and files it where it belongs." },
        { k: "Today", v: "What today is made of. The greeting, the weather, what's coming, and a quiet briefing." },
        { k: "Calendar", v: "A month and the day's 24 hours side by side. Press a day to look into it, press it again for the timetable." },
        { k: "People", v: "Not a contact list. Pick someone and you'll see what you're doing together — and the conversation that belongs to it." },
        { k: "Rooms", v: "Conversations live on events. Make an event with someone and its room comes with it; add or remove people any time." },
      ]
    : [
        { k: "말하면 됩니다", v: "아래 한 줄에 그냥 적으세요. 일정인지 할 일인지 메모인지 회의인지는 Comein이 판단해 제자리에 놓습니다." },
        { k: "오늘", v: "오늘이 무엇으로 이루어져 있는지. 인사와 날씨, 다가오는 순간, 그리고 조용한 브리핑." },
        { k: "캘린더", v: "한 달과 그 하루의 24시간이 나란히 섭니다. 날짜를 누르면 그 날을 보고, 한 번 더 누르면 시간표로 들어갑니다." },
        { k: "사람", v: "연락처가 아닙니다. 사람을 고르면 그와 함께하는 일이 보이고, 그 일에 매인 대화가 함께 열립니다." },
        { k: "대화방", v: "대화는 일정에 매여 있습니다. 함께할 자리를 만들면 방이 딸려 오고, 사람은 언제든 부르거나 뺄 수 있습니다." },
      ];

  return (
    <div className="rmg-guide">
      <p className="rmg-guide-lead">
        {en
          ? "Comein doesn't help you manage work. It helps work organize itself."
          : "Comein은 일을 관리하게 만드는 도구가 아니라, 일이 스스로 정리되게 만드는 공간입니다."}
      </p>
      <div className="rmg-guide-rows">
        {rows.map((r) => (
          <div key={r.k} className="rmg-ctx-line">
            <span className="rmg-ctx-k">{r.k}</span>
            <span className="rmg-ctx-v">{r.v}</span>
          </div>
        ))}
      </div>
      <p className="rmg-guide-foot">
        {en ? "Nothing was tidied by you. It was already in order." : "당신은 아무것도 정리하지 않았는데, 이미 정리되어 있을 겁니다."}
      </p>
    </div>
  );
}

/** 설정 — 가로 옵션의 '설정 란'. 워크스페이스 스토어 설정을 그대로 편집(이름·언어·유형·주 시작·테마·알림). */
function SettingsPanel({ settings, onChange, theme, onTheme, mounted, lang, onReplayGuide, remote }: {
  onReplayGuide: () => void;
  remote: RemoteState;
  settings: { name: string; language: "ko" | "en"; mode: "student" | "office" | "general"; weekStart: "sun" | "mon"; notifications: boolean; autoConfirm: boolean; textScale: number };
  onChange: (patch: Partial<SettingsPanelProps>) => void;
  theme: string | undefined;
  onTheme: (t: "light" | "dark") => void;
  mounted: boolean;
  lang: Lang;
}) {
  const t = L(lang);
  return (
    <div className="rmg-set">
      <AccountRow lang={lang} remote={remote} />
      <div className="rmg-set-row">
        <div className="rmg-set-label">
          <p className="rmg-set-k">{lang === "en" ? "Guide" : "사용 가이드"}</p>
          <p className="rmg-set-d">{lang === "en" ? "Walk through Comein again." : "Comein을 다시 한 번 둘러봅니다."}</p>
        </div>
        <button type="button" className="rmg-ppl-act" onClick={onReplayGuide}>
          {lang === "en" ? "Replay" : "다시 보기"}
        </button>
      </div>
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
        {/* 칸이 아니라 바 — 편한 크기는 사람마다 세 칸에 딱 떨어지지 않는다. */}
        <div className="rmg-size">
          <span className="rmg-size-a">가</span>
          <input
            type="range"
            className="rmg-size-bar"
            min={TEXT_SCALE_MIN}
            max={TEXT_SCALE_MAX}
            /* 0.01 — 손끝을 따라오게. 0.02 는 한 칸씩 툭툭 걸리는 느낌을 준다. */
            step={0.01}
            value={settings.textScale}
            onChange={(e) => onChange({ textScale: Number(e.target.value) })}
            aria-label={t.setSize}
          />
          <span className="rmg-size-b">가</span>
          <span className="rmg-size-v">{Math.round(settings.textScale * 100)}%</span>
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
type SettingsPanelProps = { name: string; language: "ko" | "en"; mode: "student" | "office" | "general"; weekStart: "sun" | "mon"; notifications: boolean; autoConfirm: boolean; textScale: number };

const CSS = `
.rmg {
  --paper: #141210; --surface: #1B1813; --ink: #F2F0EC; --muted: #98938A; --faint: #5E574C; --hair: #262019; --accent: #9B8E86; --glow: rgba(155,142,134,0.16);
  --rail-w: 64px;  /* 레일 폭 — fixed 로 떠 있는 캡처바가 캔버스 기준으로 가운데를 잡는 데 쓴다 */

  /* ── 간격 체계 — 8px 배수 하나로 통일. 임의값을 쓰지 않는다. ── */
  --sp-1: 8px; --sp-2: 16px; --sp-3: 24px; --sp-4: 32px; --sp-5: 40px; --sp-6: 48px;
  /* 모서리도 토큰으로 — 컴포넌트마다 다른 반경을 쓰지 않는다. */
  --r-sm: 8px; --r: 12px; --r-lg: 16px;
  /* --nav-row / --nav-gap (레일 한 줄의 규격) 은 NAV_ROW·NAV_GAP 에서 주입된다.
     인디케이터 이동 거리를 같은 숫자에서 파생시키기 위해 출처를 JS 한 곳으로 모았다. */
  /* 화면 가장자리 여백 — 넓어질수록 함께 자라되 88px 에서 멈춘다. */
  --gutter: clamp(32px, 4vw, 88px);
  /* ── 하나의 작업면(Workspace) ──
     세 화면이 공유하는 단 하나의 기준 폭. 화면을 따라 넓어지되 1440px 에서 멈춘다
     (그 이상은 눈이 한 줄을 따라가기 어렵다). 뷰마다 폭을 달리 두지 않는다 —
     그렇게 하면 시계·상단 문구·캡처바·배경 문양이 탭을 옮길 때마다 같이 움직인다. */
  --workspace: min(1440px, calc(100% - 2 * var(--gutter)));
  /* 캔버스 오른쪽 끝에서 작업면 오른쪽 끝까지의 거리 — 시계·상단바가 이 선에 맞춰 선다. */
  --edge: max(var(--gutter), calc((100% - var(--workspace)) / 2));
  --ctx-w: 288px;                       /* Context Rail — Today·People 이 같은 규격으로 쓴다 */
  --reading: 640px;                     /* 글·목록이 읽히는 한 칸의 최대 폭 */
  --ring-gap: clamp(32px, 3vw, 72px);   /* 달력과 링 사이 */
  --dial-w: clamp(320px, 26vw, 460px);  /* 원의 최대 지름 — 컬럼이 넓어져도 여기서 멈추고 가운데 선다 */
  /* 위 여백 — 예전 88px 은 상단을 과하게 비웠다. 세 화면이 함께 올라오므로 기준선은 그대로. */
  --flow-top: clamp(36px, 4.5vh, 56px);
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
/* 좁은 화면에서는 Context Rail 이 물러나고 본문이 작업면을 다 쓴다. */
@media (max-width: 1239px) { .rmg { --ctx-w: 0px; } }
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
/* 글자 크기 — zoom 은 레이아웃을 통째로 다시 재는 값이라 뻑뻑하게 툭툭 걸린다.
   대신 font-size 를 키운다. 본문이 rem/em 기반이라 같은 결과를 내면서 부드럽게 흐른다. */
.rmg-flow, .rmg-topbar, .rmg-panel-head, .rmg-panel-body {
  font-size: calc(1rem * var(--rmg-fs, 1));
  transition: font-size 160ms ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .rmg-flow, .rmg-topbar, .rmg-panel-head, .rmg-panel-body { transition: none; }
}

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
  width: min(560px, var(--workspace)); padding: var(--sp-1) 14px; border-radius: var(--r);
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
/* 되묻기 — 스침보다 한 칸 위. 스스로 사라지지 않고 답을 기다리므로 테두리를 한 단계 또렷하게. */
.rmg-ask-back { position: fixed; bottom: 140px; left: var(--rail-w, 64px); right: 0; margin: 0 auto; z-index: 19;
  display: flex; align-items: center; gap: 10px;
  width: min(560px, var(--workspace)); padding: var(--sp-1) 10px var(--sp-1) 14px; border-radius: var(--r);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--ink) 14%, var(--hair));
  backdrop-filter: blur(12px); box-shadow: 0 12px 34px -18px rgba(0,0,0,0.6);
  animation: rmg-rise 0.34s cubic-bezier(0.22,1,0.36,1) both;
  transition: left 280ms cubic-bezier(0.22,1,0.36,1); }
.rmg-ask-back .rmg-flash-text { white-space: normal; color: var(--ink); }
.rmg-flash-x { display: grid; place-items: center; width: 24px; height: 24px; border: 0; background: none; color: var(--faint); cursor: pointer; border-radius: 7px; flex-shrink: 0; transition: color 0.2s, background 0.2s; }
.rmg-flash-x:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 7%, transparent); }
.rmg-flash-xic { width: 14px; height: 14px; stroke-width: 2; }
@media (prefers-reduced-motion: reduce) { .rmg-ask-back { animation: none; } }

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
/* 문 — 마크이자 안내로 들어가는 입구. 다른 레일 항목과 같은 행 규격을 쓴다. */
.rmg-rail-mark { display: flex; align-items: center; gap: 12px; width: 100%; height: var(--nav-row); padding: 0 10px; border: 0; background: none; font: inherit; text-align: left; border-radius: var(--r); color: var(--ink); overflow: hidden; cursor: pointer; transition: background 170ms ease-out; }
.rmg-rail-mark:hover { background: color-mix(in srgb, var(--ink) 4%, transparent); }
.rmg-rail-mark.on { background: color-mix(in srgb, var(--ink) 7%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 5%, transparent); }
.rmg-rail-mark:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }

/* ── 오늘 화면 오른쪽의 문 ──
   장식이 아니라 입구다. 누르면 문짝이 안쪽으로 열리고, 그 자리에 안내가 펼쳐진다. */
/* 조용함은 그림(문)이 맡고, 글자는 읽히게 둔다.
   예전엔 버튼 전체에 opacity 를 걸어 두어 라벨까지 같이 흐려졌다 —
   덕분에 문은 차분했지만 '무엇을 누르는 것인지'가 안 읽혔다. 둘을 떼어 놓는다. */
.rmg-doorway { position: sticky; top: var(--flow-top); display: flex; flex-direction: column; align-items: center; gap: var(--sp-2);
  width: 100%; padding: var(--sp-6) var(--sp-3); border: 0; background: none; font: inherit; cursor: pointer;
  color: var(--ink); }
.rmg-doorway:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 4px; border-radius: var(--r); }
.rmg-doorway-door { width: var(--door-w); aspect-ratio: 40/52; opacity: 0.58; transition: opacity 400ms ease; }
.rmg-doorway:hover .rmg-doorway-door, .rmg-doorway.opening .rmg-doorway-door { opacity: 0.88; }
.rmg-doorway-cta { font-size: 0.86rem; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: color-mix(in srgb, var(--ink) 64%, transparent); transition: color 400ms ease; }
.rmg-doorway:hover .rmg-doorway-cta { color: color-mix(in srgb, var(--ink) 90%, transparent); }
/* 문짝이 안쪽으로 열린다 — 경첩은 왼쪽 모서리. 빛이 문틈으로 번진다. */
.rmg-doorway.opening .aidoor-panel { transform-box: fill-box; transform-origin: left center; animation: rmg-door-swing 520ms cubic-bezier(0.22,1,0.36,1) both; }
.rmg-doorway.opening .aidoor-svg { animation: rmg-door-glow 520ms ease both; }
@keyframes rmg-door-swing { from { transform: rotateY(0deg) scaleX(1); } to { transform: scaleX(0.12); } }
@keyframes rmg-door-glow { from { filter: none; } to { filter: drop-shadow(0 0 18px var(--glow)); } }
@media (prefers-reduced-motion: reduce) {
  .rmg-doorway.opening .aidoor-panel, .rmg-doorway.opening .aidoor-svg { animation: none; }
}
/* hover 에서만 드러나는 것들 — 평소엔 문이 조용히 서 있기만 한다. */
.rmg-doorway-wrap { position: relative; --door-w: clamp(160px, 17vw, 224px); }
.rmg-doorway-hint { font-size: 0.82rem; color: color-mix(in srgb, var(--ink) 66%, transparent); opacity: 0; transform: translateY(-3px); transition: opacity 200ms ease-out, transform 200ms ease-out; }
.rmg-doorway-wrap:hover .rmg-doorway-hint { opacity: 1; transform: none; }
.rmg-doorway-wrap:hover .rmg-doorway { transform: scale(1.012); }
.rmg-doorway { transition: transform 200ms ease-out; }
/* 처음 온 사람에게만 — 점 하나. 배지도 숫자도 두지 않는다. */
.rmg-doorway-new { position: absolute; top: calc(var(--sp-6) - 2px); right: calc(50% - var(--door-w) / 2 - 4px); width: 6px; height: 6px; border-radius: 50%; background: color-mix(in srgb, var(--accent) 75%, transparent); }
/* 미리보기 — 툴팁이 아니라 이 화면과 같은 재질의 작은 카드. */
.rmg-doorprev { position: absolute; left: 50%; transform: translate(-50%, 6px); top: calc(100% - var(--sp-4));
  width: min(260px, 100%); padding: var(--sp-2); border: 1px solid var(--hair); border-radius: var(--r);
  background: color-mix(in srgb, var(--surface) 92%, transparent); backdrop-filter: blur(10px);
  box-shadow: 0 12px 30px -22px rgba(0,0,0,0.5);
  opacity: 0; pointer-events: none; transition: opacity 200ms ease-out, transform 200ms ease-out; }
/* 보일 때만 눌린다 — 안 보이는 카드가 클릭을 삼키면 뒤의 것이 안 눌린다. */
.rmg-doorway-wrap:hover .rmg-doorprev { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; cursor: pointer; }
.rmg-doorprev-t { margin: 0 0 6px; font-size: 0.88rem; font-weight: 500; color: var(--ink); }
.rmg-doorprev-b { margin: 0 0 var(--sp-1); font-size: 0.82rem; font-weight: 400; line-height: 1.6; color: color-mix(in srgb, var(--ink) 76%, transparent); }
.rmg-doorprev-cta { margin: 0; font-size: 0.8rem; font-weight: 500; color: color-mix(in srgb, var(--ink) 68%, transparent); }
.rmg-doorway-wrap:hover .rmg-doorprev:hover .rmg-doorprev-cta { color: var(--ink); }
@media (prefers-reduced-motion: reduce) {
  .rmg-doorway, .rmg-doorway-hint, .rmg-doorprev { transition: none; }
}

/* ── 사용 가이드 투어 ──
   화면을 덮는 모달이 아니다. 지금 설명하는 것만 남기고 나머지를 아주 옅게 눌러 둔다. */
.rmg-tour { position: fixed; inset: 0; z-index: 60; pointer-events: none; }
.rmg-tour-ring { position: fixed; border-radius: var(--r); pointer-events: none;
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  /* 스포트라이트가 아니라 '나머지 UI 의 opacity 를 낮추는' 정도. */
  box-shadow: 0 0 0 9999px color-mix(in srgb, var(--paper) 62%, transparent);
  transition: left 220ms ease-out, top 220ms ease-out, width 220ms ease-out, height 220ms ease-out; }
/* 가이드 카드 — 여기서만은 절제가 곧 흐릿함이 되면 안 된다.
   차분함은 투명도로 만드는 게 아니다. 옅게 깔아 얻은 고요함은 그냥 안 읽히는 것이고,
   하필 이 화면은 Comein 을 처음 보는 사람이 읽는 화면이다.
   그래서 분위기(여백·무채색·낮은 채도)는 그대로 두고 위계는 크기와 무게로 세운다 —
   본문에 opacity 를 더 먹이는 대신 글자를 키우고 굵기를 준다. 카드 크기는 건드리지 않는다. */
.rmg-tour-card { position: fixed; width: min(380px, calc(100vw - 32px)); pointer-events: auto;
  display: flex; flex-direction: column; gap: 0;
  padding: var(--sp-3) var(--sp-3) var(--sp-2); border: 1px solid color-mix(in srgb, var(--ink) 11%, var(--hair)); border-radius: var(--r-lg);
  background: color-mix(in srgb, var(--surface) 98%, transparent); backdrop-filter: blur(12px);
  box-shadow: 0 18px 44px -26px rgba(0,0,0,0.55);
  animation: rmg-tour-in 200ms ease-out both;
  transition: left 220ms ease-out, top 220ms ease-out; }
@keyframes rmg-tour-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .rmg-tour-card, .rmg-tour-ring { animation: none; transition: none; } }
/* 제목 — 카드에서 가장 먼저 읽히는 것. 흐리게 두지 않는다(불투명 100%). */
.rmg-tour-title { margin: 0 0 14px; font-size: 1.34rem; font-weight: 600; line-height: 1.32; letter-spacing: -0.022em; color: var(--ink); }
/* 본문 — 두 줄로 감겨도 답답하지 않게 행간을 넉넉히. */
.rmg-tour-body { margin: 0 0 22px; font-size: 0.98rem; font-weight: 400; line-height: 1.7; color: color-mix(in srgb, var(--ink) 82%, transparent); }
/* 예시 한 줄 — 아직 비어 있는 워크스페이스에서 '이렇게 된다' 를 보여 준다.
   보조 정보지만 읽으라고 놓은 것이므로, 읽히는 선까지는 올린다. */
.rmg-tour-eg { margin: 0 0 20px; padding: 10px 12px; border-left: 2px solid color-mix(in srgb, var(--ink) 24%, var(--hair)); border-radius: 0 var(--r-sm) var(--r-sm) 0;
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  font-size: 0.875rem; font-weight: 400; line-height: 1.62; color: color-mix(in srgb, var(--ink) 74%, transparent); }
.rmg-tour-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); padding-top: 14px; border-top: 1px solid color-mix(in srgb, var(--ink) 10%, var(--hair)); }
.rmg-tour-acts { display: flex; gap: 8px; }
.rmg-tour-acts .rmg-ppl-act { font-size: 0.875rem; font-weight: 500; padding: 7px 16px; color: color-mix(in srgb, var(--ink) 70%, transparent); border-color: color-mix(in srgb, var(--ink) 15%, var(--hair)); }
.rmg-tour-acts .rmg-ppl-act:hover { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 30%, var(--hair)); }
/* '다음' 은 이 카드에서 할 일이 하나뿐임을 말한다 — 채워서 분명히 하되,
   색으로 소리치지 않는다(무채색 잉크. 이 화면에 액센트 컬러를 들이지 않는다). */
.rmg-tour-acts .rmg-ppl-act.primary { background: color-mix(in srgb, var(--ink) 92%, transparent); border-color: transparent; color: var(--paper); }
.rmg-tour-acts .rmg-ppl-act.primary:hover { background: var(--ink); color: var(--paper); border-color: transparent; }
.rmg-tour-dots { display: flex; gap: 6px; }
.rmg-tour-dot { width: 6px; height: 6px; border-radius: 50%; background: color-mix(in srgb, var(--ink) 24%, transparent); transition: background 200ms ease-out; }
.rmg-tour-dot.on { background: color-mix(in srgb, var(--ink) 88%, transparent); }
/* 건너뛰기 — 강조하지 않되, 찾는 사람 눈에는 보여야 한다. */
.rmg-tour-skip { position: absolute; top: 10px; right: 12px; border: 0; background: none; font: inherit; font-size: 0.85rem; font-weight: 400; color: color-mix(in srgb, var(--ink) 70%, transparent); cursor: pointer; padding: 4px 6px; border-radius: 6px; transition: color 170ms ease-out; }
.rmg-tour-skip:hover { color: var(--ink); }

/* 열린 뒤 — 문이 있던 자리에 안내가 그대로 선다(새 창이 아니라 이 화면의 한 칸). */
.rmg-guidepanel { position: sticky; top: var(--flow-top); display: flex; flex-direction: column; gap: var(--sp-3);
  max-height: calc(100vh - var(--flow-top) - var(--flow-bottom)); overflow-y: auto;
  padding-left: var(--sp-4); border-left: 1px solid var(--hair);
  animation: rmg-guide-in 320ms cubic-bezier(0.22,1,0.36,1) both; }
@keyframes rmg-guide-in { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .rmg-guidepanel { animation: none; } }
.rmg-guidepanel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-2); }
@media (max-width: 1239px) { .rmg-guidepanel { padding-left: 0; border-left: 0; } }

/* 안내 — 목록이 아니라 짧은 글. */
.rmg-guide { max-width: 620px; }
.rmg-guidepanel .rmg-guide-lead { font-size: clamp(1rem, 1.6vw, 1.15rem); margin-bottom: var(--sp-4); }
.rmg-guidepanel .rmg-ctx-line { grid-template-columns: 5.4em 1fr; gap: var(--sp-2); padding: var(--sp-2) 0; }
.rmg-guidepanel .rmg-ctx-v { font-size: 0.9rem; line-height: 1.6; }
.rmg-guide-lead { margin: 0 0 var(--sp-5); font-size: clamp(1.15rem, 2.2vw, 1.45rem); font-weight: 300; line-height: 1.5; letter-spacing: -0.015em; color: var(--ink); }
.rmg-guide-rows { display: flex; flex-direction: column; }
.rmg-guide-foot { margin: var(--sp-5) 0 0; font-size: 0.9rem; font-weight: 300; line-height: 1.6; color: var(--faint); }
.rmg.rail-open .rmg-rail-mark .aidoor-svg { filter: drop-shadow(0 0 7px var(--glow)); }
.rmg-rail-door { width: 19px; height: 24px; flex: 0 0 19px; }
.rmg-rail-word { font-size: 0.98rem; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); }

/* 오늘·캘린더·사람은 메뉴 셋이 아니라 하나의 navigation group — 같은 행 규격, 같은 간격으로 묶인다.
   (마크·foot 과는 --sp-3 만큼 떨어져 있어 '세 개가 한 덩어리'로 읽힌다.) */
.rmg-rail-nav { position: relative; display: flex; flex-direction: column; gap: var(--nav-gap); }
.rmg-rail-foot { margin-top: auto; display: flex; flex-direction: column; gap: var(--nav-gap); }
/* 활성 인디케이터 — 선택 항목 사이를 미끄러지듯 이동(morph). 스텝은 행 높이+간격에서 파생된다. */
.rmg-rail-ind { position: absolute; left: 0; right: 0; top: 0; height: var(--nav-row); border-radius: var(--r); z-index: 0; pointer-events: none;
  background: color-mix(in srgb, var(--ink) 7%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 5%, transparent);
  transition: transform 280ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease;
  will-change: transform; }
/* 좌측 3px 표식 — 글로우 없이. 지금 어느 공간에 있는지만 조용히 말한다. */
.rmg-rail-ind::before { content: ""; position: absolute; left: 1px; top: 50%; transform: translateY(-50%); width: 3px; height: 18px; border-radius: 0 3px 3px 0; background: color-mix(in srgb, var(--ink) 42%, transparent); }
.rmg-rail-ind[data-hidden="true"] { opacity: 0; }
.rmg-railbtn { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; width: 100%; height: var(--nav-row); padding: 0 10px; box-sizing: border-box; border: 0; border-radius: var(--r); background: none; color: var(--faint); cursor: pointer; text-decoration: none;
  transition: background 170ms ease-out, color 170ms ease-out; }
.rmg-railbtn > .rmg-railicon { flex: 0 0 19px; }
/* Hover — 배경이 아주 조금 오르고 대비가 한 단계 오른다. 자리는 움직이지 않는다(마우스가 지나가도 흔들리지 않게). */
.rmg-railbtn:hover { background: color-mix(in srgb, var(--ink) 4%, transparent); color: var(--muted); }
/* Click — 아주 약한 스케일(리플 없음) */
.rmg-railbtn:active { transform: scale(0.98); transition: transform 90ms ease-out; }
/* 선택 — 쉬는 상태(faint) → hover(muted) → 선택(ink). 세 단계가 분명해야 '지금 여기'가 읽힌다. */
.rmg-railbtn.on { color: var(--ink); }
.rmg-railbtn.on .rmg-railicon { color: var(--ink); }
.rmg-railbtn.on .rmg-raillabel { font-weight: 600; }
/* nav 항목의 활성 배경/바는 슬라이딩 인디케이터가 대신한다(중복 제거) */
.rmg-rail-nav .rmg-railbtn.on { background: none; }
.rmg-rail-nav .rmg-railbtn.on:hover { background: color-mix(in srgb, var(--ink) 4%, transparent); }
/* foot(설정)은 nav 밖이지만 같은 언어를 쓴다 — 설정이 현재 워크스페이스보다 강조되면 안 된다. */
.rmg-rail-foot .rmg-railbtn.on { background: color-mix(in srgb, var(--ink) 7%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 5%, transparent); }
.rmg-rail-foot .rmg-railbtn.on:hover { background: color-mix(in srgb, var(--ink) 9%, transparent); }
.rmg-rail-foot .rmg-railbtn.on::before { content: ""; position: absolute; left: 1px; top: 50%; transform: translateY(-50%); width: 3px; height: 18px; border-radius: 0 3px 3px 0; background: color-mix(in srgb, var(--ink) 42%, transparent); }
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
   작업면이 1440px 까지 자라므로, 문이 설 자리는 아주 넓은 화면에서만 생긴다. */
.rmg-heart { display: none; }
@media (min-width: 2000px) { .rmg-heart { display: block; } }
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

/* Context Rail 안의 월간 달력 — 이제 캔버스에 떠 있는 오버레이가 아니라 작업면의 한 컬럼이다.
   (오버레이였을 때는 뷰마다 본문과 겹치는 정도가 달라 화면마다 다른 UI 처럼 보였다.) */
.rmg-mc { user-select: none; position: relative; }
/* 날짜 미리보기 — 칸 오른쪽에 붙어 그 날만 조용히 펼친다. */
.rmg-mc-peek { position: absolute; z-index: 12; width: 200px; pointer-events: none;
  padding: var(--sp-1) 10px; border: 1px solid var(--hair); border-radius: var(--r-sm);
  background: color-mix(in srgb, var(--surface) 96%, transparent); backdrop-filter: blur(10px);
  box-shadow: 0 10px 26px -20px rgba(0,0,0,0.55);
  animation: rmg-fade 140ms ease both; }
@media (prefers-reduced-motion: reduce) { .rmg-mc-peek { animation: none; } }
.rmg-mc-peek-d { margin: 0 0 5px; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.04em; color: var(--faint); }
.rmg-mc-peek-none { margin: 0; font-size: 0.76rem; font-weight: 300; color: var(--faint); }
.rmg-mc-peek-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.rmg-mc-peek-row { display: flex; gap: 8px; align-items: baseline; }
.rmg-mc-peek-t { font-size: 0.72rem; color: var(--muted); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.rmg-mc-peek-x { font-size: 0.78rem; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
/* 고른 날 위에 손을 올려도 숫자는 그대로 — hover 규칙이 .sel 보다 특이성이 높아
   어두운 카드 위에 어두운 글자가 얹혀 숫자가 사라지던 것을 막는다. */
.rmg-mc-cell.sel:not(.empty):hover { background: none; color: var(--paper); }
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
/* 작업면이 넓어져 칸도 넓어졌다 — 세로를 더 눕혀야 6주치가 한 화면에 들어오고
   그 아래 '다가오는 순간'이 캡처바에 잠기지 않는다. */
.rmg-mc.big .rmg-mc-cell { aspect-ratio: 1.75; font-size: 1.02rem; border-radius: var(--r); }
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
/* 설정이 오른쪽 칸에 들어오면 좁아진다 — 라벨과 조작을 위아래로 접는다. */
.rmg-setpanel-body { flex: 1; min-height: 0; overflow-y: auto; }
.rmg-setpanel .rmg-set { max-width: none; }
/* 넉넉해졌으니 라벨과 조작을 다시 좌우로 편다 — 좁을 때만 접는다. */
.rmg-setpanel .rmg-set-row { padding: var(--sp-3) 0; }
.rmg-setpanel .rmg-acct { max-width: 62%; }
@media (max-width: 1100px) {
  .rmg-setpanel .rmg-set-row { flex-direction: column; align-items: stretch; gap: var(--sp-1); }
  .rmg-setpanel .rmg-set-input, .rmg-setpanel .rmg-acct-mail, .rmg-setpanel .rmg-acct-pw { width: 100%; }
  .rmg-setpanel .rmg-acct { max-width: none; justify-content: flex-start; }
  .rmg-setpanel .rmg-seg { align-self: flex-start; }
}

/* 글자 크기 — 칸이 아니라 바. 양 끝의 '가' 가 무엇을 조절하는지 말해 준다. */
.rmg-size { display: flex; align-items: center; gap: var(--sp-1); }
.rmg-size-a { font-size: 0.8rem; color: var(--faint); }
.rmg-size-b { font-size: 1.15rem; color: var(--muted); }
.rmg-size-v { font-size: 0.74rem; color: var(--faint); font-variant-numeric: tabular-nums; min-width: 3em; text-align: right; }
.rmg-size-bar { flex: 1; min-width: 90px; height: 2px; appearance: none; -webkit-appearance: none; background: var(--hair); border-radius: 2px; outline: none; cursor: pointer; }
.rmg-size-bar::-webkit-slider-thumb { appearance: none; -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--ink); border: 0; cursor: pointer; transition: transform 150ms ease-out; }
.rmg-size-bar::-webkit-slider-thumb:hover { transform: scale(1.15); }
.rmg-size-bar::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: var(--ink); border: 0; cursor: pointer; }
.rmg-size-bar:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 4px; }

.rmg-acct { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 6px; flex-shrink: 0; max-width: 60%; }
.rmg-acct-mail { width: min(150px, 28vw); padding: 6px 10px; font-size: 0.84rem; }
.rmg-acct-pw { width: min(120px, 24vw); padding: 6px 10px; font-size: 0.84rem; }
.rmg-acct-off { font-size: 0.76rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); flex-shrink: 0; }
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

/* ── 하나의 작업면 ──
   가로 패딩을 두지 않는다. 폭 자체가 기준선이라야 시계·캡처바·문양이 같은 선에 설 수 있다.
   세로로는 위에서부터 쌓는다 — 세 화면의 제목이 같은 높이에서 시작해야 하므로
   콘텐츠 양에 따라 오르내리는 세로 가운데 정렬은 쓰지 않는다. */
.rmg-flow { position: relative; z-index: 2; width: var(--workspace); min-height: 100%; display: flex; flex-direction: column; justify-content: flex-start; gap: var(--flow-gap); padding: var(--flow-top) 0 var(--flow-bottom);
  transition: opacity 170ms ease-out, transform 170ms ease-out; will-change: opacity, transform; }
/* 탭 전환: 이전 뷰가 6px 만큼 물러나며 사라지고(170ms), 새 뷰가 rmg-a* 로 떠오른다.
   교체 시점(JS 170ms)과 페이드 길이를 같게 둔다 — 어긋나면 다 사라지기 전에 툭 갈린다. */
.rmg-flow.flow-exit { opacity: 0; transform: translateY(-6px); }
/* 한 번이라도 탭을 옮긴 뒤엔 등장도 짧게. 첫 입장의 여유(0.62s)는 그때만의 것이다. */
.rmg-flow.switched .rmg-a1 { animation-duration: 200ms; animation-delay: 0ms; }
.rmg-flow.switched .rmg-a2 { animation-duration: 200ms; animation-delay: 25ms; }
.rmg-flow.switched .rmg-a3 { animation-duration: 200ms; animation-delay: 50ms; }
.rmg-flow.switched .rmg-a4 { animation-duration: 200ms; animation-delay: 75ms; }

/* ── PAGE HEADER — 세 화면 공통 ──
   제목의 시작 X(작업면 왼쪽 끝)와 위 Y(--flow-top)가 같아야 탭을 옮겨도 '같은 공간'으로 읽힌다.
   Today 는 인사말이, Calendar·People 은 뷰 이름이 이 자리에 온다. */
.rmg-pagehead { display: flex; flex-direction: column; gap: var(--sp-1); }
.rmg-pagetitle { margin: 0; font-size: clamp(2.2rem, 4.4vw, 3.2rem); font-weight: 300; letter-spacing: -0.035em; line-height: 1.04; color: var(--ink); }
.rmg-pagesub { margin: 0; font-size: 0.92rem; font-weight: 500; letter-spacing: 0.01em; color: var(--muted); font-variant-numeric: tabular-nums; }

/* ── PAGE BODY — Context Rail + 본문 ──
   바깥 상자(작업면)는 세 화면이 공유하고, 안쪽 컬럼 구성만 뷰마다 다르다.
   Today·People 은 [맥락 달력 | 읽는 칸 | 여백], Calendar 는 큰 달력이 레일 자리를 대신해 한 컬럼. */
.rmg-pagebody { display: grid; grid-template-columns: minmax(0, 1fr); column-gap: var(--sp-6); align-items: start; }
.rmg-pagebody[data-ctx="true"] { grid-template-columns: var(--ctx-w) minmax(0, var(--reading)) minmax(0, 1fr); }
/* 캘린더에서 일정을 열면 본문 옆에 같은 칸이 생긴다(서랍으로 띄우지 않는다). */
.rmg-pagebody[data-ctx="false"][data-aside="true"] { grid-template-columns: minmax(0, 1fr) minmax(320px, 420px); }
/* 설정은 곁들이는 칸이 아니라 하나의 화면이다 — 작업면을 통째로 받는다.
   본문을 옆에 남겨 두면 '설정을 보는 중'인지 '오늘을 보는 중'인지 눈이 두 곳으로 갈린다. */
.rmg-pagebody[data-settings="true"] { grid-template-columns: minmax(0, 1fr) !important; }
.rmg-pagebody[data-settings="true"] .rmg-pagemain { display: none; }
/* 다만 끝까지 늘리지는 않는다 — 1440px 을 가로지르는 설정 행은 읽는 눈이 멀리 간다. */
.rmg-pagebody[data-settings="true"] .rmg-pageaside { max-width: 780px; }
/* 레일이 물러난 폭에서는 빈 컬럼을 남기지 않는다. */
@media (max-width: 1239px) { .rmg-pagebody[data-ctx="true"] { grid-template-columns: minmax(0, var(--reading)) minmax(0, 1fr); } }
@media (max-width: 880px) {
  .rmg-pagebody[data-ctx="true"], .rmg-pagebody[data-ctx="false"][data-aside="true"] { grid-template-columns: minmax(0, 1fr); }
}
.rmg-pagemain { min-width: 0; display: flex; flex-direction: column; gap: var(--flow-gap); }
/* 세 번째 칸 — 사람의 맥락(일정 상세·대화)이 들어오는 자리. 행 높이를 다 받아야 sticky 가 붙는다. */
.rmg-pageaside { min-width: 0; align-self: stretch; }
/* Context Rail — Today·People 이 완전히 같은 폭·타이포·간격을 쓴다(페이지마다 다른 UI 로 보이지 않게). */
.rmg-ctxrail { min-width: 0; }
@media (max-width: 1239px) { .rmg-ctxrail { display: none; } }
.rmg-feat { display: flex; flex-direction: column; gap: var(--sp-3); min-width: 0; }

/* HERO */
.rmg-hero { display: flex; flex-direction: column; }
.rmg-mood { margin: 0; font-size: clamp(1.1rem, 2.6vw, 1.4rem); font-weight: 300; letter-spacing: -0.015em; color: var(--muted); }
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
  width: min(560px, var(--workspace));
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

/* 공통 · AI 귀속 태그 */
.rmg-tag-ai { display: inline-grid; place-items: center; width: 14px; color: var(--muted); flex-shrink: 0; }
.rmg-tag-door { width: 11px; height: 14px; }

/* Calendar 뷰 · 월(月) → 일(日) */
/* 달(月) ↔ 하루(시간표) 전환은 툭 갈아끼우지 않고 한 호흡으로 떠오른다. */
.rmg-cv { display: flex; flex-direction: column; gap: var(--sp-3); animation: rmg-cv-in 0.26s cubic-bezier(0.22,1,0.36,1) both; }
@keyframes rmg-cv-in { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .rmg-cv { animation: none; } }
/* 달력 ‖ 24시간 원 — 링은 296px 고정, 남는 폭은 달력이 가진다.
   좁아지면 링이 아래로 내려가되 두 요소의 좌우 기준선은 그대로 유지된다. */
/* 달력 약 62% ‖ 24시간 원 약 38% — 작업면의 가로를 끝까지 쓴다. */
.rmg-cv-split { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(320px, 1fr); gap: var(--ring-gap); align-items: start; }
/* 오른쪽 컬럼의 라벨은 왼쪽 '연·월' 헤더와 같은 높이의 칸을 차지한다 →
   두 라벨의 세로 중심이 맞고, 그 아래 요일 행과 링 상단도 같은 선에서 시작한다. */
.rmg-cv-col > .rmg-cv-eyebrow { display: flex; align-items: center; min-height: 30px; }
@media (max-width: 1000px) { .rmg-cv-split { grid-template-columns: minmax(0, 1fr); gap: var(--sp-4); } }
.rmg-cv-col { display: flex; flex-direction: column; gap: var(--sp-2); min-width: 0; }
.rmg-cv-eyebrow { margin: 0; font-size: 0.74rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); }
/* 일(日) 화면 — 달력 컬럼과 같은 폭을 쓴다. 월↔일을 오갈 때 좌우 기준선과 무게가 그대로다. */
.rmg-cv-head { max-width: 880px; }
.rmg-cv-head { display: flex; align-items: center; gap: var(--sp-2); }
.rmg-cv-back { display: inline-flex; align-items: center; gap: var(--sp-1); flex: 0 0 auto; height: 40px; padding: 0 var(--sp-2); border-radius: var(--r); border: 1px solid var(--hair); background: var(--surface); color: var(--muted); font: inherit; font-size: 0.84rem; cursor: pointer; transition: color 0.15s, border-color 0.15s; }
.rmg-cv-back:hover { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 22%, var(--hair)); }
.rmg-cv-title { flex: 1; text-align: center; margin: 0; font-weight: 300; font-size: 1.3rem; letter-spacing: -0.02em; color: var(--ink); }
.rmg-cv-spacer { flex: 0 0 auto; width: 40px; }
/* 공유 상태는 색이 아니라 숫자 하나로 — 목록의 리듬을 깨지 않는다. */
.rmg-dial-keyn { margin-left: auto; font-size: 0.74rem; color: var(--faint); font-variant-numeric: tabular-nums; }

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
/* ── 24시간 타임라인 ──
   시선이 '시간축 → 일정 → 지금' 순으로 가도록 농도를 계단으로 둔다. */
.rmg-dial-ring { fill: none; stroke: color-mix(in srgb, var(--ink) 12%, var(--hair)); stroke-width: 1; }
.rmg-dial-ring.inner { stroke: color-mix(in srgb, var(--ink) 6%, var(--hair)); }
/* 눈금은 읽히되 앞에 나서지 않는다 — 일정보다 진하면 배경이 정보를 이긴다. */
.rmg-dial-tick { stroke: color-mix(in srgb, var(--ink) 10%, var(--hair)); stroke-width: 1; }
.rmg-dial-tick.quarter { stroke: color-mix(in srgb, var(--ink) 5%, transparent); }
.rmg-dial-tick.major { stroke: color-mix(in srgb, var(--ink) 19%, var(--hair)); }
.rmg-dial-num { fill: var(--faint); font-size: 9px; font-weight: 500; text-anchor: middle; dominant-baseline: middle; font-variant-numeric: tabular-nums; }

/* 일정 — 면적을 잘라내는 wedge 가 아니라 곡률을 따라가는 얇은 띠.
   저채도 네 가지를 돌려 쓴다(강한 색은 이 화면에 들이지 않는다). */
.rmg-dial-arc {
  --c0: 38 22% 58%;   /* amber  */
  --c1: 205 16% 56%;  /* blue   */
  --c2: 145 14% 52%;  /* sage   */
  --c3: 18 24% 57%;   /* terracotta */
  --h: var(--c0);
  fill: none; stroke: hsl(var(--h) / 0.42); stroke-linecap: round; cursor: pointer;
  transition: stroke 180ms ease-out, opacity 180ms ease-out;
}
/* 일정이 들어올 때만 한 번 — 사라질 때는 붙잡아 둘 곳이 없어 즉시 걷힌다. */
.rmg-dial-ev { animation: rmg-dial-ev-in 420ms cubic-bezier(0.22,1,0.36,1) both; }
@keyframes rmg-dial-ev-in { from { opacity: 0; } to { opacity: 1; } }
.rmg-dial-arc.h1 { --h: var(--c1); }
.rmg-dial-arc.h2 { --h: var(--c2); }
.rmg-dial-arc.h3 { --h: var(--c3); }
.rmg-dial-arc:hover { stroke: hsl(var(--h) / 0.68); }
.rmg-dial-arc.on { stroke: hsl(var(--h) / 0.82); }
/* 하나를 붙잡으면 나머지는 물러난다 — 지워지지는 않게. */
.rmg-dial-arc.dim { opacity: 0.4; }
/* 지금 지나는 중인 일정만 한 단계 진하게. glow 는 쓰지 않는다. */
.rmg-dial-arc.current { stroke: hsl(var(--h) / 0.6); }
.rmg-dial-arc.pending { stroke: hsl(var(--h) / 0.24); stroke-dasharray: 4 3; }
/* 끝 시각이 없는 건 — 없는 길이를 그리지 않고 점 하나로만 */
.rmg-dial-arc.point { fill: hsl(var(--h) / 0.6); stroke: var(--paper); stroke-width: 1; }
/* 시작·끝 표식 — 붙잡았을 때만 */
.rmg-dial-handle { fill: var(--paper); stroke: color-mix(in srgb, var(--ink) 45%, transparent); stroke-width: 1.2; }
/* 종일 — 시간대가 없으니 바깥을 한 바퀴 두른다. */
.rmg-dial-allday { fill: none; stroke: color-mix(in srgb, var(--accent) 38%, transparent); stroke-width: 2; cursor: pointer; transition: stroke 0.2s; }
.rmg-dial-allday:hover, .rmg-dial-allday.on { stroke: color-mix(in srgb, var(--accent) 70%, transparent); }
/* 지금 — 가장 또렷하되 가장 얇게. 일정 위를 지날 때 색을 덮지 않는다.
   축에서 나오는 안쪽 절반은 더 옅게 둔다: 바늘이 중심에 매여 있다는 것만 말하고,
   읽는 눈은 바깥 끝(지금 시각)에 남는다. */
.rmg-dial-now { stroke: color-mix(in srgb, var(--ink) 62%, transparent); stroke-width: 1.2; stroke-linecap: round; }
.rmg-dial-now.shaft { stroke: color-mix(in srgb, var(--ink) 24%, transparent); stroke-width: 1; }
.rmg-dial-hub { fill: color-mix(in srgb, var(--ink) 55%, transparent); }
/* 30초마다 갱신돼도 툭 옮겨지지 않게 — 그 사이를 회전으로 메운다. */
.rmg-dial-hand { transition: transform 900ms cubic-bezier(0.22, 1, 0.36, 1); }
@media (prefers-reduced-motion: reduce) {
  .rmg-dial-hand { transition: none; }
  .rmg-dial-ev { animation: none; }
}
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
/* 목록 표식 — 원의 띠와 같은 색·같은 모양(짧은 호처럼 둥근 막대). */
.rmg-dial-chip { --c0: 38 22% 58%; --c1: 205 16% 56%; --c2: 145 14% 52%; --c3: 18 24% 57%; --h: var(--c0);
  flex: 0 0 auto; width: 4px; height: 14px; border-radius: 999px; background: hsl(var(--h) / 0.55); border: 0; }
.rmg-dial-chip.h1 { --h: var(--c1); }
.rmg-dial-chip.h2 { --h: var(--c2); }
.rmg-dial-chip.h3 { --h: var(--c3); }
.rmg-dial-keyrow.on .rmg-dial-chip { background: hsl(var(--h) / 0.85); }
.rmg-dial-chip.pending { border-style: dashed; }
.rmg-dial-chip.allday { border-radius: 50%; background: none; border-width: 2px; }
.rmg-dial-keytime { font-variant-numeric: tabular-nums; font-size: 0.78rem; color: var(--muted); min-width: 3.4em; }
.rmg-dial-keytitle { font-size: 0.86rem; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── 타임테이블 — 왼쪽 시간축(Time Gutter) ‖ 오른쪽 일정판(Event Canvas) ──
   좌표는 timeToPosition() 하나에서 나온다. 어떤 카드도 top/height 를 손으로 갖지 않는다. */
.rmg-tt { --tt-gutter: 62px; position: relative; width: 100%; max-width: 880px; }
@media (max-width: 720px) { .rmg-tt { --tt-gutter: 52px; } }
/* 시간표만 스크롤한다 — 페이지 제목·레일·캡처바는 제자리에 머문다. */
.rmg-tt-scroll { max-height: calc(100dvh - 300px); min-height: 320px; overflow-y: auto; overscroll-behavior: contain; }
.rmg-tt-grid { position: relative; }
/* 시각은 시간축 안에 오른쪽 정렬 — 선 위에 걸터앉되 겹치지 않게 살짝 올려 둔다. */
.rmg-tt-label { position: absolute; left: 0; width: calc(var(--tt-gutter) - 12px); transform: translateY(-0.5em); text-align: right; font-size: 0.74rem; font-variant-numeric: tabular-nums; color: var(--faint); user-select: none; pointer-events: none; }
/* 격자선 — 아주 낮은 대비. 30분 선은 한 단계 더 옅게. */
.rmg-tt-line { position: absolute; left: var(--tt-gutter); right: 0; height: 1px; background: var(--hair); pointer-events: none; }
.rmg-tt-line.half { background: color-mix(in srgb, var(--hair) 45%, transparent); }
/* 시간축과 일정판을 가르는 세로 헤어라인 — 두 영역이 다른 일을 한다는 표시. */
.rmg-tt-canvas { position: absolute; left: var(--tt-gutter); top: 0; right: 0; bottom: 0; border-left: 1px solid var(--hair); }
.rmg-tt-slot { position: absolute; left: 0; right: 0; cursor: pointer; transition: background 150ms ease-out; }
.rmg-tt-slot:hover { background: color-mix(in srgb, var(--ink) 3%, transparent); }
.rmg-tt-input { width: calc(100% - var(--sp-2)); margin: 6px var(--sp-1) 0; border: 0; background: none; font: inherit; font-size: 0.86rem; color: var(--ink); outline: none; padding: 2px 0; border-bottom: 1px solid var(--accent); }
.rmg-tt-input::placeholder { color: var(--faint); }
/* 일정 카드 — 카드가 아니라 '시간이 차지한 자리'. 얇은 테두리와 옅은 면만. */
/* 겹치지 않는 일정이라고 판을 가로로 다 차지하지는 않는다 — 읽히는 폭에서 멈춘다. */
.rmg-tt-block { position: absolute; margin-left: 6px; max-width: 480px; display: flex; flex-direction: column; justify-content: center; gap: 1px; padding: 3px 8px; border-radius: var(--r-sm); overflow: hidden; text-align: left; font: inherit; cursor: pointer;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 34%, transparent);
  transition: background 170ms ease-out, border-color 170ms ease-out; }
.rmg-tt-block:hover { background: color-mix(in srgb, var(--accent) 24%, transparent); border-color: color-mix(in srgb, var(--accent) 52%, transparent); }
.rmg-tt-block.pending { background: color-mix(in srgb, var(--accent) 8%, transparent); border-style: dashed; }
.rmg-tt-block-title { font-size: 0.82rem; font-weight: 500; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
.rmg-tt-block-meta { font-size: 0.7rem; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 낮은 카드는 제목 한 줄만 — 두 줄을 우겨넣으면 글자가 잘린다. */
.rmg-tt-block.tight { justify-content: center; padding: 0 8px; }
.rmg-tt-block.tight .rmg-tt-block-meta { display: none; }
/* 지금 — 빨간 줄이 아니라 잉크색 실선 한 줄. */
.rmg-tt-now { position: absolute; left: 0; right: 0; height: 1px; background: color-mix(in srgb, var(--ink) 55%, transparent); pointer-events: none; z-index: 2; }
.rmg-tt-now-dot { position: absolute; left: -3px; top: 50%; transform: translateY(-50%); width: 6px; height: 6px; border-radius: 50%; background: color-mix(in srgb, var(--ink) 70%, transparent); }
/* 마지막 시간대가 캡처바에 잠기지 않도록 비워 두는 자리 */
.rmg-tt-safe { height: var(--flow-bottom); }

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

/* People · 연락처 — 목록은 읽는 폭에서 멈춘다. 오른쪽에 남는 자리는 낭비가 아니라
   앞으로 사람의 맥락(공유 일정 등)이 들어올 숨 쉬는 공간이다. */
.rmg-ppl-list { list-style: none; margin: 0; padding: 0; max-width: var(--reading); }
.rmg-ppl { border-bottom: 1px solid var(--hair); }
.rmg-ppl:last-child { border-bottom: 0; }
/* 사람 행 자체가 버튼 — 누르면 그 사람과 함께 있는 일정이 아래로 펼쳐진다. */
.rmg-ppl-head { display: flex; align-items: center; gap: 14px; width: 100%; padding: 12px 8px; margin: 0 -8px; border: 0; background: none; font: inherit; text-align: left; cursor: pointer; border-radius: var(--r); transition: background 170ms ease-out; }
.rmg-ppl-head:hover { background: color-mix(in srgb, var(--ink) 4%, transparent); }
.rmg-ppl-head:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; }
.rmg-ppl-av { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: var(--surface); border: 1px solid var(--hair); font-size: 0.9rem; font-weight: 600; color: var(--muted); flex-shrink: 0; }
.rmg-ppl-txt { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.rmg-ppl-name { font-size: 1rem; font-weight: 400; color: var(--ink); letter-spacing: -0.01em; }
.rmg-ppl.on .rmg-ppl-name { font-weight: 500; }
.rmg-ppl-org { font-size: 0.8rem; font-weight: 300; color: var(--faint); }

.rmg-ppl-none { margin: 0; font-size: 0.86rem; font-weight: 300; color: var(--faint); }
.rmg-ppl-act { border: 1px solid var(--hair); background: color-mix(in srgb, var(--surface) 55%, transparent); color: var(--muted); font: inherit; font-size: 0.76rem; font-weight: 500; padding: 4px 11px; border-radius: 999px; cursor: pointer; flex-shrink: 0; transition: color 170ms ease-out, border-color 170ms ease-out; }
.rmg-ppl-act:hover { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 22%, var(--hair)); }
.rmg-ppl-act.primary { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 18%, var(--hair)); }

/* 사람 찾기 — 검색창처럼 보이는 상자가 아니라 목록 위에 놓인 한 줄. */
.rmg-ppl-wrap { display: flex; flex-direction: column; gap: var(--sp-2); }
.rmg-ppl-search { display: flex; align-items: center; gap: var(--sp-1); padding: 0 8px var(--sp-1); border-bottom: 1px solid var(--hair); }
.rmg-ppl-searchic { width: 15px; height: 15px; stroke-width: 1.8; color: var(--faint); flex-shrink: 0; }
.rmg-ppl-searchin { flex: 1; min-width: 0; border: 0; background: transparent; outline: none; font: inherit; font-size: 0.94rem; color: var(--ink); caret-color: var(--accent); padding: 6px 0; }
.rmg-ppl-searchin::placeholder { color: var(--faint); font-weight: 300; }
.rmg-ppl-searchx { display: grid; place-items: center; width: 20px; height: 20px; border: 0; background: none; color: var(--faint); cursor: pointer; border-radius: 6px; }
.rmg-ppl-searchx:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 8%, transparent); }
/* Comein 에서 찾은 사람 — 아직 내 목록에 없는 자리. 내 사람들과 한 칸 띄워 구분한다. */
.rmg-ppl-find { margin-top: var(--sp-3); padding-top: var(--sp-2); border-top: 1px solid var(--hair); }
.rmg-ppl-findeye { margin: 0 8px var(--sp-1); }
/* 이 줄은 누르는 자리가 아니라 '연결' 하나만 누르는 자리다 — 손모양을 주지 않는다. */
.rmg-ppl-findrow { cursor: default; }
.rmg-ppl-findrow:hover { background: none; }
/* 아무도 없을 때 — 큰 그림 대신 다음 한 걸음만. */
.rmg-ppl-blank { padding: var(--sp-4) 8px; }
.rmg-ppl-blank-t { margin: 0 0 6px; font-size: 0.98rem; font-weight: 500; color: var(--ink); }
.rmg-ppl-blank-b { margin: 0; font-size: 0.88rem; font-weight: 400; line-height: 1.65; color: color-mix(in srgb, var(--ink) 66%, transparent); }

/* ── AI 대화 요약 ──
   대화를 밀어내지 않는 크기로. 카드처럼 띄우지 않고 한 겹 옅은 바탕만 깔아
   '이건 사람이 한 말이 아니다' 만 구분한다. */
.rmg-drawer-chathead { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); }
.rmg-drawer-chathead .rmg-ppl-act { font-size: 0.76rem; padding: 4px 10px; }
.rmg-sum { display: flex; flex-direction: column; gap: 4px; padding: var(--sp-1) 10px;
  border-left: 2px solid color-mix(in srgb, var(--ink) 18%, var(--hair));
  background: color-mix(in srgb, var(--ink) 3%, transparent); border-radius: 0 var(--r-sm) var(--r-sm) 0; }
.rmg-sum-eye { margin: 0 0 2px; }
.rmg-sum-line { margin: 0; font-size: 0.84rem; line-height: 1.6; color: color-mix(in srgb, var(--ink) 76%, transparent); }
.rmg-sum-line::before { content: "· "; color: var(--faint); }

/* ── 읽지 않은 말 ──
   배지도 숫자도 두지 않는다. 여기서 필요한 건 '무언가 와 있다' 하나뿐이고,
   몇 개인지는 들어가서 알면 된다. 숫자를 매달면 목록이 알림판이 된다. */
.rmg-raildot { position: absolute; top: 9px; right: 9px; width: 5px; height: 5px; border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 78%, transparent); }
.rmg-ppl-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
  background: color-mix(in srgb, var(--accent) 78%, transparent); }
/* 읽지 않은 사람의 이름만 한 단계 또렷하게 — 색을 더 쓰지 않고 무게로 말한다. */
.rmg-ppl-name.unread { font-weight: 600; color: var(--ink); }

/* ── AI 일정 제안 ──
   대화 위에 잠깐 놓이는 한 칸. 카드처럼 띄우지 않고 이 화면의 재질로 눕힌다
   — 여기만 다른 앱에서 온 위젯처럼 보이면 '조용히 돕는다'가 깨진다. */
.rmg-prop { display: flex; flex-direction: column; gap: var(--sp-1);
  padding: var(--sp-2); border: 1px solid var(--hair); border-radius: var(--r);
  background: color-mix(in srgb, var(--ink) 3%, transparent); }
.rmg-prop-eye { margin: 0; }
.rmg-prop-when { margin: 0; font-size: 1.02rem; font-weight: 500; letter-spacing: -0.015em; color: var(--ink); font-variant-numeric: tabular-nums; }
.rmg-prop-why { margin: 0; font-size: 0.84rem; line-height: 1.6; color: color-mix(in srgb, var(--ink) 70%, transparent); }
.rmg-prop-people { list-style: none; margin: var(--sp-1) 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.rmg-prop-p { display: flex; align-items: baseline; gap: var(--sp-1); font-size: 0.84rem; }
.rmg-prop-pname { color: var(--ink); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* '되는가'와 '답했는가'는 다른 이야기라 색을 나눠 쓰지 않고 자리를 나눈다. */
.rmg-prop-pav { margin-left: auto; font-size: 0.78rem; color: color-mix(in srgb, var(--ink) 55%, transparent); }
.rmg-prop-pav.busy { color: color-mix(in srgb, 18 40% 46%, var(--ink) 40%); }
.rmg-prop-pav.unknown { color: var(--faint); }
.rmg-prop-pans { min-width: 2.6em; text-align: right; font-size: 0.78rem; color: var(--faint); }
.rmg-prop-pans.accepted { color: color-mix(in srgb, var(--ink) 78%, transparent); }
.rmg-prop-sum { margin: var(--sp-1) 0 0; font-size: 0.8rem; color: color-mix(in srgb, var(--ink) 62%, transparent); }
.rmg-prop-acts { display: flex; gap: 6px; margin-top: 4px; }
.rmg-prop-acts .rmg-ppl-act { font-size: 0.84rem; padding: 6px 14px; }
/* 함께하는 일정 수 — 이 사람과 나의 접점. 숫자 하나면 충분하다. */
.rmg-ppl-n { margin-left: auto; font-size: 0.74rem; color: var(--faint); font-variant-numeric: tabular-nums; flex-shrink: 0; }
/* 고른 사람 — 레일과 같은 언어(뉴트럴 면 + 좌측 3px). 목록이 출렁이지 않는다. */
.rmg-ppl.on .rmg-ppl-head { background: color-mix(in srgb, var(--ink) 6%, transparent); }
.rmg-ppl.on .rmg-ppl-head::before { content: ""; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 3px; height: 20px; border-radius: 0 3px 3px 0; background: color-mix(in srgb, var(--ink) 42%, transparent); }
.rmg-ppl-head { position: relative; }

/* 사람 패널 — 둘만의 대화 / 함께하는 일정 */
.rmg-pseg { align-self: flex-start; }
.rmg-pev { flex: 1; min-height: 0; overflow-y: auto; }
.rmg-pev-list { list-style: none; margin: 0; padding: 0; }
.rmg-pev-row { display: flex; align-items: baseline; gap: var(--sp-1); width: 100%; padding: var(--sp-1) 8px; margin: 0 -8px; border: 0; background: none; font: inherit; text-align: left; cursor: pointer; border-radius: var(--r-sm); transition: background 170ms ease-out; }
.rmg-pev-row:hover { background: color-mix(in srgb, var(--ink) 5%, transparent); }
.rmg-pev-title { font-size: 0.94rem; color: var(--ink); }
.rmg-pev-when { font-size: 0.78rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.rmg-pev-n { margin-left: auto; font-size: 0.74rem; color: var(--faint); font-variant-numeric: tabular-nums; }
.rmg-pev-none { margin: 0 0 var(--sp-2); font-size: 0.86rem; font-weight: 300; color: var(--faint); }
/* 새 자리 만들기 — 목록 끝에 놓인 조용한 한 줄. 버튼처럼 튀지 않는다. */
.rmg-newev-open { display: block; width: 100%; margin-top: var(--sp-2); padding: var(--sp-1) 8px; border: 1px dashed var(--hair); border-radius: var(--r-sm); background: none; font: inherit; font-size: 0.84rem; color: var(--muted); text-align: left; cursor: pointer; transition: color 170ms ease-out, border-color 170ms ease-out; }
.rmg-newev-open:hover { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 25%, var(--hair)); }
.rmg-newev { display: flex; flex-direction: column; gap: var(--sp-1); margin-top: var(--sp-2); padding: var(--sp-2); border: 1px solid var(--hair); border-radius: var(--r); background: color-mix(in srgb, var(--surface) 55%, transparent); }
.rmg-newev-title { border: 0; border-bottom: 1px solid var(--hair); background: none; outline: none; font: inherit; font-size: 0.98rem; color: var(--ink); caret-color: var(--accent); padding: 4px 0 8px; }
.rmg-newev-title::placeholder { color: var(--faint); font-weight: 300; }
.rmg-newev-when { display: flex; gap: var(--sp-1); }
.rmg-newev-in { flex: 1; min-width: 0; border: 1px solid var(--hair); border-radius: var(--r-sm); background: color-mix(in srgb, var(--surface) 70%, transparent); font: inherit; font-size: 0.84rem; color: var(--ink); padding: 6px 8px; outline: none; }
.rmg-newev-in:focus { border-color: color-mix(in srgb, var(--accent) 40%, var(--hair)); }
.rmg-newev-who { margin: 0; font-size: 0.76rem; font-weight: 300; line-height: 1.5; color: var(--faint); }
.rmg-newev-acts { display: flex; justify-content: flex-end; gap: 6px; }
/* 여러 명과 함께할 자리 만들기 */
.rmg-newroom { display: flex; flex-direction: column; gap: var(--sp-2); min-height: 0; }
.rmg-newroom-search { padding-bottom: 4px; }
.rmg-newroom-picks { display: flex; flex-wrap: wrap; gap: 6px; overflow-y: auto; max-height: 34vh; }
.rmg-newroom-chip { border: 1px solid var(--hair); background: none; color: var(--muted); font: inherit; font-size: 0.8rem; padding: 5px 12px; border-radius: 999px; cursor: pointer; transition: color 170ms ease-out, border-color 170ms ease-out, background 170ms ease-out; }
.rmg-newroom-chip:hover { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 25%, var(--hair)); }
/* 고른 사람 — 색이 아니라 면과 굵기로. */
.rmg-newroom-chip.on { color: var(--ink); font-weight: 600; background: color-mix(in srgb, var(--ink) 8%, transparent); border-color: color-mix(in srgb, var(--ink) 22%, var(--hair)); }
.rmg-ppl-act:disabled { opacity: 0.45; cursor: default; }
/* 어디서 들어왔는지 — 방만 덜렁 바뀌면 길을 잃는다. */
.rmg-evback { display: inline-block; margin-bottom: 4px; padding: 0; border: 0; background: none; font: inherit; font-size: 0.78rem; color: var(--faint); cursor: pointer; transition: color 170ms ease-out; }
.rmg-evback:hover { color: var(--ink); }
/* 페이지 헤더는 flex column 이라 버튼이 한 줄을 다 차지한다 — 그러면 button 의 기본
   가운데 정렬 때문에 '‹ 오늘' 이 화면 한가운데로 밀려난다. 내용만큼만 폭을 준다. */
.rmg-pageback { align-self: start; font-size: 0.82rem; color: color-mix(in srgb, var(--ink) 58%, transparent); }

/* ── 일정 상세 + 대화 (Drawer) ──
   오른쪽에서 한 겹. 화면을 덮는 모달이 아니라 워크스페이스가 잠깐 넓어지는 감각. */
/* inline — 사람 탭의 남는 칸. 목록과 나란히 서고, 스크롤해도 제자리에 머문다.
   떠 있는 판이 아니므로 배경·그림자를 두지 않는다(§12 minimal shadow). */
.rmg-evpanel { position: sticky; top: var(--flow-top); display: flex; flex-direction: column; gap: var(--sp-3);
  max-height: calc(100vh - var(--flow-top) - var(--flow-bottom));
  padding-left: var(--sp-4); border-left: 1px solid var(--hair);
  animation: rmg-rise 200ms ease-out both; }
@media (prefers-reduced-motion: reduce) { .rmg-evpanel { animation: none; } }
/* 아직 아무 일정도 고르지 않았을 때 — 빈 칸이 '고장'처럼 보이지 않을 만큼만. */
.rmg-aside-hint { margin: 0; padding-left: var(--sp-4); font-size: 0.86rem; font-weight: 300; line-height: 1.6; color: var(--faint); }
@media (max-width: 1239px) { .rmg-evpanel, .rmg-aside-hint { padding-left: 0; border-left: 0; } }

.rmg-drawer { position: fixed; top: 0; right: 0; bottom: 0; z-index: 40; width: min(420px, 92vw);
  display: flex; flex-direction: column; gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-3) var(--sp-2);
  background: color-mix(in srgb, var(--paper) 92%, transparent);
  backdrop-filter: blur(20px) saturate(1.04); -webkit-backdrop-filter: blur(20px) saturate(1.04);
  border-left: 1px solid var(--hair);
  box-shadow: -22px 0 54px -34px rgba(0,0,0,0.42);
  animation: rmg-drawer-in 220ms cubic-bezier(0.22,1,0.36,1) both; }
@keyframes rmg-drawer-in { from { opacity: 0; transform: translateX(18px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .rmg-drawer { animation: none; } .rmg-ppl-ctx { animation: none; } }
.rmg-drawer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-2); }
.rmg-drawer-title { margin: 0; font-size: 1.24rem; font-weight: 400; letter-spacing: -0.02em; color: var(--ink); }
.rmg-drawer-time { margin: 6px 0 0; font-size: 0.82rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.rmg-drawer-eye { margin: 0 0 var(--sp-1); }
.rmg-drawer-peoplehead { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); }
/* 참석 여부 — 색이 아니라 굵기·농도로만 구분한다(§17 강한 accent 금지). */
.rmg-drawer-prole.accepted { color: var(--muted); }
.rmg-drawer-prole.declined { color: var(--faint); text-decoration: line-through; }
/* 내 답을 묻는 한 줄 — 방 맨 위, 참여자 목록 앞. */
.rmg-rsvp { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); padding: var(--sp-1) var(--sp-2); border: 1px solid var(--hair); border-radius: var(--r); background: color-mix(in srgb, var(--surface) 55%, transparent); }
.rmg-rsvp-q { margin: 0; font-size: 0.84rem; font-weight: 400; color: var(--ink); }
.rmg-rsvp-acts { display: flex; gap: 6px; flex-shrink: 0; }
.rmg-ppl-dm { margin-bottom: var(--sp-2); }
/* 1:1 방은 참여자 목록이 없으니 대화가 위에서부터 자리를 다 갖는다. */
.rmg-drawer-chat-solo { border-top: 0; padding-top: 0; }
.rmg-drawer-px { display: grid; place-items: center; width: 20px; height: 20px; margin-left: auto; border: 0; background: none; color: var(--faint); cursor: pointer; border-radius: 6px; transition: color 170ms ease-out, background 170ms ease-out; }
.rmg-drawer-px:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 8%, transparent); }
.rmg-drawer-pxic { width: 13px; height: 13px; stroke-width: 2; }
.rmg-drawer-add { display: flex; flex-wrap: wrap; gap: 6px; margin-top: var(--sp-1); }
.rmg-drawer-addbtn { border: 1px dashed var(--hair); background: none; color: var(--muted); font: inherit; font-size: 0.78rem; padding: 5px 11px; border-radius: 999px; cursor: pointer; transition: color 170ms ease-out, border-color 170ms ease-out; }
.rmg-drawer-addbtn:hover { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 25%, var(--hair)); }
.rmg-drawer-plist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.rmg-drawer-p { display: flex; align-items: center; gap: var(--sp-1); font-size: 0.88rem; color: var(--ink); }
.rmg-drawer-p.pending { color: var(--muted); }
.rmg-drawer-pav { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--surface); border: 1px solid var(--hair); font-size: 0.72rem; font-weight: 600; color: var(--muted); flex-shrink: 0; }
.rmg-drawer-pname { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rmg-drawer-prole { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); }
/* 대화가 남는 자리를 다 갖는다 — 참여자는 머리말, 대화가 본문이다. */
.rmg-drawer-chat { flex: 1; min-height: 0; display: flex; flex-direction: column; padding-top: var(--sp-2); border-top: 1px solid var(--hair); }
.rmg-drawer-msgs { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-1) 0 var(--sp-2); }
.rmg-drawer-empty { margin: auto 0; font-size: 0.86rem; font-weight: 300; color: var(--faint); text-align: center; }
/* 말풍선을 쓰지 않는다 — 이름 · 말 · 시각 세 줄이 조용히 쌓인다. */
.rmg-msg { display: grid; grid-template-columns: 1fr auto; gap: 2px var(--sp-1); }
.rmg-msg-who { font-size: 0.74rem; font-weight: 600; letter-spacing: 0.04em; color: var(--faint); }
.rmg-msg.mine .rmg-msg-who { color: var(--muted); }
.rmg-msg-body { grid-column: 1 / -1; font-size: 0.94rem; font-weight: 300; line-height: 1.55; color: var(--ink); overflow-wrap: anywhere; }
.rmg-msg-at { font-size: 0.7rem; color: var(--faint); font-variant-numeric: tabular-nums; }
.rmg-msg.pending { opacity: 0.55; }
.rmg-drawer-compose { display: flex; align-items: center; gap: var(--sp-1); padding: var(--sp-1); border: 1px solid var(--hair); border-radius: var(--r); background: color-mix(in srgb, var(--surface) 70%, transparent); }
.rmg-drawer-input { flex: 1; min-width: 0; border: 0; background: transparent; outline: none; font: inherit; font-size: 0.94rem; color: var(--ink); caret-color: var(--accent); }
.rmg-drawer-input::placeholder { color: var(--faint); font-weight: 300; }
.rmg-drawer-compose .rmg-ask-send { width: 30px; height: 30px; }

/* Workspace Status — 우상단 세로 스택(시간 · 알림 · 문 · 상태문구). 시스템 시계가 아니라 '오늘의 상태' 공간. */
/* 시계·알림 — 본문 컬럼의 오른쪽 기준선에 맞춰 선다(캔버스 가장자리가 아니라). */
.rmg-status { position: absolute; top: var(--sp-3); right: var(--edge); z-index: 8; display: flex; flex-direction: column; align-items: flex-end; text-align: right; gap: var(--sp-2); pointer-events: none; }
.rmg-status > * { pointer-events: auto; }
.rmg-status-time-wrap { display: flex; flex-direction: column; align-items: flex-end; line-height: 1; }
.rmg-status-time { font-size: clamp(1.7rem, 2.4vw, 2.05rem); font-weight: 300; letter-spacing: -0.02em; color: var(--ink); font-variant-numeric: tabular-nums; animation: rmg-status-fade 180ms ease both; }
.rmg-status-sec { font-size: 0.52em; font-weight: 400; color: var(--faint); letter-spacing: 0; margin-left: 1px; }
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
