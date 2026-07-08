"use client";

import * as React from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Footprints,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react";

import { PageShell } from "@/components/workspace/page-shell";
import { Modal, Field, inputClass } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/lib/store";
import { useHydrated } from "@/lib/use-hydrated";
import { fmtTime, fmtDate, isSameDay } from "@/lib/format";
import { CURRENT_LOC, walkMinutes } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type { Schedule } from "@/lib/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 로컬 시간대 기준 YYYY-MM-DD (date input 값). */
function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 로컬 시간대 기준 HH:mm (time input 값). */
function toTimeInput(d: Date): string {
  const h = `${d.getHours()}`.padStart(2, "0");
  const min = `${d.getMinutes()}`.padStart(2, "0");
  return `${h}:${min}`;
}

/** 날짜 + 시간 문자열을 로컬 ISO(초 포함, Z 없음)로 결합 — 시드 데이터와 동일 포맷. */
function combineISO(date: string, time: string): string {
  const t = time || "00:00";
  return `${date}T${t}:00`;
}

/** 6주(42칸) 달력 셀의 날짜 배열 — 일요일 시작. */
function buildMonthCells(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay()); // 앞쪽 이웃 달 포함
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

interface DraftState {
  id: string | null;
  title: string;
  date: string;
  start: string;
  end: string;
  location: string;
  placeId: string;
}

const emptyDraft = (date: string): DraftState => ({
  id: null,
  title: "",
  date,
  start: "09:00",
  end: "",
  location: "",
  placeId: "",
});

