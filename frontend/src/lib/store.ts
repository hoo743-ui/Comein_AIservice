"use client";

import { create } from "zustand";

import type {
  ClassEntry,
  Connections,
  Contact,
  Conversation,
  Place,
  ID,
  Meeting,
  Memo,
  Message,
  Schedule,
  Todo,
  TodoStatus,
} from "@/lib/types";

// ── 유틸 ───────────────────────────────────────────────
const uid = (): ID =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const nowISO = () => new Date().toISOString();

/** 두 일정이 시간상 겹치는지 (충돌 감지 · 차별화 기능) */
export function overlaps(a: Schedule, b: Schedule): boolean {
  const aStart = +new Date(a.start);
  const aEnd = a.end ? +new Date(a.end) : aStart + 60 * 60 * 1000;
  const bStart = +new Date(b.start);
  const bEnd = b.end ? +new Date(b.end) : bStart + 60 * 60 * 1000;
  return aStart < bEnd && bStart < aEnd;
}

// ── 시드 데이터 (백엔드 연결 전 데모용, 고정 ISO로 SSR 안전) ──
const seedSchedules: Schedule[] = [
  { id: "s1", title: "교수님 미팅", start: "2026-07-08T15:00:00", end: "2026-07-08T16:00:00", location: "공학관 401", placeId: "b_eng", status: "confirmed" },
  { id: "s2", title: "팀 스탠드업", start: "2026-07-08T17:30:00", end: "2026-07-08T18:00:00", location: "온라인", status: "confirmed" },
  { id: "s3", title: "캡스톤 중간발표", start: "2026-07-09T14:00:00", end: "2026-07-09T15:30:00", location: "대강당", placeId: "b_vis", status: "confirmed" },
  { id: "s4", title: "스터디", start: "2026-07-10T19:00:00", end: "2026-07-10T21:00:00", location: "스터디카페", status: "pending" },
];

const seedTodos: Todo[] = [
  { id: "t1", title: "발표자료 초안 작성", due: "2026-07-08", priority: "high", status: "doing" },
  { id: "t2", title: "회의록 정리", due: "2026-07-09", priority: "mid", status: "todo" },
  { id: "t3", title: "레퍼런스 리서치", priority: "low", status: "todo" },
  { id: "t4", title: "UI 컴포넌트 리뷰", due: "2026-07-08", priority: "mid", status: "doing" },
  { id: "t5", title: "배포 스크립트 점검", priority: "mid", status: "done" },
];

const seedMemos: Memo[] = [
  { id: "m1", title: "온보딩 문 애니메이션", content: "문이 열리며 워크스페이스로 들어가는 연출. 브랜드 스토리와 연결.", tags: ["브랜드", "UX"], createdAt: "2026-07-07T09:00:00" },
  { id: "m2", title: "레퍼런스 링크 모음", content: "shadcn/ui 블록, FullCalendar 예제, 라벤더 팔레트 참고.", tags: ["리서치"], createdAt: "2026-07-06T14:00:00" },
  { id: "m3", title: "차별화 포인트", content: "대화로 입력 → AI 자동 분류·저장 → 충돌 감지·추천까지.", tags: ["기획"], createdAt: "2026-07-05T11:00:00" },
];

const seedMeetings: Meeting[] = [
  {
    id: "mt1",
    title: "캡스톤 중간발표 준비",
    start: "2026-07-09T14:00:00",
    participants: ["나", "김교수", "팀원A", "팀원B"],
    summary: "발표 흐름 확정, 데모 시나리오 3종 리허설. 디자인 QA는 목요일까지.",
    actionItems: ["발표자료 초안 작성", "데모 시나리오 리허설", "디자인 QA"],
    notes: "",
  },
];

