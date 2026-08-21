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
import { createPortal } from "react-dom";
import { CalendarDays, MoreHorizontal, Search, Trash2, Users, X } from "lucide-react";

import { suggestionLine, summarize, type AnalysisOutcome } from "@/lib/conversation";
import { copyText } from "@/lib/clipboard";
import { fmtDate, fmtTime } from "@/lib/format";
import {
  ME_ID,
  type ChatMessage, type ConnectionRequest, type Contact,
  type EventParticipant, type Schedule,
} from "@/lib/types";
import { ChatThread, type SlashCmd } from "./Chat";
import { GroupLane } from "./Groups";
import { chatStamp } from "../chatTime";
import { eventStamp } from "../datetime";
import { L, type Lang } from "../i18n";

/**
 * 사람 하나를 두고 열리는 작은 메뉴 — 오른쪽 클릭으로 부른다.
 *
 * 왜 오른쪽 클릭인가 — 여기 있는 것들은 자주 쓰는 것이 아니다. 이름을 붙이는 것도, 끊는
 * 것도 한 사람당 몇 번 안 한다. 그런 것을 줄 위에 늘 세워 두면 목록이 손잡이 밭이 된다.
 * 필요할 때만 나타나고, 쓰지 않으면 없는 것과 같아야 한다(§6 — 인터페이스는 사라진다).
 *
 * 그래서 여기 있는 것은 **다른 곳에 없는 것들**이다. '대화 열기' 같은 건 두지 않는다 —
 * 줄을 그냥 누르면 되는 일을 메뉴에 또 적으면, 읽는 사람은 둘이 다른 일인 줄 안다.
 */
