"use client";

import { usePathname } from "next/navigation";
import { CalendarClock, CheckSquare, NotebookPen } from "lucide-react";

import { useWorkspace } from "@/lib/store";
import { useHydrated } from "@/lib/use-hydrated";
import { fmtDateShort, fmtTime, dueLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

/** 우측 컨텍스트 패널 — 다가오는 일정 · 임박한 Todo · 최근 메모 (채팅 홈 전용). */
export function ContextPanel() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const base = hydrated ? new Date() : new Date(2026, 6, 8);

  const schedules = useWorkspace((s) => s.schedules);
  const todos = useWorkspace((s) => s.todos);
  const memos = useWorkspace((s) => s.memos);

  // 기능 페이지에서는 넓게 쓰도록 숨김 (채팅 홈에서만 표시)
  const show = pathname === "/workspace";

  const upcoming = [...schedules]
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
    .slice(0, 3);

  const urgent = todos
    .filter((t) => t.status !== "done")
    .sort((a, b) => (a.due ? +new Date(a.due) : Infinity) - (b.due ? +new Date(b.due) : Infinity))
    .slice(0, 3);

  const recentMemos = [...memos]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 3);

  if (!show) return null;

  return (
    <aside className="glass-panel hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border/70 p-5 xl:flex">
      <Card icon={<CalendarClock className="size-4 text-primary" />} title="다가오는 일정">
        {upcoming.map((s) => (
          <Row
            key={s.id}
            primary={s.title}
            secondary={`${fmtDateShort(s.start)} ${fmtTime(s.start)}${s.location ? ` · ${s.location}` : ""}`}
            badge={s.status === "pending" ? <Badge variant="muted">제안</Badge> : undefined}
          />
        ))}
        {upcoming.length === 0 && <Empty>예정된 일정이 없어요</Empty>}
      </Card>

      <Card icon={<CheckSquare className="size-4 text-primary" />} title="임박한 Todo">
        {urgent.map((t) => (
          <Row
            key={t.id}
            primary={t.title}
            secondary={t.due ? `${dueLabel(t.due, base)} 마감` : "기한 없음"}
            badge={
              t.priority === "high" ? <Badge variant="high">높음</Badge> : undefined
            }
          />
        ))}
        {urgent.length === 0 && <Empty>할 일이 비어 있어요</Empty>}
      </Card>

      <Card icon={<NotebookPen className="size-4 text-primary" />} title="최근 메모">
        {recentMemos.map((m) => (
          <Row
            key={m.id}
            primary={m.title}
            secondary={m.tags.map((t) => `#${t}`).join(" ") || "태그 없음"}
          />
        ))}
        {recentMemos.length === 0 && <Empty>메모가 없어요</Empty>}
      </Card>
    </aside>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="elevated rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {title}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function Row({
  primary,
  secondary,
  badge,
}: {
  primary: string;
  secondary: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/50 px-3 py-2 transition-colors hover:bg-accent">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-foreground">{primary}</p>
        {badge && <span className="shrink-0">{badge}</span>}
      </div>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{secondary}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-center text-xs text-muted-foreground">{children}</p>;
}