// 장소 (범용 · 스키매틱 좌표 0~100). 캠퍼스 건물 + 직장인 프리셋 예시. 실제 지도 연동 시 x/y→lat/lng.
const seedPlaces: Place[] = [
  // 캠퍼스(가천대 글로벌캠퍼스 근사 좌표 — 실지도 연동 대비)
  { id: "b_ai", name: "AI공학관", code: "AI", category: "campus", x: 30, y: 36, lat: 37.4536, lng: 127.1284 },
  { id: "b_eng", name: "공학관", code: "E", category: "campus", x: 55, y: 24, lat: 37.4541, lng: 127.1301 },
  { id: "b_vis", name: "비전타워", code: "V", category: "campus", x: 72, y: 54, lat: 37.4519, lng: 127.1309 },
  { id: "b_lib", name: "중앙도서관", code: "LIB", category: "campus", x: 46, y: 60, lat: 37.4522, lng: 127.1293 },
  { id: "b_art", name: "예술체육관", code: "ART", category: "campus", x: 19, y: 72, lat: 37.4512, lng: 127.1278 },
  { id: "b_stu", name: "학생회관", code: "STU", category: "campus", x: 50, y: 82, lat: 37.4508, lng: 127.1296 },
  { id: "b_sci", name: "자연과학관", code: "SCI", category: "campus", x: 78, y: 30, lat: 37.4538, lng: 127.1312 },
  // 직장인 프리셋 예시 (강남 근사 — 데모)
  { id: "o_hq", name: "본사 3층 대회의실", category: "office", x: 62, y: 20, lat: 37.4998, lng: 127.0364 },
  { id: "o_client", name: "강남 거래처", category: "office", x: 84, y: 68, lat: 37.5045, lng: 127.049 },
];

const seedTimetable: ClassEntry[] = [
  { id: "c_1", course: "인공지능개론", day: "mon", start: "09:00", end: "10:30", buildingId: "b_ai", room: "401" },
  { id: "c_2", course: "자료구조", day: "mon", start: "13:00", end: "14:30", buildingId: "b_eng", room: "202" },
  { id: "c_3", course: "웹 프로그래밍", day: "tue", start: "10:30", end: "12:00", buildingId: "b_ai", room: "305" },
  { id: "c_4", course: "확률과 통계", day: "tue", start: "15:00", end: "16:30", buildingId: "b_sci", room: "110" },
  { id: "c_5", course: "캡스톤 디자인", day: "wed", start: "09:00", end: "10:30", buildingId: "b_vis", room: "701" },
  { id: "c_6", course: "데이터베이스", day: "wed", start: "11:00", end: "12:30", buildingId: "b_eng", room: "210" },
  { id: "c_7", course: "알고리즘", day: "thu", start: "13:00", end: "14:30", buildingId: "b_ai", room: "402" },
  { id: "c_8", course: "영어회화", day: "fri", start: "10:00", end: "11:30", buildingId: "b_lib", room: "3F" },
];

// 연락처 (데모 · 구글/아웃룩에서 가져온 것처럼)
const seedContacts: Contact[] = [
  { id: "ct1", name: "김교수", org: "가천대 AI학과", email: "prof.kim@gachon.ac.kr", phone: "010-1234-5678", source: "google", lastMet: "2026-07-01T15:00:00" },
  { id: "ct2", name: "이하늘", org: "캡스톤 팀", email: "haneul@example.com", phone: "010-2222-3333", source: "google", lastMet: "2026-07-05T13:00:00" },
  { id: "ct3", name: "박지원", org: "거래처 · ACME", email: "jiwon@acme.co", phone: "010-4444-5555", source: "outlook", lastMet: "2026-06-28T10:00:00" },
  { id: "ct4", name: "최민석", org: "알고리즘 스터디", email: "minseok@example.com", source: "google" },
  { id: "ct5", name: "정예린", org: "동아리", phone: "010-7777-8888", source: "manual" },
];

const seedConversations: Conversation[] = [
  {
    id: "c1",
    title: "교수님 미팅 일정 잡기",
    createdAt: "2026-07-08T09:10:00",
    messages: [
      { id: "msg1", role: "user", content: "다음 주 화요일 3시에 교수님 미팅 잡아줘", createdAt: "2026-07-08T09:10:00" },
      { id: "msg2", role: "ai", content: "교수님 미팅을 제안 일정으로 만들었어요. 확인해 주세요.", createdAt: "2026-07-08T09:10:05", card: { kind: "schedule", id: "s1" } },
    ],
  },
];

// ── 간이 인텐트 라우터 (실제 LLM 연결 전 데모) ──
type Interpretation =
  | { kind: "schedule"; title: string; reply: string }
  | { kind: "todo"; title: string; reply: string }
  | { kind: "memo"; title: string; reply: string }
  | { kind: "chat"; reply: string };

