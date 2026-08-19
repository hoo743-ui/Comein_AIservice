"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Cloud, LogOut, MessageSquare, Search, Settings as SettingsIcon, X } from "lucide-react";

import { useWorkspace, dayKeyOf, type Settings } from "@/lib/store";
import { MODE_CONFIG, useCurrentMode } from "@/lib/mode";
import { analyzeConversation, analyzeMessage, localIsoNow, track } from "@/lib/conversation";
import { fmtTime, fmtDate } from "@/lib/format";
import { CSS } from "./styles";
import { pendingAnswers } from "@/lib/awaiting";
import { suggestEventTitle } from "@/lib/roomName";
import { ENTERED_KEY, THRESHOLD_KEY, entryVerdict } from "@/lib/entry";
// 백엔드 주소는 환경변수로 — 배포(Vercel)에서 localhost 를 부르면 안 된다.
import { API_BASE } from "@/lib/api";
import { useRemoteSync } from "@/lib/useRemoteSync";
import { answerSuggestionForRoom, fetchAnsweredSuggestions, fetchConversationState, pairSlots, recordSuggestion, saveConversationState, signOutRemote } from "@/lib/remote";
import type { ChatMessage, ConnectionRequest, Contact, EventParticipant, Schedule } from "@/lib/types";
import { ME_ID } from "@/lib/types";
import { DEST, NAV, NAV_GAP, NAV_ROW, NAV_ROW_TOUCH, type Parsed, type Receipt, type View } from "./nav";
import { L, type Lang } from "./i18n";
import { WCODE, moodEn, weatherIconOf, weatherWord } from "./weather";
import { classify, parseTime, toParsed } from "./capture";
import { useCoarsePointer } from "./hooks";
import { dayKey } from "./datetime";
// 조각들. 이 파일은 조립만 한다 — 여기서 부르지 않는 것은 조각끼리 주고받는다
// (DayDial·DayTimetable 은 CalendarView 가, ChatThread 는 People 이 쥔다).
import { AiDoor, Ambient } from "./parts/Environment";
import { DoorInvoke } from "./parts/CaptureBar";
import { CalSearch, MonthCalendar } from "./parts/MonthCalendar";
import { CalendarView } from "./parts/DayViews";
import type { ChatSummary } from "./parts/Chat";
import { EventPanel, RoomTimeline } from "./parts/EventPanel";
import { NewRoomPanel, PeopleView, PersonPanel } from "./parts/People";
import { GuideTour, type TourStep } from "./parts/Guide";
import { SettingsPanel } from "./parts/Settings";

/**
 * Comein · Reimagined Workspace — 대시보드가 아니라 '살아있는 편집적 워크스페이스'.
 * 하나의 통합 구성: Hero → Today's context → Quick capture → AI timeline (시선이 아래로 흐른다).
 * 문은 패널이 아니라 환경의 보이지 않는 심장 — 평소엔 사라지고, AI가 일하면 열려 빛이 흐른다.
 * 보라색은 오직 AI 활동의 언어. 배경은 아주 옅게 숨쉰다(래디얼·그레인·미세 입자). 구조는 타이포·여백으로.
 */



/** 이 사람이 한 번이라도 문을 지나왔는가 — 탭 하나가 아니라 이 브라우저의 기억이다.
 *  판정 자체는 lib/entry 에 있다(시험으로 못 박아 둔 표). 여기서는 기억을 읽고 쓰기만 한다. */
const markEntered = () => {
  try { localStorage.setItem(ENTERED_KEY, "1"); sessionStorage.setItem(THRESHOLD_KEY, "1"); } catch { /* 사생활 모드 */ }
};
const hasEntered = () => {
  try { return localStorage.getItem(ENTERED_KEY) === "1" || sessionStorage.getItem(THRESHOLD_KEY) === "1"; }
  catch { return false; }
};




const conditionOf = (code: number) => WCODE[code] ?? "흐림";

/** 받침이 있는가 — 을/를, 이/가 를 고르는 데 쓴다.
 *  한글이 아닌 글자(영문 이름 등)로 끝나면 받침이 없는 것으로 본다. */
const hasJong = (word: string) => {
  const last = word.trim().slice(-1);
  if (!last || last < "가" || last > "힣") return false;
  return (last.charCodeAt(0) - 0xac00) % 28 !== 0;
};




