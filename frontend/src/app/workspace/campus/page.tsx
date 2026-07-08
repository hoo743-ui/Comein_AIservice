"use client";

import * as React from "react";
import { Clock, Footprints, MapPin, Navigation } from "lucide-react";

import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/store";
import { useHydrated } from "@/lib/use-hydrated";
import { PageShell } from "@/components/workspace/page-shell";
import { Badge } from "@/components/ui/badge";
import type { Place, Weekday } from "@/lib/types";

const DAYS: { key: Weekday; label: string }[] = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
];
const DAY_ORDER = DAYS.map((d) => d.key);
const GATE = { x: 50, y: 96 }; // 정문(경로 기본 출발점)

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const walkMinutes = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.max(1, Math.round(dist(a, b) * 0.7));

export default function CampusPage() {
  const hydrated = useHydrated();
  const places = useWorkspace((s) => s.places);
  const buildings = React.useMemo(
    () => places.filter((p) => p.category === "campus"),
    [places]
  );
  const timetable = useWorkspace((s) => s.timetable);

  const base = hydrated ? new Date() : new Date(2026, 6, 8, 10, 15); // 데모: 수 10:15
  const jsDay = base.getDay();
  const todayIdx = jsDay >= 1 && jsDay <= 5 ? jsDay - 1 : -1;
  const nowMin = base.getHours() * 60 + base.getMinutes();

  const buildingOf = React.useCallback(
    (id: string) => buildings.find((b) => b.id === id),
    [buildings]
  );

  // 주간 정렬 + 다음 강의 계산
  const week = React.useMemo(
    () =>
      timetable
        .map((c) => ({ ...c, dIdx: DAY_ORDER.indexOf(c.day), sMin: toMin(c.start) }))
        .sort((a, b) => a.dIdx - b.dIdx || a.sMin - b.sMin),
    [timetable]
  );
  const next =
    week.find((c) => c.dIdx > todayIdx || (c.dIdx === todayIdx && c.sMin >= nowMin)) ??
    week[0] ??
    null;

  const [selectedDay, setSelectedDay] = React.useState<Weekday>(
    todayIdx >= 0 ? DAY_ORDER[todayIdx] : "mon"
  );
  const [focusId, setFocusId] = React.useState<string | null>(next?.buildingId ?? null);

  const dayClasses = week
    .filter((c) => c.day === selectedDay)
    .sort((a, b) => a.sMin - b.sMin);

  // 경로 출발점: 같은 날 다음 강의 직전 수업 건물, 없으면 정문
  const nextBuilding = next ? buildingOf(next.buildingId) : undefined;
  const originBuilding = React.useMemo(() => {
    if (!next) return undefined;
    const sameDay = week.filter((c) => c.day === next.day && c.sMin < next.sMin);
    const prev = sameDay[sameDay.length - 1];
    return prev ? buildingOf(prev.buildingId) : undefined;
  }, [next, week, buildingOf]);
  const origin = originBuilding ?? GATE;
  const walk = nextBuilding ? walkMinutes(origin, nextBuilding) : null;

  return (
    <PageShell
      title="Campus"
      subtitle="시간표에 따라 다음 강의 위치와 이동 경로를 안내합니다"
      icon={<MapPin className="size-5" />}
    >
      {/* 다음 강의 히어로 */}
      {next && nextBuilding && (
        <div className="elevated flex flex-col gap-4 rounded-2xl border border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="orb-3d flex size-14 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white">
              {nextBuilding.code}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                다음 강의
              </p>
              <p className="mt-0.5 font-display text-2xl font-semibold text-foreground">
                {next.course}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {DAYS.find((d) => d.key === next.day)?.label} {next.start}–{next.end}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {nextBuilding.name} {next.room}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {walk !== null && (
              <div className="rounded-xl border border-border bg-muted/50 px-4 py-2 text-center">
                <p className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums text-foreground">
                  <Footprints className="size-4 text-primary" />
                  {walk}분
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {originBuilding ? `${originBuilding.name}에서` : "정문에서"} 도보
                </p>
              </div>
            )}
            <button
              onClick={() => setFocusId(next.buildingId)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-transform hover:scale-[1.02] active:scale-95"
            >
              <Navigation className="size-4" />
              지도에서 보기
            </button>
          </div>
        </div>
      )}

      {/* 본문: 시간표 | 캠퍼스 맵 (화면 폭 활용) */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        {/* 시간표 */}
        <section className="elevated flex min-h-[28rem] flex-col rounded-2xl border border-border p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">시간표</h2>
            <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
              {DAYS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => setSelectedDay(d.key)}
                  className={cn(
                    "size-8 rounded-md text-sm font-semibold transition-colors",
                    selectedDay === d.key
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    todayIdx >= 0 && DAY_ORDER[todayIdx] === d.key && selectedDay !== d.key
                      ? "ring-1 ring-primary/40"
                      : ""
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {dayClasses.map((c) => {
              const b = buildingOf(c.buildingId);
              const isNext = next?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setFocusId(c.buildingId)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    focusId === c.buildingId
                      ? "border-primary/50 bg-primary/[0.06]"
                      : "border-border bg-card hover:bg-accent"
                  )}
                >
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-sm font-bold tabular-nums text-foreground">{c.start}</p>
                    <p className="text-[11px] text-muted-foreground">{c.end}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{c.course}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b?.name} · {c.room}
                    </p>
                  </div>
                  {isNext && <Badge>다음</Badge>}
                </button>
              );
            })}
            {dayClasses.length === 0 && (
              <div className="grid h-full place-items-center rounded-xl border border-dashed border-border/70 text-sm text-muted-foreground">
                이 요일엔 수업이 없어요
              </div>
            )}
          </div>
        </section>

        {/* 캠퍼스 맵 (지도 API 자리 — 지금은 스키매틱) */}
        <section className="elevated flex min-h-[28rem] flex-col rounded-2xl border border-border p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">캠퍼스 맵</h2>
            <span className="text-xs text-muted-foreground">가천대 · 데모</span>
          </div>
          <CampusMap
            buildings={buildings}
            focusId={focusId}
            nextId={next?.buildingId ?? null}
            origin={origin}
            target={nextBuilding ?? null}
            onPick={setFocusId}
          />
        </section>
      </div>
    </PageShell>
  );
}

