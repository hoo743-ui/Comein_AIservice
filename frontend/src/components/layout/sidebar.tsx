"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, Plus, Search, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { NAV_ITEMS } from "@/config/nav";
import { useWorkspace } from "@/lib/store";
import { SettingsModal } from "@/components/workspace/settings-modal";

/** 좌측 사이드바 — 브랜드 · 새 대화 · 검색 · 메뉴 · 최근 대화 · 프로필. */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const conversations = useWorkspace((s) => s.conversations);
  const activeId = useWorkspace((s) => s.activeConversationId);
  const name = useWorkspace((s) => s.settings.name);
  const newConversation = useWorkspace((s) => s.newConversation);
  const setActive = useWorkspace((s) => s.setActiveConversation);

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  const goChat = (id?: string) => {
    if (id) setActive(id);
    if (pathname !== "/workspace") router.push("/workspace");
  };

  return (
    <aside className="glass-panel flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border/70">
      <div className="flex h-16 items-center px-5">
        <Link href="/workspace" className="transition-opacity hover:opacity-80">
          <Logo subtitle />
        </Link>
      </div>

      {/* 새 대화 */}
      <div className="px-3">
        <button
          onClick={() => {
            newConversation();
            goChat();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg brand-gradient px-3 py-2.5 text-sm font-semibold text-white shadow-soft transition-transform hover:scale-[1.01] active:scale-[0.99]"
        >
          <Plus className="size-4" />새 대화
        </button>
      </div>

      {/* 검색 */}
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 rounded-lg border border-sidebar-border/70 bg-background/40 px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="대화 검색"
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
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => goChat(c.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                activeId === c.id && pathname === "/workspace"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <MessageCircle className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{c.title}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">대화가 없어요</p>
          )}
        </div>
      </div>

      {/* 프로필 */}
      <div className="flex items-center justify-between border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-full brand-gradient text-xs font-semibold text-white">
            {name.slice(0, 1) || "나"}
          </div>
          <span className="max-w-[96px] truncate text-sm font-medium text-sidebar-foreground">
            {name}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <ThemeToggle />
          <button
            aria-label="설정"
            onClick={() => setSettingsOpen(true)}
            className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Settings className="size-[18px]" />
          </button>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  );
}
