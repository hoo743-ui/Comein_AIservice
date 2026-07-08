"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Plus, Search, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { NAV_ITEMS } from "@/config/nav";

// 최근 대화 (목업) — 실제 데이터 연결 전까지 자리 채움
const RECENT_CHATS = [
  "교수님 미팅 일정 잡기",
  "주간 회의록 정리",
  "발표자료 아이디어 메모",
  "이번 주 할 일 우선순위",
  "스터디 일정 조율",
  "여행 준비 체크리스트",
];

/** 좌측 사이드바 — 브랜드 · 새 대화 · 검색 · 메뉴 · 최근 대화 · 프로필. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass-panel flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border/70">
      <div className="flex h-16 items-center px-5">
        <Link href="/workspace" className="transition-opacity hover:opacity-80">
          <Logo subtitle />
        </Link>
      </div>

      {/* 새 대화 */}
      <div className="px-3">
        <button className="flex w-full items-center justify-center gap-2 rounded-lg brand-gradient px-3 py-2.5 text-sm font-semibold text-white shadow-soft transition-transform hover:scale-[1.01] active:scale-[0.99]">
          <Plus className="size-4" />새 대화
        </button>
      </div>

      {/* 검색 */}
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 rounded-lg border border-sidebar-border/70 bg-background/40 px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            placeholder="검색"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* 메뉴 */}
      <nav className="px-3 pt-4">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          메뉴
        </p>
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/workspace"
                ? pathname === "/workspace"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex flex-col rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <span className="flex items-center gap-3">
                  <item.icon
                    className={cn(
                      "size-[18px] shrink-0 transition-colors",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                    )}
                  />
                  {item.title}
                </span>
                {/* 마우스 오버 시 설명이 아래로 펼쳐짐 */}
                <span className="ml-[30px] max-h-0 overflow-hidden text-xs font-normal leading-snug text-muted-foreground opacity-0 transition-all duration-300 group-hover:mt-1 group-hover:max-h-10 group-hover:opacity-100">
                  {item.desc}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* 최근 대화 */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col px-3">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          최근 대화
        </p>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-2">
          {RECENT_CHATS.map((title) => (
            <button
              key={title}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            >
              <MessageCircle className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 프로필 */}
      <div className="flex items-center justify-between border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-full brand-gradient text-xs font-semibold text-white">
            나
          </div>
          <span className="text-sm font-medium text-sidebar-foreground">내 워크스페이스</span>
        </div>
        <div className="flex items-center gap-0.5">
          <ThemeToggle />
          <button
            aria-label="설정"
            className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Settings className="size-[18px]" />
          </button>
        </div>
      </div>
    </aside>
  );
}
