// Comein · 사용자 Context (Student · Professional · Personal)
//
// 여기 담긴 것은 "세 개의 앱"이 아니라 "하나의 Comein 이 같은 데이터를 달리 읽는 규칙"이다.
// 화면도 도메인 모델도 하나뿐이고, 이 파일이 그 하나를 어떻게 해석할지만 정한다.
//
//   화면(UI)  →  이 설정(MODE_CONFIG)  →  같은 Schedule / Contact
//
// 그래서 화면 어디에도 `if (mode === "student")` 가 흩어지지 않는다. 화면은 늘
// `MODE_CONFIG[mode]` 에게 "이 자리에 뭐라고 적어야 하니" 라고 묻기만 한다.
// 새 Context 를 하나 더 여는 일은 이 파일에 항목 하나를 더하는 일이 된다.

import { useWorkspace } from "./store";
import type { Schedule } from "./types";

// ── Context ────────────────────────────────────────────

export const USER_MODES = ["student", "professional", "personal"] as const;
export type UserMode = (typeof USER_MODES)[number];

export const DEFAULT_MODE: UserMode = "student";

/** 밖에서 들어온 값(설정 저장소·API·URL 파라미터)은 믿지 않는다.
 *  예전 이름(office·general)도 여기서 흡수한다 — 저장된 설정을 깨뜨리지 않기 위해. */
export function normalizeMode(v: unknown): UserMode {
  if (typeof v !== "string") return DEFAULT_MODE;
  if ((USER_MODES as readonly string[]).includes(v)) return v as UserMode;
  if (v === "office") return "professional";   // 이전 이름
  if (v === "general") return "personal";      // 이전 이름
  return DEFAULT_MODE;
}

// ── 분류 체계 ──────────────────────────────────────────
// 일정은 Context 마다 다른 이름으로 불리지만, 저장되는 실체는 하나다.
// 그래서 category 는 Schedule 의 필드이면서 동시에 '해석의 결과'일 수 있다.
//
// 사람 쪽에도 같은 분류표(peopleCategories · PersonRelation · classifyPerson)가 있었다.
// 만들어 두고 화면에 붙인 적이 없어 걷어냈다 — 사람 화면을 붙이는 날 그때의 화면을
// 보면서 다시 세우는 편이, 쓰이지 않은 채 굳은 이름표를 물려받는 것보다 낫다.

export type EventCategory =
  // student
  | "class" | "exam" | "assignment" | "team"
  // professional
  | "meeting" | "project" | "deadline" | "client"
  // personal
  | "appointment" | "family" | "friend" | "personal" | "travel"
  // 어디에도 매이지 않는 것 — 억지로 이름 붙이지 않는다.
  | "other";

/** 라벨은 두 언어를 함께 갖는다 — 화면에서 사전을 한 번 더 뒤지지 않게. */
export interface Label {
  ko: string;
  en: string;
}

export interface CategoryDef<K extends string> {
  key: K;
  label: Label;
  /** 제목에서 이 갈래를 알아보는 실마리. 없으면 규칙으로는 잡지 않는다. */
  hints?: string[];
}

export interface ModeConfig {
  label: Label;
  /** '오늘' 화면이 자기를 부르는 이름 — 같은 하루가 Context 마다 다른 흐름으로 읽힌다. */
  todayFlow: Label;
  eventCategories: CategoryDef<EventCategory>[];
}

// ── 설정 ───────────────────────────────────────────────
// 색도 레이아웃도 여기서 갈리지 않는다(§11). 갈리는 것은 '무엇을 먼저 말하는가' 뿐이다.

