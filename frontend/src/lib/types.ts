// Comein 도메인 타입 (CLAUDE.md §7 데이터 모델 기준)

export type ID = string;

export type ScheduleStatus = "pending" | "confirmed";
export type TodoStatus = "todo" | "doing" | "done";
export type TodoPriority = "high" | "mid" | "low";
export type Role = "user" | "ai";

export interface Schedule {
  id: ID;
  title: string;
  start: string; // ISO
  end?: string; // ISO
  location?: string;
  placeId?: ID; // 좌표 있는 장소 연결(지도·이동시간)
  status: ScheduleStatus; // AI 제안(pending) → 사용자 확정(confirmed)
  /** 공유 일정의 주인. 없으면 나 혼자 보는 개인 일정이다.
   *  일정은 참여자 수만큼 복제되지 않는다 — 하나의 Schedule 을 여럿이 같은 id 로 바라본다. */
  ownerId?: ID;
  description?: string;
}

// ── 공유 일정 · 참여자 · 일정 대화 ──────────────────────
// Comein 의 "사람"은 연락처가 아니라 일정으로 연결된 관계다.
//   User ─< EventParticipant >─ Schedule ─ ChatRoom ─< ChatMessage
// 일정 하나가 곧 하나의 Context 이고, 그 안에서 사람들이 대화한다.

/** 로그인 붙기 전의 '나'. Supabase Auth 연동 시 auth.uid() 로 대체된다. */
export const ME_ID: ID = "me";

export type ParticipantRole = "owner" | "participant";
export type ParticipantStatus = "invited" | "accepted" | "declined";

/** (eventId, userId) 는 유일하다 — 같은 사람을 두 번 초대해도 한 줄만 남는다. */
export interface EventParticipant {
  eventId: ID;
  userId: ID; // Contact.id 또는 ME_ID
  role: ParticipantRole;
  status: ParticipantStatus;
}

/** 대화방은 두 종류다.
 *  - 일정 대화방: eventId 가 있다. 일정 하나당 하나(중복 생성 금지).
 *  - 사람과의 1:1 방: peerId 가 있다. 상대 한 명당 하나.
 *  둘 중 하나만 채워진다. 메시지 모델은 하나를 공유한다 — 대화를 두 벌로 만들지 않는다. */
export interface ChatRoom {
  id: ID;
  eventId?: ID;
  peerId?: ID;
}

export interface ChatMessage {
  id: ID;
  roomId: ID;
  senderId: ID;
  content: string;
  createdAt: string; // ISO
  /** 낙관적 반영 중인 메시지 — 서버/Realtime 이 같은 걸 돌려주면 이 자리를 대체한다. */
  pending?: boolean;
}

export interface Todo {
  id: ID;
  title: string;
  due?: string; // ISO date
  priority: TodoPriority;
  status: TodoStatus;
}

export interface Memo {
  id: ID;
  title: string;
  content: string;
  tags: string[];
  createdAt: string; // ISO
}

export interface Meeting {
  id: ID;
  title: string;
  start: string; // ISO
  participants: string[];
  summary?: string;
  actionItems?: string[];
  notes?: string;
}

/** 채팅 메시지에 부착되는 인라인 카드(생성된 엔티티 참조) */
export interface MessageCard {
  kind: "schedule" | "todo" | "memo";
  id: ID;
}

export interface Message {
  id: ID;
  role: Role;
  content: string;
  createdAt: string; // ISO
  card?: MessageCard;
}

export interface Conversation {
  id: ID;
  title: string;
  createdAt: string; // ISO
  messages: Message[];
  pinned?: boolean;
}

// ── 장소 (범용) — 좌표 있는 위치. 캠퍼스 건물/사옥/사용자 장소 모두. 스키매틱 0~100(추후 lat/lng) ──
export type PlaceCategory = "campus" | "office" | "custom";

export interface Place {
  id: ID;
  name: string; // "AI공학관", "본사 3층 대회의실"
  code?: string; // 캠퍼스 건물 약칭 등
  category: PlaceCategory;
  x: number; // 0~100 (스키매틱 맵)
  y: number; // 0~100
  lat?: number; // 실지도(카카오) 연동용 — 있으면 실제 지도 사용
  lng?: number;
}

// ── 사람 ──
// "comein" 은 실제 계정이다 — id 가 곧 auth.uid() 라서 참여자·대화의 주체가 될 수 있다.
// 나머지는 밖에서 가져온 이름표일 뿐이라, 일정에 부르거나 말을 걸 수는 없다.
export type ContactSource = "comein" | "google" | "outlook" | "manual";

export interface Contact {
  id: ID;
  name: string;
  /** @handle — Comein 안에서 그 사람을 가리키는 이름. 계정이 있는 사람만 갖는다. */
  handle?: string;
  org?: string;
  email?: string;
  phone?: string;
  source: ContactSource;
  lastMet?: string; // ISO
  /** 서로 잇겠다고 한 사이인가. 같은 일정에서 만나기만 한 사람은 false 다. */
  connected?: boolean;
  /** 함께 있는 일정 수 */
  sharedEvents?: number;
}

export interface Connections {
  googleCalendar: boolean;
  googleContacts: boolean;
  outlook: boolean;
}

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri";

export interface ClassEntry {
  id: ID;
  course: string; // "인공지능개론"
  day: Weekday;
  start: string; // "09:00"
  end: string; // "10:30"
  buildingId: ID;
  room: string; // "401"
}
