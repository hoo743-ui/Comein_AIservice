"use client";

import * as React from "react";
import { CalendarDays, CalendarPlus, Check, Contact as ContactIcon, Mail, Phone, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/store";
import {
  fetchGoogleContacts,
  fetchGoogleEvents,
  GOOGLE_SCOPES,
  getGoogleToken,
  googleConfigured,
} from "@/lib/google";
import { PageShell } from "@/components/workspace/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/modal";
import type { Connections, Contact } from "@/lib/types";

const CONNECTIONS: { key: keyof Connections; name: string; desc: string; dot: string }[] = [
  { key: "googleCalendar", name: "Google Calendar", desc: "일정 양방향 동기화", dot: "bg-[#4285F4]" },
  { key: "googleContacts", name: "Google Contacts", desc: "연락처 가져오기", dot: "bg-[#34A853]" },
  { key: "outlook", name: "Outlook", desc: "메일·일정·연락처", dot: "bg-[#0078D4]" },
];

const SOURCE_LABEL: Record<Contact["source"], string> = {
  google: "Google",
  outlook: "Outlook",
  manual: "직접",
};

export default function ContactsPage() {
  const contacts = useWorkspace((s) => s.contacts);
  const connections = useWorkspace((s) => s.connections);
  const toggleConnection = useWorkspace((s) => s.toggleConnection);
  const setConnection = useWorkspace((s) => s.setConnection);
  const addContact = useWorkspace((s) => s.addContact);
  const addSchedule = useWorkspace((s) => s.addSchedule);

  const [query, setQuery] = React.useState("");
  const [added, setAdded] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // 실제 Google 연동(브라우저 OAuth). 키 없으면 데모 토글로 폴백.
  const connectGoogle = async (key: "googleCalendar" | "googleContacts") => {
    setError(null);
    setBusy(key);
    try {
      if (key === "googleCalendar") {
        const token = await getGoogleToken(GOOGLE_SCOPES.calendar);
        const events = await fetchGoogleEvents(token);
        events.forEach((e) => {
          if (e.start) {
            addSchedule({ title: e.title, start: e.start, end: e.end, location: e.location, status: "confirmed" });
          }
        });
      } else {
        const token = await getGoogleToken(GOOGLE_SCOPES.contacts);
        const list = await fetchGoogleContacts(token);
        list.forEach((c) => addContact({ name: c.name, email: c.email, phone: c.phone, org: c.org, source: "google" }));
      }
      setConnection(key, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "연동에 실패했어요");
    } finally {
      setBusy(null);
    }
  };

  const onConnect = (key: keyof Connections) => {
    const on = connections[key];
    if (googleConfigured && (key === "googleCalendar" || key === "googleContacts") && !on) {
      void connectGoogle(key);
    } else {
      toggleConnection(key); // 데모 토글 / 연결 해제
    }
  };

  const filtered = contacts.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.org ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  const schedule = (c: Contact) => {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(15, 0, 0, 0);
    addSchedule({
      title: `${c.name}님과 미팅`,
      start: start.toISOString(),
      end: new Date(+start + 60 * 60 * 1000).toISOString(),
      status: "pending",
    });
    setAdded((s) => new Set(s).add(c.id));
  };

  return (
    <PageShell
      title="Contacts"
      subtitle="연동된 캘린더·연락처 (데모 데이터)"
      icon={<ContactIcon className="size-5" />}
    >
      {/* 연동 상태 */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-foreground">연동</h2>
          <span className="text-xs text-muted-foreground">
            {googleConfigured ? "Google 실연동 활성 (OAuth)" : "데모 모드 · Client ID 설정 시 실연동"}
          </span>
        </div>
        {error && (
          <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          {CONNECTIONS.map((c) => {
            const on = connections[c.key];
            return (
              <div key={c.key} className="elevated flex items-center justify-between gap-3 rounded-2xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <span className={cn("flex size-9 items-center justify-center rounded-xl text-white", c.dot)}>
                    <CalendarDays className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.desc}</p>
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={on}
                  disabled={busy === c.key}
                  onClick={() => onConnect(c.key)}
                  className={cn(
                    "inline-flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors disabled:opacity-60",
                    on ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "size-5 rounded-full bg-white shadow transition-transform",
                      busy === c.key && "animate-pulse",
                      on ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 연락처 */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            연락처 <span className="text-sm font-normal text-muted-foreground">({contacts.length})</span>
          </h2>
          <div className="flex w-64 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름·소속·이메일 검색"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <div key={c.id} className="elevated flex flex-col gap-3 rounded-2xl border border-border p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full brand-gradient text-sm font-semibold text-white">
                  {c.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                    <Badge variant="muted">{SOURCE_LABEL[c.source]}</Badge>
                  </div>
                  {c.org && <p className="truncate text-xs text-muted-foreground">{c.org}</p>}
                </div>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                {c.email && (
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail className="size-3.5 shrink-0" />
                    {c.email}
                  </p>
                )}
                {c.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="size-3.5 shrink-0" />
                    {c.phone}
                  </p>
                )}
              </div>

              <Button
                variant={added.has(c.id) ? "secondary" : "outline"}
                size="sm"
                className="mt-1 w-full"
                onClick={() => schedule(c)}
                disabled={added.has(c.id)}
              >
                {added.has(c.id) ? (
                  <>
                    <Check className="size-4" />약속 추가됨
                  </>
                ) : (
                  <>
                    <CalendarPlus className="size-4" />약속 잡기
                  </>
                )}
              </Button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              검색 결과가 없어요
            </p>
          )}
        </div>
      </section>
    </PageShell>
  );
}
