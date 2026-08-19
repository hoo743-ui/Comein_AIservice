"use client";

import { create } from "zustand";

import type { UserMode } from "./mode";
import type {
  ChatMessage,
  ChatRoom,
  ClassEntry,
  ConnectionRequest,
  Contact,
  EventParticipant,
  Group,
  GroupMember,
  Place,
  ID,
  ParticipantStatus,
  Schedule,
  ScheduleProposal,
} from "@/lib/types";
import { ME_ID } from "@/lib/types";
import {
  createGroupRemote, deleteGroupRemote, pullGroupMember, pushGroupMember, renameGroupRemote, syncGroupCalendar,
  editMessage as editMessageRemote, deleteMessage as deleteMessageRemote,
  answerConnectionRequest, cancelConnectionRequest, changeMyHandle, dayAvailability, ensureDmRoomRemote,
  fetchHandleState,
  fetchConnectionRequests, fetchOpenProposal, fetchOpenProposalEvents, fetchOutgoingRequests, fetchPeople, fetchSnapshot,
  confirmEvent, deleteEvent, renameEvent,
  openProposal, pullParticipant, pushEvent, pushMessage, pushParticipant, pushParticipantStatus,
  remoteReady, requestConnection, respondToProposal, roomIdForEvent, searchPeople, suggestSlots,
  type RequestOutcome,
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

// 할 일·메모·회의 슬라이스는 걷어냈다.
//
// 뷰가 사라진 것이 먼저였고(§9·§10.1), 그 뒤로 아무 화면도 이것들을 읽지 않았다.
// 그런데도 시드가 남아 있어서 '오늘'의 할 일 수를 채웠고 — 로그인하면 그 수가 0 이 됐다.
// 지어낸 다섯 줄이 기능이 있는 것처럼 보이게 하고 있었던 셈이다.
//
// 할 일은 담을 표도 없다(supabase/migrations 에 todos 가 없다). 살리려면 표부터
// 세워야 하고, 그건 화면을 되살리는 날 함께 할 일이다(docs/24 §25).
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
/** 사용자 Context. 실제 값과 해석 규칙은 `lib/mode.ts` 가 쥔다 —
 *  화면은 그쪽 훅(useCurrentMode)으로만 읽고, 여기는 저장되는 자리일 뿐이다.
 *  (예전 값 office·general 은 normalizeMode 가 흡수한다.) */
export type Mode = UserMode;
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
  places: Place[];
  timetable: ClassEntry[];
  contacts: Contact[];
  eventParticipants: EventParticipant[];
  /** 같은 사람들이 다시 모인다 — 일정보다 오래 사는 묶음(0017). */
  groups: Group[];
  groupMembers: GroupMember[];
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
    groups?: Group[];
    groupMembers?: GroupMember[];
  }) => void;
  /** 사람 목록만 다시 받아온다(누군가를 잇고 난 뒤). */
  refreshPeople: () => Promise<void>;
  /** Comein 계정 검색 — 지역 상태를 건드리지 않고 결과만 돌려준다. */
  findPeople: (q: string) => Promise<Contact[]>;
  /** 잇자고 청한다 — 즉시 잇지 않는다. 상대가 받아야 이어진다.
   *  상대도 나에게 보내 두었다면 그 자리에서 이어진다("accepted"). */
  requestPerson: (peerId: ID) => Promise<{ outcome: RequestOutcome; message?: string }>;
  /** 보낸 요청을 무른다. 됐으면 true — 화면은 이 값을 보고 줄을 바꾼다. */
  cancelRequest: (peerId: ID) => Promise<boolean>;
  /** 나에게 온, 아직 답하지 않은 요청들. */
  connectionRequests: ConnectionRequest[];
  /** 내가 보내 두고 아직 답을 못 받은 상대들 — 줄이 '요청' 을 다시 내밀지 않게. */
  outgoingRequests: ID[];
  /** 내 핸들 — 남에게 알려 줄 이름. 로그인 전에는 null. */
  myHandle: string | null;
  /** 언제 다시 바꿀 수 있는가(ISO). 30일 규칙을 화면이 미리 말해 준다. */
  handleChangeableAt: string | null;
  /** 이름을 바꾼다. 막혔으면 왜 막혔는지 그대로 돌려준다. */
  changeHandle: (next: string) => Promise<{ ok: boolean; message?: string }>;
  /** 받은 요청을 다시 읽어 온다. */
  loadRequests: () => Promise<void>;
  /** 받은 요청에 답한다. 화면에서 먼저 걷고 서버가 뒤따른다(실패하면 되돌린다). */
  answerRequest: (id: ID, accept: boolean) => Promise<void>;
  /** 요청에 답하다 막혔다면 그 이유. 조용한 실패는 사용자에게 '내가 잘못 눌렀나' 로만 남는다. */
  requestError: string | null;
  clearRequestError: () => void;
  /** 내가 쓴 말을 고친다. 화면에 먼저 반영하고 서버가 뒤따른다(실패하면 되돌린다). */
  editMessage: (id: ID, content: string) => Promise<void>;
  /** 내가 쓴 말을 지운다(soft delete — 서버에는 행이 남고 내용은 비워진다). */
  deleteMessage: (id: ID) => Promise<void>;
  /** Realtime 이 알려준 '지워진 말' — 그 자리를 걷는다. */
  dropMessage: (id: ID) => void;

  /** Realtime 으로 들어온 메시지 한 건. 같은 id 가 이미 있으면 무시한다
   *  (내가 보낸 낙관적 메시지와 서버가 돌려준 것이 겹쳐 두 번 보이지 않게). */
  applyRemoteMessage: (m: ChatMessage) => void;

  // 읽지 않은 말 — 방마다 몇 개가 쌓였는가.
  unread: Record<ID, number>;
  bumpUnread: (roomId: ID) => void;
  markRoomRead: (roomId: ID) => void;

  // Schedule
  addSchedule: (s: Omit<Schedule, "id">) => ID;
  /** AI 가 놓아 둔 제안(pending)을 사람이 확정한다. 이미 확정된 것은 아무 일도 일어나지 않는다. */
  confirmSchedule: (id: ID) => void;
  /** 없던 일로 — 일정과 그에 매달린 것(참여자·방·말)까지 함께 걷는다. */
  removeSchedule: (id: ID) => void;
  /** 이름을 고쳐 단다. 방 이름은 곧 일정 제목이다(서버는 주최자만 받는다). */
  renameSchedule: (id: ID, title: string) => void;

  // 그룹 — 같은 사람들이 다시 모인다(0017)
  /** 그 그룹의 사람들. */
  membersOf: (groupId: ID) => GroupMember[];
  /** 그 그룹으로 잡힌 일정들(시간 순). */
  eventsOfGroup: (groupId: ID) => Schedule[];
  /** 내가 그 그룹의 주인인가 — 이름·사람은 주인만 건드릴 수 있다(서버도 그렇게 받는다). */
  isGroupOwner: (groupId: ID) => boolean;
  /** 그룹을 열고 사람들을 부른다. 만든 사람은 서버 트리거가 주인이자 멤버로 앉힌다. */
  createGroup: (name: string, memberIds: ID[]) => Promise<ID | null>;
  renameGroup: (groupId: ID, name: string) => void;
  removeGroup: (groupId: ID) => void;
  addGroupMember: (groupId: ID, userId: ID) => void;
  removeGroupMember: (groupId: ID, userId: ID) => void;
  /** 그룹의 일정들에 지금 멤버 전원을 채운다(멱등). 몇 개 일정에 몇 사람을 채웠는지 돌려준다. */
  syncGroup: (groupId: ID) => Promise<{ events: number; members: number } | null>;

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
  /** 방금 전원 동의로 확정된 일정. 화면이 그 순간을 알아채고 한 번 정리한다.
   *  proposals[id] 로는 알 수 없다 — 확정되면 그 자리를 곧바로 비우고(아래 answerProposal),
   *  fetchOpenProposal 도 proposed·pending 만 가져오기 때문에 status 가 confirmed 로
   *  서 있는 순간이 없다. 그래서 확정됐다 는 사실을 따로 한 번 알린다. */
  justConfirmed: ID | null;
  /** 그 신호를 받아 갔다고 알린다(같은 확정으로 두 번 정리하지 않게). */
  clearJustConfirmed: () => void;

  /** 전원 동의였는데 확정 직전 확인에서 막힌 자리. 겹친 사람 수까지만 담는다(§11).
   *  null 이면 그런 일이 없었다는 뜻이다. */
  proposalConflict: { eventId: ID; busy: number } | null;

  /** 답이 서버에서 막혔을 때 그 이유. 누르고 아무 일도 안 일어나는 것보다
   *  왜 안 됐는지 한 줄 보이는 편이 늘 낫다. */
  proposalError: { eventId: ID; message: string } | null;
  clearProposalError: () => void;

  /** 화면은 바꿨는데 서버가 받지 않은 자리 — 그 한 줄.
   *
   *  이 앱의 쓰기는 전부 낙관적이다(먼저 그리고 뒤에 보낸다). 빠른 대신, 서버가 거절했을 때
   *  **아무 말도 하지 않으면 거짓말이 된다.** 특히 RLS 는 오류를 주지 않고 '0행 수정' 으로
   *  조용히 지나가므로, 남의 일정 이름을 고치면 내 화면에서만 바뀌었다가 다음 스냅샷에
   *  슬며시 되돌아갔다. 이제는 되돌리고, 왜 되돌렸는지 말한다. */
  writeError: string | null;
  clearWriteError: () => void;

  /** 지금 답을 기다리는 제안을 모두 받아 둔다 — 일정을 열어 봐야 알 수 있으면
   *  열지 않은 사람에게는 제안이 없는 것과 같다. */
  loadOpenProposals: () => Promise<void>;

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

