"use client";

import * as React from "react";
import { NotebookPen, Plus, Search, Tag, Trash2, X } from "lucide-react";

import { PageShell } from "@/components/workspace/page-shell";
import { Modal, Field, inputClass } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/lib/store";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function MemoPage() {
  const memos = useWorkspace((s) => s.memos);
  const addMemo = useWorkspace((s) => s.addMemo);
  const removeMemo = useWorkspace((s) => s.removeMemo);

  const [query, setQuery] = React.useState("");
  const [activeTag, setActiveTag] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  // Add form state
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [tagsInput, setTagsInput] = React.useState("");

  // 모든 메모에서 유니크 태그 추출
  const allTags = React.useMemo(() => {
    const set = new Set<string>();
    for (const m of memos) for (const t of m.tags) set.add(t);
    return Array.from(set);
  }, [memos]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return memos.filter((m) => {
      const tagOk = !activeTag || m.tags.includes(activeTag);
      const searchOk =
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q);
      return tagOk && searchOk;
    });
  }, [memos, query, activeTag]);

  function openAdd() {
    setTitle("");
    setContent("");
    setTagsInput("");
    setOpen(true);
  }

  function save() {
    const t = title.trim();
    const c = content.trim();
    if (!t && !c) return;
    const tags = tagsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    addMemo({ title: t || "무제", content: c, tags });
    setOpen(false);
  }

  return (
    <PageShell
      title="Memo"
      subtitle="생각과 아이디어를 AI가 정리·태깅"
      icon={<NotebookPen className="size-5" />}
      action={
        <Button onClick={openAdd}>
          <Plus className="size-4" />
          메모 작성
        </Button>
      }
    >
      {/* 툴바: 검색 + 태그 필터 */}
      <div className="mb-6 space-y-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목·내용 검색"
            className={cn(inputClass, "pl-9")}
          />
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Tag className="size-3.5" />
              태그
            </span>
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                activeTag === null
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              전체
            </button>
            {allTags.map((tag) => {
              const active = activeTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag(active ? null : tag)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 메모 그리드 (CSS multi-column 마소니) */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-muted-foreground">
          <span className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card">
            <NotebookPen className="size-6" />
          </span>
          <p className="text-sm">
            {memos.length === 0
              ? "아직 메모가 없어요. 첫 메모를 작성해 보세요."
              : "조건에 맞는 메모가 없어요."}
          </p>
          {memos.length === 0 && (
            <Button variant="outline" size="sm" onClick={openAdd}>
              <Plus className="size-4" />
              메모 작성
            </Button>
          )}
        </div>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
          {filtered.map((m) => (
            <article
              key={m.id}
              className="group mb-4 break-inside-avoid elevated rounded-xl border border-border p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-snug text-foreground">
                  {m.title}
                </h3>
                <button
                  type="button"
                  aria-label="메모 삭제"
                  onClick={() => removeMemo(m.id)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              {m.content && (
                <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {m.content}
                </p>
              )}

              {m.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {m.tags.map((t) => (
                    <Badge key={t} variant="muted">
                      #{t}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="mt-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                {fmtDate(m.createdAt)}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* 작성 모달 */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="메모 작성"
        description="생각을 남기면 태그로 정리돼요."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              <X className="size-4" />
              취소
            </Button>
            <Button onClick={save}>저장</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="제목">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="메모 제목"
              className={inputClass}
              autoFocus
            />
          </Field>
          <Field label="내용">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="떠오른 생각을 자유롭게 적어 보세요"
              className={cn(inputClass, "min-h-32 resize-y")}
            />
          </Field>
          <Field label="태그">
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="쉼표로 구분 (예: 기획, UX, 리서치)"
              className={inputClass}
            />
          </Field>
        </div>
      </Modal>
    </PageShell>
  );
}
