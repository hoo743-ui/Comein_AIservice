"use client";

/**
 * Comein · 일정 하나가 곧 하나의 Context.
 *
 * 캘린더에서 눌러도, 사람에서 눌러도 같은 서랍이 열린다 — 일정·참여자·대화·제안이
 * 한 자리에 있다. 이 파일이 큰 것은 그 넷이 서로를 보고 움직이기 때문이고,
 * 갈라 두면 "제안에 답했는데 대화는 그대로" 같은 어긋남이 생긴다.
 *
 * 지키는 선(§11): 다른 사람의 하루는 **숫자로만** 온다. 그 시간에 몇 명이 되는지까지이고,
 * 누가 왜 바쁜지는 서버가 아예 내보내지 않는다. 내 일정만 제목까지 그린다.
 *
 * 확정은 언제나 사람의 손에서 일어난다. 전원이 동의해야 서버가 일정을 앉힌다(0003).
 */

import * as React from "react";
import { ArrowUp, ChevronDown, X } from "lucide-react";

import { fmtDate, fmtTime } from "@/lib/format";
import { categoryLabel, classifyEvent, useCurrentMode } from "@/lib/mode";
import {
  ME_ID,
  type ChatMessage, type Contact, type EventParticipant,
  type ParticipantStatus, type Schedule, type ScheduleProposal,
} from "@/lib/types";
import { JumpToLatest, MessageGroups, SummaryBlock, type ChatSummary } from "./Chat";
import { useCoarsePointer, useStickToBottom } from "../hooks";
import type { Lang } from "../i18n";

/** 일정 상세 + 그 일정의 대화 — 일정 하나가 곧 하나의 Context.
 *  People 에서는 목록 옆 빈 자리에 그대로 눕고(inline), 그 자리가 없는 Calendar 에서는
 *  오른쪽에서 한 겹 열린다(drawer). 어느 쪽이든 내용과 규격은 같다.
 *  Slack/Discord 처럼 만들지 않는다 — 말풍선도 아바타 행렬도 없이, 한 사람의 한 마디씩만 조용히 쌓인다. */
/** AI 일정 제안 — 대화에서 나온 시각을 각자의 달력과 대조해 내놓은 한 칸.
 *  AI 는 여기까지만 한다. 확정은 사람들이 한다(전원이 동의해야 일정이 앉는다).
 *  누가 그 시간에 바쁜지는 말하되, 무엇을 하는지는 말하지 않는다 — 서버가 아예 보내지 않는다. */
