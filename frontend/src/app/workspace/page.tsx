"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  Calendar,
  CheckSquare,
  Footprints,
  MapPin,
  MessageCircle,
  NotebookPen,
  Users,
} from "lucide-react";

import { useWorkspace } from "@/lib/store";
import { useHydrated } from "@/lib/use-hydrated";
import { useT } from "@/lib/i18n";
import { fmtDate, fmtTime } from "@/lib/format";
import { CURRENT_LOC, shouldLeaveNow, walkMinutes } from "@/lib/geo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Message } from "@/lib/types";

/**
 * Comein 워크스페이스 홈 — 대화가 곧 인터페이스.
 * 입력 → 메시지 전송 → 간이 인텐트로 일정/메모/할 일 생성 → 인라인 카드(확인/취소).
 */
export default function ChatHome() {
  const hydrated = useHydrated();
  const t = useT();
  const conversations = useWorkspace((s) => s.conversations);
  const activeId = useWorkspace((s) => s.activeConversationId);
  const sendMessage = useWorkspace((s) => s.sendMessage);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];
  const messages = active?.messages ?? [];

  const [text, setText] = React.useState("");
  const streamRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const submit = (value?: string) => {
    const v = (value ?? text).trim();
    if (!v) return;
    sendMessage(v);
    setText("");
  };

  return (
    <div className="flex h-full flex-col">
      {/* 상단바 */}
      <header className="glass flex h-16 items-center justify-between border-b border-border/60 px-6">
        <h1 className="truncate text-sm font-semibold text-foreground">
          {active?.title ?? "Chat"}
        </h1>
        {hydrated && (
          <span className="rounded-full border border-border/60 bg-secondary/70 px-3 py-1 text-xs font-medium text-secondary-foreground">
            {fmtDate(new Date())}
          </span>
        )}
      </header>

      {/* 대화 영역 */}
      <div ref={streamRef} className="min-h-0 flex-1 overflow-y-auto px-6">
        {messages.length === 0 ? (
          <Welcome onPick={submit} />
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-5 py-8">
            {messages.map((m) => (
              <MessageRow key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      {/* 입력창 */}
      <div className="px-6 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="elevated mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-border p-2 focus-within:ring-2 focus-within:ring-ring"
        >
          <textarea
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={t("chat.placeholder")}
            className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            aria-label="보내기"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl brand-gradient text-white shadow-soft transition-transform hover:scale-105 active:scale-95"
          >
            <ArrowUp className="size-5" />
          </button>
        </form>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {t("chat.disclaimer")}
        </p>
      </div>
    </div>
  );
}

// ── 웰컴(빈 대화) ─────────────────────────────────────
function Welcome({ onPick }: { onPick: (v: string) => void }) {
  const t = useT();
  const pills = [
    { icon: Calendar, label: "일정 잡기", hint: "내일 오후 3시 스터디", prompt: "내일 오후 3시에 스터디 일정 잡아줘" },
    { icon: NotebookPen, label: "메모하기", hint: "아이디어 정리·태깅", prompt: "메모해줘: 온보딩 문 애니메이션 개선 아이디어" },
    { icon: CheckSquare, label: "할 일", hint: "우선순위 자동 추천", prompt: "발표자료 초안 작성 할 일 추가해줘" },
    { icon: Users, label: "회의 정리", hint: "요약·액션아이템", prompt: "회의록 정리해줘" },
    { icon: MessageCircle, label: "물어보기", hint: "오늘 일정 알려줘", prompt: "오늘 일정 알려줘" },
    { icon: Calendar, label: "빈 시간 찾기", hint: "겹치지 않는 시간", prompt: "이번 주 빈 시간 찾아줘" },
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center py-6">
      <div className="animate-fade-up flex w-full max-w-2xl flex-col items-center text-center">
        <div className="relative mb-7">
          <div className="absolute inset-0 rounded-full brand-gradient opacity-50 blur-2xl" />
          <div className="orb-3d relative flex size-20 items-center justify-center rounded-full text-white">
            <MessageCircle className="size-9" />
          </div>
        </div>
        <h2 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Come <span className="text-brand-gradient">in.</span>
        </h2>
        <p className="mt-3 text-base text-muted-foreground">
          {t("chat.subtitle")}
        </p>
        <div className="mt-8 grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
          {pills.map((p) => (
            <button
              key={p.label}
              onClick={() => onPick(p.prompt)}
              className="elevated group flex flex-col items-start gap-1 rounded-xl border border-border p-3.5 text-left transition-all hover:-translate-y-1 hover:border-primary/50"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="text-primary">
                  <p.icon className="size-4" />
                </span>
                {p.label}
              </span>
              <span className="text-xs text-muted-foreground">{p.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 메시지 ─────────────────────────────────────────────
function MessageRow({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-soft">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full brand-gradient text-white">
        <MessageCircle className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="w-fit max-w-[85%] rounded-2xl rounded-tl-md border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-soft">
          {message.content}
        </div>
        {message.card && <EntityCard card={message.card} />}
      </div>
    </div>
  );
}

// ── 인라인 엔티티 카드 (차별화 UX: 확인/수정/취소) ──
function EntityCard({ card }: { card: NonNullable<Message["card"]> }) {
  const schedules = useWorkspace((s) => s.schedules);
  const todos = useWorkspace((s) => s.todos);
  const memos = useWorkspace((s) => s.memos);
  const places = useWorkspace((s) => s.places);
  const confirmSchedule = useWorkspace((s) => s.confirmSchedule);
  const removeSchedule = useWorkspace((s) => s.removeSchedule);
  const conflictsFor = useWorkspace((s) => s.conflictsFor);
  const hydrated = useHydrated();

  if (card.kind === "schedule") {
    const s = schedules.find((x) => x.id === card.id);
    if (!s) return <Dismissed>일정이 취소되었습니다.</Dismissed>;
    const conflicts = conflictsFor(s.id);
    const place = s.placeId ? places.find((p) => p.id === s.placeId) : undefined;
    const travel = place ? walkMinutes(CURRENT_LOC, place) : null;
    const leaveNow =
      place && travel !== null && hydrated
        ? shouldLeaveNow(+new Date(s.start), Date.now(), travel)
        : false;
    return (
      <div className="elevated max-w-[85%] rounded-xl border border-border p-4">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{s.title}</span>
          <Badge variant={s.status === "confirmed" ? "default" : "muted"}>
            {s.status === "confirmed" ? "확정" : "제안"}
          </Badge>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {fmtDate(s.start)} {fmtTime(s.start)}
          {s.end ? `–${fmtTime(s.end)}` : ""}
          {s.location ? ` · ${s.location}` : ""}
        </p>
        {place && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MapPin className="size-3.5" />
              {place.name}
            </span>
            {travel !== null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
                <Footprints className="size-3" />도보 {travel}분
              </span>
            )}
            {leaveNow && (
              <span className="rounded-full bg-primary/12 px-2 py-0.5 font-semibold text-primary">
                지금 출발
              </span>
            )}
          </p>
        )}
        {conflicts.length > 0 && (
          <p className="mt-2 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
            ⚠ {conflicts[0].title}와(과) 시간이 겹칩니다.
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          {s.status === "pending" && (
            <>
              <Button size="sm" onClick={() => confirmSchedule(s.id)}>
                확인
              </Button>
              <Button size="sm" variant="ghost" onClick={() => removeSchedule(s.id)}>
                취소
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" asChild className="ml-auto">
            <Link href="/workspace/calendar">
              캘린더 <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (card.kind === "todo") {
    const t = todos.find((x) => x.id === card.id);
    if (!t) return <Dismissed>할 일이 삭제되었습니다.</Dismissed>;
    return (
      <div className="max-w-[85%] rounded-xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2">
          <CheckSquare className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{t.title}</span>
          <Badge variant={t.priority}>
            {t.priority === "high" ? "높음" : t.priority === "mid" ? "보통" : "낮음"}
          </Badge>
        </div>
        <div className="mt-3">
          <Button size="sm" variant="outline" asChild>
            <Link href="/workspace/todo">
              Todo 보드 <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const m = memos.find((x) => x.id === card.id);
  if (!m) return <Dismissed>메모가 삭제되었습니다.</Dismissed>;
  return (
    <div className="max-w-[85%] rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <NotebookPen className="size-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">{m.title}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {m.tags.map((tag) => (
          <Badge key={tag} variant="muted">
            #{tag}
          </Badge>
        ))}
      </div>
      <div className="mt-3">
        <Button size="sm" variant="outline" asChild>
          <Link href="/workspace/memo">
            메모 보기 <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Dismissed({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[85%] rounded-xl border border-dashed border-border px-4 py-2 text-xs text-muted-foreground">
      {children}
    </div>
  );
}