export default function Reimagine() {
  const { resolvedTheme, setTheme } = useTheme();
  const schedules = useWorkspace((s) => s.schedules);
  const contacts = useWorkspace((s) => s.contacts);
  const addSchedule = useWorkspace((s) => s.addSchedule);
  // AI 가 놓아 둔 제안을 사람이 확정하거나 없던 일로 되돌린다.
  const confirmSchedule = useWorkspace((s) => s.confirmSchedule);
  const renameSchedule = useWorkspace((s) => s.renameSchedule);
  const removeSchedule = useWorkspace((s) => s.removeSchedule);
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
  // 그리고 즉시 잇지 않는다: 청하고, 상대가 받아야 이어진다.
  const findPeople = useWorkspace((s) => s.findPeople);
  const requestPerson = useWorkspace((s) => s.requestPerson);
  const cancelRequest = useWorkspace((s) => s.cancelRequest);
  const connectionRequests = useWorkspace((s) => s.connectionRequests);
  const outgoingRequests = useWorkspace((s) => s.outgoingRequests);
  const myHandle = useWorkspace((s) => s.myHandle);
  const handleChangeableAt = useWorkspace((s) => s.handleChangeableAt);
  const changeHandle = useWorkspace((s) => s.changeHandle);
  const loadRequests = useWorkspace((s) => s.loadRequests);
  const answerRequest = useWorkspace((s) => s.answerRequest);
  const sendEventMessage = useWorkspace((s) => s.sendEventMessage);
  const sendDirectMessage = useWorkspace((s) => s.sendDirectMessage);
  // 내가 쓴 말 고치기·지우기 — 서버도 같은 규칙을 다시 확인한다(0008 RLS).
  const editMessage = useWorkspace((s) => s.editMessage);
  const deleteMessage = useWorkspace((s) => s.deleteMessage);
  const setParticipantStatus = useWorkspace((s) => s.setParticipantStatus);
  const rebaseSeeds = useWorkspace((s) => s.rebaseSeeds);
  const addParticipant = useWorkspace((s) => s.addParticipant);
  const removeParticipant = useWorkspace((s) => s.removeParticipant);
  const settings = useWorkspace((s) => s.settings);
  const updateSettings = useWorkspace((s) => s.updateSettings);
  const lang: Lang = settings.language;
  /** 지금 이 워크스페이스가 서 있는 Context. 화면은 여기서만 읽는다 — 컴포넌트마다
   *  settings.mode 를 꺼내 쓰면 나중에 '한 계정에 여러 Context' 로 넓힐 자리가 흩어진다. */
  const mode = useCurrentMode();
  const t = L(lang);

  const [mounted, setMounted] = React.useState(false);
  const [now, setNow] = React.useState<Date | null>(null);
  const [view, setView] = React.useState<View>("today");
  const [shownView, setShownView] = React.useState<View>("today"); // 실제 렌더 중인 뷰 — 전환 시 이전 뷰를 잠깐 더 붙잡아 크로스페이드
  const [flowExit, setFlowExit] = React.useState(false); // 탭 전환: 이전 내용 페이드아웃 단계
  const [switched, setSwitched] = React.useState(false); // 탭을 한 번이라도 옮겼는가 — 첫 입장의 여유로운 등장은 그때만의 것이다
  const [personId, setPersonId] = React.useState<string | null>(null); // People 에서 펼쳐 본 사람
  // 화면이 쥔 값은 '열었을 때의 id' 다. 저장이 끝나면 서버가 준 id 로 바뀌므로 한 번 옮겨 읽는다
  // — 이 대응이 없으면 자리를 만든 직후 방이 통째로 사라진다(열어 둔 id 가 어느 일정과도 안 맞아서).
  const [rawOpenEventId, setOpenEventId] = React.useState<string | null>(null); // 일정 상세 + 대화
  const openEventId = useWorkspace((s) => s.resolveEventId)(rawOpenEventId);
  const [chatFocus, setChatFocus] = React.useState(false); // '대화'로 들어왔으면 입력에 바로 커서를 둔다
  // 사람 패널의 세 자리 — 처음 고른 사람은 '요약'으로 맞이한다.
  // 곧바로 대화창을 펴면 이 화면이 메신저가 되고, 그와 나 사이의 일정·메모·자취는 갈 곳을 잃는다.

  const [peopleQuery, setPeopleQuery] = React.useState("");
  const [newRoom, setNewRoom] = React.useState(false); // 여러 명과 함께할 자리 만들기
  // AI 가 되묻는 한 줄 — 확신이 없으면 멋대로 만들지 않고 물어본다.
  // text = 알아챈 사실 · q = 권하는 한 마디 · cta = 그 한 번의 행동 · seed = 그 행동이 들고 갈 것.
  // 문구를 '경고'가 아니라 '이해했다는 말'로 세운다 — 오류가 난 것이 아니라 AI 가 읽은 것이다.
  // cta 가 없는 되물음도 있다: AI 가 시각을 물어 온 경우엔 누를 것이 아니라 답할 것이라,
  // 버튼 없이 한 줄만 서고 사용자는 캡처 바에 그대로 답한다.
  const [ask, setAsk] = React.useState<{ text: string; q?: string; cta?: string; dest?: View; seed?: string } | null>(null);
  // 되물은 질문과 그때의 원래 말. 다음 한 줄과 함께 서버로 돌아가 답으로 이어진다 —
  // 이게 없으면 사용자가 "3시" 라고만 답했을 때 그 한 마디는 아무것도 아니게 된다.
  // ref 인 이유: 답을 보내는 시점에만 읽고, 이 값 때문에 화면이 다시 그려질 이유는 없다.
  const pendingAsk = React.useRef<{ message: string; ask: string } | null>(null);
  const [receipts, setReceipts] = React.useState<Receipt[]>([]);
  // 방금 정리한 한 건 — 목록으로 쌓지 않고 잠깐 스쳤다 사라진다(자취는 목적지 뷰에 남는다).
  // events: 이 한 줄이 실제로 세운 일정들. pending: 아직 사람의 확정을 기다리는가.
  // 이 둘을 쥐고 있어야 '확정'과 '되돌리기'가 말한 대로 동작한다
  // (예전엔 영수증만 지워서, 되돌려도 일정은 캘린더에 그대로 남아 있었다).
  const [flash, setFlash] = React.useState<
    { text: string; dest: View | null; ids: number[]; events: string[]; pending: boolean } | null
  >(null);
  const [flashOut, setFlashOut] = React.useState(false);
  const [organizing, setOrganizing] = React.useState(false);
  // 'AI 에 닿지 못했다' 를 따로 쥐던 값이 있었다. 세팅만 하고 읽는 곳이 없었다 —
  // 그 사실은 아래 catch 의 스침 줄이 그 자리에서 이미 말한다(§25).
  const [weather, setWeather] = React.useState<{ temp: number; condition: string } | null>(null);
  const [calDay, setCalDay] = React.useState<Date | null>(null);
  // 전체 화면 란은 설정 하나뿐이다. 예전엔 "calendar" 도 있었지만 그 란을 여는 손잡이가
  // 어디에도 남아 있지 않아 — 그 안에 들어 있던 날짜 탐색까지 통째로 닿을 수 없었다.
  // 탐색은 이제 캘린더 화면의 달력 머리에서 직접 연다(아래 onSearch).
  const [panel, setPanel] = React.useState<null | "settings">(null);
  // 오늘 화면 오른쪽의 문 — 누르면 열리는 연출이 한 번 재생된 뒤 그 자리에 안내가 펼쳐진다.
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

  // 날짜 탐색은 캘린더 화면에서만 산다 — 다른 화면으로 옮기면 조용히 닫는다.
  // (⌘K 는 캡처바의 것이다. 여기에 같은 단축키를 또 걸면 한 번 눌러 두 곳이 반응한다.)
  React.useEffect(() => {
    if (shownView !== "calendar") setCalSearchOpen(false);
  }, [shownView]);

  const enterNow = React.useCallback(() => {
    markEntered();
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
      // 한 번 들어온 적이 있는가. 예전에는 sessionStorage 만 봤는데, 그건 탭 하나의 기억이라
      // 새 탭·북마크·복구된 세션에서는 늘 비어 있었다. 그래서 이미 로그인한 사람이
      // 주소를 다시 열 때마다 인트로부터 다시 봐야 했다("새로고침하면 처음 화면으로 간다").
      already = hasEntered();
      justEntered = sessionStorage.getItem("comein:justEntered") === "1";
      if (justEntered) sessionStorage.removeItem("comein:justEntered");
    } catch {}
    let a: ReturnType<typeof setTimeout> | undefined;
    if (already) {
      markEntered();
      setEntered(true);
      if (justEntered) { setArriving(true); a = setTimeout(() => setArriving(false), 1300); }
    }
    // 아직 아니라면 여기서 결정하지 않는다 — 로그인 여부를 알기 전이다.
    // 아래 '문턱 판정' 이 remote.ready 를 기다렸다가 정한다.
    return () => { clearInterval(clock); if (a) clearTimeout(a); };
  }, []);

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
      // 갈 곳이 없는 갈래도 있다(할 일). 그럴 땐 목적지를 비워 둔다 —
      // 없는 곳의 이름을 적으면 스침 줄이 "오늘로 정리했어요" 라고 말하게 된다.
      const dest = DEST[p.kind];
      return {
        id: seq.current, at, title: p.title.trim(), kind: p.kind,
        destView: dest?.view, destLabel: dest?.label,
        time: p.time, date: p.date, note: p.note.trim() || undefined,
        priority: p.priority,
      };
    });
    setReceipts((prev) => [...[...rows].reverse(), ...prev].slice(0, 12));
    return rows;
  }, []);

  // 스침 — 6초 뒤 옅어지고 6.5초 뒤 사라진다. 화면에 남지 않는 게 요점.
  const showFlash = React.useCallback((rows: Receipt[], text?: string, events: string[] = [], pending = false) => {
    if (!rows.length) return;
    for (const timer of flashTimers.current) clearTimeout(timer);
    const head = rows[0];
    const more = rows.length > 1 ? ` 외 ${rows.length - 1}건` : "";
    // 갈 곳이 있으면 어디로 갔는지, 없으면 담아 두지 못했다고 말한다.
    // 예전에는 갈 곳 없는 할 일에도 "· 오늘" 을 붙였다 — 오늘 화면 어디에도 남지 않는데.
    // 한 줄이 하지 않은 일을 했다고 말하면, 그 다음부터는 한 줄을 믿을 수 없게 된다.
    const where = head.destLabel
      ? ` · ${head.destLabel}`
      : lang === "en" ? " · not stored yet" : " · 담아 두는 곳은 아직 없어요";
    setFlashOut(false);
    setFlash({
      text: text || `${head.title}${more}${where}`,
      dest: head.destView ?? null,
      ids: rows.map((r) => r.id),
      events,
      pending: pending && events.length > 0,
    });
    // 답을 기다리는 제안은 스스로 사라지지 않는다 — 확정하지 않은 일정이 조용히 캘린더에
    // 남아 버리면, 확정이라는 절차 자체가 있으나 마나 한 것이 된다.
    flashTimers.current = pending && events.length
      ? []
      : [setTimeout(() => setFlashOut(true), 6000), setTimeout(() => setFlash(null), 6500)];
  }, [lang]);

  /** 정리한 것 없이 한 마디만 스치게 한다 — AI 가 "정리할 게 없다" 고 답했을 때의 자리.
   *  목적지도 되돌릴 것도 없으므로 손잡이를 달지 않는다. */
  const showSay = React.useCallback((text: string) => {
    for (const timer of flashTimers.current) clearTimeout(timer);
    setFlashOut(false);
    setFlash({ text, dest: null, ids: [], events: [], pending: false });
    flashTimers.current = [
      setTimeout(() => setFlashOut(true), 4000),
      setTimeout(() => setFlash(null), 4500),
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

    // 답을 기다리던 질문이 있었다면 이번 한 줄이 그 답이다 — 물어본 쪽이 함께 가야 말이 된다.
    const pending = pendingAsk.current;
    pendingAsk.current = null;

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: t,
          // 화면만 아는 것들. 서버 시계는 UTC 로 돌고 사용자는 제 시간대로 말한다.
          // 지금은 벽시계 + 오프셋으로 적는다(toISOString 이 아니다 — localIsoNow 의 주석 참고).
          context: {
            now: localIsoNow(),
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            ...(pending ? { pending } : {}),
          },
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);

      const data = await res.json();
      const items: unknown[] = Array.isArray(data.items) ? data.items : [];
      const asked = typeof data.ask === "string" ? data.ask.trim() : "";

      // 되물었다 — 시각 없이 일정을 지어내지 않았다는 뜻이다.
      // 여기서 지역 규칙으로라도 정리해 버리면(아래 폴백처럼) 방금 묻지 않기로 한 것을
      // 그 자리에서 지어내는 셈이 된다. 아무것도 세우지 않고, 답을 기다린다.
      if (asked && !items.length) {
        // 누를 것이 아니라 답할 것이라 cta 를 달지 않는다 — 사용자는 캡처 바에 그대로 답한다.
        setAsk({ text: asked });
        pendingAsk.current = { message: t, ask: asked };
        return;
      }
      // 여기까지 왔으면 되물음이 아니다 — 기다리던 질문이 있었다면 답이 된 것이므로 내린다.
      setAsk(null);

      // AI가 한 문장에서 여러 건을 뽑았으면 전부 각자의 목적지로 보낸다.
      // ("내일 3시 미팅 잡고 자료도 준비해야 해" → 일정 + 할 일)
      const parsed = items.slice(0, 4).map((raw) => toParsed(raw, t));
      const said = typeof data.reply === "string" ? data.reply.trim() : "";

      // ── AI 가 "정리할 것이 없다" 고 답했으면 그 말을 믿는다 ──
      // 백엔드는 그런 말을 intent:"chat" · items:[] 로 돌려준다. "나 그때 다른 일정 있어서
      // 안 될 것 같아" 가 정확히 그 경우다 — 일정도 할 일도 아니다.
      // 그런데 여기서 items 가 비면 무조건 원문 한 줄을 지어내 항목으로 세우고 있었다.
      // AI 는 옳게 읽었는데 화면이 틀린 것을 만들어 낸 셈이다.
      // (아래 catch 의 폴백은 'AI 에 닿지 못했을 때' 의 것이다 — 그건 전혀 다른 상황이다.)
      if (!parsed.length) {
        showSay(said || (lang === "en" ? "Nothing to file." : "정리할 것은 없었어요."));
        return;
      }

      const rows = file(parsed);

      // ── 말 한 줄이 실제 일정과 대화방이 된다 ──
      // 여기까지 오면 화면에 '스침'만 남기고 끝났었다. 이제 시각이 있는 건 진짜 일정으로 세우고,
      // AI 가 뽑아 준 이름을 아는 사람과 맞춰 참여자로 부른다 → 그 일정의 방이 함께 생긴다.
      // 확정은 사람이 한다 — 설정이 그렇게 말하고 있었는데(기본값 꺼짐) 코드는 늘
      // "confirmed" 로 박아 넣고 있었다. 그래서 AI 가 잘못 읽은 한 줄도 확정된 일정으로
      // 캘린더에 앉았다. 이제 꺼져 있으면 '제안(pending)' 으로 놓이고 — 원·시간표에서
      // 점선으로 구분되며 — 아래 스침 줄에서 사람이 확정하거나 없던 일로 되돌린다.
      const asProposal = !settings.autoConfirm;
      const madeIds: string[] = [];
      const unknownNames: string[] = [];
      for (const p of parsed) {
        if (p.kind !== "일정" || !p.date) continue;
        const eventId = addSchedule({
          title: p.title,
          start: p.date.toISOString(),
          // 사용자가 끝 시각을 말했으면 그것을 쓴다. 안 말했을 때만 한 시간으로 둔다 —
          // 예전에는 늘 한 시간이라 "2시부터 5시까지" 가 2~3시로 앉았다(§25).
          end: (p.end ?? new Date(+p.date + 3_600_000)).toISOString(),
          location: p.note || undefined,
          status: asProposal ? "pending" : "confirmed",
        });
        madeIds.push(eventId);
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

      // 스침은 일정을 세운 뒤에 띄운다 — 무엇을 확정할지 알아야 손잡이를 달 수 있다.
      showFlash(rows, said || undefined, madeIds, asProposal);

      // 모르는 이름이 있으면 조용히 되묻는다 — 멋대로 새 사람을 만들지 않는다.
      if (unknownNames.length) {
        const who = unknownNames.join(", ");
        // 이미 존칭이 붙은 이름에는 또 붙이지 않는다. AI 는 역할 낱말을 이름으로 그대로
        // 뽑아 오므로("교수님"·"팀장님"), 규칙대로 붙이면 "교수님님을 처음 언급했어요" 가 된다.
        // 이 줄은 사용자가 회의를 잡을 때마다 보는 자리라, 어색한 채로 둘 수 없다.
        // 조사도 함께 고른다 — 존칭을 뗀 자리에서 '교수을' 이 되면 고치나 마나다.
        // (백엔드가 '일정으로/할 일로' 를 고르는 것과 같은 판단이다 — chat.py 의 _ro.)
        const named = /(님|씨)$/.test(who.trim()) ? who.trim() : `${who.trim()}님`;
        const withParticle = `${named}${hasJong(named) ? "을" : "를"}`;
        setAsk({
          text: lang === "en" ? `First mention of ${who}.` : `${withParticle} 처음 언급했어요.`,
          q: lang === "en" ? "Add them to People?" : "사람으로 등록해 둘까요?",
          cta: lang === "en" ? "Find them" : "찾아서 추가",
          dest: "people",
          seed: unknownNames[0],
        });
      }

      // 영속화는 이제 스토어가 Supabase 로 직접 한다(addSchedule → pushEvent).
      // 예전의 백엔드 경유 저장(/api/items)은 같은 것을 두 번 쓰게 되어 걷어냈다.
    } catch (err) {
      // 백엔드가 자거나 죽어도 입력은 삼키지 않는다 — 로컬 규칙으로라도 정리한다.
      //
      // 다만 그건 **저장되지 않은 정리**다. 예전엔 그 사실이 콘솔에만 남아서, 사용자에겐
      // "AI 가 갑자기 멍청해진 것" 처럼 보였다(docs/24 §8.2 에 기록된 그 함정).
      // 그래서 방금 정리한 그 줄 위에, 그 자리에서 말해 준다 — 따로 알림을 띄우지 않는다.
      console.error("AI 파싱 실패 → 로컬 폴백:", err);
      const rows = file([{ title: t, kind: classify(t), time: parseTime(t), note: "" }]);
      const head = rows[0];
      // 이 한 줄은 한 줄로만 서고 넘치면 뒤가 잘린다(rmg-flash-text). 그래서 순서가 중요하다:
      // 제목은 방금 목록에 앉아 눈에 보이지만, "저장되지 않았다" 는 사실은 여기서만 말한다.
      // 앞서는 제목을 앞세워 정작 그 말이 잘려 나갔다("… 이 화면에만 남…").
      showFlash(
        rows,
        lang === "en"
          ? `Filed here only — AI is unreachable · ${head?.title ?? ""}`
          : `AI 없이 정리했어요 — 이 화면에만 남아요 · ${head?.title ?? ""}`,
      );
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
  // exiting 을 빼 두는 이유: 나가는 사람은 세션이 풀리는 순간 이 가드에도 걸려 로그인 화면으로
  // 끌려간다 — 나가려는 곳과 가드가 미는 곳이 달라 화면이 두 번 바뀐다.
  React.useEffect(() => {
    if (exiting) return;
    if (remote.configured && remote.ready && !remote.signedIn) router.replace("/experience?auth=1");
  }, [exiting, remote.configured, remote.ready, remote.signedIn, router]);

  /** 문턱 판정 — 아직 한 번도 들어온 적이 없는 사람만 인트로로 보낸다.
   *
   *  예전에는 마운트 직후 sessionStorage 하나만 보고 곧바로 /experience 로 되돌렸다.
   *  그래서 **이미 로그인해 있는 사람**도 새로고침 한 번에 인트로 앞에 다시 세워졌다.
   *  판단을 remote.ready 까지 미룬다: 세션이 있으면 그 사람은 이미 들어온 사람이다.
   *  들어온 사람을 문 앞에 다시 세우는 것은 환대가 아니라 검문이다. */
  React.useEffect(() => {
    const verdict = entryVerdict({
      entered, remembered: hasEntered(), leaving: toOpening, exiting,
      configured: remote.configured, ready: remote.ready, signedIn: remote.signedIn,
    });
    if (verdict === "hold") return;
    if (verdict === "enter") { markEntered(); setEntered(true); return; }
    setToOpening(true);
    router.replace("/experience");
  }, [entered, toOpening, exiting, remote.configured, remote.ready, remote.signedIn, router]);

  /** 나가기 — 묻지 않고 그냥 나간다.
   *  "정말 나가시겠어요?" 를 한 겹 세우면 나가는 일이 결심이 된다. 다시 들어오면 되는 일이다.
   *  세션을 먼저 끊고 그 다음에 한 번만 옮긴다(끊기 전에 옮기면 로그아웃이 도중에 잘린다). */
  const exitWorkspace = React.useCallback(() => {
    if (exiting) return;
    setExiting(true);
    // 문턱 연출은 들어올 때의 것이다 — 나갈 때 남겨 두면 다음에 들어올 때 재생되지 않는다.
    try { sessionStorage.removeItem("comein:reimagine"); localStorage.removeItem(ENTERED_KEY); } catch { /* 사생활 모드 */ }
    // 나가면 곧바로 다시 들어올 수 있는 자리에 선다 — 랜딩으로 보내면 철학을 한 번 더 읽고
    // '들어가기'를 눌러 8초짜리 인트로를 다시 봐야 로그인 칸에 닿는다. 나가는 사람은
    // 대개 계정을 바꾸거나 다시 들어오려는 것이다. ?auth=1 은 그 인트로를 건너뛴다.
    void signOutRemote().finally(() => router.replace("/experience?auth=1"));
  }, [exiting, router]);

  // 받은 요청 — 들어올 때 한 번, 그리고 사람 화면으로 옮길 때마다.
  // Realtime 으로 밀어 주는 길도 있지만(0013), 여기서는 화면이 필요할 때 읽는 것으로 족하다.
  React.useEffect(() => {
    if (!remote.signedIn) return;
    void loadRequests();
  }, [remote.signedIn, shownView, loadRequests]);

  /** 문이 스스로 한 번 손을 든다 — 처음 온 사람에게만, 한 세션에 한 번만.
   *
   *  가이드로 들어가는 문은 오늘 화면 오른쪽에 조용히 서 있고, 처음 온 사람에게는
   *  6px 짜리 점 하나가 붙을 뿐이었다. 그건 '있다' 는 표시이지 '여기다' 는 안내가 아니다 —
   *  찾으려는 사람만 찾는다.
   *
   *  그렇다고 가이드를 강제로 재생하지는 않는다(들어오자마자 붙잡히는 건 환대가 아니다).
   *  대신 잠깐 스스로 드러났다가 물러난다: 미리보기가 저절로 펼쳐지고 문이 한 겹 밝아진다.
   *  보여 주고 비켜서는 것까지가 안내다.
   *
   *  한 번 본 사람에게 매번 다시 흔들지 않으려고 세션에 표를 남긴다. 가이드를 아직
   *  끝내지 않았다면 다음에 들어올 때 다시 한 번 — 잊었을 수도 있으니까. */
  const [guideHint, setGuideHint] = React.useState(false);
  React.useEffect(() => {
    if (!firstVisit || !entered || shownView !== "today" || panel || tourStep !== null) return;
    let hinted = true;
    try { hinted = sessionStorage.getItem("comein:guideHint") === "1"; } catch { /* 사생활 모드 */ }
    if (hinted) return;
    // 화면이 다 앉은 뒤에 든다 — 등장 애니메이션과 겹치면 그저 소란스럽다.
    const start = window.setTimeout(() => setGuideHint(true), 1500);
    const end = window.setTimeout(() => {
      setGuideHint(false);
      try { sessionStorage.setItem("comein:guideHint", "1"); } catch {}
    }, 1500 + 5000);
    return () => { clearTimeout(start); clearTimeout(end); };
  }, [firstVisit, entered, shownView, panel, tourStep]);

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
  // 확정되는 그 순간의 신호 — proposals 로는 알 수 없다(스토어 주석 참고).
  const justConfirmed = useWorkspace((s) => s.justConfirmed);
  const clearJustConfirmed = useWorkspace((s) => s.clearJustConfirmed);
  const loadProposal = useWorkspace((s) => s.loadProposal);
  // 대화방 옆 하루 — 어느 날을 보고 있는가, 그 날의 '몇 명 가능'.
  const dayAvail = useWorkspace((s) => s.dayAvail);
  const loadDayAvail = useWorkspace((s) => s.loadDayAvail);
  const [roomDay, setRoomDay] = React.useState<Date>(() => new Date());
  const proposeTime = useWorkspace((s) => s.proposeTime);
  const answerProposal = useWorkspace((s) => s.answerProposal);
  const proposalError = useWorkspace((s) => s.proposalError);
  // 전원이 동의했는데 그 사이 누가 그 시간에 다른 일정을 잡았다 — 확정은 일어나지 않았다.
  // 스토어는 이걸 오래전부터 쥐고 있었지만 읽는 화면이 없어서, 사용자에게는 '동의를 눌렀는데
  // 아무 일도 안 일어남' 으로만 보였다. 답이 막혔으면 왜 막혔는지는 사람이 알아야 한다(§17).
  // 겹친 사람이 무엇을 하는지는 여기서도 말하지 않는다 — 몇 명인지까지다(§11).
  const proposalConflict = useWorkspace((s) => s.proposalConflict);
  // 화면은 바꿨는데 서버가 받지 않은 자리 — 스토어가 되돌린 뒤 남긴 한 줄.
  const writeError = useWorkspace((s) => s.writeError);
  const clearWriteError = useWorkspace((s) => s.clearWriteError);
  const requestError = useWorkspace((s) => s.requestError);
  const clearProposalError = useWorkspace((s) => s.clearProposalError);
  const [proposalBusy, setProposalBusy] = React.useState(false);

  // 일정을 열면 그 일정에 답을 기다리는 제안이 있는지 확인한다.
  React.useEffect(() => {
    clearProposalError();
    if (openEventId) void loadProposal(openEventId);
  }, [openEventId, loadProposal, clearProposalError]);

  // 방을 열면 그 일정의 날로 하루를 맞춘다 — 늘 오늘부터 시작하면 매번 손으로 옮겨야 한다.
  React.useEffect(() => {
    if (!openEventData) return;
    setRoomDay(new Date(openEventData.start));
  }, [openEventId]);   // eslint-disable-line react-hooks/exhaustive-deps

  // 함께 보는 하루 — 방·날짜가 바뀌거나, 누군가의 일정이 바뀌면(Realtime 이 schedules 를 갈아끼운다) 다시 센다.
  React.useEffect(() => {
    if (!openEventId) return;
    void loadDayAvail(openEventId, roomDay);
  }, [openEventId, roomDay, loadDayAvail, schedules, eventParticipants]);

  /** 일정 대화에 말을 얹는다. 그 말에 시각이 들어 있으면 AI 가 후보를 내놓는다.
   *  말은 먼저 올라가고 제안은 뒤따른다 — AI 를 기다리느라 대화가 멈추지는 않는다.
   *  시각이 없으면 아무 일도 일어나지 않는다. 지어내서 제안하지 않는다. */
  const sendEventMessageAndMaybePropose = React.useCallback((eventId: string, text: string) => {
    sendEventMessage(eventId, text);
    if (!remote.signedIn) return;

    // ── 이 말이 시간을 정하자는 말인가 ──
    // 시각이 들어 있다고 일정이 아니다. "나 그때 다른 일정 있어서" 는 **거절**이고,
    // "3시에 수업 있어" 는 그냥 사실이다. 예전엔 이 구분 없이 모든 말을 캡처 파서에 던져,
    // 거절하는 말이 그대로 '3시로 제안' 이 되어 돌아왔다 — 사람이 아니라고 한 시간을
    // AI 가 다시 들이미는 셈이었다.
    //
    // 판단은 이미 lib/conversation 이 갖고 있다(§9). 화면이 규칙을 새로 지어내지 않고
    // 그것에 묻는다: 시간을 정하자는 뜻(제안·가용·언제 볼까)일 때만 AI 에게 넘긴다.
    const read = analyzeMessage(text, new Date());
    const wantsTime = read.intent === "proposal" || read.intent === "availability" || read.intent === "scheduling_request";
    if (!wantsTime) return;

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
  // 요약은 줄인 글이 아니라 '행동할 수 있는 정보' 다 — 네 갈래로 받는다.
  // 근거가 없는 갈래는 서버가 빈 채로 보낸다. 빈 갈래는 화면에도 서지 않는다.
  const [summaries, setSummaries] = React.useState<Record<string, ChatSummary>>({});
  const [summaryBusy, setSummaryBusy] = React.useState(false);
  // 정리하지 못한 방 — 그 이유 한 줄. 예전에는 실패가 조용히 삼켜져서, 사용자가 '요약 보기'
  // 를 눌러도 아무것도 열리지 않고 버튼만 '요약 닫기' 로 바뀌었다(닫을 것도 없이).
  const [summaryErrors, setSummaryErrors] = React.useState<Record<string, string>>({});
  // AI 가 스스로 정리한 방 — 그 방에서는 요약을 펼친 채로 맞이한다.
  const [autoSummed, setAutoSummed] = React.useState<Record<string, boolean>>({});

  const summarizeEvent = React.useCallback(async (eventId: string) => {
    const st = useWorkspace.getState();
    const ev = st.schedules.find((s) => s.id === eventId);
    const msgs = st.messagesOf(eventId);
    const lang0 = st.settings.language;
    const fail = (why: string) => setSummaryErrors((m) => ({ ...m, [eventId]: why }));
    const clear = () => setSummaryErrors((m) => { const n = { ...m }; delete n[eventId]; return n; });
    if (msgs.length === 0) {
      fail(lang0 === "en" ? "Nothing to summarize yet." : "아직 정리할 말이 없어요.");
      return;
    }
    clear();
    // 이름을 안 적어 둔 사람도 대화록에는 이름으로 서야 한다 — 화면이 쓰는 것과 같은 폴백.
    const nameOf = (uid: string) =>
      uid === ME_ID
        ? (st.settings.name || (lang0 === "en" ? "Me" : "나"))
        : (st.contacts.find((c) => c.id === uid)?.name ?? (lang0 === "en" ? "Someone" : "누군가"));
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
      if (!res.ok) {
        fail(lang0 === "en" ? "Couldn't read the conversation. Try again." : "대화를 정리하지 못했어요. 잠시 뒤 다시 눌러 주세요.");
        return;
      }
      const data = await res.json();
      const s = (k: string) => (typeof data?.[k] === "string" ? data[k].trim() : "");
      const sum: ChatSummary = { recap: s("recap"), decided: s("decided"), pending: s("pending"), next: s("next"), title: s("title") };
      // 네 갈래가 모두 비었으면(옛 서버거나 근거가 없거나) 예전 형태로 물러난다.
      if (!sum.recap && !sum.decided && !sum.pending && !sum.next) {
        const lines: string[] = Array.isArray(data?.lines) ? data.lines.filter((l: unknown) => typeof l === "string" && l.trim()) : [];
        if (!lines.length) {
          // 서버가 답하긴 했는데 갈래가 전부 비었다 — 근거가 없어서다. 실패와는 다른 말을 한다.
          fail(lang0 === "en" ? "Not enough was said to summarize yet." : "아직 정리할 만큼 이야기가 쌓이지 않았어요.");
          return;
        }
        sum.recap = lines.join(" ");
      }
      setSummaries((m) => ({ ...m, [eventId]: sum }));
      clear();
    } catch {
      // 요약이 없어도 대화는 그대로다 — 다만 조용히 두지는 않는다. 누른 사람은 답을 기다린다.
      fail(lang0 === "en" ? "Couldn't reach the assistant." : "AI 에 닿지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    }
    finally { setSummaryBusy(false); }
  }, []);

  /** 문을 연다 — 문짝이 열리는 동안 기다렸다가 가이드를 시작한다.
   *  문과 미리보기 카드가 같은 자리를 여는 것이므로 손잡이도 하나만 둔다. */
  /** 협의가 끝난 순간 — 그때 한 번만 정리한다.
   *
   *  말이 오갈 때마다 요약하면 요약이 대화를 따라다니며 계속 고쳐 쓴다. 그건 정리가
   *  아니라 중계다. 정리는 '무슨 결론이 났는가' 를 남기는 일이므로, 결론이 나야 할 일이 있다.
   *
   *  둘만의 대화는 이미 그렇게 돼 있다(lib/conversation/summary.ts — confirmed·cancelled
   *  일 때만 무언가를 돌려주고, 조율 중이면 null 이다). 일정 방만 그 기준이 없어서
   *  메시지 4개면 요약 버튼이 서고 누르면 근거 없이도 요약을 만들었다.
   *
   *  이 방에는 더 단단한 신호가 있다. schedule_proposals.status 는 서버가
   *  **전원이 동의했을 때만** confirmed 로 올린다(0003 — 아무나 직접 적을 수 없게 잠가 뒀다).
   *  그 전환을 요약의 기준으로 삼는다. 사람이 부르는 길(요약 보기)은 그대로 둔다 —
   *  기준을 뒀다고 해서 사람에게서 손잡이를 빼앗지는 않는다.
   *
   *  방을 열어 둔 사람에게서만 돈다: 아무도 안 보는 방을 미리 요약해 둘 이유가 없다(§34). */
  React.useEffect(() => {
    if (!justConfirmed) return;
    const id = justConfirmed;
    clearJustConfirmed();
    if (summaries[id] || autoSummed[id]) return;
    setAutoSummed((m) => ({ ...m, [id]: true }));
    void summarizeEvent(id);
  }, [justConfirmed, clearJustConfirmed, summaries, autoSummed, summarizeEvent]);

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

  // ── 대화의 기억 ──
  // 분석은 화면이 아니라 엔진(lib/conversation)이 하고, 그 결과를 여기서 서버에 앉힌다.
  // 화면 컴포넌트 안에서 API 를 부르지 않는다(§39) — 데이터가 있는 자리에서 저장한다.
  const personRoomId = personId ? roomIdOfPeer(personId) : null;
  /** 서버에 앉힐 수 있는 방인가. `dm_…` 는 로그인 전 스토어가 붙인 임시 이름이라 아니다. */
  const roomIsRemote = !!personRoomId && /^[0-9a-f-]{36}$/i.test(personRoomId);
  const [dismissed, setDismissed] = React.useState<string[]>([]);

  // 서버가 계산해 준 후보. 서버는 양쪽 달력을 볼 수 있고 우리는 볼 수 없다 —
  // 그러니 '언제가 되는가' 의 사실은 저쪽이 더 정확하다(§10).
  // 못 받아 오면(로그인 전·연결 안 된 사이·장애) null 로 두고 아는 것만으로 판단한다(§32).
  const [pairFree, setPairFree] = React.useState<{ start: string; end: string; conflicts: number; score: number }[] | null>(null);
  React.useEffect(() => { setPairFree(null); }, [personId]);

  const personOutcome = React.useMemo(() => {
    if (!personId) return null;
    // 프라이버시(§11): 넘기는 것은 '차 있는 구간' 뿐이다. 제목은 넘기지 않는다.
    const busy = personEvents.map((s) => ({
      start: new Date(s.start).toISOString(),
      end: new Date(s.end ?? +new Date(s.start) + 3_600_000).toISOString(),
    }));
    return analyzeConversation({
      messages: personMsgs.map((m) => ({ id: m.id, text: m.content })),
      // 아직 아는 달력은 내 것뿐이다. 상대의 가용 여부는 서버가 채운다 —
      // 그때까지도 '모른다' 를 '한가하다' 로 바꿔 읽지 않는다.
      participants: [busy],
      slots: pairFree ?? undefined,
      now: new Date(),
      shown: dismissed,
      en: lang === "en",
    });
  }, [personId, personMsgs, personEvents, dismissed, lang, pairFree]);

  // 조율이 열렸을 때만 서버에 묻는다 — 잡담에 달력을 열지 않는다(§34).
  // 하루 창 하나만 본다: 여러 날을 훑으면 남의 하루가 재구성된다(§11, 서버도 거절한다).
  const askedRef = React.useRef<string>("");
  React.useEffect(() => {
    const m = personOutcome?.memory;
    if (!personId || !roomIsRemote || !m) return;
    const open = m.state === "scheduling_detected" || m.state === "collecting_preferences" || m.state === "time_proposed";
    if (!open) return;
    const dayed = m.constraints.filter((c) => c.hasDay);
    const day = new Date(dayed.length ? dayed[dayed.length - 1].at : Date.now());
    const from = new Date(day); from.setHours(9, 0, 0, 0);
    const to = new Date(day); to.setHours(22, 0, 0, 0);
    // 창을 대화의 조건에 맞춰 좁힌다. 서버는 대화를 모르므로 이른 시각부터 순서대로
    // 돌려주는데, "3시 이후" 라고 했으면 그 앞의 후보들은 받아 봐야 전부 버려진다
    // (실제로 그래서 제안이 하나도 안 떴다). 좁혀 묻는 편이 정확하고, 덜 들여다본다.
    for (const c of m.constraints) {
      const at = c.hasDay ? c.at : (() => { const x = new Date(day); x.setHours(c.at.getHours(), c.at.getMinutes(), 0, 0); return x; })();
      if (c.kind === "after" && +at > +from) from.setTime(+at);
      if (c.kind === "before" && +at < +to) to.setTime(+at);
      if (c.kind === "at") { if (+at > +from) from.setTime(+at); }
    }
    if (+to - +from < 30 * 60_000) return;
    const key = `${personId}|${from.toISOString()}`;
    if (key === askedRef.current) return;
    askedRef.current = key;
    void pairSlots(personId, from, to)
      .then((rows) => { if (rows) setPairFree(rows); })
      .catch(() => track("engine.error"));
  }, [personId, roomIsRemote, personOutcome]);

  // 방을 옮기면 그 방의 기억을 읽어 온다. 넘긴 제안은 다시 띄우지 않는다.
  React.useEffect(() => {
    setDismissed([]);
    if (!roomIsRemote || !personRoomId) return;
    let alive = true;
    void (async () => {
      const [state, seen] = await Promise.all([
        fetchConversationState(personRoomId),
        fetchAnsweredSuggestions(personRoomId),
      ]);
      if (!alive) return;
      if (state?.rejected?.length || seen.length) setDismissed(seen);
    })();
    return () => { alive = false; };
  }, [personRoomId, roomIsRemote]);

  // 기억이 실제로 달라졌을 때만 올린다 — 렌더마다 쓰면 서버와 서로를 부른다.
  const savedRef = React.useRef<string>("");
  React.useEffect(() => {
    if (!roomIsRemote || !personRoomId || !personOutcome) return;
    const m = personOutcome.memory;
    const sig = `${personRoomId}|${m.state}|${m.proposed.join()}|${m.rejected.join()}|${m.confirmed ?? ""}`;
    if (sig === savedRef.current) return;
    savedRef.current = sig;
    // AI 가 실패해도 대화와 캘린더는 살아 있어야 한다(§32) — 실패는 조용히 삼킨다.
    void saveConversationState(personRoomId, {
      state: m.state,
      constraints: m.constraints.map((c) => ({ kind: c.kind, at: c.at.toISOString(), text: c.text, hasDay: c.hasDay })),
      proposed: m.proposed,
      rejected: m.rejected,
      confirmedAt: m.confirmed ?? null,
      lastMessageId: null,
    })
      .then((row) => track(row && row.version !== undefined ? "state.saved" : "state.stale"))
      .catch(() => track("engine.error"));
  }, [personRoomId, roomIsRemote, personOutcome]);

  // 화면에 띄운 제안은 남긴다 — 같은 것을 두 번 띄우지 않기 위해, 그리고 얼마나 받아들여지는지 보기 위해.
  // 서버가 멱등이므로 여러 번 불러도 한 줄이다(§28).
  const sugRef = React.useRef<string>("");
  React.useEffect(() => {
    const s = personOutcome?.suggestion;
    if (!roomIsRemote || !personRoomId || !s || s.key === sugRef.current) return;
    sugRef.current = s.key;
    track("suggestion.shown");
    void recordSuggestion(personRoomId, s.start, s.end, s.reason).catch(() => track("engine.error"));
  }, [personRoomId, roomIsRemote, personOutcome]);

  /** 사람이 답했다 — 넘겼거나 받아들였거나. 화면에서 먼저 지우고 서버에는 뒤따라 알린다. */
  const answerPersonSuggestion = React.useCallback(
    (key: string, verdict: "accepted" | "dismissed") => {
      setDismissed((prev) => (prev.includes(key) ? prev : [...prev, key]));
      track(verdict === "accepted" ? "suggestion.accepted" : "suggestion.dismissed");
      if (!roomIsRemote || !personRoomId) return;
      void answerSuggestionForRoom(personRoomId, key, verdict).catch(() => track("engine.error"));
    },
    [personRoomId, roomIsRemote],
  );

  // ── 사람 탭이 보는 세 갈래 ──
  // 연락처(누구와 이어져 있는가) · 개인 대화 · 그룹 대화. 한 목록에 섞으면 셋의 성격이 흐려진다.
  // 마지막 말과 안 읽은 수는 여기서 한 번만 세어 아래로 내려보낸다.
  const convo = React.useMemo(() => {
    const lastOfRoom = (roomId: string | undefined) => {
      if (!roomId) return undefined;
      let best: ChatMessage | undefined;
      for (const m of chatMessages) {
        if (m.roomId !== roomId) continue;
        if (!best || +new Date(m.createdAt) > +new Date(best.createdAt)) best = m;
      }
      return best;
    };

    const dm = new Map<string, { last?: ChatMessage; unread: number }>();
    for (const c of contacts as Contact[]) {
      const rid = chatRooms.find((r) => r.peerId === c.id)?.id;
      dm.set(c.id, { last: lastOfRoom(rid), unread: rid ? unread[rid] ?? 0 : 0 });
    }

    const groups = schedules
      .map((ev) => {
        const parts = participantsOf(ev.id);
        if (parts.length < 2) return null;   // 나 혼자인 일정은 '대화'가 아니다
        const rid = chatRooms.find((r) => r.eventId === ev.id)?.id;
        const last = lastOfRoom(rid);
        return {
          id: ev.id, title: ev.title, count: parts.length, last,
          unread: rid ? unread[rid] ?? 0 : 0,
          at: last ? +new Date(last.createdAt) : +new Date(ev.start),
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.at - a.at) as { id: string; title: string; count: number; last?: ChatMessage; unread: number; at: number }[];

    return { dm, groups };
  }, [contacts, chatRooms, chatMessages, schedules, participantsOf, unread]);

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
  /** 자리를 하나 세운다. 이름을 주지 않으면 여기서 짓는다.
   *
   *  이름을 부르는 자리가 셋이었고(사람 패널의 '캘린더에 추가' 둘, 새 자리 폼 하나) 모두
   *  "새 일정" 이라는 같은 낱말을 넘겼다. 같은 사람들과 두 번 모이면 목록에 똑같은 줄이
   *  둘 서고, 어느 것이 무엇인지 열어 봐야 알았다. 이름은 한 곳에서만 짓는다 —
   *  그리고 **이미 같은 사람들과 쓰고 있는 이름은 피한다**(lib/roomName). */
  const createEventWith = React.useCallback((peerIds: string[], title: string | null, start: Date) => {
    const named = (title ?? "").trim() || suggestEventTitle({
      peerNames: peerIds.map((id) => contacts.find((c: any) => c.id === id)?.name).filter(Boolean) as string[],
      start,
      // 같은 사람들과 이미 있는 자리들 — 그 이름은 다시 쓰지 않는다.
      existing: schedules
        .filter((ev: any) => peerIds.every((pid) => eventParticipants.some((q) => q.eventId === ev.id && q.userId === pid)))
        .map((ev: any) => ev.title),
      lang,
    });
    const id = addSchedule({
      title: named,
      start: start.toISOString(),
      end: new Date(+start + 3_600_000).toISOString(),
      status: "confirmed",
    });
    for (const p of peerIds) addParticipant(id, p);
    setNewRoom(false);
    setOpenEventId(id);
    setChatFocus(true);
    ignite();
  }, [addSchedule, addParticipant, contacts, schedules, eventParticipants, lang]);

  // ── Invisible AI · 조용한 비서 — 데이터가 아니라 '사람다운 한 문장'으로. ──
  const h = now?.getHours() ?? 9;
  const WeatherIcon = weather ? weatherIconOf(weather.condition) : Cloud;
  // 시각이 잡힌 일정은 캡처하는 순간 진짜 일정(addSchedule)이 되어 upcoming 에 이미 들어 있다.
  // 영수증까지 더하면 한 건이 두 번 세어진다 — "내일 3시 미팅" 한 줄에 숫자가 2씩 올랐다.
  // 시각을 못 읽은 것만(영수증으로만 남은 것) 여기에 더한다.
  const eventCount = upcoming.length + receipts.filter((r) => r.destView === "calendar" && !r.date).length;
  // 숫자가 둘이었다. 하나는 '할 일' 이었는데, 그 수가 세던 것은 시드 다섯 줄과 이번 세션의
  // 영수증뿐이었다 — 로그인하면 시드가 물러나 0 이 됐고, 새로고침하면 영수증도 사라졌다.
  // 담을 표가 없는 것을 세고 있었던 셈이라(§25) 숫자를 하나로 줄였다.
  const paceLine = eventCount > 0 ? t.pace(eventCount, upcoming.length > 2) : t.paceEmpty;

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

  // ── 사용 가이드 ──
  //
  // 각 단계는 진짜 화면을 짚는다. 필요한 화면으로 먼저 옮겨 두고 그 위의 요소를 가리킨다.
  // 가짜 UI 를 만들지 않는다 — 사용자가 배우는 건 지금 눈앞의 그 버튼이다.
  //
  // 세 막으로 나눠 둔 이유: 아홉 걸음을 평평하게 늘어놓으면 세 번째쯤에서 "몇 개나 더 남았지"
  // 가 된다. 막 이름이 있으면 남은 개수가 아니라 **무엇을 배우는 중인지**가 먼저 읽힌다.
  //   둘러보기 — 이 공간이 어떻게 생겼는가
  //   함께     — 사람과 일이 어떻게 이어지는가   ← 두 사람이 각자 써 봐야 비로소 보이던 것들
  //   맡기기   — 무엇을 Comein 에게 넘길 수 있는가
  const tourSteps = React.useMemo<TourStep[]>(() => {
    const en = lang === "en";
    const ACT = {
      look: en ? "Looking around" : "둘러보기",
      together: en ? "Together" : "함께",
      hand: en ? "Handing over" : "맡기기",
    };
    // 공유 일정이 있는 사람을 하나 골라 둔다 — '일정 안에서 대화' 걸음이 가리킬 대상.
    const withShared = contacts.find((c: any) => sharedEventsWith(c.id).length > 0);
    // 고를 사람이 하나라도 있으면 그 사람으로 보여 준다 — 함께한 일정이 없어도 화면은 같다.
    const someone = withShared ?? contacts[0];
    return [
      {
        key: "today", target: "today", act: ACT.look,
        title: en ? "Today" : "오늘",
        body: en
          ? "What you need today, and what is coming — in one place. The line under the greeting is Comein reading your actual day: an unanswered invite, something starting soon, two meetings back to back."
          : "오늘 해야 할 일과 지금 필요한 정보를 한곳에서 봅니다. 인사말 아래 한 줄은 AI 가 오늘을 실제로 읽고 하는 말이에요 — 답하지 않은 초대, 곧 시작하는 일, 숨 돌릴 틈 없이 붙은 회의 같은 것들.",
        example: en ? "e.g.  Up next · 14:00 Capstone review" : "예)  다가오는 순간 · 14:00 캡스톤 중간발표",
        before: () => { setPanel(null); setView("today"); },
      },
      {
        key: "calendar", target: "calendar", act: ACT.look,
        title: en ? "Calendar" : "캘린더",
        body: en
          ? "Pick a day to see its 24 hours. Do not remember the date? Press Find and say it in words."
          : "날짜를 고르면 그날의 24시간이 열립니다. 날짜가 기억나지 않으면 '찾기'를 눌러 말로 옮겨 가세요.",
        example: en
          ? "e.g.  Find → “next semester”, “week 2 of August”"
          : "예)  찾기 → “다음 학기”, “8월 둘째 주”, “회의 있는 날”",
        before: () => setView("calendar"),
      },
      {
        key: "dial", target: "dial", act: ACT.look,
        title: en ? "24 hours" : "24시간 시간 지도",
        body: en
          ? "See where each event sits in the shape of your day — and where the gaps are."
          : "일정이 하루의 어느 자리에 놓여 있는지, 그리고 어디가 비어 있는지 한눈에 봅니다.",
        example: en ? "e.g.  15:00 Meeting fills the arc from 3 to 4." : "예)  15:00 회의는 원의 3시~4시 구간을 채웁니다.",
        before: () => setView("calendar"),
      },
      {
        key: "people", target: "people", act: ACT.together,
        title: en ? "People" : "사람",
        body: en
          ? "Your handle is your invite code. Tell someone yours, search theirs, and ask to connect — they accept, and you are linked. Nobody joins your list without saying yes."
          : "@핸들이 곧 초대코드입니다. 내 핸들을 알려 주고 상대 핸들로 찾아 청하면, 상대가 받았을 때 이어집니다. 상대의 승낙 없이 누군가가 목록에 들어오는 일은 없어요.",
        example: en
          ? "e.g.  You are @hoo743 · search @fapp1004 → Request"
          : "예)  내 핸들 @hoo743 · 검색창에 @fapp1004 → 요청",
        before: () => { setView("people"); selectPerson(null); },
      },
      {
        // 사람을 고른 뒤의 화면 — AI 가 여기서 무엇을 하는지 말해 준다.
        // 조용히 돕는 것은 좋지만, 조용하기만 하면 있는 줄도 모른다.
        key: "person", target: someone ? "person" : "people", act: ACT.together, available: !!someone,
        title: en ? "One person, one screen" : "사람 하나, 한 화면",
        body: en
          ? "Pick someone and what you said and what you are doing together sit on one screen. Comein listens quietly: when a time comes up it offers one, and it only writes a summary once you have actually settled — not on every message."
          : "사람을 고르면 나눈 말과 함께하는 일정이 한 화면에 섭니다. AI 는 뒤에서 조용히 듣다가 시간 이야기가 오가면 후보를 한 줄로 권하고, 정리는 정말로 정해졌을 때만 합니다 — 말이 오갈 때마다 요약하지 않아요.",
        example: en
          ? "e.g.  “Friday evening?” → Fri 19:00, both free  [Add to calendar]"
          : "예)  “금요일 저녁 어때?” → 금 19:00 · 둘 다 비어 있어요  [캘린더에 추가]",
        whenMissing: en
          ? "No one here yet. Connect with someone on the People screen and this is what it becomes."
          : "아직 이어진 사람이 없어요. 사람 화면에서 누군가와 이어지면 이 자리가 이렇게 됩니다.",
        before: () => {
          setView("people");
          if (someone) { setPersonId(someone.id); setOpenEventId(null); }
        },
      },
      {
        key: "shared", target: withShared ? "sharedevent" : "people", act: ACT.together, available: !!withShared,
        title: en ? "Talk inside the event" : "일정 안에서 대화",
        body: en
          ? "Everyone on an event shares its room. Say a time and Comein checks everyone's calendar and suggests one — with a reason. It never says what anyone is busy with, only whether they are free."
          : "같은 일정의 사람들이 그 방을 함께 씁니다. 시각을 말하면 참여자들의 달력을 맞춰 보고 근거와 함께 시간을 권해요. 누가 그때 무엇을 하는지는 말하지 않습니다 — 되는지 안 되는지까지만.",
        example: en
          ? "e.g.  “How about 4pm Thursday?” → Thu 16:00 · no conflicts for 2"
          : "예)  “그럼 목요일 4시 어때?” → 목 16:00 · 2명 모두 충돌 없음",
        whenMissing: en
          ? "No shared event yet. Make one with someone and its room opens right here."
          : "아직 함께하는 일정이 없어요. 누군가와 자리를 하나 만들면 그 방이 바로 여기에 열립니다.",
        before: () => {
          setView("people");
          if (withShared) { setPersonId(withShared.id); setOpenEventId(null); }
        },
      },
      {
        // 두 사람이 각자의 화면에서 쓸 때 비로소 드러나는 자리 — 가이드에 없으면
        // 초대를 받은 쪽은 화면 위의 이 한 줄이 무엇인지 모른다.
        key: "await", target: "await", act: ACT.together,
        title: en ? "Waiting on you" : "답을 기다리는 것",
        body: en
          ? "When someone invites you or proposes a time, one line appears at the top of the screen — no popup, nothing blocked. Tap it and that event opens, with Agree / Another time right there. A time is only set once everyone has agreed."
          : "누군가 나를 부르거나 시간을 내밀면 화면 맨 위에 한 줄이 섭니다 — 팝업으로 가로막지 않아요. 누르면 그 일정이 열리고 거기에 ‘동의 · 다른 시간’ 이 있습니다. 시간은 전원이 동의해야 비로소 앉습니다.",
        example: en
          ? "e.g.  “Team sync” — Aug 20 14:00 proposed. Does that work?  [Open]"
          : "예)  “팀 회의” — 8월 20일 14:00 로 제안됐어요. 괜찮으세요?  [열어 보기]",
        whenMissing: en
          ? "Nothing waiting right now — which is how it should look most of the time. When someone asks, the line appears at the top of this screen."
          : "지금은 기다리는 것이 없어요 — 평소에는 이게 맞는 모습입니다. 누군가 물어 오면 이 화면 맨 위에 한 줄이 섭니다.",
        before: () => { setPanel(null); setView("today"); },
      },
      {
        key: "capture", target: "capture", act: ACT.hand,
        title: en ? "Just say it" : "말하면 됩니다",
        body: en
          ? "Type a line and Comein files it where it belongs — as a proposal, not a decision. Confirm it or undo it right there. ⌘K opens this bar from anywhere."
          : "한 줄로 적으면 제자리에 놓입니다. 다만 확정하진 않아요 — 그 자리에서 확정하거나 없던 일로 되돌리면 됩니다. 어느 화면에서든 ⌘K 로 이 칸이 열려요.",
        example: en
          ? "e.g.  “Meet Prof. Kim at 3pm tomorrow” → Filed · Confirm / Undo"
          : "예)  “내일 3시 교수님 미팅 잡아줘” → 정리했어요 · 확정 / 되돌리기",
        before: () => { setPanel(null); setView("today"); },
      },
      {
        // 마지막 걸음이 설정인 이유: 앞의 여덟이 "이렇게 움직입니다" 였다면
        // 여기는 "그 움직임을 당신이 바꿉니다" 다. 맡기는 정도를 정하는 건 사람이다.
        key: "settings", target: "settings", act: ACT.hand,
        title: en ? "Yours to adjust" : "맡기는 정도는 당신이",
        body: en
          ? "Theme, language, text size — and how much you hand over. Auto-confirm is off by default: what Comein reads waits for your yes. Signing in is what lets this workspace follow you off this browser."
          : "테마 · 언어 · 글자 크기, 그리고 얼마나 맡길지. ‘자동 확정’ 은 기본으로 꺼져 있어요 — AI 가 읽은 것은 당신의 확인을 기다립니다. 로그인해야 이 워크스페이스가 이 브라우저 밖으로 나갑니다.",
        example: en
          ? "e.g.  Settings → AI auto-confirm · Account · Replay this guide"
          : "예)  설정 → AI 자동 확정 · 계정 · 이 가이드 다시 보기",
        before: () => { setPanel(null); setView("today"); },
      },
    ];
  }, [lang, contacts, sharedEventsWith, selectPerson]);

  /** 답을 기다리는 것 — 판단은 lib/awaiting 이 한다(§39). 화면은 한 줄씩 눕히기만 한다. */
  const awaiting = React.useMemo(
    () => pendingAnswers({
      proposals, eventParticipants, schedules, lang,
      fmt: (d) => `${fmtDate(d)} ${fmtTime(d)}`,
    }),
    [proposals, eventParticipants, schedules, lang],
  );

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
              handle={myHandle}
              handleAt={handleChangeableAt}
              onHandle={changeHandle}
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
          event={openEventData}
          participants={openEventParts}
          contacts={contacts}
          messages={openEventMsgs}
          myName={myName}
          lang={lang}
          focusChat={chatFocus}
          proposal={proposals[openEventData.id] ?? null}
          proposalBusy={proposalBusy}
          proposalError={
            proposalError?.eventId === openEventData.id
              ? proposalError.message
              : proposalConflict?.eventId === openEventData.id
                ? lang === "en"
                  ? `Everyone agreed, but ${proposalConflict.busy} now have something else then. Pick another time.`
                  : `모두 동의했지만 그 사이 ${proposalConflict.busy}명에게 다른 일정이 생겼어요. 다른 시간을 골라 주세요.`
                : null
          }
          summary={summaries[openEventData.id] ?? null}
          summaryError={summaryErrors[openEventData.id] ?? null}
          summaryAuto={!!autoSummed[openEventData.id]}
          onRename={(t) => renameSchedule(openEventData.id, t)}
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
          onEditMessage={(id, text) => void editMessage(id, text)}
          onDeleteMessage={(id) => void deleteMessage(id)}
          onAddParticipant={(uid) => addParticipant(openEventData.id, uid)}
          onRemoveParticipant={(uid) => removeParticipant(openEventData.id, uid)}
          onRespond={(status) => setParticipantStatus(openEventData.id, ME_ID, status)}
          backLabel={shownView === "people" && person ? person.name : undefined}
          onBack={shownView === "people" && person ? () => setOpenEventId(null) : undefined}
          // 여럿이 모인 자리에서만 하루를 세운다 — 혼자인 일정 옆에 남의 가용시간을 그릴 이유가 없다.
          timeline={
            openEventParts.length >= 2 ? (
              <RoomTimeline
                event={openEventData}
                day={roomDay}
                onDay={setRoomDay}
                mySchedules={schedules}
                avail={dayAvail[`${openEventData.id}|${dayKeyOf(roomDay)}`] ?? []}
                proposal={proposals[openEventData.id] ?? null}
                participants={openEventParts}
                lang={lang}
                proposing={proposalBusy}
                onPropose={(at: Date) => {
                  setProposalBusy(true);
                  void proposeTime(openEventData.id, at, 60, openEventData.title).finally(() => setProposalBusy(false));
                }}
              />
            ) : undefined
          }
        />
      );
    }
    // 오늘 — 오른쪽 자리에 문이 서 있다. 장식이 아니라 '처음 배우는 입구'다.
    // 누르면 문이 열리고, 그 뒤 진짜 화면 위에서 한 곳씩 짚어 주는 가이드가 시작된다.
    if (shownView === "today") {
      return (
        <div className={`rmg-doorway-wrap ${guideHint ? "hint" : ""}`}>
          <button
            type="button"
            className={`rmg-doorway ${doorOpening ? "opening" : ""}`}
            onClick={() => { setGuideHint(false); openGuideDoor(); }}
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
          <div className="rmg-doorprev" onClick={() => { setGuideHint(false); openGuideDoor(); }} role="presentation">
            <p className="rmg-doorprev-t">{lang === "en" ? "How Comein works" : "Comein 사용 가이드"}</p>
            <p className="rmg-doorprev-b">
              {lang === "en"
                ? "Nine steps on the real screen — no fake demo. Looking around, then how people and work connect, then what you can hand over."
                : "진짜 화면 위에서 아홉 걸음 — 따로 만든 데모가 아닙니다. 이 공간을 둘러보고, 사람과 일이 어떻게 이어지는지 보고, 무엇을 맡길 수 있는지까지."}
            </p>
            {/* 얼마나 걸리는지 먼저 말한다 — 길이를 모르는 안내는 시작 자체가 결심이 된다. */}
            <p className="rmg-doorprev-meta">
              {lang === "en" ? "9 steps · about 2 min · leave anytime with Esc" : "아홉 걸음 · 2분 남짓 · Esc 로 언제든 나가기"}
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
          messages={personMsgs}
          sharedEvents={personEvents}
          participantsOf={participantsOf}
          myName={myName}
          lang={lang}
          focusChat={chatFocus}
          onClose={() => selectPerson(null)}
          onSend={(text) => sendDirectMessage(person.id, text)}
          onEditMessage={(id, text) => void editMessage(id, text)}
          onDeleteMessage={(id) => void deleteMessage(id)}
          onOpenEvent={(id) => openEvent(id, true)}
          onCreateEvent={(title, start) => createEventWith([person.id], title, start)}
          outcome={personOutcome}
          onAnswerSuggestion={answerPersonSuggestion}
        />
      );
    }
    // 고를 사람이 아직 없으면 이 칸은 아무 말도 하지 않는다.
    // 왼쪽이 "아직 연결된 사람이 없어요" 라고 이미 말했는데 오른쪽이 "사람을 선택하세요" 라고
    // 하면, 화면이 서로 어긋난 말을 하는 셈이다(할 수 없는 일을 시킨다).
    if (!contacts.length) return null;
    // 아무도 고르지 않았을 때 — 벌판을 남기지도, 억지로 채우지도 않는다.
    // 한가운데 표식 하나와 한 줄. 이 칸이 '아직 비어 있다'가 아니라 '기다리고 있다'로 읽히게.
    return (
      <div className="rmg-pnone">
        <span className="rmg-pnone-mark" aria-hidden>
          <MessageSquare className="rmg-pnone-ic" />
        </span>
        <p className="rmg-pnone-t">
          {lang === "en" ? "Pick someone to start the conversation." : "사람을 선택해 대화를 시작하세요."}
        </p>
      </div>
    );
  })();

  // 맥락 레일을 세울지 — 한 곳에서만 정한다.
  // 이 판단이 두 군데(격자 컬럼 수 · 레일 렌더)에 따로 적혀 있으면 반드시 어긋난다.
  // 실제로 어긋나 있었다: 설정을 열면 컬럼은 둘로 줄었는데 레일은 계속 그려져,
  // 자식 셋이 칸 둘에 들어가느라 설정 패널이 다음 줄로 떨어졌다.
  //
  // 사람 탭에서도 걷어냈다: 시간에 관한 일은 캘린더 탭이 전담하고, 사람은 연락처와 대화만 맡는다.
  // 같은 달력이 두 화면에 서 있으면 "여기서도 일정을 보는 화면인가" 하고 역할이 흐려지고,
  // 정작 사람 탭에서 필요한 건 목록과 대화가 나눠 쓸 가로 폭이다.
  const showCtxRail = shownView === "today" && panel !== "settings";

  // 레일 한 줄의 높이는 기기가 정한다. 인디케이터의 이동 거리도 여기서만 나온다 —
  // 두 숫자가 다른 곳에서 각자 만들어지면 표식이 칸과 어긋나 앉는다.
  const navRow = useCoarsePointer() ? NAV_ROW_TOUCH : NAV_ROW;
  const navStep = navRow + NAV_GAP;

  // 첫 진입 → opening 으로 리디렉트 중엔 빈 배경만 (깜빡임 없이 넘어간다).
  // ★ 이 조기 반환은 반드시 모든 훅 아래에 둔다 — 위에 두면 렌더마다 훅 개수가 달라져
  //   React 가 "Rendered fewer hooks than expected"(#300) 로 화면을 통째로 떨어뜨린다.
  if (toOpening) {
    return (
      <div className="rmg" style={{ ["--rmg-fs" as string]: String(textScale), ["--nav-row" as string]: `${navRow}px`, ["--nav-gap" as string]: `${NAV_GAP}px` } as React.CSSProperties}>
        <style>{CSS}</style>
      </div>
    );
  }

  // 레일 활성 인디케이터 위치 — 캘린더 패널이면 캘린더 칸, 패널 없으면 현재 뷰 칸. 설정/가이드(패널)일 땐 숨김(위치는 마지막 뷰 유지 → 튐 없이 페이드).
  const navViewIndex = NAV.findIndex((n) => n.key === view);
  const navActive = panel === null ? navViewIndex : -1;
  const navIndPos = navActive >= 0 ? navActive : navViewIndex;

  return (
    <div className={`rmg ${railOpen || panel ? "rail-open" : ""} ${railIntro ? "rail-intro" : ""} ${panel ? "panel-open" : ""} view-${shownView}`} style={{ ["--rmg-fs" as string]: String(textScale), ["--nav-row" as string]: `${navRow}px`, ["--nav-gap" as string]: `${NAV_GAP}px` } as React.CSSProperties}>
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
              style={{ transform: `translateY(${navIndPos * navStep}px)` }}
            />
            {NAV.map((n, i) => {
              const on = panel === null && view === n.key;
              return (
                <button
                  key={n.key}
                  type="button"
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
                  {n.key === "people" && (unreadTotal > 0 || connectionRequests.length > 0) && shownView !== "people" && (
                    <span className="rmg-raildot" aria-label={lang === "en" ? "New messages" : "새 메시지"} />
                  )}
                </button>
              );
            })}
          </nav>
          <div className="rmg-rail-foot">
            <button
              type="button"
              data-tour="settings"
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
                {/* 부제를 두지 않는다. 화면 이름을 작은 글씨로 한 번 더 풀어 쓰는 자리가 되기 쉽고,
                    '오늘' 밑의 날짜도 마찬가지였다 — 왼쪽 달력이 오늘을 이미 짚어 준다.
                    제목 하나만 서 있을 때 세 화면의 기준선이 가장 조용하다. */}
              </>
            )}
          </header>

          {/* 답을 기다리는 것 — 조용하지만 먼저 온다. 누르면 그 일정이 열린다. */}
          {panel !== "settings" && awaiting.length > 0 && (
            <div className="rmg-await rmg-a1" role="list" data-tour="await">
              {awaiting.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  role="listitem"
                  className={`rmg-await-row ${a.kind}`}
                  onClick={() => openEvent(a.eventId)}
                >
                  <span className="rmg-await-dot" aria-hidden />
                  <span className="rmg-await-text">{a.text}</span>
                  <span className="rmg-await-go">{lang === "en" ? "Open" : "열어 보기"}</span>
                </button>
              ))}
            </div>
          )}

          {/* PAGE BODY — Context Rail + 본문 (+ 필요하면 오른쪽 칸).
              캘린더는 큰 달력이 레일 자리를 대신하므로 왼쪽 레일이 없다.
              data-picked: 사람 화면에서 '무언가를 골랐는가'. 좁은 폭에서 목록을 접는 데 쓴다
              (data-aside 는 빈 자리 안내에도 참이라 이 판단에 쓸 수 없다). */}
          <div
            className="rmg-pagebody"
            data-view={shownView}
            data-ctx={showCtxRail}
            data-aside={!!aside}
            data-picked={shownView === "people" && !!(person || openEventData || newRoom)}
            data-settings={panel === "settings"}
          >

            {/* CONTEXT RAIL — '오늘' 의 시간 맥락.
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
                        {/* 날짜를 다시 적지 않는다 — 바로 위 달력에서 그 날이 이미 짚여 있다.
                            같은 말을 두 번 하면 그만큼 목록이 아래로 밀린다. */}
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
                    {/* 같은 하루가 Context 마다 다른 이름으로 불린다 — 학업의 흐름 · 업무의 흐름 · 생활의 흐름.
                        화면을 복제하지 않는다. 이 한 줄이 설정에게 이름을 물어볼 뿐이다. */}
                    <div className="rmg-ctx-line">
                      <span className="rmg-ctx-k">{MODE_CONFIG[mode].todayFlow[lang === "en" ? "en" : "ko"]}</span>
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
                  onRequest={requestPerson}
                  onCancelRequest={cancelRequest}
                  requests={connectionRequests}
                  requestError={requestError}
                  outgoing={outgoingRequests}
                  myHandle={myHandle}
                  onAnswerRequest={answerRequest}
                  unreadOf={unreadOf}
                  convo={convo}
                  openEventId={openEventId}
                  onSearchDay={() => setCalSearchOpen(true)}
                  focusDay={calFocus}
                />
              )}
            </div>

            {/* 오른쪽 칸 — 고른 것의 속내가 여기 그대로 눕는다.
                떠 있는 서랍이 아니라 이 화면의 한 칸이라, 목록·시간표와 같이 보며 움직일 수 있다. */}
            {aside && <div className="rmg-pageaside">{aside}</div>}
          </div>

        </div>

        {/* 알아챈 것 — 경고가 아니라 '이해했고, 이런 게 필요해 보인다' 는 말.
            스침과 달리 스스로 사라지지 않는다(사용자의 답을 기다린다).
            입력창보다 가볍게 선다: 면도 테두리도 한 겹 옅고, 손잡이는 하나뿐이다. */}
        {/* 서버가 받지 않은 자리 — 되돌렸다는 사실과 그 이유. AI 의 되물음(ask)과 같은
            자리를 쓰되, 둘이 동시에 서지는 않는다: 물음이 있으면 그쪽이 먼저다.
            스스로 사라지지 않는다 — 저장이 안 됐다는 말은 스쳐 지나가면 안 되는 말이다. */}
        {!panel && !ask && writeError && (
          <div className="rmg-note" role="alert" aria-live="assertive">
            <span className="rmg-note-body">
              <span className="rmg-note-t">{writeError}</span>
            </span>
            <button
              type="button"
              className="rmg-note-x"
              onClick={clearWriteError}
              aria-label={lang === "en" ? "Dismiss" : "닫기"}
            >
              <X className="rmg-note-xic" />
            </button>
          </div>
        )}

        {!panel && ask && (
          <div className="rmg-note" role="status" aria-live="polite">
            <span className="rmg-note-body">
              <span className="rmg-note-t">{ask.text}</span>
              {ask.q && <span className="rmg-note-q">{ask.q}</span>}
            </span>
            {/* 갈 곳과 부를 말이 둘 다 있을 때만 버튼이 선다 — AI 가 시각을 물어 온 되물음에는
                누를 것이 없다(답은 캡처 바에 적는다). 빈 버튼이 서 있으면 그게 더 큰 질문이 된다. */}
            {ask.dest && ask.cta && (
              <button
                type="button"
                className="rmg-note-act"
                onClick={() => {
                  // 이름만으로 사람을 지어내지 않는다 — 대신 그 이름을 들고 사람 화면으로 간다.
                  // 라벨이 약속한 것("찾아서 추가")과 실제로 하는 일을 같게 둔다.
                  if (ask.seed) setPeopleQuery(ask.seed);
                  setView(ask.dest!);
                  setAsk(null);
                  pendingAsk.current = null;
                }}
              >
                {ask.cta}
              </button>
            )}
            {/* 닫으면 질문도 잊는다 — 남겨 두면 한참 뒤의 엉뚱한 한 줄이 이 질문의 답으로 붙는다. */}
            <button type="button" className="rmg-note-x" onClick={() => { setAsk(null); pendingAsk.current = null; }} aria-label={lang === "en" ? "Dismiss" : "닫기"}>
              <X className="rmg-note-xic" />
            </button>
          </div>
        )}

        {/* AI 가 일하는 중 — 카드가 아니다. 입력창 위에 놓인 한 줄의 기척.
            결과가 나오면 그 자리를 결과에 내준다(두 개가 겹쳐 서지 않게). */}
        {!panel && organizing && !flash && (
          <div className="rmg-working" role="status" aria-live="polite">
            <span className="rmg-working-mark" aria-hidden />
            <span className="rmg-working-t">{t.working}</span>
          </div>
        )}

        {/* 스침 — 정리된 결과는 목적지 뷰에 놓이고, 여기엔 방금 한 일만 잠깐 머물다 사라진다.
            기록을 쌓아 보여주면 대시보드가 된다. Comein은 자취를 남기되 진열하지 않는다. */}
        {!panel && flash && (
          <div className={`rmg-flash ${flashOut ? "out" : ""} ${flash.pending ? "hold" : ""}`} role="status" aria-live="polite">
            {/* 결과에는 문을 걸지 않는다 — 문(AI)이 일하는 기척은 위의 '정리 중' 한 줄이 맡는다.
                여기 남는 것은 무엇이 어디로 갔는가, 그리고 그것을 어떻게 할 것인가뿐이다. */}
            {(
              <>
                <span className="rmg-flash-text">{flash.text}</span>
                {flash.dest && (
                  <button type="button" className="rmg-flash-act" onClick={() => { setView(flash.dest!); setFlash(null); }}>{t.open}</button>
                )}
                {/* AI 가 읽은 것이 맞는지는 사람만 안다 — 확정도 취소도 여기 이 줄에서 끝난다.
                    ("자동 확정" 을 켜 두면 이 물음 없이 바로 확정된 일정으로 앉는다.) */}
                {flash.pending && (
                  <button
                    type="button"
                    className="rmg-flash-act primary"
                    onClick={() => { flash.events.forEach(confirmSchedule); setFlash(null); }}
                  >
                    {lang === "en" ? "Confirm" : "확정"}
                  </button>
                )}
                <button
                  type="button"
                  className="rmg-flash-act"
                  onClick={() => {
                    // 되돌리기는 정말로 되돌린다 — 영수증만 지우고 일정은 캘린더에 남겨 두지 않는다.
                    flash.events.forEach(removeSchedule);
                    flash.ids.forEach(undoReceipt);
                    setFlash(null);
                  }}
                >
                  {t.undo}
                </button>
              </>
            )}
          </div>
        )}

        {/* 앰비언트 AI — 상주 챗박스가 아니라, 필요할 때만 펼쳐지는 떠다니는 문 (⌘K).
            전체 패널(캘린더·설정·가이드)이 열리면 컴포저는 물러난다(⌘K 충돌 방지).
            입력하면 확인 절차 없이 바로 정리된다 — 결과는 위 영수증에 남는다. */}
        {/* 대화를 열어 둔 동안에도 물러난다 — 아래에 이미 메시지 입력칸이 있어 둘이 겹친다. */}
        {!panel && (
          <DoorInvoke
            view={view}
            lang={lang}
            organizing={organizing}
            onSubmit={capture}
            /* 아래에 이미 제 입력칸을 가진 화면 위에서는 물러난다.
               새 자리 만들기 폼도 그중 하나다 — 물러나지 않으면 캡처 바가 '만들기' 버튼
               한복판을 덮어 클릭을 가로챈다(실제로 눌리지 않았다). */
            tuck={shownView === "people" && !!(personId || openEventId || newRoom)}
          />
        )}

      </main>

      {/* 사용 가이드 — 화면을 덮지 않고 진짜 요소를 한 곳씩 짚는다 */}
      {tourStep !== null && mounted && (
        <GuideTour steps={tourSteps} index={tourStep} lang={lang} onIndex={setTourStep} onClose={endTour} />
      )}

      {/* AI Calendar Search — 말로 날짜를 탐색. 캘린더 화면의 달력 머리에서 연다. */}
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





