export const MODE_CONFIG: Record<UserMode, ModeConfig> = {
  student: {
    label: { ko: "학생", en: "Student" },
    todayFlow: { ko: "오늘의 학업 흐름", en: "Today's study flow" },
    eventCategories: [
      { key: "class", label: { ko: "수업", en: "Class" }, hints: ["수업", "강의", "실습", "class", "lecture"] },
      { key: "exam", label: { ko: "시험", en: "Exam" }, hints: ["시험", "중간", "기말", "퀴즈", "exam", "quiz", "midterm", "final"] },
      { key: "assignment", label: { ko: "과제", en: "Assignment" }, hints: ["과제", "제출", "레포트", "보고서", "assignment", "report", "due"] },
      { key: "team", label: { ko: "팀 프로젝트", en: "Team project" }, hints: ["팀", "조별", "캡스톤", "프로젝트", "team", "capstone"] },
    ],
  },

  professional: {
    label: { ko: "직장인", en: "Professional" },
    todayFlow: { ko: "오늘의 업무 흐름", en: "Today's work flow" },
    eventCategories: [
      { key: "meeting", label: { ko: "회의", en: "Meeting" }, hints: ["회의", "미팅", "스탠드업", "meeting", "sync", "1:1"] },
      { key: "project", label: { ko: "프로젝트", en: "Project" }, hints: ["프로젝트", "스프린트", "릴리즈", "project", "sprint", "release"] },
      { key: "deadline", label: { ko: "마감", en: "Deadline" }, hints: ["마감", "데드라인", "제출", "deadline", "due"] },
      { key: "client", label: { ko: "고객", en: "Client" }, hints: ["고객", "클라이언트", "거래처", "client", "customer"] },
    ],
  },

  personal: {
    label: { ko: "개인", en: "Personal" },
    todayFlow: { ko: "오늘의 생활 흐름", en: "Today's flow" },
    eventCategories: [
      { key: "appointment", label: { ko: "약속", en: "Appointment" }, hints: ["약속", "예약", "병원", "appointment"] },
      { key: "family", label: { ko: "가족", en: "Family" }, hints: ["가족", "부모", "생일", "family", "birthday"] },
      { key: "friend", label: { ko: "친구", en: "Friend" }, hints: ["친구", "모임", "friend"] },
      { key: "travel", label: { ko: "여행", en: "Travel" }, hints: ["여행", "출발", "비행", "travel", "flight", "trip"] },
      { key: "personal", label: { ko: "개인", en: "Personal" }, hints: ["운동", "취미", "휴식", "gym", "personal"] },
    ],
  },
};

// ── 해석 ───────────────────────────────────────────────
// 같은 Schedule 하나가 Context 에 따라 다른 이름으로 불린다. 데이터를 복제하지 않는다.
// 저장된 category 가 있으면 그것이 먼저다 — 사람이 정한 것을 규칙이 덮지 않는다.

const matches = (text: string, hints?: string[]) =>
  !!hints && hints.some((h) => text.includes(h.toLowerCase()));

/** 일정 → 이 Context 에서의 갈래. 실마리가 없으면 "other" — 지어내지 않는다. */
export function classifyEvent(event: Pick<Schedule, "title" | "category">, mode: UserMode): EventCategory {
  const cfg = MODE_CONFIG[mode];
  if (event.category && cfg.eventCategories.some((c) => c.key === event.category)) return event.category;
  const text = (event.title ?? "").toLowerCase();
  return cfg.eventCategories.find((c) => matches(text, c.hints))?.key ?? "other";
}

/** 갈래 → 화면에 적을 이름. 못 찾으면 아무 말도 하지 않는다(null). */
export function categoryLabel(key: EventCategory, mode: UserMode, en: boolean): string | null {
  const def = MODE_CONFIG[mode].eventCategories.find((c) => c.key === key);
  return def ? (en ? def.label.en : def.label.ko) : null;
}

// ── 전역 상태 ──────────────────────────────────────────
// mode 는 설정 안에 산다(이미 있는 zustand 스토어 하나만 쓴다 — 상태 관리 층을 더 만들지 않는다).
// 화면은 이 훅으로만 mode 를 읽는다. 컴포넌트마다 settings.mode 를 꺼내 쓰면
// 나중에 '계정 하나에 여러 Context' 로 넓힐 때 고칠 자리가 흩어진다.

/** 지금 이 워크스페이스가 서 있는 Context. */
export const useCurrentMode = (): UserMode =>
  useWorkspace((s) => normalizeMode(s.settings.mode));