/** 낙관적으로 얹었던 내 말이 서버 id 를 받아 자리를 잡는다.
 *
 *  그 사이 스냅샷이나 Realtime 이 같은 말을 이미 실어 왔을 수 있다(같은 id 로).
 *  그러면 임시 줄을 서버 id 로 고쳐 다는 대신 **걷어낸다** — 안 그러면 같은 id 가 둘이 되고,
 *  그때부터 그 말은 지워도 하나만 지워지고 고쳐도 하나만 고쳐진다.
 *  저장에 실패했으면(realId 없음) 임시 줄만 걷는다. 보내지지 않은 말이 보내진 척 남지 않게. */
export const settleSent = (all: ChatMessage[], tempId: ID, realId: string | null, roomId: ID): ChatMessage[] => {
  if (!realId) return all.filter((m) => m.id !== tempId);
  if (all.some((m) => m.id === realId)) return all.filter((m) => m.id !== tempId);
  return all.map((m) => (m.id === tempId ? { ...m, id: realId, roomId, pending: false } : m));
};

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  schedules: seedSchedules,
  places: seedPlaces,
  timetable: seedTimetable,
  contacts: seedContacts,
  eventParticipants: seedParticipants,
  // 그룹은 지어내지 않는다. 사람과 같은 이유다 — 지어낸 묶음은 로그인한 뒤에도 남아
  // 진짜인 척한다(seedContacts 위 주석 참고).
  groups: [],
  groupMembers: [],
  chatRooms: seedRooms,
  chatMessages: seedChatMessages,
  // 이름의 기본값은 **빈 칸**이다. 예전에는 "나" 로 박혀 있었는데, 그러면 화면 쪽의
  // 언어별 폴백(`settings.name || (en ? "Me" : "나")`)이 영영 발동하지 않는다 —
  // 영어로 바꿔도 요약 대화록에 "나: …" 가 그대로 찍혔다.
  // 설정 화면의 입력칸은 placeholder 로 '이름/Name' 을 보여 주므로 빈 칸이라도 허전하지 않다.
  settings: { name: "", language: "ko", mode: "student", weekStart: "mon", notifications: true, autoConfirm: false, textScale: 1 },
  seedsRebased: false,
  remoteLive: false,

  hydrateRemote: (snap) =>
    set((st) => ({
      remoteLive: true,
      seedsRebased: true, // 서버 것을 쓰기 시작하면 시드 날짜를 옮길 이유가 없다
      schedules: snap.schedules,
      eventParticipants: snap.eventParticipants,
      chatRooms: snap.chatRooms,
      // 아직 서버에 닿지 못한 내 말은 남긴다.
      // 스냅샷은 자주 다시 온다(일정이 바뀔 때마다, 화면이 돌아올 때마다) — 그때마다
      // 보내는 중인 말을 함께 쓸어 버리면 방금 친 문장이 눈앞에서 사라진다.
      chatMessages: [
        ...snap.chatMessages,
        ...st.chatMessages.filter((m) => m.pending && !snap.chatMessages.some((x) => x.id === m.id)),
      ],
      // 사람은 서버가 준 진짜 계정으로 채운다(없으면 빈 채로 둔다).
      contacts: snap.contacts ?? [],
      // 그룹도 같다. 0017 을 아직 안 올린 서버에서는 비어 온다 — 그때 화면은
      // 그룹 갈래를 '아직 없음' 으로 그리면 되고, 다른 것은 그대로 돈다.
      groups: snap.groups ?? [],
      groupMembers: snap.groupMembers ?? [],
    })),

  refreshPeople: async () => {
    if (!remoteReady()) return;
    const people = await fetchPeople();
    set({ contacts: people });
  },

  findPeople: async (q) => (remoteReady() ? searchPeople(q) : []),

  requestPerson: async (peerId) => {
    if (!remoteReady()) return { outcome: "error" as const };
    const r = await requestConnection(peerId);
    // 그 자리에서 이어졌을 때만 목록이 달라진다 — 보내기만 한 경우는 아직 남의 차례다.
    if (r.outcome === "accepted" || r.outcome === "connected") await get().refreshPeople();
    return r;
  },

  cancelRequest: async (peerId) => {
    if (!remoteReady()) return false;
    // 예전에는 결과를 버렸다. 그래서 서버가 못 무른 경우에도 화면은 '취소됨' 으로 바뀌었고,
    // 상대에게는 요청이 그대로 남아 있었다 — 무른 줄 알고 있는데 무르지 않은 상태.
    // 됐는지 안 됐는지를 돌려주고, 화면을 어떻게 할지는 부른 쪽이 정한다.
    return cancelConnectionRequest(peerId);
  },

  connectionRequests: [],
  requestError: null,
  clearRequestError: () => set({ requestError: null }),
  outgoingRequests: [],
  myHandle: null,
  handleChangeableAt: null,

  changeHandle: async (next) => {
    if (!remoteReady()) return { ok: false };
    const r = await changeMyHandle(next);
    if (r.ok) {
      const st = await fetchHandleState();
      set({ myHandle: r.handle ?? next, handleChangeableAt: st?.canChangeAt ?? null });
    }
    return { ok: r.ok, message: r.message };
  },

  loadRequests: async () => {
    if (!remoteReady()) return;
    const [incoming, outgoing, handle] = await Promise.all([
      fetchConnectionRequests(), fetchOutgoingRequests(), fetchHandleState(),
    ]);
    set({ connectionRequests: incoming, outgoingRequests: outgoing,
      myHandle: handle?.handle ?? null, handleChangeableAt: handle?.canChangeAt ?? null });
  },

  answerRequest: async (id, accept) => {
    // 답한 줄은 화면에서 곧바로 걷는다 — 서버를 기다리는 동안 남아 있으면
    // 두 번 누르게 되고, 두 번째 호출은 'gone' 으로 조용히 흘러간다.
    const before = get().connectionRequests.find((r) => r.id === id);
    set((st) => ({ connectionRequests: st.connectionRequests.filter((r) => r.id !== id), requestError: null }));
    if (!remoteReady()) return;
    const ok = await answerConnectionRequest(id, accept);
    if (ok) { if (accept) await get().refreshPeople(); return; }
    // 서버가 받지 않았으면 줄을 되돌린다.
    // 예전에는 걷어낸 채로 끝이었다 — 이어지지도 않았는데 요청만 사라졌고, 화면은
    // 아무 말도 하지 않았다. '동의를 눌러도 아무 반응이 없다' 와 같은 병이다.
    if (before) set((st) => (st.connectionRequests.some((r) => r.id === id) ? st : { connectionRequests: [before, ...st.connectionRequests] }));
    set({ requestError: "답을 보내지 못했어요. 잠시 뒤 다시 눌러 주세요." });
  },

  applyRemoteMessage: (m) =>
    set((st) => {
      const i = st.chatMessages.findIndex((x) => x.id === m.id);
      // 이미 있는 말이면 '고쳐진 것' 이다 — 무시하지 않고 그 자리를 갈아 끼운다.
      // (내가 보낸 낙관적 메시지가 서버 id 로 돌아온 경우에도 같은 자리를 덮는다.)
      if (i >= 0) {
        const next = [...st.chatMessages];
        next[i] = { ...next[i], content: m.content, edited: m.edited, pending: false };
        return { chatMessages: next };
      }
      return { chatMessages: [...st.chatMessages, m] };
    }),

  dropMessage: (id) => set((st) => ({ chatMessages: st.chatMessages.filter((m) => m.id !== id) })),

  editMessage: async (id, content) => {
    const text = content.trim();
    if (!text) return;
    const before = get().chatMessages.find((m) => m.id === id);
    if (!before || before.content === text) return;

    // 화면이 먼저 바뀐다. 서버가 거절하면 되돌린다 — 고쳐진 척 남아 있으면 그게 더 나쁘다.
    set((st) => ({ chatMessages: st.chatMessages.map((m) => (m.id === id ? { ...m, content: text, edited: true } : m)) }));
    if (!remoteReady()) return;
    const ok = await editMessageRemote(id, text);
    if (!ok) {
      set((st) => ({ chatMessages: st.chatMessages.map((m) => (m.id === id ? { ...m, content: before.content, edited: before.edited } : m)) }));
    }
  },

  deleteMessage: async (id) => {
    const before = get().chatMessages.find((m) => m.id === id);
    if (!before) return;
    set((st) => ({ chatMessages: st.chatMessages.filter((m) => m.id !== id) }));
    if (!remoteReady()) return;
    const ok = await deleteMessageRemote(id);
    if (!ok) set((st) => ({ chatMessages: [...st.chatMessages, before] }));   // 못 지웠으면 되돌려 놓는다
  },

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
        if (!realId) {
          // 서버에 앉지 못했다. 화면에서 지우지는 않는다 — 사용자가 방금 만든 것을
          // 눈앞에서 없애는 편이 더 나쁘다. 대신 이 자리가 이 브라우저에만 있다고 말한다.
          unsynced.delete(id); pendingInvites.delete(id);
          set({ writeError: "일정을 서버에 저장하지 못했어요 — 이 화면에만 남아요." });
          return;
        }
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
  confirmSchedule: (id) => {
    const real = get().resolveEventId(id) ?? id;
    const before = get().schedules.find((s) => s.id === real)?.status;
    if (before === undefined || before === "confirmed") return;   // 이미 확정이면 아무 일도 없다
    set((st) => ({
      schedules: st.schedules.map((s) => (s.id === real ? { ...s, status: "confirmed" } : s)),
      writeError: null,
    }));
    if (!remoteReady() || unsynced.has(real)) return;
    void confirmEvent(real).then((ok) => {
      if (ok) return;
      // 확정하지 못했으면 제안으로 되돌린다. 확정된 척 서 있는 일정이 가장 나쁘다 —
      // 사용자는 그걸 믿고 그 시간을 비워 둔다.
      set((st) => ({
        schedules: st.schedules.map((s) => (s.id === real ? { ...s, status: before } : s)),
        writeError: "일정을 확정하지 못했어요. 잠시 뒤 다시 눌러 주세요.",
      }));
    });
  },

  removeSchedule: (id) => {
    const real = get().resolveEventId(id) ?? id;
    // 되돌릴 수 있게 지우기 전 모습을 쥔다. 일정 하나에 참여자·방·말이 매달려 있어
    // 실패했을 때 일정만 되살리면 그 방과 대화는 잃어버린다.
    const st0 = get();
    const roomIds = st0.chatRooms.filter((r) => r.eventId === real).map((r) => r.id);
    const before = {
      schedules: st0.schedules,
      eventParticipants: st0.eventParticipants,
      chatRooms: st0.chatRooms,
      chatMessages: st0.chatMessages,
    };
    if (!before.schedules.some((s) => s.id === real)) return;
    // 일정이 사라지면 그 자리에 매달려 있던 것들도 함께 사라진다 —
    // 남겨 두면 주인 없는 방과 참여자가 목록에 유령으로 선다.
    set(() => ({
      schedules: before.schedules.filter((s) => s.id !== real),
      eventParticipants: before.eventParticipants.filter((p) => p.eventId !== real),
      chatRooms: before.chatRooms.filter((r) => r.eventId !== real),
      chatMessages: before.chatMessages.filter((m) => !roomIds.includes(m.roomId)),
      writeError: null,
    }));
    if (!remoteReady() || unsynced.has(real)) return;
    // 서버의 events 행만 지운다 — 참여자·방·말은 DB 가 on delete cascade 로 따라 지운다.
    void deleteEvent(real).then((ok) => {
      if (ok) return;
      // 못 지웠으면 되살린다. 그대로 두면 다음 스냅샷에 그 일정이 스스로 돌아오는데,
      // 사용자에게는 지운 것이 유령처럼 되살아나는 것으로 보인다.
      set(() => ({ ...before, writeError: "일정을 지우지 못했어요 — 주최자만 지울 수 있어요." }));
    });
  },

  renameSchedule: (id, title) => {
    const real = get().resolveEventId(id) ?? id;
    const name = title.trim();
    if (!name) return;
    const before = get().schedules.find((s) => s.id === real)?.title;
    if (before === undefined || before === name) return;
    set((st) => ({
      schedules: st.schedules.map((s) => (s.id === real ? { ...s, title: name } : s)),
      writeError: null,
    }));
    if (!remoteReady() || unsynced.has(real)) return;
    void renameEvent(real, name).then((ok) => {
      if (ok) return;
      // 서버는 주최자만 받는다(0001 events_update). 막히면 오류가 아니라 0행 수정으로
      // 지나가므로, 이걸 보지 않으면 내 화면에서만 이름이 바뀐 채로 남는다.
      set((st) => ({
        schedules: st.schedules.map((s) => (s.id === real ? { ...s, title: before } : s)),
        writeError: "이름을 바꾸지 못했어요 — 이 일정의 주최자만 바꿀 수 있어요.",
      }));
    });
  },

  // ── 그룹 ────────────────────────────────────────────
  membersOf: (groupId) => get().groupMembers.filter((m) => m.groupId === groupId),

  eventsOfGroup: (groupId) =>
    get().schedules
      .filter((s) => s.groupId === groupId)
      .sort((a, b) => +new Date(a.start) - +new Date(b.start)),

  isGroupOwner: (groupId) => get().groups.find((g) => g.id === groupId)?.ownerId === ME_ID,

  createGroup: async (name, memberIds) => {
    const label = name.trim();
    if (!label) return null;
    if (!remoteReady()) {
      // 그룹은 서버 없이는 뜻이 없다 — 사람의 묶음인데 그 사람들이 서버에만 있다.
      // 지역 그룹을 만들어 두면 로그인한 뒤 진짜와 겹쳐 두 벌이 된다.
      set({ writeError: "그룹은 로그인해야 만들 수 있어요." });
      return null;
    }
    const id = await createGroupRemote(label);
    if (!id) { set({ writeError: "그룹을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요." }); return null; }
    // 주인 줄은 서버 트리거가 넣는다. 여기서는 부른 사람들만 보낸다.
    set((st) => ({
      groups: [...st.groups, { id, name: label, ownerId: ME_ID }],
      groupMembers: [...st.groupMembers, { groupId: id, userId: ME_ID, role: "owner" }],
      writeError: null,
    }));
    for (const uid of memberIds) get().addGroupMember(id, uid);
    return id;
  },

  renameGroup: (groupId, name) => {
    const label = name.trim();
    const before = get().groups.find((g) => g.id === groupId)?.name;
    if (!label || before === undefined || before === label) return;
    set((st) => ({
      groups: st.groups.map((g) => (g.id === groupId ? { ...g, name: label } : g)),
      writeError: null,
    }));
    if (!remoteReady()) return;
    void renameGroupRemote(groupId, label).then((ok) => {
      if (ok) return;
      set((st) => ({
        groups: st.groups.map((g) => (g.id === groupId ? { ...g, name: before } : g)),
        writeError: "그룹 이름을 바꾸지 못했어요 — 그룹을 만든 사람만 바꿀 수 있어요.",
      }));
    });
  },

  removeGroup: (groupId) => {
    const st0 = get();
    const before = { groups: st0.groups, groupMembers: st0.groupMembers, schedules: st0.schedules };
    if (!before.groups.some((g) => g.id === groupId)) return;
    // 그룹이 사라져도 **일정은 남는다** — 그 표시만 걷는다(서버도 on delete set null).
    // 모임이 해체됐다고 지난 약속까지 지울 이유가 없다.
    set(() => ({
      groups: before.groups.filter((g) => g.id !== groupId),
      groupMembers: before.groupMembers.filter((m) => m.groupId !== groupId),
      schedules: before.schedules.map((s) => (s.groupId === groupId ? { ...s, groupId: undefined } : s)),
      writeError: null,
    }));
    if (!remoteReady()) return;
    void deleteGroupRemote(groupId).then((ok) => {
      if (ok) return;
      set(() => ({ ...before, writeError: "그룹을 없애지 못했어요 — 그룹을 만든 사람만 없앨 수 있어요." }));
    });
  },

  addGroupMember: (groupId, userId) => {
    if (get().groupMembers.some((m) => m.groupId === groupId && m.userId === userId)) return;
    set((st) => ({
      groupMembers: [...st.groupMembers, { groupId, userId, role: "member" }],
      writeError: null,
    }));
    if (!remoteReady()) return;
    void pushGroupMember(groupId, userId).then((ok) => {
      if (ok) return;
      set((st) => ({
        groupMembers: st.groupMembers.filter((m) => !(m.groupId === groupId && m.userId === userId)),
        writeError: "그 사람을 그룹에 넣지 못했어요 — 그룹을 만든 사람만 부를 수 있어요.",
      }));
    });
  },

  removeGroupMember: (groupId, userId) => {
    const before = get().groupMembers.find((m) => m.groupId === groupId && m.userId === userId);
    if (!before) return;
    set((st) => ({
      groupMembers: st.groupMembers.filter((m) => !(m.groupId === groupId && m.userId === userId)),
      writeError: null,
    }));
    if (!remoteReady()) return;
    void pullGroupMember(groupId, userId).then((ok) => {
      if (ok) return;
      set((st) => ({
        groupMembers: st.groupMembers.some((m) => m.groupId === groupId && m.userId === userId)
          ? st.groupMembers
          : [...st.groupMembers, before],
        writeError: "그 사람을 그룹에서 빼지 못했어요. 잠시 뒤 다시 시도해 주세요.",
      }));
    });
  },

  syncGroup: async (groupId) => {
    if (!remoteReady()) { set({ writeError: "아직 서버에 연결되지 않았어요." }); return null; }
    set({ writeError: null });
    const r = await syncGroupCalendar(groupId);
    if (!r) { set({ writeError: "일정을 맞추지 못했어요. 잠시 뒤 다시 눌러 주세요." }); return null; }
    // 참여자가 늘었으면 그 관계를 화면이 알아야 한다 — 한 건씩 깁지 않고 다시 받아 온다
    // (스토어가 일정·참여자를 다루는 방식과 같다).
    if (r.members > 0) {
      const snap = await fetchSnapshot();
      if (snap) get().hydrateRemote(snap);
    }
    return r;
  },

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
    if (get().eventParticipants.some((p) => p.eventId === eventId && p.userId === userId)) return;
    set((st) => ({
      eventParticipants: [...st.eventParticipants, { eventId, userId, role: "participant", status: "invited" }],
      writeError: null,
    }));
    // 참여자가 되면 그 일정의 대화에 들어올 수 있어야 한다.
    get().ensureRoom(eventId);
    if (!remoteReady()) return;
    // 아직 서버에 없는 일정이면 지금 보내 봐야 FK 위반으로 사라진다 — 진짜 id 를 받은 뒤에 보낸다.
    if (unsynced.has(eventId)) { queueInvite(eventId, userId); return; }
    void pushParticipant(eventId, userId).then((ok) => {
      if (ok) return;
      // 부르지 못했으면 그 줄을 걷는다. 남겨 두면 목록에는 있는데 그 사람 화면에는
      // 아무 일도 일어나지 않은, 한쪽만 아는 초대가 된다.
      set((st) => ({
        eventParticipants: st.eventParticipants.filter((p) => !(p.eventId === eventId && p.userId === userId)),
        writeError: "그 사람을 부르지 못했어요 — 주최자만 부를 수 있어요.",
      }));
    });
  },

  removeParticipant: (eventId, userId) => {
    // 참여자에서 빠지면 대화 접근도 끊긴다. 다만 이미 남긴 메시지의 작성자 정보는 지우지 않는다.
    const before = get().eventParticipants.find((p) => p.eventId === eventId && p.userId === userId);
    if (!before) return;
    set((st) => ({
      eventParticipants: st.eventParticipants.filter((p) => !(p.eventId === eventId && p.userId === userId)),
      writeError: null,
    }));
    if (!remoteReady()) return;
    void pullParticipant(eventId, userId).then((ok) => {
      if (ok) return;
      set((st) => ({
        eventParticipants: st.eventParticipants.some((p) => p.eventId === eventId && p.userId === userId)
          ? st.eventParticipants
          : [...st.eventParticipants, before],
        writeError: "그 사람을 빼지 못했어요. 잠시 뒤 다시 시도해 주세요.",
      }));
    });
  },

  setParticipantStatus: (eventId, userId, status) => {
    const before = get().eventParticipants.find((p) => p.eventId === eventId && p.userId === userId)?.status;
    if (before === undefined || before === status) return;
    set((st) => ({
      eventParticipants: st.eventParticipants.map((p) =>
        p.eventId === eventId && p.userId === userId ? { ...p, status } : p,
      ),
      writeError: null,
    }));
    if (!remoteReady()) return;
    void pushParticipantStatus(eventId, userId, status).then((ok) => {
      if (ok) return;
      // 참석하겠다고 눌렀는데 서버가 못 받았다면, 그 사실을 아는 사람이 나뿐이다.
      // 다른 참여자의 화면에는 여전히 '답 없음' 으로 서 있다.
      set((st) => ({
        eventParticipants: st.eventParticipants.map((p) =>
          p.eventId === eventId && p.userId === userId ? { ...p, status: before } : p,
        ),
        writeError: "참석 여부를 보내지 못했어요. 잠시 뒤 다시 눌러 주세요.",
      }));
    });
  },

  // ── 일정 제안 ───────────────────────────────────────
  proposals: {},
  proposalConflict: null,
  proposalError: null,
  clearProposalError: () => set({ proposalError: null }),
  writeError: null,
  clearWriteError: () => set({ writeError: null }),
  justConfirmed: null,
  clearJustConfirmed: () => set({ justConfirmed: null }),

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

  loadOpenProposals: async () => {
    if (!remoteReady()) return;
    const ids = await fetchOpenProposalEvents();
    // 닫힌 제안은 그 자리를 비운다 — 남겨 두면 이미 지난 물음이 화면에 서 있게 된다.
    set((st) => {
      const next: Record<ID, ScheduleProposal | null> = {};
      for (const k of Object.keys(st.proposals)) if (ids.includes(k)) next[k] = st.proposals[k];
      return { proposals: next };
    });
    await Promise.all(ids.map((id) => get().loadProposal(id)));
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
    if (!remoteReady()) {
      set({ proposalError: { eventId, message: "아직 서버에 연결되지 않았어요. 잠시 뒤 다시 눌러 주세요." } });
      return;
    }
    set({ proposalError: null });
    const res = await respondToProposal(proposalId, response);
    // 막혔으면 그렇다고 말한다. 눌렀는데 아무 일도 일어나지 않는 것이 가장 나쁜 답이다.
    if (res.status === "error") {
      set({ proposalError: { eventId, message: res.message ?? "답을 보내지 못했어요." } });
      return;
    }
    // 전원이 동의하면 서버가 그 자리에서 일정을 앉힌다 → 달력도 다시 받아 온다.
    if (res.status === "confirmed") {
      const snap = await fetchSnapshot();
      if (snap) get().hydrateRemote(snap);
      set((st) => ({ proposals: { ...st.proposals, [eventId]: null } }));
      set({ proposalConflict: null, justConfirmed: eventId });
      return;
    }
    // 전원이 동의했는데도 확정되지 않은 경우 — 그 사이 누가 그 시간에 다른 일정을 잡았다.
    // 조용히 넘어가지 않는다. 무슨 일이 있었는지는 사람이 알아야 다음을 정할 수 있다(§17).
    // 다만 겹친 사람이 무엇을 하는지는 여기서도 말하지 않는다 — 몇 명인지까지다(§11).
    set({ proposalConflict: res.status === "conflict" ? { eventId, busy: res.waiting } : null });
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
      set((st) => ({ chatMessages: settleSent(st.chatMessages, msg.id, realId, rid) }));
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
        // 방 자체도 진짜 id 로 갈아 끼운다.
        //
        // 이걸 빠뜨리면 이런 일이 생긴다(실제로 그랬다): 말은 서버에 잘 저장되는데
        // 화면에는 "아직 대화가 없어요" 가 뜬다. 메시지만 진짜 방 id 로 옮겨 놓고
        // 방 목록은 지역 이름(dm_…)을 그대로 들고 있으니, 화면이 찾는 방과
        // 말이 앉은 방이 서로 다른 곳이 된다. 새로고침해야 비로소 보였다.
        chatRooms: st.chatRooms.some((r) => r.id === rid)
          ? st.chatRooms.filter((r) => !(r.peerId === peerId && r.id !== rid))
          : st.chatRooms.map((r) => (r.peerId === peerId ? { ...r, id: rid } : r)),
        chatMessages: settleSent(st.chatMessages, msg.id, realId, rid),
      }));
      // 지역 id 로 앉아 있던 옛 말들도 함께 옮긴다 — 로그인 전에 나눈 말이 여기 있을 수 있다.
      set((st) => ({
        chatMessages: st.chatMessages.map((m) => (m.roomId === roomId && roomId !== rid ? { ...m, roomId: rid } : m)),
      }));
    })();
  },

  updateSettings: (patch) => set((st) => ({ settings: { ...st.settings, ...patch } })),
}));

