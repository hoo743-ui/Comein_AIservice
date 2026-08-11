"use client";

import { create } from "zustand";

import type {
  ChatMessage,
  ChatRoom,
  ClassEntry,
  Contact,
  EventParticipant,
  Place,
  ID,
  ParticipantStatus,
  Schedule,
  ScheduleProposal,
  Todo,
  TodoStatus,
} from "@/lib/types";
import { ME_ID } from "@/lib/types";
import {
  connectWith, dayAvailability, ensureDmRoomRemote, fetchOpenProposal, fetchPeople, fetchSnapshot,
  openProposal, pullParticipant, pushEvent, pushMessage, pushParticipant, pushParticipantStatus,
  remoteReady, respondToProposal, roomIdForEvent, searchPeople, suggestSlots,
} from "@/lib/remote";

/** 하루를 가리키는 키 — 시간대 문제를 피해 로컬 연·월·일로 만든다. */
export const dayKeyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ── 아직 서버에 없는 일정 ──
// 일정은 화면에 먼저 서고(지역 id) 저장은 뒤따른다. 그 사이에 사람을 부르면
// 서버에는 없는 일정에 참여자를 넣는 셈이라 조용히 실패한다(FK 위반).
// 실제로 그랬다: 여럿이 모이는 자리를 만들어도 부른 사람이 붙지 않았다.
// 그래서 아직 서버에 없는 동안의 초대는 여기 모아 뒀다가, 진짜 id 를 받은 뒤 한꺼번에 보낸다.
const unsynced = new Set<ID>();
const pendingInvites = new Map<ID, ID[]>();

const queueInvite = (eventId: ID, userId: ID) => {
  const list = pendingInvites.get(eventId) ?? [];
  if (!list.includes(userId)) list.push(userId);
  pendingInvites.set(eventId, list);
};

/** 지역 id 가 진짜 id 로 바뀐 순간 — 밀렸던 초대를 그 id 로 보낸다. */
const flushInvites = (localId: ID, realId: ID) => {
  unsynced.delete(localId);
  const list = pendingInvites.get(localId);
  pendingInvites.delete(localId);
  for (const userId of list ?? []) void pushParticipant(realId, userId);
};

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

// 메모·회의 슬라이스는 걷어냈다. 뷰가 사라지면서(24_AI_PIPELINE_STATUS §9·§10.1)
// 어떤 화면도 읽지 않게 됐고, 캡처는 memo 를 '할 일'로 접어 담는다.
// 시드만 남으면 로그인한 계정에 지어낸 회의가 떠 있는 것처럼 보인다.

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

