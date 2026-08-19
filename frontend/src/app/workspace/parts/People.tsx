"use client";

/**
 * Comein · 사람, 그리고 그 사람과의 자리.
 *
 * 여기서 '사람'은 연락처가 아니다. 일정으로 이어진 관계이고, 그래서 한 사람을 고르면
 * 나눈 말과 함께하는 일정이 한 화면에 선다(PersonPanel).
 *
 * 지어낸 이름은 이 목록에 들어오지 않는다 — @핸들로 찾은 실재하는 계정뿐이고,
 * 즉시 잇지도 않는다. 청하고, 상대가 받아야 이어진다(0013).
 *
 * AI 는 여기서 조용히 듣는다: 시간 이야기가 오갈 때만 후보를 한 줄 권하고,
 * 정말로 정해졌을 때만 정리한다. 그 판단은 `@/lib/conversation` 이 이미 갖고 있다.
 */

import * as React from "react";
import { CalendarDays, MoreHorizontal, Search, Users, X } from "lucide-react";

import { suggestionLine, summarize, type AnalysisOutcome } from "@/lib/conversation";
import { fmtDate, fmtTime } from "@/lib/format";
import {
  ME_ID,
  type ChatMessage, type ConnectionRequest, type Contact,
  type EventParticipant, type Schedule,
} from "@/lib/types";
import { ChatThread } from "./Chat";
import { chatStamp } from "../chatTime";
import { L, type Lang } from "../i18n";