// 함께 걷어낸 것들 —
//   commandOpen / setCommandOpen        커맨드 팔레트가 없다
//   dismissNotif(s) / dismissedNotifs   알림 벨을 없앨 때(§10.1) 함께 죽었다
//   connections / toggle·setConnection  구글·아웃룩 토글 화면이 없다
//   addContact                          사람은 이제 Comein 계정 검색으로만 들어온다
//   memos / meetings                    뷰가 사라졌다(§9·§10.1)
//   todos / addTodo·updateTodo·moveTodo·removeTodo
//                                       담을 표가 없다(§25). 시드만 남아 기능인 척했다
//   conversations / sendMessage         가짜 AI 대화방. 캡처바가 대신한다
//   updateSchedule / removeScheduleCascade / conflictsFor / overlaps /
//   isShared / myEvents / directMessagesOf
//                                       한 곳에서도 부르지 않았다
//
// 이 목록은 한동안 거짓이었다: removeSchedule·confirmSchedule 을 걷었다고 적어 두었지만
// 둘 다 살아서 화면이 부르고 있었다. 걷은 것을 적는 자리라, 적힌 것이 틀리면
// 다음 사람은 있는 것을 없다고 믿고 다시 만든다. 코드를 보고 다시 적었다.
// 되살릴 일이 생기면 git 이 기억하고 있다.