// 각 기능은 '익숙한' 인터페이스로 — AI는 강화만. (제안 배너 + 귀속 마크 + 행 액션)
function Feature(props: {
  view: View; lang: Lang; schedules: any[]; contacts: any[];
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
  /** 사람 찾기·잇기 · 읽지 않은 말 — People 로 그대로 흘려보낸다. */
  onFind: (q: string) => Promise<Contact[]>;
  onRequest: (peerId: string) => Promise<{ outcome: string; message?: string }>;
  /** 됐으면 true. 화면은 이 값을 보고 줄을 바꾼다 — 못 물렀는데 걷으면 거짓말이 된다. */
  onCancelRequest: (peerId: string) => Promise<boolean>;
  /** 나에게 온, 아직 답하지 않은 요청 — 연락처 갈래 맨 위에 얹힌다. */
  requests: ConnectionRequest[];
  /** 내가 보내 두고 답을 못 받은 상대들 — 줄이 '요청' 을 다시 내밀지 않게. */
  outgoing: string[];
  /** 내 핸들 — 남이 나를 찾을 때 쓰는 이름. */
  myHandle: string | null;
  onAnswerRequest: (id: string, accept: boolean) => Promise<void>;
  requestError?: string | null;
  unreadOf: (personId: string) => number;
  /** 세 갈래가 읽는 것 — 사람별 마지막 말·안 읽은 수, 그리고 함께하는 자리들. */
  convo: {
    dm: Map<string, { last?: ChatMessage; unread: number }>;
    groups: { id: string; title: string; count: number; last?: ChatMessage; unread: number; at: number }[];
  };
  openEventId: string | null;
  /** 말로 날짜를 찾는 자리를 연다 · 그렇게 찾은 날이 있는 달로 달력을 옮긴다. */
  onSearchDay?: () => void;
  focusDay?: Date | null;
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