export function PersonMenu({ person, at, lang, onClose, onRename, onUnlink }: {
  person: Contact;
  /** 눌린 자리(뷰포트 좌표). 메뉴는 여기서 열린다. */
  at: { x: number; y: number };
  lang: Lang;
  onClose: () => void;
  onRename: (label: string) => void;
  onUnlink?: () => void;
}) {
  const en = lang === "en";
  const box = React.useRef<HTMLDivElement>(null);
  const [naming, setNaming] = React.useState(false);
  const [draft, setDraft] = React.useState(person.realName ? person.name : "");
  const [copied, setCopied] = React.useState<boolean | null>(null);
  const [asking, setAsking] = React.useState(false);

  // 이 메뉴는 body 로 옮겨 붙인다(아래 createPortal).
  //
  // 왜 — `position: fixed` 는 보통 뷰포트를 기준으로 앉지만, 조상 중 하나라도
  // transform·filter·will-change 를 갖고 있으면 **그 조상이 기준을 가로챈다**(CSS 규격).
  // 워크스페이스의 작업면 `.rmg-flow` 가 탭 전환 크로스페이드 때문에
  // `will-change: opacity, transform` 을 달고 있어서(styles.ts), 여기서 넘긴 clientX/clientY
  // 뷰포트 좌표가 작업면의 왼쪽 위를 원점으로 다시 읽혔다 — 그래서 메뉴가 누른 자리가 아니라
  // 엉뚱한 곳에 떠 있었다. 좌표를 보정하는 대신 아예 그 상자 밖으로 내보낸다:
  // 보정은 조상이 하나 바뀔 때마다 다시 틀리지만, 밖으로 나온 것은 계속 맞는다.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // 바깥을 누르거나 Esc 를 누르면 닫힌다. 스크롤에도 닫는다 — 메뉴는 뷰포트에 고정돼 있어서
  // 목록이 움직이면 엉뚱한 줄 위에 떠 있게 된다(그러면 어느 사람의 메뉴인지 거짓말이 된다).
  React.useEffect(() => {
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  // 화면 밖으로 나가지 않게 — 오른쪽·아래 끝에서 누르면 메뉴가 잘려 나간다.
  const [pos, setPos] = React.useState(at);
  React.useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.min(at.x, window.innerWidth - r.width - 8),
      y: Math.min(at.y, window.innerHeight - r.height - 8),
    });
  }, [at.x, at.y]);

  const copy = async () => {
    if (!person.handle) return;
    const ok = await copyText("@" + person.handle);
    setCopied(ok);
    // 됐으면 잠깐 보여 주고 닫는다. 안 됐으면 남는다 — 안 된 것을 알려야 다른 길을 찾는다.
    if (ok) window.setTimeout(onClose, 700);
  };

  if (!mounted) return null;

  return createPortal(
    <div ref={box} className="rmg-pmenu" role="menu" style={{ left: pos.x, top: pos.y }}>
      {/* 붙이는 이름 — 나만 본다. 그 말을 적어 두지 않으면 상대에게 보일까 봐 아무도 안 쓴다. */}
      {naming ? (
        <form
          className="rmg-pmenu-name"
          onSubmit={(e) => { e.preventDefault(); onRename(draft); onClose(); }}
        >
          <input
            className="rmg-pmenu-in"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={person.realName ?? person.name}
            aria-label={en ? "What you call them" : "부르는 이름"}
            maxLength={40}
            autoFocus
          />
          <p className="rmg-pmenu-note">
            {en ? "Only you see this. Empty to clear." : "나만 보여요. 비우면 지워집니다."}
          </p>
        </form>
      ) : (
        <button type="button" role="menuitem" className="rmg-pmenu-row" onClick={() => setNaming(true)}>
          {person.realName
            ? (en ? "Change what you call them" : "부르는 이름 고치기")
            : (en ? "Call them something" : "부르는 이름 붙이기")}
        </button>
      )}

      {person.handle && (
        <button type="button" role="menuitem" className="rmg-pmenu-row" onClick={() => void copy()}>
          {copied === true
            ? (en ? "Copied" : "복사됨")
            : copied === false
              ? (en ? "Couldn't copy — @" + person.handle : `복사가 막혀 있어요 — @${person.handle}`)
              : (en ? `Copy @${person.handle}` : `@${person.handle} 복사`)}
        </button>
      )}

      {/* 끊기 — 되돌릴 수는 있지만(다시 청하면 된다) 상대에게 청을 다시 보내야 하는 일이라 묻는다. */}
      {onUnlink && person.connected && (
        asking ? (
          <div className="rmg-pmenu-ask">
            <span className="rmg-pmenu-askq">{en ? "Unlink?" : "끊을까요?"}</span>
            <button type="button" className="rmg-ppl-make" onClick={() => setAsking(false)}>
              {en ? "Cancel" : "취소"}
            </button>
            <button type="button" className="rmg-mg-del" onClick={() => { onUnlink(); onClose(); }}>
              {en ? "Unlink" : "끊기"}
            </button>
          </div>
        ) : (
          <button type="button" role="menuitem" className="rmg-pmenu-row" onClick={() => setAsking(true)}>
            {en ? "Unlink" : "연결 끊기"}
          </button>
        )
      )}

      {/* 함께한 자리는 남는다는 말 — 끊으면 다 사라지는 줄 알고 못 끊는 사람이 있다. */}
      {onUnlink && person.connected && (
        <p className="rmg-pmenu-note">
          {en ? "Shared events stay." : "함께한 일정은 그대로 남아요."}
        </p>
      )}
    </div>,
    document.body,
  );
}

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
/**
 * 대화 위에 얹히는 자리 한 칸.
 *
 * 왜 이것이 필요한가 — 1:1 에서 자리 하나를 누르면 화면이 통째로 그 자리의 방으로 갈렸다.
 * 같은 두 사람인데 대화가 둘이고, 하나를 누르면 다른 하나가 말없이 사라진다. 사람 쪽에서
 * 보면 "일정이 여기저기 흩어져 있다" 로 읽힌다 — 실제로는 한 곳에 있는데도.
 *
 * 그래서 여기서 끝낸다: **언제 · 누구 · 내가 가는가.** 자리 하나를 두고 사람이 대개
 * 알고 싶은 것이 그 셋이다. 그 이상이 필요할 때만 방으로 건너간다.
 *
 * 무엇을 여기 두지 않았나 — 시간 후보(제안)와 하루 겹쳐 보기는 그 방에 둔다. 여럿이
 * 시간을 맞추는 일은 넓은 자리가 필요하고, 여기 끌고 오면 이 칸이 또 하나의 방이 된다.
 */
