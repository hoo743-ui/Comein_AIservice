"use client";

import { create } from "zustand";

import type {
  ChatMessage,
  ChatRoom,
  ClassEntry,
  Connections,
  Contact,
  Conversation,
  EventParticipant,
  Place,
  ID,
  Meeting,
  Memo,
  Message,
  ParticipantStatus,
  Schedule,
  ScheduleProposal,
  Todo,
  TodoStatus,
} from "@/lib/types";
import { ME_ID } from "@/lib/types";
import {
  connectWith, ensureDmRoomRemote, fetchOpenProposal, fetchPeople, fetchSnapshot, openProposal,
  pullParticipant, pushEvent, pushMessage, pushParticipant, pushParticipantStatus, remoteReady,
  respondToProposal, roomIdForEvent, searchPeople, suggestSlots,
} from "@/lib/remote";

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

// ── 시드 날짜 기준점 ──
// 시드는 고정 ISO 로 둔다 — 모듈이 읽히는 시점에 new Date() 를 쓰면 서버와 브라우저가
// 서로 다른 값을 만들어 하이드레이션이 깨진다. 대신 화면이 뜬 뒤 rebaseSeeds() 로
// 이 기준일과 오늘의 차이만큼 한 번 밀어준다 → 데모가 늘 '오늘'을 중심으로 보인다.
const SEED_ANCHOR = "2026-07-08"; // 시드에서 '오늘'에 해당하던 날

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 로컬 시각 표기("YYYY-MM-DD" 또는 "YYYY-MM-DDTHH:mm:ss")를 days 만큼 민다.
 *  toISOString() 을 쓰지 않는다 — UTC 로 바뀌면서 시각이 실제로 어긋난다. */