function interpret(text: string): Interpretation {
  const t = text.trim();
  if (/할\s*일|투두|todo|해야|마감|체크리스트/i.test(t))
    return { kind: "todo", title: t, reply: "할 일로 정리했어요. 우선순위를 추천해 뒀습니다." };
  if (/메모|기록|아이디어|적어|노트/i.test(t))
    return { kind: "memo", title: t.slice(0, 24), reply: "메모로 저장하고 태그를 자동으로 붙였어요." };
  if (/일정|약속|스케줄|잡아|미팅|회의|시에|오후|오전|내일|다음\s*주|모레/i.test(t))
    return { kind: "schedule", title: t, reply: "제안 일정으로 만들었어요. 겹치는 일정이 없는지 확인했습니다." };
  return { kind: "chat", reply: "네, 말씀하신 내용을 워크스페이스에 반영할 수 있어요. 일정·메모·할 일 무엇이든 편하게 말씀해 주세요." };
}

// ── 설정 ──
export type Language = "ko" | "en";
export type Mode = "student" | "office" | "general";
export type TextScale = "md" | "lg" | "xl"; // 글자 크기 — 보통 · 크게 · 더 크게

export interface Settings {
  name: string;
  language: Language;
  mode: Mode; // 사용 유형 — 기본 장소 프리셋/라벨에 반영
  weekStart: "sun" | "mon";
  notifications: boolean;
  autoConfirm: boolean; // AI 제안 일정을 자동 확정할지
  textScale: TextScale; // 전체 글자 크기 배율
}

// ── 스토어 ─────────────────────────────────────────────
interface WorkspaceState {
  conversations: Conversation[];
  activeConversationId: ID | null;
  schedules: Schedule[];
  todos: Todo[];
  memos: Memo[];
  meetings: Meeting[];
  places: Place[];
  timetable: ClassEntry[];
  contacts: Contact[];
  connections: Connections;
  settings: Settings;
  commandOpen: boolean;
  dismissedNotifs: ID[];

  // Chat
  newConversation: () => ID;
  setActiveConversation: (id: ID) => void;
  sendMessage: (text: string) => void;
  togglePin: (id: ID) => void;

  // Schedule
  addSchedule: (s: Omit<Schedule, "id">) => ID;
  updateSchedule: (id: ID, patch: Partial<Schedule>) => void;
  removeSchedule: (id: ID) => void;
  confirmSchedule: (id: ID) => void;
  conflictsFor: (id: ID) => Schedule[];

  // Todo
  addTodo: (t: Omit<Todo, "id">) => void;
  updateTodo: (id: ID, patch: Partial<Todo>) => void;
  moveTodo: (id: ID, status: TodoStatus) => void;
  removeTodo: (id: ID) => void;

  // Memo
  addMemo: (m: Omit<Memo, "id" | "createdAt">) => void;
  updateMemo: (id: ID, patch: Partial<Memo>) => void;
  removeMemo: (id: ID) => void;

  // Meeting
  addMeeting: (m: Omit<Meeting, "id">) => void;
  removeMeeting: (id: ID) => void;

  // Settings
  updateSettings: (patch: Partial<Settings>) => void;

  // Command palette
  setCommandOpen: (v: boolean) => void;

  // Notifications (닫은 알림 id 기억 — 세션 내 유지)
  dismissNotif: (id: ID) => void;
  dismissNotifs: (ids: ID[]) => void;

  // Connections
  toggleConnection: (key: keyof Connections) => void;
  setConnection: (key: keyof Connections, value: boolean) => void;
  addContact: (c: Omit<Contact, "id">) => void;
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  conversations: seedConversations,
  activeConversationId: "c1",
  schedules: seedSchedules,
  todos: seedTodos,
  memos: seedMemos,
  meetings: seedMeetings,
  places: seedPlaces,
  timetable: seedTimetable,
  contacts: seedContacts,
  connections: { googleCalendar: true, googleContacts: true, outlook: false },
  settings: { name: "나", language: "ko", mode: "student", weekStart: "mon", notifications: true, autoConfirm: false, textScale: "md" },
  commandOpen: false,
  dismissedNotifs: [],

