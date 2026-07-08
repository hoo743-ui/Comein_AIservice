import * as React from "react";

import { NotificationBell } from "@/components/layout/notification-bell";

/**
 * 워크스페이스 기능 페이지 공통 셸 — 세리프 타이틀 + 우측 액션 + 스크롤 본문.
 * 모든 기능 페이지가 동일한 헤더/여백/테두리 규칙을 공유한다.
 */
export function PageShell({
  title,
  subtitle,
  icon,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="glass flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/60 px-6">
        <div className="flex items-center gap-3">
          {icon && (
            <span className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-primary">
              {icon}
            </span>
          )}
          <div>
            <h1 className="font-display text-xl font-semibold leading-none tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <NotificationBell />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