function EventStrip({ event, parts, peerName, msgCount, lang, onRespond, onOpen, onClose }: {
  event: Schedule;
  parts: EventParticipant[];
  peerName: string;
  msgCount: number;
  lang: Lang;
  onRespond: (status: "accepted" | "declined") => void;
  onOpen: () => void;
  onClose: () => void;
}) {
  const en = lang === "en";
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : null;
  const me = parts.find((p) => p.userId === ME_ID) ?? null;
  const going = parts.filter((p) => p.status === "accepted").length;
  // 둘만의 자리인가. 셋 이상이면 그 방에는 여기 없는 사람이 있다 — 건너갈 이유가 하나 더 있다.
  const others = parts.length - 2;

  return (
    <div className="rmg-pev" role="group" aria-label={event.title}>
      <div className="rmg-pev-head">
        <p className="rmg-pev-when">
          {fmtDate(start)} · {fmtTime(start)}{end ? `–${fmtTime(end)}` : ""}
          {event.location ? ` · ${event.location}` : ""}
          {/* 중요도는 말한 것만 보여 준다 — 비어 있는 것은 '보통' 이 아니라 '아무도 말하지 않음' 이다(0018). */}
          {event.priority && event.priority !== "mid" && (
            <span className={`rmg-drawer-cat pr-${event.priority}`}>
              {event.priority === "high" ? (en ? "Important" : "중요") : (en ? "Light" : "가벼움")}
            </span>
          )}
        </p>
        <button type="button" className="rmg-pev-x" onClick={onClose} aria-label={en ? "Collapse" : "접기"}>
          <X className="rmg-drawer-pxic" />
        </button>
      </div>

      {/* 누가 — 둘뿐이면 이름을 다시 적지 않는다. 방금 그 사람을 골라서 여기 온 것이다. */}
      <p className="rmg-pev-who">
        {others > 0
          ? (en ? `${peerName} and ${others} more · ${going} going` : `${peerName} 외 ${others}명 · 참석 ${going}`)
          : (en ? `Just you and ${peerName}` : `${peerName} 와 둘이서`)}
      </p>

      {/* 참석 여부 — 자리를 떠나지 않고 여기서 답한다. 주최자에게는 물을 것이 없다. */}
      {me && me.role !== "owner" && (
        <div className="rmg-rsvp">
          <p className="rmg-rsvp-q">
            {me.status === "invited"
              ? (en ? "Are you joining?" : "참석하시겠어요?")
              : me.status === "accepted"
                ? (en ? "You're going." : "참석으로 표시했어요.")
                : (en ? "You declined." : "불참으로 표시했어요.")}
          </p>
          <div className="rmg-rsvp-acts">
            <button
              type="button"
              className={`rmg-ppl-act ${me.status === "accepted" ? "primary" : ""}`}
              disabled={me.status === "accepted"}
              onClick={() => onRespond("accepted")}
            >
              {en ? "Going" : "참석"}
            </button>
            <button
              type="button"
              className={`rmg-ppl-act ${me.status === "declined" ? "primary" : ""}`}
              disabled={me.status === "declined"}
              onClick={() => onRespond("declined")}
            >
              {en ? "Can't" : "불참"}
            </button>
          </div>
        </div>
      )}

      {/* 그 방으로 — 한 줄이고, 어디로 가는지 미리 말한다.
          아무 말도 없는 방을 '대화 0' 이라고 부르면 갈 이유가 없어 보인다. 실제로는 시간을
          맞추고 하루를 겹쳐 보는 자리이므로, 비어 있을 때는 그 쪽을 말한다. */}
      <button type="button" className="rmg-pev-go" onClick={onOpen}>
        {msgCount > 0
          ? (en ? `Open the conversation · ${msgCount}` : `이 자리의 대화 ${msgCount}`)
          : (en ? "Find a time together" : "시간 맞추러 가기")}
        <span className="rmg-pev-goic" aria-hidden>›</span>
      </button>
    </div>
  );
}

