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
}
