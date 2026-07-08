import {
  Calendar,
  CheckSquare,
  MessageCircle,
  NotebookPen,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  desc: string;
};

/** 사이드바 네비게이션 — 포스터 5대 기능 (Chat이 워크스페이스 홈). */
export const NAV_ITEMS: NavItem[] = [
  { title: "Chat", href: "/workspace", icon: MessageCircle, desc: "AI와 대화하며 업무 처리" },
  { title: "Calendar", href: "/workspace/calendar", icon: Calendar, desc: "일정 생성·조회·충돌 관리" },
  { title: "Memo", href: "/workspace/memo", icon: NotebookPen, desc: "생각과 아이디어를 AI가 정리" },
  { title: "Todo", href: "/workspace/todo", icon: CheckSquare, desc: "할 일 생성 및 우선순위" },
  { title: "Meeting", href: "/workspace/meeting", icon: Users, desc: "회의 일정·요약·참석자" },
];
