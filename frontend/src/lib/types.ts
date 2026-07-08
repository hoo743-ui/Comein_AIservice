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
  x: number; // 0~100
  y: number; // 0~100
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