function shiftISO(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?/.exec(iso);
  if (!m) return iso;
  const [, y, mo, da, hh, mi, ss] = m;
  const d = new Date(Number(y), Number(mo) - 1, Number(da) + days, Number(hh ?? 0), Number(mi ?? 0), Number(ss ?? 0));
  const ymd = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return hh === undefined ? ymd : `${ymd}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

const daysBetween = (fromISO: string, to: Date): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fromISO);
  if (!m) return 0;
  const from = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const till = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((till - from) / 86_400_000);
};

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

// 연락처 — 비워 둔다.
// 사람은 지어낼 수 없다. 실제로 가입한 상대만 여기 들어온다(그 전까지 '사람' 탭은 비어 있는 게 정직하다).
const seedContacts: Contact[] = [];

// ── 공유 일정 ──
// 참여자·대화방·메시지는 지어내지 않는다. 지어낸 사람과 지어낸 대화는
// 로그인한 뒤에도 남아 진짜 데이터인 척하게 된다.
const seedParticipants: EventParticipant[] = [];
const seedRooms: ChatRoom[] = [];
const seedChatMessages: ChatMessage[] = [];

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
/** 글자 크기 배율. 칸이 아니라 연속값 — 사람마다 편한 크기가 세 칸에 딱 떨어지지 않는다. */
export type TextScale = number;
export const TEXT_SCALE_MIN = 0.9;
export const TEXT_SCALE_MAX = 1.4;

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
  eventParticipants: EventParticipant[];
  chatRooms: ChatRoom[];
  chatMessages: ChatMessage[];
  connections: Connections;
  settings: Settings;
  commandOpen: boolean;
  dismissedNotifs: ID[];
  seedsRebased: boolean;
  /** Supabase 에 붙어 있는가. 붙으면 시드 데모 데이터를 걷어내고 서버의 것만 본다. */
  remoteLive: boolean;

  /** 시드 날짜를 오늘 기준으로 한 번만 옮긴다(화면이 뜬 뒤 호출). 두 번 불러도 안전하다. */
  rebaseSeeds: (today: Date) => void;

  /** 서버에서 받아온 것으로 갈아끼운다. 로그인하면 데모 시드는 물러난다. */
  hydrateRemote: (snap: {
    schedules: Schedule[];
    eventParticipants: EventParticipant[];
    chatRooms: ChatRoom[];
    chatMessages: ChatMessage[];
    contacts?: Contact[];
  }) => void;
  /** 사람 목록만 다시 받아온다(누군가를 잇고 난 뒤). */
  refreshPeople: () => Promise<void>;
  /** Comein 계정 검색 — 지역 상태를 건드리지 않고 결과만 돌려준다. */
  findPeople: (q: string) => Promise<Contact[]>;
  /** 잇는다. 이어지면 사람 목록에 들어온다(멱등). */
  connectPerson: (peerId: ID) => Promise<boolean>;
  /** Realtime 으로 들어온 메시지 한 건. 같은 id 가 이미 있으면 무시한다
   *  (내가 보낸 낙관적 메시지와 서버가 돌려준 것이 겹쳐 두 번 보이지 않게). */
  applyRemoteMessage: (m: ChatMessage) => void;

  // 읽지 않은 말 — 방마다 몇 개가 쌓였는가.
  unread: Record<ID, number>;
  bumpUnread: (roomId: ID) => void;
  markRoomRead: (roomId: ID) => void;

  // Chat
  newConversation: () => ID;
  setActiveConversation: (id: ID) => void;
  sendMessage: (text: string) => void;
  togglePin: (id: ID) => void;

  // Schedule
  addSchedule: (s: Omit<Schedule, "id">) => ID;
  updateSchedule: (id: ID, patch: Partial<Schedule>) => void;
  removeSchedule: (id: ID) => void;
  /** 일정과 함께 참여자·대화방·메시지까지 지운다(고아 데이터 방지). */
  removeScheduleCascade: (id: ID) => void;
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

  // 공유 일정 · 참여자 — 하나의 일정을 여럿이 같은 id 로 바라본다
  participantsOf: (eventId: ID) => EventParticipant[];
  /** 내가 참여한 일정만. Supabase 전환 시 current_user → event_participants → events 질의로 대체된다. */
  myEvents: () => Schedule[];
  /** 그 사람과 내가 함께 있는 일정 — People 화면의 '공유 일정'. */
  sharedEventsWith: (userId: ID) => Schedule[];
  isShared: (eventId: ID) => boolean;
  /** 같은 사람을 두 번 초대해도 한 줄만 남는다(멱등). 참여자가 되면 대화방 멤버도 된다. */
  addParticipant: (eventId: ID, userId: ID) => void;
  removeParticipant: (eventId: ID, userId: ID) => void;
  setParticipantStatus: (eventId: ID, userId: ID, status: ParticipantStatus) => void;

  // 일정 제안 — 대화에서 시간이 정해지는 길
  /** eventId → 열려 있는 제안(없으면 null). 지난 제안은 담지 않는다. */
  proposals: Record<ID, ScheduleProposal | null>;
  loadProposal: (eventId: ID) => Promise<void>;
  /** 후보 시각 언저리에서 가장 나은 시간을 서버에 물어 제안을 연다.
   *  못 찾으면 null 을 돌려준다 — 아무 때나 지어내 제안하지 않는다. */
  proposeTime: (eventId: ID, preferred: Date, durationMin?: number, title?: string) => Promise<ScheduleProposal | null>;
  answerProposal: (eventId: ID, proposalId: ID, response: "accepted" | "declined") => Promise<void>;

  // 일정 대화 — 일정 하나당 방 하나
  /** 없으면 만들고 있으면 그대로 돌려준다(중복 생성 금지). */
  ensureRoom: (eventId: ID) => ID;
  messagesOf: (eventId: ID) => ChatMessage[];
  sendEventMessage: (eventId: ID, content: string) => void;

  // 사람과의 1:1 대화 — 일정에 매이지 않는 방. 상대 한 명당 하나(멱등).
  ensureDirectRoom: (peerId: ID) => ID;
  directMessagesOf: (peerId: ID) => ChatMessage[];
  sendDirectMessage: (peerId: ID, content: string) => void;

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
  eventParticipants: seedParticipants,
  chatRooms: seedRooms,
  chatMessages: seedChatMessages,
  connections: { googleCalendar: true, googleContacts: true, outlook: false },
  settings: { name: "나", language: "ko", mode: "student", weekStart: "mon", notifications: true, autoConfirm: false, textScale: 1 },
  commandOpen: false,
  dismissedNotifs: [],
  seedsRebased: false,
  remoteLive: false,

  hydrateRemote: (snap) =>
    set({
      remoteLive: true,
      seedsRebased: true, // 서버 것을 쓰기 시작하면 시드 날짜를 옮길 이유가 없다
      schedules: snap.schedules,
      eventParticipants: snap.eventParticipants,
      chatRooms: snap.chatRooms,
      chatMessages: snap.chatMessages,
      // 데모용으로 깔아 둔 것들은 물러난다 — 로그인한 계정에 지어낸 사람과
      // 지어낸 회의가 남아 있으면 그게 진짜 데이터인 줄 알게 된다.
      // 사람만은 서버가 준 진짜 계정으로 채운다(없으면 빈 채로 둔다).
      contacts: snap.contacts ?? [],
      meetings: [],
      todos: [],
      memos: [],
      conversations: [],
    }),

  refreshPeople: async () => {
    if (!remoteReady()) return;
    const people = await fetchPeople();
    set({ contacts: people });
  },

  findPeople: async (q) => (remoteReady() ? searchPeople(q) : []),

  connectPerson: async (peerId) => {
    if (!remoteReady()) return false;
    const ok = await connectWith(peerId);
    if (ok) await get().refreshPeople();
    return ok;
  },

  applyRemoteMessage: (m) =>
    set((st) => (st.chatMessages.some((x) => x.id === m.id) ? st : { chatMessages: [...st.chatMessages, m] })),

  unread: {},
  bumpUnread: (roomId) => set((st) => ({ unread: { ...st.unread, [roomId]: (st.unread[roomId] ?? 0) + 1 } })),
  markRoomRead: (roomId) =>
    set((st) => {
      if (!st.unread[roomId]) return st;      // 이미 0 이면 새 객체를 만들지 않는다(불필요한 리렌더 방지)
      const next = { ...st.unread };
      delete next[roomId];
      return { unread: next };
    }),

  rebaseSeeds: (today) => {
    if (get().remoteLive) return;   // 서버 데이터에는 손대지 않는다
    if (get().seedsRebased) return; // 이미 옮겼다 — 두 번 밀면 날짜가 더 멀어진다
    const days = daysBetween(SEED_ANCHOR, today);
    if (days === 0) { set({ seedsRebased: true }); return; }
    set((st) => ({
      seedsRebased: true,
      schedules: st.schedules.map((s) => ({
        ...s,
        start: shiftISO(s.start, days),
        end: s.end ? shiftISO(s.end, days) : s.end,
      })),
      todos: st.todos.map((t) => (t.due ? { ...t, due: shiftISO(t.due, days) } : t)),
      memos: st.memos.map((m) => ({ ...m, createdAt: shiftISO(m.createdAt, days) })),
      meetings: st.meetings.map((m) => ({ ...m, start: shiftISO(m.start, days) })),
      contacts: st.contacts.map((c) => (c.lastMet ? { ...c, lastMet: shiftISO(c.lastMet, days) } : c)),
      chatMessages: st.chatMessages.map((m) => ({ ...m, createdAt: shiftISO(m.createdAt, days) })),
      conversations: st.conversations.map((c) => ({
        ...c,
        createdAt: shiftISO(c.createdAt, days),
        messages: c.messages.map((msg) => ({ ...msg, createdAt: shiftISO(msg.createdAt, days) })),
      })),
    }));
  },

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
    // 일정을 만든 사람은 그 일정의 주인이다 — 참여자 표에 owner 로 함께 들어간다.
    // (여기가 비어 있으면 나중에 사람을 초대해도 '누가 이 일정의 주인인가'를 알 수 없다.)
    set((st) => ({
      schedules: [...st.schedules, { ...s, id, ownerId: s.ownerId ?? ME_ID }],
      eventParticipants: [...st.eventParticipants, { eventId: id, userId: ME_ID, role: "owner", status: "accepted" }],
    }));
    // 서버에 붙어 있으면 곧바로 밀어 넣고, 서버가 준 진짜 id 로 지역 id 를 바꿔 단다.
    // (화면은 이미 그려졌다 — 저장은 뒤에서 따라온다. 실패해도 화면은 멈추지 않는다.)
    if (remoteReady()) {
      void pushEvent({ ...s, id } as Schedule).then((realId) => {
        if (!realId) return;
        set((st) => ({
          schedules: st.schedules.map((x) => (x.id === id ? { ...x, id: realId } : x)),
          eventParticipants: st.eventParticipants.map((p) => (p.eventId === id ? { ...p, eventId: realId } : p)),
          chatRooms: st.chatRooms.map((r) => (r.eventId === id ? { ...r, eventId: realId, id: `room_${realId}` } : r)),
          chatMessages: st.chatMessages.map((m) => (m.roomId === `room_${id}` ? { ...m, roomId: `room_${realId}` } : m)),
        }));
      });
    }
    return id;
  },
  removeScheduleCascade: (id) =>
    // 일정이 사라지면 그 일정에 매인 참여자·대화방·메시지도 함께 사라진다(고아 데이터를 남기지 않는다).
    set((st) => {
      const room = st.chatRooms.find((r) => r.eventId === id);
      return {
        schedules: st.schedules.filter((s) => s.id !== id),
        eventParticipants: st.eventParticipants.filter((p) => p.eventId !== id),
        chatRooms: st.chatRooms.filter((r) => r.eventId !== id),
        chatMessages: room ? st.chatMessages.filter((m) => m.roomId !== room.id) : st.chatMessages,
      };
    }),
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

  // ── 공유 일정 · 참여자 ──────────────────────────────
  participantsOf: (eventId) => get().eventParticipants.filter((p) => p.eventId === eventId),

  isShared: (eventId) => get().eventParticipants.filter((p) => p.eventId === eventId).length > 1,

  myEvents: () => {
    const st = get();
    // 내가 참여자로 들어간 일정 + 참여자 관계가 아예 없는 개인 일정.
    // (참여자 표가 있는 일정인데 내가 없다면 그건 남의 일정이라 보이지 않아야 한다.)
    const mine = new Set(st.eventParticipants.filter((p) => p.userId === ME_ID).map((p) => p.eventId));
    const shared = new Set(st.eventParticipants.map((p) => p.eventId));
    return st.schedules.filter((s) => mine.has(s.id) || !shared.has(s.id));
  },

  sharedEventsWith: (userId) => {
    const st = get();
    const theirs = new Set(st.eventParticipants.filter((p) => p.userId === userId).map((p) => p.eventId));
    const mine = new Set(st.eventParticipants.filter((p) => p.userId === ME_ID).map((p) => p.eventId));
    return st.schedules
      .filter((s) => theirs.has(s.id) && mine.has(s.id))
      .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  },

  addParticipant: (eventId, userId) => {
    // 멱등 — 같은 사람이 동시에 두 번 초대돼도 한 줄만 남는다.
    set((st) =>
      st.eventParticipants.some((p) => p.eventId === eventId && p.userId === userId)
        ? st
        : { eventParticipants: [...st.eventParticipants, { eventId, userId, role: "participant", status: "invited" }] },
    );
    // 참여자가 되면 그 일정의 대화에 들어올 수 있어야 한다.
    get().ensureRoom(eventId);
    if (remoteReady()) void pushParticipant(eventId, userId);
  },

  removeParticipant: (eventId, userId) => {
    // 참여자에서 빠지면 대화 접근도 끊긴다. 다만 이미 남긴 메시지의 작성자 정보는 지우지 않는다.
    set((st) => ({
      eventParticipants: st.eventParticipants.filter((p) => !(p.eventId === eventId && p.userId === userId)),
    }));
    if (remoteReady()) void pullParticipant(eventId, userId);
  },

  setParticipantStatus: (eventId, userId, status) => {
    set((st) => ({
      eventParticipants: st.eventParticipants.map((p) =>
        p.eventId === eventId && p.userId === userId ? { ...p, status } : p,
      ),
    }));
    if (remoteReady()) void pushParticipantStatus(eventId, userId, status);
  },

  // ── 일정 제안 ───────────────────────────────────────
  proposals: {},

  loadProposal: async (eventId) => {
    if (!remoteReady()) return;
    const p = await fetchOpenProposal(eventId);
    set((st) => ({ proposals: { ...st.proposals, [eventId]: p } }));
  },

  proposeTime: async (eventId, preferred, durationMin = 60, title) => {
    if (!remoteReady()) return null;
    // 후보를 찾는 창은 그날 하루로 둔다 — 며칠씩 훑으면 '언제 바쁜지'를 넓게 되묻는 셈이 된다.
    const dayStart = new Date(preferred); dayStart.setHours(7, 0, 0, 0);
    const dayEnd = new Date(preferred); dayEnd.setHours(23, 0, 0, 0);
    const slots = await suggestSlots(
      eventId, dayStart.toISOString(), dayEnd.toISOString(), durationMin, preferred.toISOString(),
    );
    if (slots.length === 0) return null;

    const best = slots[0];
    // 왜 이 시각인지 한 줄로 남긴다. 근거 없는 제안은 사람을 설득하지 못한다.
    const everyone = best.availableCount === best.totalCount;
    const moved = Math.abs(+new Date(best.start) - +preferred) >= 60_000;
    const why = everyone
      ? (moved ? `${best.totalCount}명 모두 가능한 가장 가까운 시간이에요.` : `${best.totalCount}명 모두 일정 충돌이 없어요.`)
      : `${best.totalCount}명 중 ${best.availableCount}명이 가능한 시간이에요.`;

    const id = await openProposal(eventId, title ?? null, best.start, best.end, why);
    if (!id) return null;
    await get().loadProposal(eventId);
    return get().proposals[eventId] ?? null;
  },

  answerProposal: async (eventId, proposalId, response) => {
    if (!remoteReady()) return;
    const res = await respondToProposal(proposalId, response);
    // 전원이 동의하면 서버가 그 자리에서 일정을 앉힌다 → 달력도 다시 받아 온다.
    if (res?.status === "confirmed") {
      const snap = await fetchSnapshot();
      if (snap) get().hydrateRemote(snap);
      set((st) => ({ proposals: { ...st.proposals, [eventId]: null } }));
      return;
    }
    await get().loadProposal(eventId);
  },

  // ── 일정 대화 — 일정 하나당 방 하나 ──────────────────
  ensureRoom: (eventId) => {
    const existing = get().chatRooms.find((r) => r.eventId === eventId);
    if (existing) return existing.id;
    // id 를 eventId 에서 파생시켜 두면 경합이 나도 같은 방으로 수렴한다.
    const id = `room_${eventId}`;
    set((st) => (st.chatRooms.some((r) => r.eventId === eventId) ? st : { chatRooms: [...st.chatRooms, { id, eventId }] }));
    return id;
  },

  messagesOf: (eventId) => {
    const room = get().chatRooms.find((r) => r.eventId === eventId);
    if (!room) return [];
    return get()
      .chatMessages.filter((m) => m.roomId === room.id)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  },

  sendEventMessage: (eventId, content) => {
    const text = content.trim();
    if (!text) return;
    const roomId = get().ensureRoom(eventId);
    // 낙관적 반영 — 말은 즉시 화면에 얹고, 저장은 뒤따른다.
    const msg: ChatMessage = { id: uid(), roomId, senderId: ME_ID, content: text, createdAt: nowISO(), pending: remoteReady() };
    set((st) => ({ chatMessages: [...st.chatMessages, msg] }));
    if (!remoteReady()) return;
    void (async () => {
      const rid = (await roomIdForEvent(eventId)) ?? roomId;
      const realId = await pushMessage(rid, text);
      // 서버가 준 id 로 갈아 단다 — Realtime 이 같은 걸 돌려줘도 중복으로 쌓이지 않는다.
      set((st) => ({
        chatMessages: realId
          ? st.chatMessages.map((m) => (m.id === msg.id ? { ...m, id: realId, roomId: rid, pending: false } : m))
          : st.chatMessages.filter((m) => m.id !== msg.id),
      }));
    })();
  },

  ensureDirectRoom: (peerId) => {
    const existing = get().chatRooms.find((r) => r.peerId === peerId);
    if (existing) return existing.id;
    const id = `dm_${peerId}`;
    set((st) => (st.chatRooms.some((r) => r.peerId === peerId) ? st : { chatRooms: [...st.chatRooms, { id, peerId }] }));
    return id;
  },

  directMessagesOf: (peerId) => {
    const room = get().chatRooms.find((r) => r.peerId === peerId);
    if (!room) return [];
    return get()
      .chatMessages.filter((m) => m.roomId === room.id)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  },

  sendDirectMessage: (peerId, content) => {
    const text = content.trim();
    if (!text) return;
    const roomId = get().ensureDirectRoom(peerId);
    const msg: ChatMessage = { id: uid(), roomId, senderId: ME_ID, content: text, createdAt: nowISO(), pending: remoteReady() };
    set((st) => ({ chatMessages: [...st.chatMessages, msg] }));
    if (!remoteReady()) return;
    void (async () => {
      const rid = await ensureDmRoomRemote(peerId);
      if (!rid) return;
      const realId = await pushMessage(rid, text);
      set((st) => ({
        chatMessages: realId
          ? st.chatMessages.map((m) => (m.id === msg.id ? { ...m, id: realId, roomId: rid, pending: false } : m))
          : st.chatMessages.filter((m) => m.id !== msg.id),
      }));
    })();
  },

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