// 대화방(conversations)과 간이 인텐트 라우터 interpret() 는 걷어냈다.
// 정규식으로 "일정|메모|할 일" 을 갈라 놓고 "우선순위를 추천해 뒀습니다" 라고 말하던
// 가짜 AI 였고, 지금은 캡처바가 진짜 AI(/api/chat)를 부른다. 화면도 이 대화방을
// 그리지 않는다 — 남겨 두면 '있는 것처럼 보이는' 코드가 된다.

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
  schedules: Schedule[];
  /** 아직 서버에 자리가 없다 — 캡처한 할 일은 지금 어디에도 저장되지 않는다.
   *  '오늘'의 할 일 수만 이 값을 읽는다. todos 테이블이 생기면 그때 이어진다. */
  todos: Todo[];
  places: Place[];
  timetable: ClassEntry[];
  contacts: Contact[];
  eventParticipants: EventParticipant[];
  chatRooms: ChatRoom[];
  chatMessages: ChatMessage[];
  settings: Settings;
  seedsRebased: boolean;
  /** Supabase 에 붙어 있는가. 붙으면 시드 데모 데이터를 걷어내고 서버의 것만 본다. */
  remoteLive: boolean;

  /** 지역 id → 서버가 준 진짜 id.
   *  일정은 화면에 먼저 서고 저장이 뒤따르므로, 그 사이 화면이 쥔 id 는 곧 낡는다.
   *  (실제로 그랬다: 자리를 만들자마자 방이 통째로 사라졌다 — 열어 둔 id 가 어느 일정과도 안 맞아서.) */
  idAlias: Record<ID, ID>;
  /** 화면이 쥔 id 로 지금의 일정을 찾는다. 낡았으면 대응표를 한 번 거친다. */
  resolveEventId: (id: ID | null) => ID | null;

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

  // Schedule
  addSchedule: (s: Omit<Schedule, "id">) => ID;

  // Todo
  addTodo: (t: Omit<Todo, "id">) => void;
  updateTodo: (id: ID, patch: Partial<Todo>) => void;
  moveTodo: (id: ID, status: TodoStatus) => void;
  removeTodo: (id: ID) => void;

  // 공유 일정 · 참여자 — 하나의 일정을 여럿이 같은 id 로 바라본다
  participantsOf: (eventId: ID) => EventParticipant[];
  /** 그 사람과 내가 함께 있는 일정 — People 화면의 '공유 일정'. */
  sharedEventsWith: (userId: ID) => Schedule[];
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

  /** 대화방 옆 하루 — 슬롯별 '몇 명이 되는가'. 키는 `eventId|YYYY-MM-DD`.
   *  누가 바쁜지는 담기지 않는다(집계만). 내 일정은 schedules 에서 그대로 읽어 그린다. */
  dayAvail: Record<string, { start: string; available: number; total: number }[]>;
  loadDayAvail: (eventId: ID, day: Date) => Promise<void>;

  // 일정 대화 — 일정 하나당 방 하나
  /** 없으면 만들고 있으면 그대로 돌려준다(중복 생성 금지). */
  ensureRoom: (eventId: ID) => ID;
  messagesOf: (eventId: ID) => ChatMessage[];
  sendEventMessage: (eventId: ID, content: string) => void;

  // 사람과의 1:1 대화 — 일정에 매이지 않는 방. 상대 한 명당 하나(멱등).
  ensureDirectRoom: (peerId: ID) => ID;
  sendDirectMessage: (peerId: ID, content: string) => void;

  // Settings
  updateSettings: (patch: Partial<Settings>) => void;
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  schedules: seedSchedules,
  todos: seedTodos,
  places: seedPlaces,
  timetable: seedTimetable,
  contacts: seedContacts,
  eventParticipants: seedParticipants,
  chatRooms: seedRooms,
  chatMessages: seedChatMessages,
  settings: { name: "나", language: "ko", mode: "student", weekStart: "mon", notifications: true, autoConfirm: false, textScale: 1 },
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
      // 데모용으로 깔아 둔 것들은 물러난다 — 로그인한 계정에 지어낸 데이터가
      // 남아 있으면 그게 진짜인 줄 알게 된다.
      // 사람만은 서버가 준 진짜 계정으로 채운다(없으면 빈 채로 둔다).
      contacts: snap.contacts ?? [],
      todos: [],
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
      contacts: st.contacts.map((c) => (c.lastMet ? { ...c, lastMet: shiftISO(c.lastMet, days) } : c)),
      chatMessages: st.chatMessages.map((m) => ({ ...m, createdAt: shiftISO(m.createdAt, days) })),
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
      unsynced.add(id); // 진짜 id 를 받기 전까지, 이 일정에 붙는 초대는 밀어 둔다
      void pushEvent({ ...s, id } as Schedule).then((realId) => {
        if (!realId) { unsynced.delete(id); pendingInvites.delete(id); return; }
        flushInvites(id, realId);
        set((st) => ({
          idAlias: { ...st.idAlias, [id]: realId },
          schedules: st.schedules.map((x) => (x.id === id ? { ...x, id: realId } : x)),
          eventParticipants: st.eventParticipants.map((p) => (p.eventId === id ? { ...p, eventId: realId } : p)),
          chatRooms: st.chatRooms.map((r) => (r.eventId === id ? { ...r, eventId: realId, id: `room_${realId}` } : r)),
          chatMessages: st.chatMessages.map((m) => (m.roomId === `room_${id}` ? { ...m, roomId: `room_${realId}` } : m)),
        }));
      });
    }
    return id;
  },
  addTodo: (t) => set((st) => ({ todos: [{ ...t, id: uid() }, ...st.todos] })),
  updateTodo: (id, patch) =>
    set((st) => ({ todos: st.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  moveTodo: (id, status) =>
    set((st) => ({ todos: st.todos.map((t) => (t.id === id ? { ...t, status } : t)) })),
  removeTodo: (id) => set((st) => ({ todos: st.todos.filter((t) => t.id !== id) })),

  // ── 공유 일정 · 참여자 ──────────────────────────────
  participantsOf: (eventId) => get().eventParticipants.filter((p) => p.eventId === eventId),

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
    if (!remoteReady()) return;
    // 아직 서버에 없는 일정이면 지금 보내 봐야 FK 위반으로 사라진다 — 진짜 id 를 받은 뒤에 보낸다.
    if (unsynced.has(eventId)) queueInvite(eventId, userId);
    else void pushParticipant(eventId, userId);
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

  idAlias: {},

  resolveEventId: (id) => {
    if (!id) return null;
    const st = get();
    if (st.schedules.some((s) => s.id === id)) return id;
    const real = st.idAlias[id];
    return real && st.schedules.some((s) => s.id === real) ? real : id;
  },

  dayAvail: {},

  loadDayAvail: async (eventId, day) => {
    if (!remoteReady()) return;
    // 하루의 창은 07:00–23:00 — 새벽까지 훑으면 그것도 남의 하루를 넓게 되묻는 일이 된다.
    const from = new Date(day); from.setHours(7, 0, 0, 0);
    const to = new Date(day); to.setHours(23, 0, 0, 0);
    const rows = await dayAvailability(eventId, from, to, 30);
    const key = `${eventId}|${dayKeyOf(day)}`;
    set((st) => ({ dayAvail: { ...st.dayAvail, [key]: rows } }));
  },

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
}));

// 함께 걷어낸 것들 —
//   commandOpen / setCommandOpen      커맨드 팔레트가 없다
//   dismissNotif(s) / dismissedNotifs 알림 벨을 없앨 때(§10.1) 함께 죽었다
//   connections / toggle·setConnection  구글·아웃룩 토글 화면이 없다
//   addContact                        사람은 이제 Comein 계정 검색으로만 들어온다
//   memos / meetings                  뷰가 사라졌다(§9·§10.1)
//   conversations / sendMessage       가짜 AI 대화방. 캡처바가 대신한다
//   updateSchedule / removeSchedule / removeScheduleCascade / confirmSchedule /
//   conflictsFor / overlaps / isShared / myEvents / directMessagesOf
//                                     한 곳에서도 부르지 않았다
// 되살릴 일이 생기면 git 이 기억하고 있다.