function ProposalCard({ proposal, participants, nameOf, lang, busy, error, onAnswer }: {
  proposal: ScheduleProposal;
  participants: EventParticipant[];
  nameOf: (userId: string) => string;
  lang: Lang;
  busy: boolean;
  /** 답이 서버에서 막혔다면 그 이유. 눌렀는데 아무 일도 안 일어나는 것이 가장 나쁜 답이다. */
  error?: string | null;
  onAnswer: (r: "accepted" | "declined") => void;
}) {
  const en = lang === "en";
  const start = new Date(proposal.start);
  const end = new Date(proposal.end);
  const avail = new Map(proposal.availability?.map((a) => [a.userId, a.state]));
  const answer = new Map(proposal.responses.map((r) => [r.userId, r.response]));
  const mine = answer.get(ME_ID) ?? "pending";
  const waiting = participants.filter((p) => (answer.get(p.userId) ?? "pending") !== "accepted").length;
  const freeAll = participants.every((p) => avail.get(p.userId) !== "busy");

  const stateWord = (s?: string) =>
    s === "busy" ? (en ? "Busy" : "일정 있음")
      : s === "unknown" ? (en ? "Unknown" : "알 수 없음")
        : (en ? "Free" : "가능");

  return (
    <section className="rmg-prop" aria-label={en ? "Suggested time" : "AI 일정 제안"}>
      <p className="rmg-eyebrow rmg-prop-eye">{en ? "Suggested time" : "AI 일정 제안"}</p>

      <p className="rmg-prop-when">
        {fmtDate(start)} · {fmtTime(start)} – {fmtTime(end)}
      </p>
      {proposal.rationale && <p className="rmg-prop-why">{proposal.rationale}</p>}

      {/* 사람마다 그 시간에 되는지 · 답했는지. 두 가지는 다른 이야기라 나란히 둔다. */}
      <ul className="rmg-prop-people">
        {participants.map((p) => {
          const a = avail.get(p.userId);
          const r = answer.get(p.userId) ?? "pending";
          return (
            <li key={p.userId} className={`rmg-prop-p ${a ?? ""}`}>
              <span className="rmg-prop-pname">{nameOf(p.userId)}</span>
              <span className={`rmg-prop-pav ${a ?? ""}`}>{stateWord(a)}</span>
              <span className={`rmg-prop-pans ${r}`}>
                {r === "accepted" ? (en ? "Agreed" : "동의")
                  : r === "declined" ? (en ? "Declined" : "거절")
                    : (en ? "Waiting" : "대기")}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="rmg-prop-sum">
        {freeAll
          ? (en ? `No conflicts for ${participants.length}.` : `${participants.length}명 모두 일정 충돌 없음`)
          : (en ? "Some have something then." : "일부는 그 시간에 일정이 있어요")}
        {waiting > 0 && (en ? ` · waiting on ${waiting}` : ` · ${waiting}명 대기 중`)}
      </p>

      {/* 이미 답했으면 조용히 상태만 두고, 마음이 바뀌면 다시 누를 수 있게 남겨 둔다. */}
      <div className="rmg-prop-acts">
        <button type="button" className={`rmg-ppl-act ${mine === "accepted" ? "primary" : ""}`} disabled={busy} onClick={() => onAnswer("accepted")}>
          {en ? "Agree" : "동의"}
        </button>
        <button type="button" className={`rmg-ppl-act ${mine === "declined" ? "primary" : ""}`} disabled={busy} onClick={() => onAnswer("declined")}>
          {en ? "Another time" : "다른 시간"}
        </button>
      </div>

      {/* 막혔으면 막혔다고 말한다. 조용한 실패는 사용자에게 '내가 잘못 눌렀나' 로만 남는다. */}
      {error && <p className="rmg-prop-err" role="alert">{error}</p>}
    </section>
  );
}

/** 함께 보는 하루 — 대화 옆에 서는 세로 타임라인.
 *
 *  같은 방을 보는 사람들이 같은 하루를 본다. 다만 서로의 하루를 들여다보지는 않는다:
 *    · 내 일정   — 제목까지 그대로 (내 것이니까)
 *    · 다른 사람 — 그 시간에 **몇 명이 되는지** 만. 누가 왜 바쁜지는 서버에서 나오지 않는다
 *                 (0006 day_availability — 0003 suggest_slots 가 세운 규칙과 같다)
 *    · AI 제안   — 보라. 이 화면에서 보라는 오직 AI 가 한 일의 언어다
 *    · 확정      — 잉크. 정해진 것은 조용하고 분명하게
 *
 *  슬롯을 누르면 그 시각으로 제안이 열린다 — 대화하다가 손이 닿는 자리에서 시간이 정해진다. */
// '함께 보는 일정' 칸의 폭 — 곁들이는 작은 달력이 아니라 대화와 나란히 서는 자리라
// 일정 제목과 시각이 한 줄에 읽힐 만큼은 늘 확보한다.
export const TL_MIN = 340, TL_MAX = 520, TL_DEFAULT = 380;
export const TL_KEY = "comein:tlWidth", TL_OPEN_KEY = "comein:tlOpen";
export const clampTl = (w: number) => Math.max(TL_MIN, Math.min(TL_MAX, Math.round(w)));

const SLOT_MIN = 30;          // 한 칸 = 30분
const SLOT_H = 15;            // 한 칸의 높이(px) — 마우스 기준
// 손가락 기준의 한 칸. 15px 은 커서 끝으로는 정확하지만 손끝(~40px)으로는 옆 칸이 눌린다.
// 30분을 고르려다 30분 뒤가 잡히면, 그건 못 고르는 것과 같다. 하루가 길어져도 이 칸은 스크롤한다.
const SLOT_H_TOUCH = 28;
const DAY_FROM = 7;           // 07:00 부터
const DAY_TO = 23;            // 23:00 까지

export function RoomTimeline({ event, day, onDay, mySchedules, avail, proposal, participants, lang, onPropose, proposing }: {
  event: Schedule;
  day: Date;
  onDay: (d: Date) => void;
  mySchedules: Schedule[];
  avail: { start: string; available: number; total: number }[];
  proposal?: ScheduleProposal | null;
  participants: EventParticipant[];
  lang: Lang;
  onPropose: (at: Date) => void;
  proposing: boolean;
}) {
  const en = lang === "en";
  const [picked, setPicked] = React.useState<Date | null>(null);
  React.useEffect(() => { setPicked(null); }, [day]);

  // 칸 높이는 기기가 정한다 — 아래 좌표 계산은 전부 이 하나를 따른다.
  const slotH = useCoarsePointer() ? SLOT_H_TOUCH : SLOT_H;

  const slots = ((DAY_TO - DAY_FROM) * 60) / SLOT_MIN;
  const top = (d: Date) => ((d.getHours() * 60 + d.getMinutes() - DAY_FROM * 60) / SLOT_MIN) * slotH;

  // 이 날에 걸치는 내 일정만 — 하루 밖은 잘라 그린다(없는 길이를 그리지 않는다).
  const dayStart = new Date(day); dayStart.setHours(DAY_FROM, 0, 0, 0);
  const dayEnd = new Date(day); dayEnd.setHours(DAY_TO, 0, 0, 0);
  const blocks = mySchedules
    .map((s) => {
      const a = new Date(s.start);
      const b = s.end ? new Date(s.end) : new Date(+a + 3_600_000);
      if (b <= dayStart || a >= dayEnd) return null;
      const from = a < dayStart ? dayStart : a;
      const to = b > dayEnd ? dayEnd : b;
      return { id: s.id, title: s.title, from, to, self: s.id === event.id };
    })
    .filter(Boolean) as { id: string; title: string; from: Date; to: Date; self: boolean }[];

  const availAt = new Map(avail.map((a) => [new Date(a.start).getTime(), a]));
  const total = avail[0]?.total ?? participants.length;

  const shift = (n: number) => { const d = new Date(day); d.setDate(d.getDate() + n); onDay(d); };
  const propStart = proposal ? new Date(proposal.start) : null;
  const propEnd = proposal ? new Date(proposal.end) : null;

  const parts = participants.length;
  const going = participants.filter((p) => p.status === "accepted").length;

  return (
    <div className="rmg-tl">
      {/* 이 칸이 무엇의 시간인지 먼저 말한다 — 달력이 홀로 떠 있으면 부가 기능처럼 읽힌다. */}
      <div className="rmg-tl-ctx">
        <p className="rmg-tl-ctxeye">{en ? "Shared schedule" : "함께하는 일정"}</p>
        <p className="rmg-tl-ctxt">{event.title}</p>
        <p className="rmg-tl-ctxm">
          {fmtDate(new Date(event.start))} · {fmtTime(new Date(event.start))}
          {event.end ? `–${fmtTime(new Date(event.end))}` : ""}
        </p>
        <p className="rmg-tl-ctxm">
          {en ? `${parts} people · ${going} going` : `참여자 ${parts}명 · 참석 ${going}`}
        </p>
      </div>

      <div className="rmg-tl-head">
        <button type="button" className="rmg-tl-nav" onClick={() => shift(-1)} aria-label={en ? "Previous day" : "이전 날"}>‹</button>
        <p className="rmg-tl-day">{fmtDate(day)}</p>
        <button type="button" className="rmg-tl-nav" onClick={() => shift(1)} aria-label={en ? "Next day" : "다음 날"}>›</button>
      </div>
      {/* 이 화면이 무엇을 보여주는지 한 줄 — 남의 일정 내용은 보이지 않는다는 약속을 먼저 말한다. */}
      <p className="rmg-tl-note">
        {en ? "Your events in full · others only as how many are free" : "내 일정은 그대로 · 다른 사람은 '몇 명 가능'만"}
      </p>

      <div className="rmg-tl-scroll">
      <div className="rmg-tl-grid" style={{ height: slots * slotH }}>
        {/* 시간 눈금 */}
        {Array.from({ length: DAY_TO - DAY_FROM + 1 }, (_, i) => (
          <div key={i} className="rmg-tl-hour" style={{ top: (i * 60 / SLOT_MIN) * slotH }}>
            <span className="rmg-tl-hourl">{String(DAY_FROM + i).padStart(2, "0")}</span>
          </div>
        ))}

        {/* 슬롯 — 가능 인원이 많을수록 진하다. 누르면 그 시각이 후보가 된다. */}
        <div className="rmg-tl-slots">
          {Array.from({ length: slots }, (_, i) => {
            const at = new Date(dayStart); at.setMinutes(at.getMinutes() + i * SLOT_MIN);
            const a = availAt.get(at.getTime());
            const ratio = a && a.total > 0 ? a.available / a.total : null;
            const on = picked && +picked === +at;
            return (
              <button
                key={i}
                type="button"
                className={`rmg-tl-slot ${on ? "on" : ""}`}
                style={{ top: i * slotH, height: slotH, ["--fill" as string]: ratio == null ? "0" : String(ratio) }}
                onClick={() => setPicked(on ? null : at)}
                title={
                  a
                    ? (en ? `${fmtTime(at)} · ${a.available}/${a.total} free` : `${fmtTime(at)} · ${a.available}/${a.total}명 가능`)
                    : fmtTime(at)
                }
                aria-label={fmtTime(at)}
              />
            );
          })}
        </div>

        {/* 내 일정 — 제목까지. 이 방의 일정 자신은 살짝 다르게(자기 시간과 충돌한다고 말하지 않는다). */}
        {blocks.map((b) => (
          <div
            key={b.id}
            className={`rmg-tl-ev ${b.self ? "self" : ""}`}
            style={{ top: top(b.from), height: Math.max(slotH - 2, top(b.to) - top(b.from) - 2) }}
            title={`${b.title} · ${fmtTime(b.from)}`}
          >
            <span className="rmg-tl-evt">{b.title}</span>
          </div>
        ))}

        {/* AI 제안 — 이 하루에 걸쳐 있을 때만 */}
        {propStart && propEnd && propStart < dayEnd && propEnd > dayStart && (
          <div
            className="rmg-tl-prop"
            style={{ top: top(propStart < dayStart ? dayStart : propStart), height: Math.max(slotH, top(propEnd > dayEnd ? dayEnd : propEnd) - top(propStart < dayStart ? dayStart : propStart)) }}
          >
            <span className="rmg-tl-propl">{en ? "Proposed" : "제안"} {fmtTime(propStart)}</span>
          </div>
        )}
      </div>
      </div>

      {/* 고른 시각 — 여기서 바로 제안이 열린다. 고르지 않았으면 아무 말도 하지 않는다. */}
      {picked && (
        <div className="rmg-tl-pick">
          <span className="rmg-tl-pickt">
            {fmtTime(picked)}
            {(() => {
              const a = availAt.get(picked.getTime());
              return a ? ` · ${en ? `${a.available}/${a.total} free` : `${a.available}/${a.total}명 가능`}` : "";
            })()}
          </span>
          <button type="button" className="rmg-ppl-act primary" disabled={proposing} onClick={() => onPropose(picked)}>
            {proposing ? (en ? "…" : "…") : (en ? "Propose" : "이 시간으로 제안")}
          </button>
        </div>
      )}

      <p className="rmg-tl-legend">
        <span className="rmg-tl-key ev" /> {en ? "Yours" : "내 일정"}
        <span className="rmg-tl-key av" /> {en ? "Free" : "가능"} {total > 0 ? `· ${total}${en ? "" : "명"}` : ""}
        <span className="rmg-tl-key pr" /> {en ? "Proposed" : "제안"}
      </p>
    </div>
  );
}

export function EventPanel({ event, participants, contacts, messages, myName, lang, focusChat, proposal, proposalBusy, proposalError, onAnswerProposal, summary, summaryAuto, summaryBusy, onRename, onSummarize, onClose, onSend, onAddParticipant, onRemoveParticipant, onRespond, backLabel, onBack, timeline, onEditMessage, onDeleteMessage, summaryError }: {
  event: Schedule;
  participants: EventParticipant[];
  contacts: Contact[];
  messages: ChatMessage[];
  myName: string;
  lang: Lang;
  focusChat: boolean;
  /** 이 일정에 열려 있는 AI 제안(없으면 null) */
  proposal?: ScheduleProposal | null;
  proposalBusy?: boolean;
  proposalError?: string | null;
  onAnswerProposal?: (r: "accepted" | "declined") => void;
  /** 대화 요약 — 스스로 갱신하지 않는다. 사람이 부를 때만 다시 읽는다. */
  summary?: ChatSummary | null;
  /** AI 가 스스로 정리했는가(전원 동의로 시간이 확정된 순간). 그러면 펼친 채로 맞이한다. */
  summaryAuto?: boolean;
  /** 이름을 고쳐 단다 — AI 가 권한 이름을 사람이 받아들였을 때만 불린다. */
  onRename?: (title: string) => void;
  summaryBusy?: boolean;
  /** 정리하지 못했을 때 그 한 줄. 없으면 null. */
  summaryError?: string | null;
  onSummarize?: () => void;
  onClose: () => void;
  onSend: (text: string) => void;
  onAddParticipant: (userId: string) => void;
  onRemoveParticipant: (userId: string) => void;
  onRespond: (status: "accepted" | "declined") => void;
  /** 사람에서 들어왔으면 어디서 왔는지 남겨둔다 — 방만 덜렁 바뀌면 길을 잃는다. */
  backLabel?: string;
  onBack?: () => void;
  /** 여럿이 함께하는 자리에서만 서는 오른쪽 칸(함께 보는 하루). 없으면 대화만 그린다. */
  timeline?: React.ReactNode;
  /** 내 말 고치기·지우기 */
  onEditMessage?: (id: string, text: string) => void;
  onDeleteMessage?: (id: string) => void;
}) {
  const en = lang === "en";
  const [adding, setAdding] = React.useState(false);
  // 점진적 공개 — 처음엔 시각과 제목만. 사람도 메모도 물었을 때 열린다.
  const [openWho, setOpenWho] = React.useState(false);
  const [openNotes, setOpenNotes] = React.useState(false);
  const mode = useCurrentMode();
  // 요약은 기본으로 닫혀 있다 — 필요할 때만 펼친다(§9).
  const [sumOpen, setSumOpen] = React.useState(false);
  // 스스로 정리한 것은 펼쳐 둔다 — 결론이 났다는 사실을 굳이 한 번 더 눌러 확인하게 하지 않는다.
  React.useEffect(() => { if (summaryAuto && summary) setSumOpen(true); }, [summaryAuto, summary]);

  // 오른쪽 '함께 보는 일정' 칸의 폭. 사용자가 정하고, 브라우저가 기억한다.
  const [tlW, setTlW] = React.useState(TL_DEFAULT);
  const [tlOpen, setTlOpen] = React.useState(true);
  React.useEffect(() => {
    try {
      const w = Number(localStorage.getItem(TL_KEY));
      if (w) setTlW(clampTl(w));
      setTlOpen(localStorage.getItem(TL_OPEN_KEY) !== "0");
    } catch { /* 못 읽어도 기본값으로 산다 */ }
  }, []);
  React.useEffect(() => { try { localStorage.setItem(TL_KEY, String(tlW)); } catch {} }, [tlW]);
  React.useEffect(() => { try { localStorage.setItem(TL_OPEN_KEY, tlOpen ? "1" : "0"); } catch {} }, [tlOpen]);

  // 끌기 — 포인터를 잡아 두면 커서가 칸 밖으로 나가도 끊기지 않는다.
  const startDrag = React.useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const w0 = tlW;
    const move = (ev: PointerEvent) => setTlW(clampTl(w0 - (ev.clientX - x0)));  // 왼쪽으로 끌면 넓어진다
    const up = () => {
      el.releasePointerCapture(e.pointerId);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  }, [tlW]);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  // 대화는 맨 아래에 붙어 있는다 — 위를 읽는 동안에는 '최근으로' 한 점만 남는다.
  const { listRef, endRef, atBottom, toBottom } = useStickToBottom(messages, event.id);

  const nameOf = React.useCallback(
    (userId: string) => (userId === ME_ID ? myName : contacts.find((c) => c.id === userId)?.name ?? (en ? "Unknown" : "알 수 없음")),
    [contacts, myName, en],
  );

  React.useEffect(() => { if (focusChat) inputRef.current?.focus(); }, [focusChat]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onSend(text);
  };

  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : null;
  const me = participants.find((p) => p.userId === ME_ID) ?? null;
  // 이름 제안 — 한 번 답하면 이 방에서는 다시 묻지 않는다.
  const [nameDone, setNameDone] = React.useState(false);
  React.useEffect(() => { setNameDone(false); }, [event.id]);
  /** 권할 만한 이름인가. 이미 그 이름이거나, 내가 주최자가 아니거나, 답했으면 묻지 않는다. */
  const suggestedName = React.useMemo(() => {
    const t = summary?.title?.trim();
    if (!t || nameDone) return null;
    if (me?.role !== "owner") return null;              // 서버도 주최자만 받는다
    if (t === event.title.trim()) return null;
    return t;
  }, [summary?.title, nameDone, me?.role, event.title]);
  const accepted = participants.filter((p) => p.status === "accepted").length;
  // 남을 부르고 내보내는 것은 주최자만 할 수 있다 — 서버가 그렇게 받는다
  // (0001 participants_insert · participants_delete: is_event_owner(event_id) or user_id = auth.uid()).
  // 손잡이를 아무에게나 보이면 눌러 놓고 조용히 거절당한다.
  const iAmOwner = me?.role === "owner";
  // 얼굴은 다섯까지만 눕히고 나머지는 +N 으로 접는다 — 줄이 두 줄로 넘어가면 '얇은 줄'이 아니게 된다.
  const shownParts = participants.slice(0, 5);
  const restParts = participants.length - shownParts.length;
  // 접힌 +N 뒤에 누가 있는지 — 그 숫자만으로는 아무도 알 수 없다.
  const restNames = participants.slice(5).map((p) => nameOf(p.userId)).join(", ");
  // 얼굴은 눈으로만 읽히므로, 읽어 주는 쪽에는 말로 남긴다.
  const whoLabel = en
    ? `${participants.length} participants, ${accepted} going — manage`
    : `참여자 ${participants.length}명, 참석 ${accepted} — 관리`;
  const categoryName = categoryLabel(classifyEvent(event, mode), mode, en);

  return (
    <aside className="rmg-evpanel" role="region" aria-label={event.title}>
      <div className="rmg-drawer-head">
        <div className="rmg-drawer-when">
          {backLabel && onBack && (
            <button type="button" className="rmg-evback" onClick={onBack}>‹ {backLabel}</button>
          )}
          <p className="rmg-drawer-title">{event.title}</p>
          <p className="rmg-drawer-time">
            {fmtDate(start)} · {fmtTime(start)}{end ? ` – ${fmtTime(end)}` : ""}
            {event.location ? ` · ${event.location}` : ""}
            {/* 같은 일정이 Context 에 따라 다른 이름으로 불린다 — 수업이거나, 회의이거나, 약속이거나.
                읽어 내지 못했으면 아무 말도 하지 않는다(빈 이름표를 붙이지 않는다). */}
            {categoryName && <span className="rmg-drawer-cat">{categoryName}</span>}
          </p>
        </div>
        <button type="button" className="rmg-panel-close" onClick={onClose} aria-label={en ? "Close" : "닫기"}>
          <X className="rmg-notif-ic" />
        </button>
      </div>

      {/* 이름을 권한다 — 조용히 바꾸지 않는다.
          방을 만드는 순간에는 무슨 얘기를 할지 아직 모른다. 그래서 이름은 대개
          "금요일 저녁" 같은 시각이거나 참여자 이름이 된다 — 무엇에 대한 자리인지는
          비어 있다. 이야기가 쌓이고 나면 AI 가 그 자리를 뭐라고 부를지 알게 된다.

          그렇다고 몰래 갈아 끼우지는 않는다. 방 이름은 곧 캘린더의 일정 제목이라,
          어제 보던 일정이 오늘 다른 이름으로 서 있게 된다. 권하고, 사람이 받는다.
          서버도 주최자만 받아 준다(0001) — 남의 자리 이름을 바꿀 수는 없다. */}
      {onRename && suggestedName && (
        <div className="rmg-rename" role="note">
          <span className="rmg-rename-t">
            {en ? "Call this " : "이 자리를 "}
            <em className="rmg-rename-em">{suggestedName}</em>
            {en ? "?" : " 라고 부를까요?"}
          </span>
          <button
            type="button"
            className="rmg-ppl-act primary"
            onClick={() => { onRename(suggestedName); setNameDone(true); }}
          >
            {en ? "Rename" : "그러기"}
          </button>
          <button type="button" className="rmg-ppl-act" onClick={() => setNameDone(true)}>
            {en ? "Keep" : "그대로"}
          </button>
        </div>
      )}

      {/* AI 가 시간을 내놓았으면 대화보다 먼저 — 지금 답을 기다리는 건 이것이다. */}
      {proposal && onAnswerProposal && (
        <ProposalCard
          proposal={proposal}
          participants={participants}
          nameOf={nameOf}
          lang={lang}
          busy={!!proposalBusy}
          error={proposalError ?? null}
          onAnswer={onAnswerProposal}
        />
      )}

      {/* 내 참석 여부 — 여럿이 모이는 자리는 '초대됐다'로 끝나면 안 되고 답이 돌아와야 한다.
          이미 답했으면 조용히 상태만 두고, 마음이 바뀌면 다시 누를 수 있게 남겨둔다. */}
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
            {/* 이미 그 답으로 서 있는 버튼은 누를 것이 없다. 눌러도 스토어가 곧바로 되돌아
                나가지만(같은 값이면 아무 일도 하지 않는다), 눌리는 것처럼 보이면 안 된다. */}
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

      {/* 일정은 사각형 카드가 아니라 시간·사람·말·메모가 매달린 하나의 맥락이다.
          다만 그것을 한꺼번에 펼치지 않는다 — 처음 눈에 닿는 건 시각과 제목이고,
          나머지는 이렇게 한 줄로 접혀 있다가 물었을 때 열린다. */}
      <div className="rmg-drawer-people">
        {/* 누가 와 있는지는 늘 보인다 — 이름 대신 얼굴을 얇게 눕혀 둔다.
            예전에는 이 자리가 접힌 한 줄이었다. "2명" 이라는 숫자는 읽히는데 그 둘이
            누구인지는 한 번 더 눌러야 했고, 누르면 목록이 대화를 아래로 밀어냈다 —
            여럿이 모인 자리의 주인공은 대화인데. 접기·펼치기로는 둘 중 하나만 풀린다.
            이니셜만 눕히면 자리를 거의 쓰지 않으면서 누가 있는지는 늘 말할 수 있다.
            사람 패널의 `.rmg-pwith` 칩 줄이 같은 문제를 이미 이렇게 풀었다.
            초대·제외는 가끔 하는 일이라, 그때만 아래로 연다. */}
        <div className="rmg-evwho">
          {/* 아직 아무도 실려 오지 않았으면(첫 하이드레이션) 빈 손잡이를 세우지 않는다. */}
          {participants.length > 0 && (
            <button
              type="button"
              className="rmg-evwho-faces"
              aria-expanded={openWho}
              aria-label={whoLabel}
              onClick={() => { setOpenWho((v) => { if (v) setAdding(false); return !v; }); }}
            >
              {/* 이름은 얼굴마다 따로 붙인다 — 줄 전체에 한 덩어리로 달면
                  "저 사람이 누구인지" 를 짚어 물을 수가 없다. 읽어 주는 쪽은 위의 aria-label 이 맡는다. */}
              {shownParts.map((p) => (
                <span key={p.userId} className={`rmg-evwho-av ${p.status}`} title={nameOf(p.userId)} aria-hidden="true">
                  {nameOf(p.userId).slice(0, 1)}
                </span>
              ))}
              {restParts > 0 && (
                <span className="rmg-evwho-more" title={restNames} aria-hidden="true">+{restParts}</span>
              )}
            </button>
          )}
          <span className="rmg-evwho-going">{en ? `${accepted} going` : `참석 ${accepted}`}</span>
          {iAmOwner && (
            <button
              type="button"
              className="rmg-evwho-add"
              onClick={() => { if (adding) { setAdding(false); return; } setOpenWho(true); setAdding(true); }}
            >
              {adding ? (en ? "Done" : "완료") : (en ? "Add" : "추가")}
            </button>
          )}
        </div>
        {openWho && (
        <>
        <ul className="rmg-drawer-plist">
          {participants.map((p) => (
            <li key={p.userId} className={`rmg-drawer-p ${p.status === "invited" ? "pending" : ""}`}>
              <span className="rmg-drawer-pav">{nameOf(p.userId).slice(0, 1)}</span>
              <span className="rmg-drawer-pname">{nameOf(p.userId)}</span>
              {p.role === "owner" && <span className="rmg-drawer-prole">{en ? "Owner" : "주최"}</span>}
              <span className={`rmg-drawer-prole ${p.status}`}>
                {p.status === "accepted" ? (en ? "Going" : "참석")
                  : p.status === "declined" ? (en ? "Can't" : "불참")
                    : (en ? "Invited" : "미정")}
              </span>
              {/* 주최자는 뺄 수 없다 — 일정의 주인이 사라지면 남는 사람들의 권한이 모호해진다.
                  그리고 빼는 사람도 주최자여야 한다(위 iAmOwner 참고). */}
              {adding && iAmOwner && p.role !== "owner" && (
                <button type="button" className="rmg-drawer-px" onClick={() => onRemoveParticipant(p.userId)} aria-label={en ? "Remove" : "제외"}>
                  <X className="rmg-drawer-pxic" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {adding && (
          <div className="rmg-drawer-add">
            {contacts.filter((c) => !participants.some((p) => p.userId === c.id)).length === 0 ? (
              <p className="rmg-drawer-empty">{en ? "Everyone is already here." : "이미 다 들어와 있어요."}</p>
            ) : (
              contacts
                .filter((c) => !participants.some((p) => p.userId === c.id))
                .map((c) => (
                  // 같은 사람을 두 번 눌러도 한 줄만 남는다(스토어에서 멱등 처리).
                  <button key={c.id} type="button" className="rmg-drawer-addbtn" onClick={() => onAddParticipant(c.id)}>
                    + {c.name}
                  </button>
                ))
            )}
          </div>
        )}
        </>
        )}
      </div>

      {/* 관련 메모 — 같은 규칙으로 접혀 있다. 아직 일정에 매인 메모가 없으므로
          열면 없다고 말한다. 없는 것을 있는 척 그리지 않는다. */}
      <div className="rmg-drawer-people">
        <button type="button" className="rmg-evdisc" aria-expanded={openNotes} onClick={() => setOpenNotes((v) => !v)}>
          <span className="rmg-evdisc-k">{en ? "Notes" : "관련 메모"}</span>
          <span className="rmg-evdisc-v">{en ? "None" : "없음"}</span>
          <ChevronDown className={`rmg-evdisc-ic ${openNotes ? "on" : ""}`} />
        </button>
        {openNotes && (
          <p className="rmg-drawer-empty">{en ? "No notes on this event." : "이 일정에 매인 메모가 없습니다."}</p>
        )}
      </div>

      {/* 대화 ‖ 함께 보는 일정 — 여럿이 모인 자리에서만 둘로 나뉜다.
          말과 시간이 한 화면에 있어야 "그럼 금요일 저녁 어때?" 가 손이 닿는 거리에서 끝난다.
          오른쪽은 곁들이는 작은 달력이 아니라 '이 대화와 이어진 시간' 이 서는 자리다 —
          그래서 폭을 사용자가 쥔다(끌어서 조절, 접기, 다음에 와도 그대로). */}
      <div
        className="rmg-evsplit"
        data-split={!!timeline}
        data-tlopen={tlOpen}
        style={{ ["--tl-w" as string]: `${tlW}px` }}
      >
      <div className="rmg-drawer-chat">
        <div className="rmg-drawer-chathead">
          <p className="rmg-eyebrow rmg-drawer-eye">{en ? "Conversation" : "이 일정의 대화"}</p>
          {/* 말이 몇 마디뿐이면 요약할 것도 없다 — 그때까지는 이 자리를 만들지 않는다. */}
          {/* 말이 몇 마디뿐이면 요약할 것도 없다 — 그때까지는 이 자리를 만들지 않는다.
              'AI' 라고 크게 말하지 않는다. 정리된 것이 조용히 나타날 뿐이다(§12·§17). */}
          {/* 말이 몇 마디뿐이면 요약할 것이 없다 — 다만 이미 정리된 것이 있으면
              (전원이 동의해 AI 가 스스로 남긴 경우) 개수와 무관하게 접었다 펼 수 있어야 한다. */}
          {onSummarize && (messages.length >= 4 || !!summary) && (
            <button
              type="button"
              className="rmg-ppl-make"
              disabled={summaryBusy}
              onClick={() => { if (!summary) onSummarize(); setSumOpen((v) => !v); }}
            >
              {/* 라벨은 **정말로 열려 있을 때만** '닫기' 라고 말한다.
                  예전에는 sumOpen 만 보고 바꿨는데, 서버가 실패하면 summary 가 없어
                  아무것도 안 열린 채 버튼만 '요약 닫기' 가 됐다 — 누를 것도 닫을 것도 없이. */}
              {summaryBusy
                ? (en ? "Reading…" : "읽는 중…")
                : sumOpen && (summary || summaryError)
                  ? (en ? "Hide" : "요약 닫기")
                  : (en ? "Summary" : "요약 보기")}
            </button>
          )}
        </div>

        {/* 요약 — 대화를 밀어내지 않게 위에 한 겹만. 스스로 갱신하지 않는다. */}
        {sumOpen && summary && <SummaryBlock summary={summary} lang={lang} busy={!!summaryBusy} onRefresh={onSummarize} />}
        {/* 정리하지 못했으면 그렇다고 말한다. 눌렀는데 아무 일도 일어나지 않는 것이
            이 화면에서 가장 나쁜 답이다 — 사용자는 자기가 잘못 눌렀다고 생각한다. */}
        {sumOpen && !summary && summaryError && (
          <p className="rmg-prop-err" role="alert">{summaryError}</p>
        )}

        <div className="rmg-msgwrap">
          <div className="rmg-drawer-msgs" ref={listRef}>
            {messages.length === 0 ? (
              <p className="rmg-drawer-empty">{en ? "No messages yet." : "아직 대화가 없어요."}</p>
            ) : (
              <MessageGroups messages={messages} nameOf={nameOf} myName={myName} lang={lang} onEdit={onEditMessage} onDelete={onDeleteMessage} />
            )}
            <div ref={endRef} />
          </div>
          <JumpToLatest show={!atBottom} lang={lang} onClick={() => toBottom()} />
        </div>
        <form className="rmg-drawer-compose" onSubmit={submit}>
          <input
            ref={inputRef}
            className="rmg-drawer-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={en ? "Write to everyone on this event…" : "이 일정의 사람들에게…"}
            aria-label={en ? "Message" : "메시지"}
          />
          {/* 캡처 바는 빈 입력이면 보내기를 아예 감춘다. 여기서도 같은 말을 해야 한다 —
              같은 화살표가 어떤 자리에서는 눌리고 어떤 자리에서는 아무 일도 안 하면
              사용자는 자기가 뭘 잘못했는지를 먼저 의심한다. */}
          <button type="submit" className="rmg-ask-send" disabled={!draft.trim()} aria-label={en ? "Send" : "보내기"}>
            <ArrowUp className="rmg-railicon" />
          </button>
        </form>
      </div>
        {timeline && tlOpen && (
          <>
            {/* 사이의 선 — 끌면 폭이 바뀐다. 평소엔 그냥 선이고, 손이 닿으면 그제야 손잡이가 된다. */}
            <div
              className="rmg-evgrip"
              role="separator"
              aria-orientation="vertical"
              aria-label={en ? "Resize" : "폭 조절"}
              onPointerDown={startDrag}
              onDoubleClick={() => setTlW(TL_DEFAULT)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setTlW((w) => clampTl(w + 24));
                if (e.key === "ArrowRight") setTlW((w) => clampTl(w - 24));
              }}
            />
            <div className="rmg-evtl">
              <button
                type="button"
                className="rmg-evtl-fold"
                onClick={() => setTlOpen(false)}
                aria-label={en ? "Hide schedule" : "일정 접기"}
              >›</button>
              {timeline}
            </div>
          </>
        )}
        {/* 접혀 있을 때 — 돌아올 길 하나만 남긴다. */}
        {timeline && !tlOpen && (
          <button
            type="button"
            className="rmg-evtl-unfold"
            onClick={() => setTlOpen(true)}
            aria-label={en ? "Show schedule" : "일정 펼치기"}
          >‹</button>
        )}
      </div>
    </aside>
  );
}