function CampusMap({
  buildings,
  focusId,
  nextId,
  origin,
  target,
  onPick,
}: {
  buildings: Place[];
  focusId: string | null;
  nextId: string | null;
  origin: { x: number; y: number };
  target: Place | null;
  onPick: (id: string) => void;
}) {
  return (
    <div className="relative flex-1 overflow-hidden rounded-xl border border-border bg-[radial-gradient(120%_120%_at_50%_0%,hsl(var(--accent))_0%,hsl(var(--muted))_100%)]">
      {/* 은은한 그리드 */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.5] [background-image:linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)] [background-size:2.5rem_2.5rem]"
      />

      {/* 경로선 */}
      {target && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <line
            x1={origin.x}
            y1={origin.y}
            x2={target.x}
            y2={target.y}
            stroke="hsl(var(--primary))"
            strokeWidth={0.6}
            strokeDasharray="2 1.5"
            strokeLinecap="round"
            opacity={0.7}
          />
        </svg>
      )}

      {/* 출발점(정문/직전 강의) */}
      <span
        className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-muted-foreground"
        style={{ left: `${origin.x}%`, top: `${origin.y}%` }}
        title="출발"
      />

      {/* 건물 마커 */}
      {buildings.map((b) => {
        const isNext = b.id === nextId;
        const isFocus = b.id === focusId;
        return (
          <button
            key={b.id}
            onClick={() => onPick(b.id)}
            className="group absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${b.x}%`, top: `${b.y}%` }}
          >
            {isNext && (
              <span className="absolute left-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-primary/30" />
            )}
            <span
              className={cn(
                "relative flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-soft transition-all",
                isNext
                  ? "border-primary bg-primary text-primary-foreground"
                  : isFocus
                    ? "border-primary/50 bg-card text-foreground ring-2 ring-primary/30"
                    : "border-border bg-card text-foreground hover:border-primary/40"
              )}
            >
              <MapPin
                className={cn("size-3.5", isNext ? "text-primary-foreground" : "text-primary")}
              />
              {b.code}
              <span
                className={cn(
                  "max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all group-hover:max-w-[7rem] group-hover:opacity-100",
                  (isNext || isFocus) && "max-w-[7rem] opacity-100"
                )}
              >
                {b.name}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
