"use client";

import * as React from "react";
import {
  Users,
  Plus,
  Trash2,
  ListChecks,
  Clock,
  CheckCircle2,
  UserRound,
  FileText,
} from "lucide-react";

import { useWorkspace } from "@/lib/store";
import type { Meeting } from "@/lib/types";
import { PageShell } from "@/components/workspace/page-shell";
import { Modal, Field, inputClass } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function MeetingPage() {
  const meetings = useWorkspace((s) => s.meetings);
  const addMeeting = useWorkspace((s) => s.addMeeting);
  const removeMeeting = useWorkspace((s) => s.removeMeeting);
  const addTodo = useWorkspace((s) => s.addTodo);

  const [selectedId, setSelectedId] = React.useState<string | null>(
    meetings[0]?.id ?? null
  );

  // 선택된 회의(삭제 등으로 사라졌으면 첫 회의로 폴백)
  const selected =
    meetings.find((m) => m.id === selectedId) ?? meetings[0] ?? null;

  // ── Add modal 상태 ──
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [participants, setParticipants] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [actionItems, setActionItems] = React.useState("");

  const openAdd = () => {
    setTitle("");
    setDate("");
    setTime("");
    setParticipants("");
    setSummary("");
    setActionItems("");
    setOpen(true);
  };

  const save = () => {
    const t = title.trim();
    if (!t) return;
    const start = date
      ? new Date(`${date}T${time || "00:00"}:00`).toISOString()
      : new Date().toISOString();
    const parts = participants
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const items = actionItems
      .split("\n")
      .map((i) => i.trim())
      .filter(Boolean);
    addMeeting({
      title: t,
      start,
      participants: parts,
      ...(summary.trim() ? { summary: summary.trim() } : {}),
      ...(items.length ? { actionItems: items } : {}),
    });
    setOpen(false);
  };

  const handleRemove = (id: string) => {
    removeMeeting(id);
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <PageShell
      title="Meeting"
      subtitle="회의 일정·요약·참석자 관리"
      icon={<Users className="size-5" />}
      action={
        <Button onClick={openAdd}>
          <Plus className="size-4" />
          회의 추가
        </Button>
      }
    >
      {meetings.length === 0 ? (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
            <Users className="size-6" />
          </span>
          <p className="text-sm text-muted-foreground">회의를 추가해 보세요</p>
          <Button variant="outline" onClick={openAdd}>
            <Plus className="size-4" />
            회의 추가
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
          {/* ── 좌측: 회의 리스트 ── */}
          <aside className="flex flex-col gap-2.5">
            {meetings.map((m) => {
              const active = selected?.id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    active
                      ? "elevated border-primary/50 bg-accent/60"
                      : "border-border bg-card hover:bg-accent"
                  )}
                >
                  <p className="truncate text-sm font-semibold text-foreground">
                    {m.title}
                  </p>
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {fmtDate(m.start)} · {fmtTime(m.start)}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <UserRound className="size-3" />
                    참석자 {m.participants.length}명
                  </p>
                </button>
              );
            })}
          </aside>

          {/* ── 우측: 상세 패널 ── */}
          {selected ? (
            <MeetingDetail
              key={selected.id}
              meeting={selected}
              onRemove={handleRemove}
              addTodo={addTodo}
            />
          ) : (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-border/70 p-10 text-sm text-muted-foreground">
              회의를 선택하세요
            </div>
          )}
        </div>
      )}

      {/* ── 회의 추가 모달 ── */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="회의 추가"
        description="회의 정보를 입력하면 요약과 액션 아이템까지 정리돼요."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button onClick={save} disabled={!title.trim()}>
              저장
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="제목">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="회의 제목"
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="날짜">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="시작 시간">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="참석자 (쉼표로 구분)">
            <input
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder="나, 김교수, 팀원A"
              className={inputClass}
            />
          </Field>
          <Field label="요약">
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="회의 요약"
              rows={3}
              className={cn(inputClass, "resize-none")}
            />
          </Field>
          <Field label="액션 아이템 (한 줄에 하나씩)">
            <textarea
              value={actionItems}
              onChange={(e) => setActionItems(e.target.value)}
              placeholder={"발표자료 초안 작성\n데모 시나리오 리허설"}
              rows={3}
              className={cn(inputClass, "resize-none")}
            />
          </Field>
        </div>
      </Modal>
    </PageShell>
  );
}

// ── 상세 패널 ─────────────────────────────────────────
function MeetingDetail({
  meeting,
  onRemove,
  addTodo,
}: {
  meeting: Meeting;
  onRemove: (id: string) => void;
  addTodo: (t: { title: string; priority: "mid"; status: "todo" }) => void;
}) {
  return (
    <div className="elevated space-y-6 rounded-2xl border border-border p-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-foreground">
            {meeting.title}
          </h2>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-4" />
            {fmtDate(meeting.start)} · {fmtTime(meeting.start)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label="회의 삭제"
          onClick={() => onRemove(meeting.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* 참석자 */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <UserRound className="size-4 text-muted-foreground" />
          참석자
        </h3>
        {meeting.participants.length ? (
          <div className="flex flex-wrap gap-2">
            {meeting.participants.map((p, i) => (
              <Badge key={`${p}-${i}`} variant="muted">
                <UserRound className="size-3" />
                {p}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">참석자가 없습니다</p>
        )}
      </section>

      {/* 요약 */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <FileText className="size-4 text-muted-foreground" />
          요약
        </h3>
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
          {meeting.summary?.trim() || (
            <span className="text-muted-foreground">요약이 없습니다</span>
          )}
        </div>
      </section>

      {/* 액션 아이템 */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <ListChecks className="size-4 text-muted-foreground" />
          액션 아이템
        </h3>
        {meeting.actionItems?.length ? (
          <ul className="flex flex-col gap-1.5">
            {meeting.actionItems.map((item, i) => (
              <ActionItemRow
                key={`${item}-${i}`}
                item={item}
                addTodo={addTodo}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">액션 아이템이 없습니다</p>
        )}
      </section>
    </div>
  );
}

// ── 액션 아이템 행 (→ 할 일 변환) ──────────────────────
function ActionItemRow({
  item,
  addTodo,
}: {
  item: string;
  addTodo: (t: { title: string; priority: "mid"; status: "todo" }) => void;
}) {
  const [added, setAdded] = React.useState(false);

  const handleAdd = () => {
    addTodo({ title: item, priority: "mid", status: "todo" });
    setAdded(true);
  };

  return (
    <li className="flex items-center gap-3 rounded-lg border border-transparent p-3 transition-colors hover:border-border hover:bg-accent">
      <span
        className={cn(
          "size-2.5 shrink-0 rounded-full",
          added ? "bg-primary" : "border border-border bg-muted"
        )}
        aria-hidden
      />
      <span className="flex-1 text-sm text-foreground">{item}</span>
      <Button
        size="sm"
        variant="outline"
        disabled={added}
        onClick={handleAdd}
      >
        {added ? (
          <>
            <CheckCircle2 className="size-4" />
            추가됨
          </>
        ) : (
          <>
            <Plus className="size-4" />
            할 일로 추가
          </>
        )}
      </Button>
    </li>
  );
}