export function NewRoomPanel({ contacts, lang, onClose, onCreate }: {
  contacts: Contact[];
  lang: Lang;
  onClose: () => void;
  onCreate: (peerIds: string[], title: string | null, start: Date) => void;
}) {
  const en = lang === "en";
  const [title, setTitle] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [q, setQ] = React.useState("");
  const titleRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setMinutes(0, 0, 0);
    // 여기도 같은 이유로 — 새벽 시각을 기본값으로 권하지 않는다.
    if (d.getHours() < 8 || d.getHours() > 20) d.setHours(10, 0, 0, 0);
    const p = (n: number) => String(n).padStart(2, "0");
    setDate(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    setTime(`${p(d.getHours())}:00`);
    titleRef.current?.focus();
  }, []);

  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const ql = q.trim().toLowerCase();
  const shown = ql ? contacts.filter((c) => [c.name, c.org].filter(Boolean).some((v) => (v as string).toLowerCase().includes(ql))) : contacts;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // 이름은 나중 일이다. 비워 두면 부모가 짓는다 — 같은 사람들과 이미 쓰는 이름을 피해서
    // (여기서 지으면 그 사람들과 어떤 자리가 이미 있는지 이 폼은 알지 못한다).
    if (!picked.length || !date || !time) return;
    const [y, mo, da] = date.split("-").map(Number);
    const [hh, mi] = time.split(":").map(Number);
    onCreate(picked, title.trim() || null, new Date(y, mo - 1, da, hh, mi, 0, 0));
  };

  return (
    <aside className="rmg-evpanel" role="region" aria-label={en ? "New event" : "새 자리"}>
      <div className="rmg-drawer-head">
        <div className="rmg-drawer-when">
          <p className="rmg-drawer-title">{en ? "New event" : "새 자리"}</p>
          <p className="rmg-drawer-time">{en ? "Everyone here gets the room too." : "부른 사람들이 곧 이 자리의 대화 상대가 됩니다"}</p>
        </div>
        <button type="button" className="rmg-panel-close" onClick={onClose} aria-label={en ? "Close" : "닫기"}>
          <X className="rmg-notif-ic" />
        </button>
      </div>

      <form className="rmg-newroom" onSubmit={submit}>
        <input
          ref={titleRef}
          className="rmg-newev-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={en ? "Name it later — optional" : "이름은 나중에 — 비워 둬도 됩니다"}
          aria-label={en ? "Title" : "제목"}
        />
        <div className="rmg-newev-when">
          <input type="date" className="rmg-newev-in" value={date} onChange={(e) => setDate(e.target.value)} aria-label={en ? "Date" : "날짜"} />
          <input type="time" className="rmg-newev-in" value={time} onChange={(e) => setTime(e.target.value)} aria-label={en ? "Time" : "시각"} />
        </div>

        <p className="rmg-eyebrow rmg-drawer-eye">
          {en ? `With ${picked.length}` : `함께할 사람 ${picked.length}명`}
        </p>
        <div className="rmg-ppl-search rmg-newroom-search">
          <Search className="rmg-ppl-searchic" />
          <input className="rmg-ppl-searchin" value={q} onChange={(e) => setQ(e.target.value)} placeholder={en ? "Search" : "이름으로 찾기"} aria-label={en ? "Search" : "찾기"} />
        </div>
        <div className="rmg-newroom-picks">
          {shown.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`rmg-newroom-chip ${picked.includes(c.id) ? "on" : ""}`}
              aria-pressed={picked.includes(c.id)}
              onClick={() => toggle(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="rmg-newev-acts">
          <button type="button" className="rmg-ppl-act" onClick={onClose}>{en ? "Cancel" : "취소"}</button>
          <button type="submit" className="rmg-ppl-act primary" disabled={picked.length === 0}>
            {en ? "Create" : "만들기"}
          </button>
        </div>
      </form>
    </aside>
  );
}

/** 고른 사람에 대한 모든 것 — 오른쪽 칸의 주인.
 *
 *  세 자리로 나뉜다. 처음 맞이하는 건 '요약'(overview) 이다 — 그 사람과 나 사이에
 *  무엇이 있는지(대화·일정·메모·자취)를 아주 가벼운 글줄로만 보여 준다. 카드로 만들지 않는다.
 *  거기서 대화로 들어가면 그때 이 칸이 대화 화면이 된다. 메신저가 먼저 오지 않는다 —
 *  Comein 에서 대화는 목적이 아니라 일정·메모로 이어지는 통로다. */
export function PersonPanel({ person, messages, sharedEvents, participantsOf, myName, lang, focusChat, onClose, onSend, onOpenEvent, onCreateEvent, onEditMessage, onDeleteMessage, outcome, onAnswerSuggestion }: {
  person: Contact;
  messages: ChatMessage[];
  sharedEvents: Schedule[];
  participantsOf: (id: string) => EventParticipant[];
  myName: string;
  lang: Lang;
  focusChat: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
  onOpenEvent: (eventId: string) => void;
  /** 이름을 모르면 null 을 넘긴다 — 짓는 일은 부모가 한곳에서 한다. */
  onCreateEvent: (title: string | null, start: Date) => void;
  /** 내 말 고치기·지우기 */
  onEditMessage?: (id: string, text: string) => void;
  onDeleteMessage?: (id: string) => void;
  /** 대화 엔진이 읽어 낸 결과. 계산은 이 컴포넌트 밖에서 끝났다(§39). */
  outcome: AnalysisOutcome | null;
  /** 사람이 제안에 답했다 — 저장은 부모가 한다. */
  onAnswerSuggestion: (key: string, verdict: "accepted" | "dismissed") => void;
}) {
  const en = lang === "en";

  // 새 자리 만들기 — 기본값은 '내일 이 시간쯤'. 빈 칸부터 채우게 하지 않는다.
  const [creating, setCreating] = React.useState(false);
  // 칩 줄은 셋까지만 — 더 있으면 눌러서 편다. 목록이 대화를 밀어내지 않게.
  const [showAllEvents, setShowAllEvents] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newDate, setNewDate] = React.useState("");
  const [newTime, setNewTime] = React.useState("");
  const newTitleRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!creating) return;
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setMinutes(0, 0, 0);
    // '내일 이 시간쯤' 이 기본이되, 사람이 만나지 않는 시각은 권하지 않는다.
    // 새벽 두 시에 자리를 만들면 '내일 새벽 두 시' 가 기본값으로 앉는다 —
    // 규칙으로는 맞지만 아무도 그 시각에 만나지 않는다(실제로 00:00 이 떠 있었다).
    if (d.getHours() < 8 || d.getHours() > 20) d.setHours(10, 0, 0, 0);
    const p = (n: number) => String(n).padStart(2, "0");
    setNewDate(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    setNewTime(`${p(d.getHours())}:00`);
    newTitleRef.current?.focus();
  }, [creating]);

  const submitNew = (e: React.FormEvent) => {
    e.preventDefault();
    // 이름은 비워 둘 수 있다 — 무슨 얘기를 할지 아직 모르는 자리에 이름부터 요구하지 않는다.
    // 비면 함께하는 사람으로 부르고, 이야기가 쌓이면 AI 가 다시 권한다.
    const title = newTitle.trim() || (en ? `With ${person.name}` : `${person.name}님과의 자리`);
    if (!newDate || !newTime) return;
    const [y, mo, da] = newDate.split("-").map(Number);
    const [hh, mi] = newTime.split(":").map(Number);
    setCreating(false);
    setNewTitle("");
    onCreateEvent(title, new Date(y, mo - 1, da, hh, mi, 0, 0));
  };

  // 더보기 — 늘 펼쳐 두지 않는다. 이 사람에게 할 수 있는 일은 둘뿐이라 메뉴도 두 줄이다.
  const [menu, setMenu] = React.useState(false);
  React.useEffect(() => { setMenu(false); }, [person.id]);
  // 바깥을 누르면 닫힌다. 보이지 않는 면(scrim)을 깔아 두지 않는다 —
  // 이 칸은 이제 자기 폭을 기준으로 접히는 컨테이너라, 그 안의 fixed 면은
  // 화면 전체가 아니라 이 칸까지만 덮는다(왼쪽 목록을 눌러도 메뉴가 안 닫혔다).
  React.useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  // 대화가 무엇을 하려는지는 엔진이 읽고, 그 결과를 워크스페이스가 서버에 앉힌 뒤
  // 여기로 내려보낸다. 이 컴포넌트는 그리기만 한다 — 파싱도 API 호출도 하지 않는다(§39).
  const suggestion = outcome?.suggestion ?? null;
  /** 이 대화에 정리할 것이 있는가. 없으면 null 이고, 없는 편이 흔하다(§20). */
  const outcomeSummary = React.useMemo(
    () => (outcome ? summarize({ memory: outcome.memory, participants: [myName, person.name], now: new Date(), en }) : null),
    [outcome, myName, person.name, en],
  );

  const last = messages.length ? messages[messages.length - 1] : undefined;
  // 최근 활동 — 마지막 말과 가장 가까운 자리 중 더 최근인 쪽 하나만.
  const recentEvent = [...sharedEvents].sort((a, b) => +new Date(b.start) - +new Date(a.start))[0];
  const recent = (() => {
    const mAt = last ? +new Date(last.createdAt) : 0;
    const eAt = recentEvent ? +new Date(recentEvent.start) : 0;
    if (!mAt && !eAt) return null;
    return mAt >= eAt
      ? (en ? `Last message · ${fmtDate(new Date(last!.createdAt))}` : `마지막 대화 · ${fmtDate(new Date(last!.createdAt))}`)
      : (en ? `${recentEvent.title} · ${fmtDate(new Date(recentEvent.start))}` : `${recentEvent.title} · ${fmtDate(new Date(recentEvent.start))}`);
  })();

  return (
    <aside className="rmg-evpanel rmg-ppanel" data-tour="person" role="region" aria-label={person.name}>
      {/* 돌아갈 길. 방만 덜렁 바뀌면 길을 잃는다.
          좁은 폭에서는 목록이 접혀 있으므로 요약에서도 '사람' 으로 돌아갈 길이 있어야 한다 —
          없으면 사람을 한 번 고른 뒤 목록으로 되돌아갈 방법이 사라진다(막다른 길이었다). */}
      <button type="button" className="rmg-evback rmg-backlist" onClick={onClose}>
        ‹ {en ? "People" : "사람"}
      </button>

      {/* 머리 — 얼굴 · 이름 · 핸들, 그리고 아주 작은 더보기.
          닫기 버튼은 두지 않는다: 목록에서 그 사람을 한 번 더 누르면 닫힌다. */}
      <div className="rmg-phead">
        <span className="rmg-phead-av" aria-hidden>{person.name?.slice(0, 1) ?? "·"}</span>
        <span className="rmg-phead-id">
          <span className="rmg-phead-name">{person.name}</span>
          {person.handle && <span className="rmg-phead-handle">@{person.handle}</span>}
        </span>
        <div className="rmg-phead-more">
          <button
            type="button"
            className="rmg-phead-morebtn"
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label={en ? "More" : "더보기"}
            onClick={(e) => { e.stopPropagation(); setMenu((v) => !v); }}
          >
            <MoreHorizontal className="rmg-phead-moreic" />
          </button>
          {menu && (
            <div className="rmg-phead-menu" role="menu" onClick={(e) => e.stopPropagation()}>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); setCreating(true); }}>
                {en ? "New event together" : "함께 일정 만들기"}
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); onClose(); }}>
                {en ? "Clear selection" : "선택 해제"}
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="rmg-phair" aria-hidden />

      {/* 함께하는 일정 — 갈래를 만들지 않고 대화 위에 한 줄로 눕힌다.
          예전엔 요약·대화·일정·메모·최근활동 다섯 자리가 탭 뒤에 흩어져 있었는데,
          그중 메모는 늘 "없습니다"(기능이 없다) 였고 최근활동은 위 두 줄을 다시 쓴 것이었다.
          남는 건 대화와 일정 둘뿐이라, 둘을 한 화면에 세우면 탭이 필요 없어진다. */}
      {(sharedEvents.length > 0 || creating) && (
        <div className="rmg-pwith">
          <p className="rmg-pwith-k">{en ? "Together" : "함께하는 일정"}</p>
          <div className="rmg-pwith-row">
            {(showAllEvents ? sharedEvents : sharedEvents.slice(0, 3)).map((s2: Schedule) => (
              <button
                key={s2.id}
                type="button"
                className="rmg-pwith-chip"
                data-tour="sharedevent"
                onClick={() => onOpenEvent(s2.id)}
                title={`${fmtDate(new Date(s2.start))} · ${fmtTime(new Date(s2.start))}`}
              >
                <span className="rmg-pwith-t">{s2.title}</span>
                <span className="rmg-pwith-at">{fmtTime(new Date(s2.start))}</span>
              </button>
            ))}
            {!showAllEvents && sharedEvents.length > 3 && (
              <button type="button" className="rmg-pwith-more" onClick={() => setShowAllEvents(true)}>
                {en ? `+${sharedEvents.length - 3}` : `외 ${sharedEvents.length - 3}`}
              </button>
            )}
            {!creating && (
              <button type="button" className="rmg-pwith-new" onClick={() => setCreating(true)}>
                {en ? "+ New" : "+ 만들기"}
              </button>
            )}
          </div>

          {/* 새 자리 — 칩 줄 바로 아래에서 열린다. 다른 화면으로 옮겨 가지 않는다. */}
          {creating && (
            <form className="rmg-newev" onSubmit={submitNew}>
              <input
                ref={newTitleRef}
                className="rmg-newev-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={en ? "Name it later — optional" : "이름은 나중에 — 비워 둬도 됩니다"}
                aria-label={en ? "Title" : "제목"}
              />
              <div className="rmg-newev-when">
                <input type="date" className="rmg-newev-in" value={newDate} onChange={(e) => setNewDate(e.target.value)} aria-label={en ? "Date" : "날짜"} />
                <input type="time" className="rmg-newev-in" value={newTime} onChange={(e) => setNewTime(e.target.value)} aria-label={en ? "Time" : "시각"} />
              </div>
              <p className="rmg-newev-who">
                {en ? `With ${person.name}` : `${person.name}님과 함께 · 참여자는 만든 뒤에 더 부를 수 있어요`}
              </p>
              <div className="rmg-newev-acts">
                <button type="button" className="rmg-ppl-act" onClick={() => setCreating(false)}>{en ? "Cancel" : "취소"}</button>
                <button type="submit" className="rmg-ppl-act primary">{en ? "Create" : "만들기"}</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 아직 함께한 자리가 없을 때 — 빈 목록을 그리는 대신 한 줄로 권한다. */}
      {sharedEvents.length === 0 && !creating && (
        <button type="button" className="rmg-pwith-empty" onClick={() => setCreating(true)}>
          + {en ? `New event with ${person.name}` : `${person.name}님과 함께할 자리 만들기`}
        </button>
      )}

      {/* 결론이 났으면 그것만 한 겹 — 조율 중이거나 잡담이면 아무것도 서지 않는다. */}
      {outcomeSummary && (
        <section className="rmg-sum" aria-label={en ? "Outcome" : "대화 정리"}>
          <p className="rmg-sum-h">{outcomeSummary.headline}</p>
          {outcomeSummary.lines.map((l) => (
            <p key={l} className="rmg-sum-l">{l}</p>
          ))}
          {outcomeSummary.actionable && outcomeSummary.start && (
            <button
              type="button"
              className="rmg-pov-cta rmg-sum-cta"
              onClick={() => onCreateEvent(null, new Date(outcomeSummary.start!))}
            >
              {en ? "Add to calendar" : "캘린더에 추가"}
            </button>
          )}
        </section>
      )}

        <div className="rmg-drawer-chat rmg-drawer-chat-solo">
          <ChatThread
            messages={messages}
            nameOf={() => person.name}
            myName={myName}
            placeholder={en ? `Message ${person.name}…` : `${person.name}님에게…`}
            focus={focusChat}
            lang={lang}
            onSend={onSend}
            onEditMessage={onEditMessage}
            onDeleteMessage={onDeleteMessage}
            context={
              suggestion && (
                // 대화가 일정으로 건너가는 자리 — 얇은 한 줄. 권할 뿐 가로막지 않는다.
                // AI 가 말하는 것처럼 보이지 않게, 메시지 모양을 쓰지 않는다(§14).
                // 확정은 언제나 사람이 한다 — 이 줄은 스스로 아무것도 만들지 않는다(§15).
                <div className="rmg-pctx" role="note" aria-live="polite">
                  <CalendarDays className="rmg-pctx-ic" aria-hidden />
                  <span className="rmg-pctx-t">
                    {suggestion.reason}
                    <em className="rmg-pctx-em">
                      {fmtDate(new Date(suggestion.start))} · {suggestionLine(suggestion, en)}
                    </em>
                  </span>
                  {/* '제안' 이라 부르지 않는다. 이 제품에서 제안은 이미 다른 기제의 이름이고
                      (schedule_proposals — 전원이 동의해야 일정이 앉는다), 이 버튼은 그 길을
                      가지 않는다. 여기서 하는 일은 같은 패널 위쪽 버튼과 **완전히 같다** —
                      달력에 자리를 세우고 상대를 부른다. 같은 일에는 같은 이름을 쓴다. */}
                  <button
                    type="button"
                    className="rmg-pctx-act"
                    onClick={() => {
                      onCreateEvent(null, new Date(suggestion.start));
                      onAnswerSuggestion(suggestion.key, "accepted");
                    }}
                  >
                    {en ? "Add to calendar" : "캘린더에 추가"}
                  </button>
                  <button
                    type="button"
                    className="rmg-pctx-x"
                    aria-label={en ? "Dismiss" : "넘어가기"}
                    onClick={() => onAnswerSuggestion(suggestion.key, "dismissed")}
                  >
                    <X className="rmg-pctx-xic" />
                  </button>
                </div>
              )
            }
          />
        </div>
    </aside>
  );
}

/** People — 연락처가 아니라 '일정으로 이어진 사람'.
 *  사람을 누르면 그 사람과 내가 함께 있는 일정이 펼쳐지고, 거기서 바로 그 일정의 대화로 들어간다.
 *  사람 → 일정 → 대화. 1:1 DM 은 만들지 않는다 — Comein 의 대화는 늘 일정에 매여 있다. */
export function PeopleView({ contacts, lang, personId, onSelectPerson, sharedEventsWith, query, onQuery, onNewRoom, onFind, onRequest, onCancelRequest, requests, requestError, outgoing, myHandle, onAnswerRequest, unreadOf, convo, openEventId, onOpenEvent }: any) {
  const t = L(lang as Lang);
  const en = lang === "en";
  // 앞의 @ 는 이름의 일부가 아니라 '핸들을 부르는 방식' 이다. 여기서 벗겨야
  // 내 목록 거르기("@fapp" 로도 fapp1004 가 걸린다)와 '두 글자' 셈이 함께 맞는다.
  const q = (query as string).trim().replace(/^@+/, "").toLowerCase();

  // ── 세 갈래 ──
  // 연락처는 '누구와 이어져 있는가', 대화는 '무슨 말이 오갔는가' 다. 서로 다른 질문이라 목록도 나눈다.
  // 탭은 버튼처럼 보이지 않는다 — 얇은 밑줄 하나로만 지금 어디를 보는지 말한다.
  type Lane = "contacts" | "dm" | "group";
  const [lane, setLane] = React.useState<Lane>("contacts");
  const dm = (convo?.dm as Map<string, { last?: ChatMessage; unread: number }>) ?? new Map();
  const groups = (convo?.groups as { id: string; title: string; count: number; last?: ChatMessage; unread: number }[]) ?? [];
  const LANES: { key: Lane; label: string; n: number }[] = [
    { key: "contacts", label: en ? "Contacts" : "연락처", n: contacts.length },
    { key: "dm", label: en ? "Direct" : "개인 채팅", n: [...dm.values()].filter((v) => v.last).length },
    { key: "group", label: en ? "Groups" : "그룹 채팅", n: groups.length },
  ];
  const preview = (m?: ChatMessage) =>
    m ? `${m.senderId === ME_ID ? (en ? "You: " : "나: ") : ""}${m.content}` : "";
  // 이름·핸들·소속 어디로든 찾는다 — "그 교수님" 을 기억하는 방식은 사람마다 다르다.
  const shown = q
    ? contacts.filter((c: any) => [c.name, c.handle, c.org].filter(Boolean).some((v: string) => v.toLowerCase().includes(q)))
    : contacts;

  // ── Comein 계정에서 찾기 ──
  // 내 목록에 없는 사람은 여기서 찾는다. 이름만 적어 넣는 방식이 아니라 실재하는 계정을
  // 고르는 방식이라, 고른 사람은 곧바로 일정에 부를 수 있고 말을 걸 수 있다.
  const [found, setFound] = React.useState<any[]>([]);
  const [finding, setFinding] = React.useState(false);
  const [joining, setJoining] = React.useState<string | null>(null);
  // 방금 청한 사람과, 서버가 돌려준 말 한 줄(거절 뒤 다시 보낸 경우 등).
  const [asked, setAsked] = React.useState<Record<string, string>>({});
  const [copied, setCopied] = React.useState(false);
  const [askErr, setAskErr] = React.useState<string | null>(null);
  /** 지금 답하고 있는 요청 · 무르고 있는 사람. 같은 것을 두 번 누르면 서버에 두 번 간다. */
  const [answering, setAnswering] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!onFind || q.length < 2) { setFound([]); setFinding(false); return; }
    // 한 글자 칠 때마다 서버에 묻지 않는다 — 손이 멈추면 그때 한 번.
    setFinding(true);
    let alive = true;
    const timer = window.setTimeout(async () => {
      const rows = await onFind(q);
      if (!alive) return;
      setFound(rows ?? []);
      setFinding(false);
    }, 280);
    return () => { alive = false; window.clearTimeout(timer); setFinding(false); window.clearTimeout(timer); };
  }, [q, onFind]);

  // 이미 내 목록에 있는 사람은 검색 결과에서 뺀다 — 같은 사람이 두 번 보이면 어느 쪽을 눌러야 할지 모른다.
  const mine = new Set(contacts.map((c: any) => c.id));
  const newcomers = found.filter((p) => !mine.has(p.id));

  /** 청한다. 이어지는 경우(상대도 보내 뒀을 때)에만 검색을 걷는다 —
   *  보내기만 한 경우에는 그 줄이 '보냄' 으로 바뀐 것을 봐야 두 번 누르지 않는다. */
  const ask = async (id: string) => {
    if (joining) return;
    setJoining(id); setAskErr(null);
    const r = await onRequest?.(id);
    setJoining(null);
    if (!r) return;
    if (r.outcome === "error") { setAskErr(r.message ?? (en ? "Couldn't send." : "보내지 못했어요.")); return; }
    setAsked((m) => ({ ...m, [id]: r.outcome }));
    if (r.outcome === "accepted" || r.outcome === "connected") onQuery("");
  };

  const unask = async (id: string) => {
    if (answering) return;
    setAnswering(id); setAskErr(null);
    let ok = false;
    try { ok = (await onCancelRequest?.(id)) ?? false; } finally { setAnswering(null); }
    // 못 물렀으면 줄을 그대로 둔다. 예전에는 결과와 상관없이 '보냄' 을 걷어서,
    // 상대에게는 요청이 남아 있는데 내 화면에서만 사라졌다.
    if (!ok) { setAskErr(en ? "Couldn't undo. Try again." : "요청을 무르지 못했어요. 잠시 뒤 다시 눌러 주세요."); return; }
    setAsked((m) => { const n = { ...m }; delete n[id]; return n; });
  };

  /** 받은 요청에 답한다. 답하는 동안 잠근다 — 두 번 누르면 두 번 나간다. */
  const answer = async (id: string, accept: boolean) => {
    if (answering) return;
    setAnswering(id);
    try { await onAnswerRequest?.(id, accept); } finally { setAnswering(null); }
  };

  return (
    <div className="rmg-ppl-wrap">
      <div className="rmg-ppl-search">
        <Search className="rmg-ppl-searchic" />
        <input
          className="rmg-ppl-searchin"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={en ? "Name or @handle" : "이름 · @핸들로 찾기"}
          aria-label={en ? "Search people" : "사람 찾기"}
        />
        {q && (
          <button type="button" className="rmg-ppl-searchx" onClick={() => onQuery("")} aria-label={en ? "Clear" : "지우기"}>
            <X className="rmg-drawer-pxic" />
          </button>
        )}
        {/* 만들기는 큰 버튼이 아니라 한 줄의 말이다 — 늘 눌리길 기다리는 얼굴을 하지 않는다.
            '그룹' 이라 부르지 않는다: 이 제품에 group 이라는 것은 없고, 이 버튼이 여는 패널은
            스스로를 '새 자리(New event)' 라고 부른다. 여는 것과 열리는 것의 이름이 다르면
            누른 사람은 자기가 무엇을 만들었는지 모른다. */}
        <button type="button" className="rmg-ppl-make" onClick={onNewRoom}>
          {en ? "New event" : "새 자리"}
        </button>
      </div>

      {/* 내 핸들 — 사람을 더하는 화면에서, 나를 더하게 하려면 내 이름을 알려 줄 수 있어야 한다.
          남의 핸들은 검색·프로필에 다 보이는데 내 것만 어디에도 없었다: 청할 수는 있어도
          청해 달라고 할 수는 없는 상태였다. 크게 세우지 않는다 — 필요할 때 눈에 들어올 만큼만. */}
      {myHandle && (
        <p className="rmg-mine">
          <span className="rmg-mine-k">{en ? "You are" : "내 핸들"}</span>
          <span className="rmg-mine-v">@{myHandle}</span>
          <button
            type="button"
            className="rmg-mine-copy"
            onClick={() => {
              void navigator.clipboard?.writeText("@" + myHandle).then(
                () => setCopied(true),
                () => setCopied(false),   // 클립보드가 막힌 자리도 있다 — 그때는 조용히 둔다
              );
              window.setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? (en ? "Copied" : "복사됨") : (en ? "Copy" : "복사")}
          </button>
        </p>
      )}

      {/* 받은 요청 — 탭을 새로 만들지 않는다. 대부분 비어 있는 탭이 하나 늘면
          그만큼 화면이 무거워질 뿐이다. 온 것이 있을 때만 연락처 위에 얹히고,
          답하면 사라진다. 무엇을 청했는지가 아니라 '누가' 가 먼저 읽혀야 한다. */}
      {lane === "contacts" && (requests?.length ?? 0) > 0 && (
        <section className="rmg-req" aria-label={en ? "Connection requests" : "받은 요청"}>
          <p className="rmg-eyebrow rmg-req-eye">
            {en ? `${requests.length} want${requests.length > 1 ? "" : "s"} to connect` : `연결 요청 ${requests.length}`}
          </p>
          <ul className="rmg-req-list">
            {(requests as ConnectionRequest[]).map((r) => (
              <li key={r.id} className="rmg-req-row">
                <span className="rmg-ppl-av">{r.name?.slice(0, 1) ?? "·"}</span>
                <span className="rmg-req-who">
                  <span className="rmg-req-name">{r.name}</span>
                  <span className="rmg-req-handle">@{r.handle}</span>
                </span>
                <button type="button" className="rmg-ppl-act primary" disabled={answering === r.id} onClick={() => void answer(r.id, true)}>
                  {answering === r.id ? "…" : (en ? "Accept" : "수락")}
                </button>
                <button type="button" className="rmg-ppl-act" disabled={answering === r.id} onClick={() => void answer(r.id, false)}>
                  {en ? "Decline" : "거절"}
                </button>
              </li>
            ))}
          </ul>
          {/* 서버가 받지 않았으면 그렇다고 말한다 — 요청만 사라지고 아무 일도 없는 것처럼 두지 않는다. */}
          {requestError && <p className="rmg-ppl-none rmg-req-err">{requestError}</p>}
        </section>
      )}

      {/* 세 갈래 — 밑줄 하나로만 지금 어디를 보는지 말한다(§4). */}
      <nav className="rmg-lane" role="tablist" aria-label={en ? "People views" : "사람 보기"}>
        {LANES.map((l) => (
          <button
            key={l.key}
            type="button"
            role="tab"
            aria-selected={lane === l.key}
            className={`rmg-lane-btn ${lane === l.key ? "on" : ""}`}
            onClick={() => setLane(l.key)}
          >
            {l.label}
            {l.n > 0 && <span className="rmg-lane-n">{l.n}</span>}
          </button>
        ))}
      </nav>

      {lane === "group" ? (
        groups.length === 0 ? (
          <div className="rmg-ppl-blank">
            <p className="rmg-ppl-blank-t">{en ? "No groups yet." : "함께하는 자리가 아직 없어요."}</p>
            <p className="rmg-ppl-blank-b">
              {en ? "Make one, and its room comes with it." : "자리를 만들면 그 자리의 대화도 함께 생겨요."}
            </p>
          </div>
        ) : (
          <ul className="rmg-ppl-list">
            {groups
              .filter((g) => !q || g.title.toLowerCase().includes(q))
              .map((g) => {
                const on = openEventId === g.id;
                return (
                  <li key={g.id} className={`rmg-ppl ${on ? "on" : ""}`}>
                    <button type="button" className="rmg-ppl-head" aria-current={on} onClick={() => onOpenEvent?.(g.id, true)}>
                      <span className="rmg-ppl-av grp"><Users className="rmg-ppl-avic" /></span>
                      <span className="rmg-ppl-txt">
                        <span className="rmg-ppl-top">
                          <span className={`rmg-ppl-name ${g.unread > 0 ? "unread" : ""}`}>{g.title}</span>
                          {g.last && <span className="rmg-ppl-at">{chatStamp(new Date(g.last.createdAt), en)}</span>}
                        </span>
                        <span className="rmg-ppl-bottom">
                          <span className={`rmg-ppl-prev ${g.last ? "" : "faint"}`}>
                            {preview(g.last) || (en ? `${g.count} people` : `${g.count}명`)}
                          </span>
                          {g.unread > 0 && <span className="rmg-ppl-dot" aria-label={en ? "New" : "새 메시지"} />}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        )
      ) : contacts.length === 0 && !q ? (
        // 큰 그림 대신 다음 한 걸음만 말해 준다.
        <div className="rmg-ppl-blank">
          <p className="rmg-ppl-blank-t">
            {lane === "dm"
              ? (en ? "No conversations yet." : "아직 나눈 대화가 없어요.")
              : (en ? "No one here yet." : "아직 연결된 사람이 없어요.")}
          </p>
          <p className="rmg-ppl-blank-b">
            {lane === "dm"
              ? (en ? "Pick someone from Contacts and say something." : "연락처에서 사람을 골라 말을 걸어보세요.")
              : (en ? "Find someone on Comein by name or @handle, and start there." : "이름이나 @핸들로 Comein에서 사람을 찾아보세요.")}
          </p>
        </div>
      ) : shown.length === 0 && newcomers.length === 0 && !finding ? (
        <p className="rmg-ppl-none">
          {q.length < 2
            ? (en ? "Type two letters or more." : "두 글자 이상 적어 주세요.")
            : (en ? `No one matches "${query}".` : `"${query}"와 맞는 사람이 없어요.`)}
        </p>
      ) : shown.length === 0 ? null : (
        // 펼치지 않는다 — 고르면 오른쪽 칸이 그 사람 이야기로 바뀐다.
        // (예전처럼 목록 안에서 펼치면 아래가 밀려 리스트가 출렁이고, 버튼이 세 개나 겹쳐 보였다.)
        <ul className="rmg-ppl-list">
          {/* 개인 대화 갈래에서는 아직 말이 오가지 않은 사람은 세우지 않는다 — 여긴 '대화' 목록이다. */}
          {shown
            .filter((c: any) => (lane === "dm" ? dm.get(c.id)?.last : true))
            .map((c: any) => {
            const on = personId === c.id;
            const n = (sharedEventsWith(c.id) as any[]).length;
            const nu = unreadOf ? unreadOf(c.id) : 0;
            const last = dm.get(c.id)?.last;
            return (
              <li key={c.id} className={`rmg-ppl ${on ? "on" : ""}`}>
                <button type="button" className="rmg-ppl-head" aria-current={on} onClick={() => onSelectPerson(on ? null : c.id)}>
                  <span className="rmg-ppl-av">{c.name?.slice(0, 1) ?? "·"}</span>
                  <span className="rmg-ppl-txt">
                    <span className="rmg-ppl-top">
                      <span className={`rmg-ppl-name ${nu > 0 ? "unread" : ""}`}>{c.name}</span>
                      {lane === "dm" && last && <span className="rmg-ppl-at">{chatStamp(new Date(last.createdAt), en)}</span>}
                    </span>
                    {/* 연락처에서는 소속을, 대화에서는 마지막 말을 — 같은 줄이 갈래에 따라 다른 것을 말한다. */}
                    <span className="rmg-ppl-bottom">
                      <span className={`rmg-ppl-prev ${lane === "dm" ? "" : "faint"}`}>
                        {lane === "dm" ? preview(last) : (c.org ?? (c.handle ? `@${c.handle}` : ""))}
                      </span>
                      {nu > 0 && <span className="rmg-ppl-dot" aria-label={en ? "New" : "새 메시지"} />}
                      {/* 함께하는 일정 수는 연락처에서만 — 대화 목록에 숫자를 더 얹지 않는다. */}
                      {lane === "contacts" && n > 0 && <span className="rmg-ppl-n">{en ? `${n}` : `일정 ${n}`}</span>}
                    </span>
                  </span>
                </button>
                {/* 같은 일정에서 만나기만 한 사람 — 목록에는 있지만 아직 이어지지 않았다.
                    검색은 '이미 내 목록에 있는 사람'을 걸러 내므로, 여기서 청할 길이 없으면
                    그 사람에게는 영영 요청을 보낼 수 없다. 줄 자체가 버튼이라 안에 또 버튼을
                    넣을 수 없어(중첩 금지), 형제로 두고 오른쪽 끝에 세운다. */}
                {lane === "contacts" && !c.connected && (
                  (asked[c.id] || (outgoing ?? []).includes(c.id)) ? (
                    <button type="button" className="rmg-ppl-act rmg-ppl-rowact" disabled={answering === c.id} onClick={() => void unask(c.id)}>
                      {answering === c.id ? "…" : (en ? "Requested · Undo" : "요청함 · 취소")}
                    </button>
                  ) : (
                    <button type="button" className="rmg-ppl-act rmg-ppl-rowact" disabled={joining === c.id} onClick={() => void ask(c.id)}>
                      {joining === c.id ? "…" : (en ? "Request" : "요청")}
                    </button>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Comein 계정에서 찾은 사람 — 아직 내 사람이 아니다. 이어야 목록으로 올라온다.
          없는 사람을 지어내 넣지 않는다: 여기 뜨는 건 전부 실재하는 계정이다. */}
      {q.length >= 2 && (finding || newcomers.length > 0) && (
        <div className="rmg-ppl-find">
          <p className="rmg-eyebrow rmg-ppl-findeye">
            {finding ? (en ? "Looking…" : "찾는 중…") : (en ? "On Comein" : "Comein에서")}
          </p>
          {/* 서버가 거절한 이유는 그대로 옮긴다 — 아무 일도 일어나지 않은 것처럼 두지 않는다. */}
          {askErr && <p className="rmg-ppl-none rmg-req-err">{askErr}</p>}
          <ul className="rmg-ppl-list">
            {newcomers.map((p: any) => (
              <li key={p.id} className="rmg-ppl">
                <div className="rmg-ppl-head rmg-ppl-findrow">
                  <span className="rmg-ppl-av">{p.name?.slice(0, 1) ?? "·"}</span>
                  <span className="rmg-ppl-txt">
                    <span className="rmg-ppl-name">{p.name}</span>
                    <span className="rmg-ppl-org">@{p.handle}</span>
                  </span>
                  {/* 한 줄이 자기가 어디까지 왔는지 안다 —
                      이어짐 · 그쪽이 먼저 보냄(여기서 바로 받는다) · 내가 보내 둠 · 아직 아무것도. */}
                  {p.connected ? (
                    <span className="rmg-ppl-n">{en ? "Connected" : "연결됨"}</span>
                  ) : p.incomingRequestId ? (
                    <span className="rmg-ppl-req">
                      <span className="rmg-ppl-reqt">{en ? "Wants to connect" : "요청이 와 있어요"}</span>
                      <button type="button" className="rmg-ppl-act primary" disabled={answering === p.incomingRequestId} onClick={() => { void answer(p.incomingRequestId, true).then(() => onQuery("")); }}>
                        {answering === p.incomingRequestId ? "…" : (en ? "Accept" : "수락")}
                      </button>
                    </span>
                  ) : asked[p.id] || p.requested ? (
                    <button type="button" className="rmg-ppl-act" disabled={answering === p.id} onClick={() => void unask(p.id)}>
                      {answering === p.id ? "…" : (en ? "Requested · Undo" : "요청함 · 취소")}
                    </button>
                  ) : (
                    <button type="button" className="rmg-ppl-act" disabled={joining === p.id} onClick={() => void ask(p.id)}>
                      {joining === p.id ? "…" : (en ? "Request" : "요청")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** 사용 가이드 투어 — 화면을 덮는 모달이 아니라, 진짜 화면 위에서 한 곳씩 짚어 준다.
 *  각 단계는 실제 요소(data-tour)를 가리키고, 필요하면 그 화면으로 먼저 옮겨 간다.
 *  가짜 UI 를 만들지 않는다 — 사용자가 배우는 건 지금 눈앞의 그 버튼이다. */
