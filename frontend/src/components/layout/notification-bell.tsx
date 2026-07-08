"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CalendarClock, CheckSquare, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/store";
import { useHydrated } from "@/lib/use-hydrated";
import { fmtDateShort, fmtTime, dueLabel } from "@/lib/format";

type NotifKind = "proposal" | "schedule" | "todo";

type Notif = {
  id: string;
  kind: NotifKind;
  title: string;
  detail: string;
  href: string;
  ts: number; // 정렬 기준(임박할수록 위)
  urgent: boolean;
};

const DAY = 86_400_000;

/**
 * 워크스페이스 우측 상단 알림 벨 — 다가오는 일정·임박한 Todo·AI 제안 일정을 모아 보여준다.
 * 데이터는 store(schedules/todos)에서 파생하며, 닫은 알림은 store.dismissedNotifs 로 세션 내 유지.
 */
export function NotificationBell() {
  const hydrated = useHydrated();
  const base = hydrated ? new Date() : new Date(2026, 6, 8, 10, 15);

  const schedules = useWorkspace((s) => s.schedules);
  const todos = useWorkspace((s) => s.todos);
  const dismissed = useWorkspace((s) => s.dismissedNotifs);
  const dismissNotif = useWorkspace((s) => s.dismissNotif);
  const dismissNotifs = useWorkspace((s) => s.dismissNotifs);

  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  // 바깥 클릭 / ESC 로 닫기
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const notifs = React.useMemo<Notif[]>(() => {
    if (!hydrated) return [];
    const now = +base;
    const list: Notif[] = [];

    for (const s of schedules) {
      const start = +new Date(s.start);
      // AI 제안 일정 — 확인 필요
      if (s.status === "pending") {
        list.push({
          id: `sch-proposal:${s.id}`,
          kind: "proposal",
          title: "AI 제안 일정 · 확인 필요",
          detail: `${s.title} · ${fmtDateShort(s.start)} ${fmtTime(s.start)}`,
          href: "/workspace/calendar",
          ts: start,
          urgent: true,
        });
        continue;
      }
      // 24시간 내 시작하는 확정 일정
      if (start >= now && start <= now + DAY) {
        list.push({
          id: `sch:${s.id}`,
          kind: "schedule",
          title: "곧 시작하는 일정",
          detail: `${s.title} · ${fmtTime(s.start)}${s.location ? ` · ${s.location}` : ""}`,
          href: "/workspace/calendar",
          ts: start,
          urgent: start <= now + 2 * 60 * 60 * 1000, // 2시간 내
        });
      }
    }

    for (const t of todos) {
      if (t.status === "done" || !t.due) continue;
      const due = +new Date(t.due);
      // 오늘까지거나 이미 지난 미완료 Todo
      if (due <= now + DAY) {
        list.push({
          id: `todo:${t.id}`,
          kind: "todo",
          title: due < now ? "기한 지난 할 일" : "마감 임박한 할 일",
          detail: `${t.title} · ${dueLabel(t.due, base)} 마감`,
          href: "/workspace/todo",
          ts: due,
          urgent: due < now || t.priority === "high",
        });
      }
    }

    return list.sort((a, b) => a.ts - b.ts);
  }, [hydrated, base, schedules, todos]);

  const visible = notifs.filter((n) => !dismissed.includes(n.id));
  const count = visible.length;

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`알림 ${count}건`}
        aria-expanded={open}
        className={cn(
          "relative flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-primary",
          open && "text-primary ring-2 ring-primary/30"
        )}
      >
        <Bell className="size-[18px]" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground shadow-soft">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Bell className="size-4 text-primary" />
              알림
              {count > 0 && (
                <span className="rounded-full bg-primary/12 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                  {count}
                </span>
              )}
            </p>
            {count > 0 && (
              <button
                onClick={() => dismissNotifs(visible.map((n) => n.id))}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                모두 읽음
              </button>
            )}
          </div>

          <div className="max-h-[22rem] overflow-y-auto p-1.5">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
                <Bell className="size-6 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">모두 확인했어요</p>
                <p className="text-xs text-muted-foreground">새로운 알림이 없습니다</p>
              </div>
            ) : (
              visible.map((n) => <NotifRow key={n.id} n={n} onClose={() => setOpen(false)} onDismiss={() => dismissNotif(n.id)} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ICON: Record<NotifKind, React.ReactNode> = {
  proposal: <Sparkles className="size-4" />,
  schedule: <CalendarClock className="size-4" />,
  todo: <CheckSquare className="size-4" />,
};

function NotifRow({
  n,
  onClose,
  onDismiss,
}: {
  n: Notif;
  onClose: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="group/n flex items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-accent">
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border",
          n.urgent
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-muted/60 text-muted-foreground"
        )}
      >
        {ICON[n.kind]}
      </span>
      <Link href={n.href} onClick={onClose} className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          {n.title}
          {n.urgent && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.detail}</p>
      </Link>
      <button
        onClick={onDismiss}
        aria-label="알림 닫기"
        className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition hover:text-foreground group-hover/n:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
