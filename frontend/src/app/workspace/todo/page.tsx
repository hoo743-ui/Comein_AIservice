"use client";

import * as React from "react";
import {
  CheckSquare,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Flag,
  Circle,
  Clock,
  CheckCircle2,
} from "lucide-react";

import { useWorkspace } from "@/lib/store";
import type { Todo, TodoStatus, TodoPriority } from "@/lib/types";
import { PageShell } from "@/components/workspace/page-shell";
import { Modal, Field, inputClass } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { dueLabel, fmtDateShort } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

// ── 컬럼 정의 ──────────────────────────────────────────
const COLUMNS: { status: TodoStatus; label: string; icon: React.ReactNode }[] = [
  { status: "todo", label: "할 일", icon: <Circle className="size-4" /> },
  { status: "doing", label: "진행 중", icon: <Clock className="size-4" /> },
  { status: "done", label: "완료", icon: <CheckCircle2 className="size-4" /> },
];

const STATUS_ORDER: TodoStatus[] = ["todo", "doing", "done"];

const PRIORITY_META: Record<
  TodoPriority,
  { label: string; variant: "high" | "mid" | "low" }
> = {
  high: { label: "높음", variant: "high" },
  mid: { label: "보통", variant: "mid" },
  low: { label: "낮음", variant: "low" },
};

export default function TodoPage() {
  const todos = useWorkspace((s) => s.todos);
  const addTodo = useWorkspace((s) => s.addTodo);
  const moveTodo = useWorkspace((s) => s.moveTodo);
  const removeTodo = useWorkspace((s) => s.removeTodo);
  const updateTodo = useWorkspace((s) => s.updateTodo);

  const hydrated = useHydrated();
  const base = hydrated ? new Date() : new Date(2026, 6, 8);

  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [priority, setPriority] = React.useState<TodoPriority>("mid");
  const [due, setDue] = React.useState("");

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const editing = editingId
    ? todos.find((t) => t.id === editingId) ?? null
    : null;

  const openAdd = () => {
    setTitle("");
    setPriority("mid");
    setDue("");
    setOpen(true);
  };

  const save = () => {
    const t = title.trim();
    if (!t) return;
    addTodo({
      title: t,
      priority,
      status: "todo",
      ...(due ? { due } : {}),
    });
    setOpen(false);
  };

  return (
    <PageShell
      title="Todo"
      subtitle="할 일 생성 및 우선순위 관리"
      icon={<CheckSquare className="size-5" />}
      action={
        <Button onClick={openAdd}>
          <Plus className="size-4" />
          할 일 추가
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = todos.filter((t) => t.status === col.status);
          return (
            <section
              key={col.status}
              className="flex flex-col rounded-2xl border border-border bg-muted/40 p-3.5"
            >
              <div className="mb-3.5 flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-[0.9375rem] font-semibold text-foreground">
                  <span className="text-muted-foreground">{col.icon}</span>
                  {col.label}
                </div>
                <Badge variant="muted">{items.length}</Badge>
              </div>

              <div className="space-y-3">
                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/70 px-3 py-10 text-center text-xs text-muted-foreground">
                    비어 있어요
                  </p>
                ) : (
                  items.map((todo) => (
                    <TodoCard
                      key={todo.id}
                      todo={todo}
                      base={base}
                      hydrated={hydrated}
                      onMove={moveTodo}
                      onRemove={removeTodo}
                      onOpen={() => setEditingId(todo.id)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="할 일 추가"
        description="새 할 일을 만들고 우선순위를 정하세요."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button onClick={save} disabled={!title.trim()}>
              추가
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
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
              placeholder="할 일을 입력하세요"
              className={inputClass}
            />
          </Field>
          <Field label="우선순위">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TodoPriority)}
              className={inputClass}
            >
              <option value="high">높음</option>
              <option value="mid">보통</option>
              <option value="low">낮음</option>
            </select>
          </Field>
          <Field label="마감일">
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditingId(null)}
        title="할 일 편집"
        description="할 일의 세부 정보를 확인하고 수정하세요."
        footer={
          <>
            <Button
              variant="destructive"
              onClick={() => {
                if (editing) removeTodo(editing.id);
                setEditingId(null);
              }}
            >
              <Trash2 className="size-4" />
              삭제
            </Button>
            <Button variant="ghost" onClick={() => setEditingId(null)}>
              닫기
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <Field label="제목">
              <input
                value={editing.title}
                onChange={(e) =>
                  updateTodo(editing.id, { title: e.target.value })
                }
                placeholder="할 일을 입력하세요"
                className={inputClass}
              />
            </Field>
            <Field label="우선순위">
              <select
                value={editing.priority}
                onChange={(e) =>
                  updateTodo(editing.id, {
                    priority: e.target.value as TodoPriority,
                  })
                }
                className={inputClass}
              >
                <option value="high">높음</option>
                <option value="mid">보통</option>
                <option value="low">낮음</option>
              </select>
            </Field>
            <Field label="상태">
              <select
                value={editing.status}
                onChange={(e) =>
                  updateTodo(editing.id, {
                    status: e.target.value as TodoStatus,
                  })
                }
                className={inputClass}
              >
                <option value="todo">할 일</option>
                <option value="doing">진행 중</option>
                <option value="done">완료</option>
              </select>
            </Field>
            <Field label="마감일">
              <input
                type="date"
                value={editing.due ?? ""}
                onChange={(e) =>
                  updateTodo(editing.id, { due: e.target.value || undefined })
                }
                className={inputClass}
              />
            </Field>
          </div>
        )}
      </Modal>
    </PageShell>
  );
}

// ── 카드 ───────────────────────────────────────────────
function TodoCard({
  todo,
  base,
  hydrated,
  onMove,
  onRemove,
  onOpen,
}: {
  todo: Todo;
  base: Date;
  hydrated: boolean;
  onMove: (id: string, status: TodoStatus) => void;
  onRemove: (id: string) => void;
  onOpen: () => void;
}) {
  const idx = STATUS_ORDER.indexOf(todo.status);
  const done = todo.status === "done";
  const prio = PRIORITY_META[todo.priority];
  const dueChip = todo.due
    ? hydrated
      ? dueLabel(todo.due, base)
      : fmtDateShort(todo.due)
    : "";
  const overdue = todo.due
    ? dueLabel(todo.due, base).endsWith("지남")
    : false;

  return (
    <article className="elevated rounded-xl border border-border p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/40">
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        aria-label={`${todo.title} 편집`}
        className="w-full cursor-pointer rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p
          className={cn(
            "text-sm font-medium text-foreground",
            done && "text-muted-foreground line-through"
          )}
        >
          {todo.title}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant={prio.variant}>
            <Flag className="size-3" />
            {prio.label}
          </Badge>
          {dueChip && (
            <Badge variant={overdue && !done ? "high" : "outline"}>
              <Clock className="size-3" />
              {dueChip}
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="이전 단계로 이동"
            disabled={idx <= 0}
            onClick={(e) => {
              e.stopPropagation();
              onMove(todo.id, STATUS_ORDER[idx - 1]);
            }}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="다음 단계로 이동"
            disabled={idx >= STATUS_ORDER.length - 1}
            onClick={(e) => {
              e.stopPropagation();
              onMove(todo.id, STATUS_ORDER[idx + 1]);
            }}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          aria-label="삭제"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(todo.id);
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </article>
  );
}
