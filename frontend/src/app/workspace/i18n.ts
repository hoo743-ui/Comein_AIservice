/**
 * Comein · 이 화면이 쓰는 말.
 *
 * 문안을 컴포넌트 안에 흩어 두면 같은 것을 두 가지로 말하기 시작한다(실제로 그랬다 —
 * "새 그룹" 을 여는 패널이 스스로를 "새 자리" 라고 불렀다). 한자리에 모아 두면
 * 어긋난 것이 눈에 띈다.
 */

import { fmtDate } from "@/lib/format";
import { reflectEn, reflection } from "./weather";
import { VIEW_LABEL, type View } from "./nav";

// ── reimagine 전용 번역 레이어 (settings.language 에 연결) ──
export type Lang = "ko" | "en";

export const EN_VIEW: Record<View, string> = { today: "Today", calendar: "Calendar", people: "People" };

export const EN_PLACEHOLDER: Record<View, string> = {
  today: "Write anything — I'll tidy the rest",
  calendar: "Say a new event — e.g. Meeting tomorrow 3pm",
  people: "Who should we connect with?",
};

export const EN_HINTS = [
  "Write anything — I'll tidy the rest",
  "e.g.  Meet the professor tomorrow 3pm",
  "e.g.  2 to 5 on Thursday, capstone review",
  "e.g.  Organize this week",
];

export function L(lang: Lang) {
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
    /* 처리 중 한 줄 — 상태를 알리되 재촉하지 않는다. 문장으로 두면 기계의 로그가 아니라 곁의 말이 된다. */
    working: en ? "Sorting this out" : "내용을 정리하고 있어요",
    // 오래 걸릴 때만 이 말로 바뀐다. 사과가 아니라 사정이다 — 무엇이 걸리는지 알면 기다려진다.
    waking: en ? "Waking the AI — the first call takes a moment" : "AI 를 깨우는 중이에요 — 처음 한 번은 조금 걸려요",
    open: en ? "Open" : "열기",
    undo: en ? "Undo" : "되돌리기",
    startingSoon: en ? "Starting soon" : "곧 시작하는 일정",
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
    // 빈 날에 건네는 말은 기기를 가리지 않아야 한다 — 누를 키가 없는 손에게 키를 안내하지 않는다.
    // 캡처 바는 펼쳐졌든 접혔든 늘 아래에 있으므로, 자리로 가리키는 편이 언제나 맞다.
    dayNoEvent: en ? "Nothing today — add one below." : "오늘은 비어 있습니다 — 아래에서 하나 더해보세요.",
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
    actWeek: en ? "Preview this week" : "이번 주 미리 살펴보기",
    quietNote: (w: number) => (en ? `quiet for ${w} week${w > 1 ? "s" : ""}` : `${w}주째 조용해요`),
    setName: en ? "Name" : "이름", setNameD: en ? "Display name in greetings and profile" : "인사와 프로필에 쓰이는 표시 이름",
    setLang: en ? "Language" : "언어", setLangD: en ? "Interface language" : "인터페이스 언어",
    setMode: en ? "Usage type" : "사용 유형", setModeD: en ? "Renames today's flow and the categories events fall into" : "오늘의 흐름과 일정이 나뉘는 갈래 이름이 바뀝니다",
    setWeek: en ? "Week starts" : "주 시작", setWeekD: en ? "First day of the calendar week" : "캘린더 한 주의 시작 요일",
    setTheme: en ? "Theme" : "테마", setThemeD: en ? "Light and dark" : "밝은 화면과 어두운 화면",
    setSize: en ? "Text size" : "글자 크기", setSizeD: en ? "Enlarge text across the screen" : "화면 전체 글자를 키워요",
    setNotif: en ? "Notifications" : "알림", setNotifD: en ? "We'll flag upcoming events and key tasks" : "다가오는 일정·중요한 할 일을 알려드려요",
    setAuto: en ? "AI auto-confirm" : "AI 자동 확정", setAutoD: en ? "Register AI-suggested events without asking" : "AI가 제안한 일정을 확인 없이 바로 등록",
    // segStudent·segOffice·segGeneral 은 걷었다 — 사용 유형의 이름은 이제 MODE_CONFIG
    // (lib/mode.ts)가 갖는다. 같은 낱말을 두 곳에 두면 한쪽만 고쳐지고, 실제로 그랬다:
    // 여기 남아 있던 '일반' 은 화면 어디에도 쓰이지 않는 채로 '개인' 과 다른 말을 하고 있었다.
    segSun: en ? "Sunday" : "일요일", segMon: en ? "Monday" : "월요일",
    segMd: en ? "Normal" : "보통", segLg: en ? "Large" : "크게", segXl: en ? "Larger" : "더 크게",
  };
}

export const PLACEHOLDER: Record<View, string> = {
  today: "무엇이든 적어보세요 — 나머지는 정리해 둘게요",
  calendar: "새 일정을 말해보세요 — 예: 내일 3시 미팅",
  people: "누구를 연결할까요?",
};

// 쉬고 있을 때 이 자리가 하는 말. 첫 줄은 '무엇을 하는 자리인가'이고,
// 그 뒤는 예시다 — 예시에는 '예)'를 붙인다. 안 붙이면 회전하는 문장이
// 이미 적어 둔 글처럼 읽혀서, 빈 입력창이 채워진 검색창으로 보인다.
export const HINTS = [
  "무엇이든 적어보세요 — 나머지는 정리해 둘게요",
  "예) 내일 3시 교수님 미팅 잡아줘",
  "예) 목요일 2시부터 5시까지 캡스톤 리뷰",
  "예) 이번 주 일정 정리해줘",
];
