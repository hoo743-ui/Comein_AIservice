"use client";

import { useWorkspace } from "@/lib/store";

/** 한/영 사전. 값에 \n 포함 시 whitespace-pre-line 으로 렌더. */
const DICT = {
  // 사이드바
  "sb.newChat": { ko: "새 대화", en: "New chat" },
  "sb.search": { ko: "대화 검색", en: "Search chats" },
  "sb.menu": { ko: "메뉴", en: "Menu" },
  "sb.recent": { ko: "최근 대화", en: "Recent" },
  "sb.noChats": { ko: "대화가 없어요", en: "No conversations" },
  "sb.settings": { ko: "설정", en: "Settings" },
  "sb.workspace": { ko: "내 워크스페이스", en: "My workspace" },

  // 랜딩
  "land.eyebrow": { ko: "당신의 AI 워크스페이스", en: "Your AI Workspace" },
  "land.tagline": { ko: "생각만 하세요.\n나머지는 AI가 합니다.", en: "Just think.\nAI does the rest." },
  "land.desc": {
    ko: "들어오세요. 채팅 한 줄이면 일정·메모·할 일·회의가 자동으로 정리됩니다.",
    en: "Come in. One line of chat and your schedule, notes, tasks and meetings organize themselves.",
  },
  "land.enter": { ko: "입장하기", en: "Enter" },
  "land.browse": { ko: "회원가입 없이 둘러보기", en: "Explore, no sign-up" },
  "land.login": { ko: "로그인", en: "Log in" },

  // 채팅
  "chat.subtitle": { ko: "무엇이든 말씀하세요. 워크스페이스가 대신 정리합니다.", en: "Say anything. Your workspace organizes it for you." },
  "chat.placeholder": { ko: "무엇을 도와드릴까요?  예) 내일 오후 2시에 스터디 잡아줘", en: "How can I help?  e.g. Schedule a study session tomorrow 2pm" },
  "chat.disclaimer": { ko: "AI가 생성한 결과는 확인 후 반영됩니다.", en: "AI-generated results are applied after your review." },

  // 설정
  "set.title": { ko: "설정", en: "Settings" },
  "set.subtitle": { ko: "워크스페이스 환경을 조정합니다", en: "Adjust your workspace" },
  "set.profile": { ko: "프로필", en: "Profile" },
  "set.profileDesc": { ko: "표시 이름과 아바타", en: "Display name and avatar" },
  "set.displayName": { ko: "표시 이름", en: "Display name" },
  "set.displayNameDesc": { ko: "사이드바와 대화에 표시됩니다", en: "Shown in the sidebar and chats" },
  "set.language": { ko: "언어", en: "Language" },
  "set.languageSection": { ko: "언어", en: "Language" },
  "set.languageDesc": { ko: "인터페이스 표시 언어", en: "Interface display language" },
  "set.languageRow": { ko: "표시 언어", en: "Display language" },
  "set.languageRowDesc": { ko: "한국어 또는 영어", en: "Korean or English" },
  "set.korean": { ko: "한국어", en: "Korean" },
  "set.english": { ko: "English", en: "English" },
  "set.screen": { ko: "화면", en: "Appearance" },
  "set.screenDesc": { ko: "테마와 모드", en: "Theme and mode" },
  "set.theme": { ko: "테마", en: "Theme" },
  "set.themeDesc": { ko: "라이트 · 다크 · 시스템 자동", en: "Light · Dark · System" },
  "set.light": { ko: "라이트", en: "Light" },
  "set.dark": { ko: "다크", en: "Dark" },
  "set.system": { ko: "시스템", en: "System" },
  "set.calendar": { ko: "캘린더", en: "Calendar" },
  "set.calendarDesc": { ko: "일정 표시 규칙", en: "Schedule display rules" },
  "set.weekStart": { ko: "주 시작 요일", en: "Week starts on" },
  "set.weekStartDesc": { ko: "월간 그리드의 첫 열", en: "First column of the month grid" },
  "set.sunday": { ko: "일요일", en: "Sunday" },
  "set.monday": { ko: "월요일", en: "Monday" },
  "set.notif": { ko: "알림", en: "Notifications" },
  "set.notifDesc": { ko: "리마인드와 알림", en: "Reminders and alerts" },
  "set.notifToggle": { ko: "알림 받기", en: "Receive notifications" },
  "set.notifToggleDesc": { ko: "일정·할 일 리마인드를 알림으로 받습니다", en: "Get reminders for schedules and tasks" },
  "set.ai": { ko: "AI", en: "AI" },
  "set.aiDesc": { ko: "자동화 동작", en: "Automation behavior" },
  "set.autoConfirm": { ko: "AI 제안 일정 자동 확정", en: "Auto-confirm AI schedules" },
  "set.autoConfirmDesc": { ko: "켜면 AI가 만든 일정을 확인 없이 바로 확정합니다", en: "AI-created schedules are confirmed without review" },
} as const;

export type I18nKey = keyof typeof DICT;

/** 현재 언어에 맞는 번역 함수를 반환. */
export function useT() {
  const lang = useWorkspace((s) => s.settings.language);
  return (key: I18nKey): string => DICT[key][lang];
}
