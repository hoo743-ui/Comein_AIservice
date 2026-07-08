import { CalendarClock, CheckSquare, NotebookPen } from "lucide-react";

/** 우측 컨텍스트 패널 — 오늘 일정 · 임박 Todo · 최근 메모 (현재는 목업). */
export function ContextPanel() {
  return (
    <aside className="glass-panel hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border/70 p-5 xl:flex">
      <ContextCard
        icon={<CalendarClock className="size-4 text-primary" />}
        title="오늘 일정"
      >
        <Row primary="교수님 미팅" secondary="15:00 · 공학관 401" />
        <Row primary="팀 스탠드업" secondary="17:30 · 온라인" />
      </ContextCard>

      <ContextCard
        icon={<CheckSquare className="size-4 text-primary" />}
        title="임박한 Todo"
      >
        <Row primary="발표자료 초안" secondary="오늘 마감 · 우선순위 높음" badge />
        <Row primary="회의록 정리" secondary="내일 · 우선순위 보통" />
      </ContextCard>

      <ContextCard
        icon={<NotebookPen className="size-4 text-primary" />}
        title="최근 메모"
      >
        <Row primary="아이디어: 온보딩 문 애니메이션" secondary="#브랜드 #UX" />
        <Row primary="레퍼런스 링크 모음" secondary="#리서치" />
      </ContextCard>
    </aside>
  );
}

function ContextCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass rounded-xl border border-border/70 p-4 shadow-soft">
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
  badge?: boolean;
}) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2 transition-colors hover:bg-accent">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-foreground">{primary}</p>
        {badge && (
          <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
            마감
          </span>
        )}
      </div>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{secondary}</p>
    </div>
  );
}
