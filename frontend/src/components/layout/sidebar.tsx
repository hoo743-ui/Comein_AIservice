"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { NAV_ITEMS } from "@/config/nav";

/** 좌측 사이드바 — 브랜드 + 5대 기능 네비 + 하단 유틸. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass-panel flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border/70">
      <div className="flex h-16 items-center px-5">
        <Link href="/workspace" className="transition-opacity hover:opacity-80">
          <Logo subtitle />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
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
      </nav>

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