export default function CalendarPage() {
  const schedules = useWorkspace((s) => s.schedules);
  const addSchedule = useWorkspace((s) => s.addSchedule);
  const updateSchedule = useWorkspace((s) => s.updateSchedule);
  const removeSchedule = useWorkspace((s) => s.removeSchedule);
  const confirmSchedule = useWorkspace((s) => s.confirmSchedule);
  const conflictsFor = useWorkspace((s) => s.conflictsFor);
  const places = useWorkspace((s) => s.places);

  const hydrated = useHydrated();

  // SSR 결정성을 위해 2026년 7월로 고정 초기화.
  const [month, setMonth] = React.useState(() => new Date(2026, 6, 1));
  const [modalOpen, setModalOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftState>(() => emptyDraft("2026-07-08"));

  const cells = React.useMemo(() => buildMonthCells(month), [month]);

  const sorted = React.useMemo(
    () => [...schedules].sort((a, b) => +new Date(a.start) - +new Date(b.start)),
    [schedules]
  );

  const goPrev = () => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const goNext = () => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const goToday = () => {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const openAdd = React.useCallback(
    (date?: string) =>
      setDraft(() => {
        setModalOpen(true);
        return emptyDraft(date ?? toDateInput(new Date(month.getFullYear(), month.getMonth(), 1)));
      }),
    [month]
  );

  const openEdit = (s: Schedule) => {
    const st = new Date(s.start);
    setDraft({
      id: s.id,
      title: s.title,
      date: toDateInput(st),
      start: toTimeInput(st),
      end: s.end ? toTimeInput(new Date(s.end)) : "",
      location: s.location ?? "",
      placeId: s.placeId ?? "",
    });
    setModalOpen(true);
  };

  const canSave = draft.title.trim().length > 0 && draft.date.length > 0;

  const save = () => {
    if (!canSave) return;
    const payload: Omit<Schedule, "id"> = {
      title: draft.title.trim(),
      start: combineISO(draft.date, draft.start),
      end: draft.end ? combineISO(draft.date, draft.end) : undefined,
      location: draft.location.trim() || undefined,
      placeId: draft.placeId || undefined,
      status: "pending",
    };
    if (draft.id) {
      // 수정 시에는 기존 status를 유지.
      updateSchedule(draft.id, {
        title: payload.title,
        start: payload.start,
        end: payload.end,
        location: payload.location,
        placeId: payload.placeId,
      });
    } else {
      addSchedule(payload);
    }
    setModalOpen(false);
  };

  return (
    <PageShell
      title="Calendar"
      subtitle="일정 생성·조회·충돌 관리"
      icon={<Calendar className="size-5" />}
      action={
        <Button onClick={() => openAdd()}>
          <Plus className="size-4" />
          일정 추가
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* ── 달력 ── */}
        <section className="elevated rounded-2xl border border-border p-5">
          {/* 툴바 */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goPrev} aria-label="이전 달">
                <ChevronLeft className="size-4" />
              </Button>
              <div className="flex items-center gap-1.5">
                <select
                  aria-label="연도 선택"
                  value={month.getFullYear()}
                  onChange={(e) => setMonth((m) => new Date(Number(e.target.value), m.getMonth(), 1))}
                  className="cursor-pointer rounded-lg border border-border bg-background px-2.5 py-1.5 text-base font-semibold tabular-nums text-foreground outline-none transition-colors hover:border-primary/50 focus:border-primary"
                >
                  {[2024, 2025, 2026, 2027, 2028, 2029].map((y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ))}
                </select>
                <select
                  aria-label="월 선택"
                  value={month.getMonth()}
                  onChange={(e) => setMonth((m) => new Date(m.getFullYear(), Number(e.target.value), 1))}
                  className="cursor-pointer rounded-lg border border-border bg-background px-2.5 py-1.5 text-base font-semibold tabular-nums text-foreground outline-none transition-colors hover:border-primary/50 focus:border-primary"
                >
                  {Array.from({ length: 12 }, (_, i) => i).map((mi) => (
                    <option key={mi} value={mi}>
                      {mi + 1}월
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="outline" size="icon" onClick={goNext} aria-label="다음 달">
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={goToday}>
              오늘
            </Button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-border pb-2.5">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={cn(
                  "text-center text-[13px] font-semibold",
                  i === 0 ? "text-destructive/80" : "text-muted-foreground"
                )}
              >
                {w}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-1.5 pt-2">
            {cells.map((cell) => {
              const inMonth = cell.getMonth() === month.getMonth();
              const isToday = hydrated && isSameDay(cell, new Date());
              const dayItems = schedules.filter((s) => isSameDay(s.start, cell));
              const isSunday = cell.getDay() === 0;

              return (
                <button
                  key={cell.toISOString()}
                  type="button"
                  onClick={() => openAdd(toDateInput(cell))}
                  className={cn(
                    "flex min-h-[6.5rem] flex-col gap-1 rounded-xl border border-border/50 bg-background/30 p-2 text-left transition-colors hover:border-primary/40 hover:bg-accent/60",
                    !inMonth && "opacity-40",
                    isToday && "border-primary/40 bg-primary/[0.04]"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums",
                      isToday
                        ? "bg-primary text-primary-foreground shadow-soft"
                        : isSunday
                          ? "text-destructive/80"
                          : "text-foreground",
                      !inMonth && !isToday && "text-muted-foreground"
                    )}
                  >
                    {cell.getDate()}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {dayItems.slice(0, 3).map((s) => (
                      <span
                        key={s.id}
                        className={cn(
                          "truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight",
                          s.status === "confirmed"
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                        title={s.title}
                      >
                        {s.title}
                      </span>
                    ))}
                    {dayItems.length > 3 && (
                      <span className="px-1 text-[10px] font-medium text-muted-foreground">
                        +{dayItems.length - 3}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 다가오는 일정 ── */}
        <aside className="rounded-xl border border-border bg-card p-4 shadow-soft sm:p-5">
          <h2 className="mb-4 font-display text-lg font-semibold text-foreground">다가오는 일정</h2>

          {sorted.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
              <Calendar className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">아직 일정이 없어요.</p>
              <Button variant="outline" size="sm" onClick={() => openAdd()}>
                <Plus className="size-4" />
                일정 추가
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {sorted.map((s) => {
                const hasConflict = conflictsFor(s.id).length > 0;
                const place = s.placeId ? places.find((p) => p.id === s.placeId) : undefined;
                const travel = place ? walkMinutes(CURRENT_LOC, place) : null;
                return (
                  <li
                    key={s.id}
                    className="rounded-lg border border-border bg-background/50 p-3 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-semibold text-foreground">{s.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {fmtDate(s.start)} · {fmtTime(s.start)}
                          {s.end && `–${fmtTime(s.end)}`}
                        </p>
                        {s.location && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3 shrink-0" />
                            <span className="truncate">{s.location}</span>
                          </p>
                        )}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeSchedule(s.id)}
                        aria-label="일정 삭제"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {s.status === "confirmed" ? (
                        <Badge variant="default">확정</Badge>
                      ) : (
                        <Badge variant="muted">제안</Badge>
                      )}
                      {hasConflict && (
                        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="size-3" />
                          일정 충돌
                        </Badge>
                      )}
                      {travel !== null && (
                        <Badge variant="muted">
                          <Footprints className="size-3" />도보 {travel}분
                        </Badge>
                      )}
                      {s.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-auto h-7 px-2 text-xs"
                          onClick={() => confirmSchedule(s.id)}
                        >
                          <Check className="size-3" />
                          확정
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      {/* ── 추가/수정 모달 ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={draft.id ? "일정 수정" : "일정 추가"}
        description="날짜와 시간을 정하면 겹치는 일정을 자동으로 확인해요."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button onClick={save} disabled={!canSave}>
              저장
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="제목">
            <input
              className={inputClass}
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="예: 교수님 미팅"
              autoFocus
            />
          </Field>
          <Field label="날짜">
            <input
              type="date"
              className={inputClass}
              value={draft.date}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="시작 시간">
              <input
                type="time"
                className={inputClass}
                value={draft.start}
                onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
              />
            </Field>
            <Field label="종료 시간 (선택)">
              <input
                type="time"
                className={inputClass}
                value={draft.end}
                onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="장소 (선택)">
            <input
              className={inputClass}
              value={draft.location}
              onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
              placeholder="예: 공학관 401"
            />
          </Field>
          <Field label="지도 장소 (이동시간 안내)">
            <select
              className={inputClass}
              value={draft.placeId}
              onChange={(e) => setDraft((d) => ({ ...d, placeId: e.target.value }))}
            >
              <option value="">연결 안 함</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Modal>
    </PageShell>
  );
}