export function PersonPanel({ person, messages, sharedEvents, participantsOf, myName, lang, focusChat, onClose, onSend, onOpenEvent, onCreateEvent, onEditMessage, onDeleteMessage, outcome, onAnswerSuggestion, openEventId, onPickEvent, onRespond, msgCountOf, cmds, cleared, onRenamePerson, onUnlinkPerson }: {
  person: Contact;
  messages: ChatMessage[];
  sharedEvents: Schedule[];
  participantsOf: (id: string) => EventParticipant[];
  myName: string;
  lang: Lang;
  focusChat: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
  /** 자리의 대화로 **일부러** 건너간다 — 칩을 누르는 것으로는 더 이상 일어나지 않는다. */
  onOpenEvent: (eventId: string) => void;
  /** 지금 이 사람 밑에서 펼쳐 둔 자리. 대화로 다녀와도 그대로 펼쳐져 있다(page 가 쥔다). */
  openEventId: string | null;
  onPickEvent: (eventId: string | null) => void;
  /** 참석 여부 — 자리를 떠나지 않고 여기서 답한다. 그게 이 줄이 여기 있는 이유다. */
  onRespond: (eventId: string, status: "accepted" | "declined") => void;
  /** 그 자리의 방에 쌓인 말의 수. 0 이면 건너갈 이유를 만들지 않는다. */
  msgCountOf: (eventId: string) => number;
  /** 빗금으로 부를 수 있는 것들 · 접어 둔 이전 대화 — 그대로 타래로 내려보낸다. */
  cmds?: SlashCmd[];
  cleared?: { count: number; onUndo: () => void };
  /** 부르는 이름 · 연결 끊기 — 오른쪽 클릭 메뉴가 쓴다. */
  onRenamePerson?: (personId: string, label: string) => void;
  onUnlinkPerson?: (personId: string) => void;
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
  /** 다가오는 것이 앞, 지난 것은 뒤(가까운 과거부터).
   *  세 개만 보여 주는 자리라 순서가 곧 '무엇을 먼저 보여 줄 것인가' 다 — 지난 약속보다
   *  다음 약속이 먼저다. 예전에는 서버가 준 순서(시작 시각 오름차순) 그대로여서,
   *  지난 자리가 많으면 앞으로의 자리가 '외 N' 뒤에 숨었다. */
  const ordered = React.useMemo(() => {
    const now = Date.now();
    const next = sharedEvents.filter((e) => +new Date(e.start) >= now)
      .sort((a, b) => +new Date(a.start) - +new Date(b.start));
    const past = sharedEvents.filter((e) => +new Date(e.start) < now)
      .sort((a, b) => +new Date(b.start) - +new Date(a.start));
    return [...next, ...past];
  }, [sharedEvents]);
  /** 프로필 위에서 연 메뉴 — 목록과 같은 것을 여기서도 쓴다. */
  const [menu2, setMenu2] = React.useState<{ x: number; y: number } | null>(null);
  /** 펼쳐 둔 자리. 그 사이 지워졌으면(다른 기기에서) 조용히 접힌다. */
  const picked = openEventId ? sharedEvents.find((e) => e.id === openEventId) ?? null : null;
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
      <div
        className="rmg-phead"
        // 목록에서와 같은 몸짓 — 프로필 위에서 오른쪽 클릭.
        onContextMenu={(e) => { e.preventDefault(); setMenu2({ x: e.clientX, y: e.clientY }); }}
      >
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
              {/* 오른쪽 클릭을 모르는 사람에게도 같은 곳으로 가는 길을 하나 둔다.
                  숨은 몸짓만으로 닿는 기능은, 그것을 아는 사람에게만 있는 기능이다. */}
              {onRenamePerson && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => { setMenu(false); setMenu2({ x: e.clientX, y: e.clientY }); }}
                >
                  {person.realName
                    ? (en ? "Change what you call them" : "부르는 이름 고치기")
                    : (en ? "Call them something" : "부르는 이름 붙이기")}
                </button>
              )}
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
            {(showAllEvents ? ordered : ordered.slice(0, 3)).map((s2: Schedule) => (
              <button
                key={s2.id}
                type="button"
                className={`rmg-pwith-chip ${+new Date(s2.start) < Date.now() ? "past" : ""} ${openEventId === s2.id ? "on" : ""}`}
                data-tour="sharedevent"
                aria-expanded={openEventId === s2.id}
                onClick={() => onPickEvent(openEventId === s2.id ? null : s2.id)}
                title={`${fmtDate(new Date(s2.start))} · ${fmtTime(new Date(s2.start))}`}
              >
                <span className="rmg-pwith-t">{s2.title}</span>
                {/* 시각만으로는 어느 날인지 알 수 없다 — "14:00" 은 오늘일 수도 지난달일 수도 있다. */}
                <span className="rmg-pwith-at">{eventStamp(new Date(s2.start), en)} {fmtTime(new Date(s2.start))}</span>
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

          {/* 고른 자리 — 여기서 펼친다. 예전에는 칩을 누르면 화면 전체가 그 자리의 방으로
              갈려 나갔다. 같은 두 사람인데 대화가 둘이고, 하나를 누르면 다른 하나가
              말없이 사라지니 일정이 여기저기 흩어져 있는 것처럼 읽혔다.

              그래서 자리는 **대화 위에 얹힌다.** 읽던 말은 그대로 아래에 남아 있고,
              언제·누구·내 참석 여부처럼 대개 알고 싶은 것은 여기서 끝난다.
              그 자리의 방으로 건너가는 것은 이제 실수가 아니라 선택이다(아래 한 줄). */}
          {picked && (
            <EventStrip
              event={picked}
              parts={participantsOf(picked.id)}
              peerName={person.name}
              msgCount={msgCountOf(picked.id)}
              lang={lang}
              onRespond={(st) => onRespond(picked.id, st)}
              onOpen={() => onOpenEvent(picked.id)}
              onClose={() => onPickEvent(null)}
            />
          )}

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
            cmds={cmds}
            cleared={cleared}
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

      {menu2 && onRenamePerson && (
        <PersonMenu
          person={person}
          at={menu2}
          lang={lang}
          onClose={() => setMenu2(null)}
          onRename={(label) => onRenamePerson(person.id, label)}
          onUnlink={onUnlinkPerson ? () => onUnlinkPerson(person.id) : undefined}
        />
      )}
    </aside>
  );
}

/** People — 연락처가 아니라 '일정으로 이어진 사람'.
 *  사람을 누르면 그 사람과 내가 함께 있는 일정이 펼쳐지고, 거기서 바로 그 일정의 대화로 들어간다.
 *  사람 → 일정 → 대화. 1:1 DM 은 만들지 않는다 — Comein 의 대화는 늘 일정에 매여 있다. */
export function PeopleView({ contacts, lang, personId, onSelectPerson, sharedEventsWith, query, onQuery, onNewRoom, onFind, onRequest, onCancelRequest, requests, requestError, outgoing, myHandle, onAnswerRequest, unreadOf, convo, openEventId, onOpenEvent, teams, memberCountOf, openGroupId, onOpenGroup, onNewGroup, onRenamePerson, onUnlinkPerson, onClearRoom }: any) {
  const t = L(lang as Lang);
  const en = lang === "en";
  // 앞의 @ 는 이름의 일부가 아니라 '핸들을 부르는 방식' 이다. 여기서 벗겨야
  // 내 목록 거르기("@fapp" 로도 fapp1004 가 걸린다)와 '두 글자' 셈이 함께 맞는다.
  const q = (query as string).trim().replace(/^@+/, "").toLowerCase();

  // ── 세 갈래 ──
  // 연락처는 '누구와 이어져 있는가', 대화는 '무슨 말이 오갔는가' 다. 서로 다른 질문이라 목록도 나눈다.
  // 탭은 버튼처럼 보이지 않는다 — 얇은 밑줄 하나로만 지금 어디를 보는지 말한다.
  // 갈래 넷. `rooms` 는 예전에 `group` 이라 불렀는데, 그건 **일정마다 생긴 방**이지
  // 사람의 묶음이 아니다. 진짜 그룹(0017)이 생기면서 같은 낱말이 둘이 되므로,
  // 이쪽은 이 제품이 이미 쓰는 어휘를 따라 '자리' 로 부른다("새 자리" 버튼이 그렇다).
  type Lane = "contacts" | "dm" | "rooms" | "teams";
  const [lane, setLane] = React.useState<Lane>("contacts");
  const dm = (convo?.dm as Map<string, { last?: ChatMessage; unread: number }>) ?? new Map();
  const groups = (convo?.groups as { id: string; title: string; count: number; last?: ChatMessage; unread: number }[]) ?? [];
  const LANES: { key: Lane; label: string; n: number }[] = [
    { key: "contacts", label: en ? "Contacts" : "연락처", n: contacts.length },
    { key: "dm", label: en ? "Direct" : "개인 채팅", n: [...dm.values()].filter((v) => v.last).length },
    { key: "rooms", label: en ? "Rooms" : "자리 대화", n: groups.length },
    { key: "teams", label: en ? "Groups" : "그룹", n: (teams?.length ?? 0) },
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

  /** 오른쪽 클릭으로 연 메뉴 — 누구를, 어디서. */
  const [menu, setMenu] = React.useState<{ person: Contact; x: number; y: number } | null>(null);

  /**
   * 치우려고 휴지통을 누른 줄. 한 번에 치우지 않고 그 자리에서 한 번 되묻는다.
   *
   * 되묻는 이유는 이것이 위험해서가 아니다 — 치워도 **내 화면에서만** 사라지고
   * 상대의 대화는 그대로다(clearmark, 되돌릴 수 있다). 다만 목록에서 누르면 그 방을
   * 열어 보지도 않은 채 사라지므로, 되돌리는 줄(ClearedLine)을 볼 기회가 없다.
   * 볼 수 없는 되돌리기 대신, 누르기 전에 한 번 묻는 쪽을 택했다.
   */
  const [clearing, setClearing] = React.useState<string | null>(null);

  /** 목록의 한 줄에 붙는 휴지통 — 평소엔 없고, 손이 올라오면 나타난다(CSS). */
  const ClearBtn = ({ id, kind }: { id: string; kind: "dm" | "event" }) =>
    !onClearRoom ? null : clearing === id ? (
      <span className="rmg-ppl-rowact rmg-ppl-clearask">
        <button
          type="button"
          className="rmg-ppl-make"
          onClick={(e) => { e.stopPropagation(); setClearing(null); }}
        >
          {en ? "Cancel" : "취소"}
        </button>
        <button
          type="button"
          className="rmg-mg-del"
          onClick={(e) => { e.stopPropagation(); onClearRoom(kind, id); setClearing(null); }}
        >
          {en ? "Clear" : "치우기"}
        </button>
      </span>
    ) : (
      <button
        type="button"
        className="rmg-ppl-rowact rmg-ppl-trash"
        aria-label={en ? "Clear this conversation from my view" : "이 대화 치우기"}
        title={en ? "Clears it from your view only" : "내 화면에서만 치워집니다"}
        onClick={(e) => { e.stopPropagation(); setClearing(id); }}
      >
        <Trash2 className="rmg-ppl-trash-ic" />
      </button>
    );

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
            **여는 것과 열리는 것의 이름이 같아야 한다.** 누른 사람은 자기가 무엇을 만들었는지
            그 이름으로 안다. 그래서 지금 보고 있는 갈래를 따라간다:
              그룹 갈래에서는 '그룹 만들기' → 새 그룹 패널
              그 밖에서는     '새 자리'     → 새 자리(New event) 패널
            (한때 이 자리에 "이 제품에 group 이라는 것은 없다" 고 적혀 있었다. 0017 로
             생겼다 — 그래서 그 말을 지운다. 없다고 적어 둔 것이 생기면 주석이 거짓이 된다.) */}
        <button
          type="button"
          className="rmg-ppl-make"
          onClick={() => (lane === "teams" ? onNewGroup?.() : onNewRoom?.())}
        >
          {lane === "teams" ? (en ? "New group" : "그룹 만들기") : (en ? "New event" : "새 자리")}
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

      {lane === "teams" ? (
        <GroupLane
          teams={teams ?? []}
          memberCountOf={memberCountOf ?? (() => 0)}
          openGroupId={openGroupId ?? null}
          q={q}
          lang={lang}
          onOpenGroup={onOpenGroup}
          onNewGroup={onNewGroup}
        />
      ) : lane === "rooms" ? (
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
                  <li key={g.id} className={`rmg-ppl ${on ? "on" : ""} ${onClearRoom ? "act-trash" : ""}`}>
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
                    {/* 자리 대화도 치울 수 있다 — 줄 자체가 버튼이라 안에 못 넣고 형제로 둔다. */}
                    <ClearBtn id={g.id} kind="event" />
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
            // 이 줄 오른쪽 끝에 무엇이 서는가 — 알약(요청/요청함·취소)인가, 휴지통인가.
            // 손잡이는 줄 위에 **겹쳐** 서므로(.rmg-ppl-rowact), 그만큼 글의 자리를
            // 미리 비워 두지 않으면 '일정 3' 위에 '요청' 이 올라탄다. 실제로 그랬다.
            // hover 때만 비우면 손이 닿을 때마다 글자가 밀려 목록이 출렁인다 — 늘 비운다.
            const act = lane === "dm" ? "trash" : (lane === "contacts" && !c.connected) ? "pill" : null;
            return (
              <li
                key={c.id}
                className={`rmg-ppl ${on ? "on" : ""} ${act ? `act-${act}` : ""}`}
                // 오른쪽 클릭 — 자주 쓰지 않는 것들은 여기 숨어 있다가 필요할 때만 나온다.
                onContextMenu={(e) => { e.preventDefault(); setMenu({ person: c, x: e.clientX, y: e.clientY }); }}
              >
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
                {/* 개인 채팅 갈래에서만 휴지통 — 연락처는 '대화 목록'이 아니라 사람 목록이다.
                    거기 휴지통을 달면 사람을 지우는 것으로 읽힌다(그건 '연결 끊기'다). */}
                {lane === "dm" && <ClearBtn id={c.id} kind="dm" />}
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

      {menu && (
        <PersonMenu
          person={menu.person}
          at={{ x: menu.x, y: menu.y }}
          lang={lang}
          onClose={() => setMenu(null)}
          onRename={(label) => onRenamePerson?.(menu.person.id, label)}
          onUnlink={onUnlinkPerson ? () => onUnlinkPerson(menu.person.id) : undefined}
        />
      )}
    </div>
  );
}

/** 사용 가이드 투어 — 화면을 덮는 모달이 아니라, 진짜 화면 위에서 한 곳씩 짚어 준다.
 *  각 단계는 실제 요소(data-tour)를 가리키고, 필요하면 그 화면으로 먼저 옮겨 간다.
 *  가짜 UI 를 만들지 않는다 — 사용자가 배우는 건 지금 눈앞의 그 버튼이다. */