  newConversation: () => {
    const id = uid();
    const conv: Conversation = { id, title: "새 대화", createdAt: nowISO(), messages: [] };
    set((st) => ({ conversations: [conv, ...st.conversations], activeConversationId: id }));
    return id;
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  togglePin: (id) =>
    set((st) => ({
      conversations: st.conversations.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)),
    })),

  sendMessage: (text) => {
    const content = text.trim();
    if (!content) return;
    const st = get();
    let convId = st.activeConversationId;
    // 활성 대화 없으면 생성
    if (!convId || !st.conversations.find((c) => c.id === convId)) {
      convId = get().newConversation();
    }
    const userMsg: Message = { id: uid(), role: "user", content, createdAt: nowISO() };

    const res = interpret(content);
    let card: Message["card"];

    if (res.kind === "schedule") {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      start.setHours(15, 0, 0, 0);
      const id = get().addSchedule({
        title: res.title,
        start: start.toISOString(),
        end: new Date(+start + 60 * 60 * 1000).toISOString(),
        status: get().settings.autoConfirm ? "confirmed" : "pending",
      });
      card = { kind: "schedule", id };
    } else if (res.kind === "todo") {
      const id = uid();
      set((s) => ({ todos: [{ id, title: res.title, priority: "mid", status: "todo" }, ...s.todos] }));
      card = { kind: "todo", id };
    } else if (res.kind === "memo") {
      const id = uid();
      set((s) => ({
        memos: [{ id, title: res.title || "메모", content, tags: ["AI"], createdAt: nowISO() }, ...s.memos],
      }));
      card = { kind: "memo", id };
    }

    const aiMsg: Message = { id: uid(), role: "ai", content: res.reply, createdAt: nowISO(), card };

    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === convId
          ? {
              ...c,
              title: c.messages.length === 0 ? content.slice(0, 20) : c.title,
              messages: [...c.messages, userMsg, aiMsg],
            }
          : c
      ),
    }));
  },

  addSchedule: (s) => {
    const id = uid();
    set((st) => ({ schedules: [...st.schedules, { ...s, id }] }));
    return id;
  },
  updateSchedule: (id, patch) =>
    set((st) => ({ schedules: st.schedules.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
  removeSchedule: (id) => set((st) => ({ schedules: st.schedules.filter((s) => s.id !== id) })),
  confirmSchedule: (id) =>
    set((st) => ({ schedules: st.schedules.map((s) => (s.id === id ? { ...s, status: "confirmed" } : s)) })),
  conflictsFor: (id) => {
    const st = get();
    const target = st.schedules.find((s) => s.id === id);
    if (!target) return [];
    return st.schedules.filter((s) => s.id !== id && overlaps(s, target));
  },

  addTodo: (t) => set((st) => ({ todos: [{ ...t, id: uid() }, ...st.todos] })),
  updateTodo: (id, patch) =>
    set((st) => ({ todos: st.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  moveTodo: (id, status) =>
    set((st) => ({ todos: st.todos.map((t) => (t.id === id ? { ...t, status } : t)) })),
  removeTodo: (id) => set((st) => ({ todos: st.todos.filter((t) => t.id !== id) })),

  addMemo: (m) => set((st) => ({ memos: [{ ...m, id: uid(), createdAt: nowISO() }, ...st.memos] })),
  updateMemo: (id, patch) =>
    set((st) => ({ memos: st.memos.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
  removeMemo: (id) => set((st) => ({ memos: st.memos.filter((m) => m.id !== id) })),

  addMeeting: (m) => set((st) => ({ meetings: [{ ...m, id: uid() }, ...st.meetings] })),
  removeMeeting: (id) => set((st) => ({ meetings: st.meetings.filter((m) => m.id !== id) })),

  updateSettings: (patch) => set((st) => ({ settings: { ...st.settings, ...patch } })),

  setCommandOpen: (v) => set({ commandOpen: v }),

  dismissNotif: (id) =>
    set((st) =>
      st.dismissedNotifs.includes(id)
        ? st
        : { dismissedNotifs: [...st.dismissedNotifs, id] }
    ),
  dismissNotifs: (ids) =>
    set((st) => ({
      dismissedNotifs: [...new Set([...st.dismissedNotifs, ...ids])],
    })),

  toggleConnection: (key) =>
    set((st) => ({ connections: { ...st.connections, [key]: !st.connections[key] } })),
  setConnection: (key, value) =>
    set((st) => ({ connections: { ...st.connections, [key]: value } })),
  addContact: (c) => set((st) => ({ contacts: [{ ...c, id: uid() }, ...st.contacts] })),
}));