"use client";

/**
 * Comein · 말풍선을 그리지 않는 대화.
 *
 * 메신저처럼 보이면 이 화면은 메신저가 된다. 그래서 말풍선도, 줄마다 붙는 이름표도 없다 —
 * 종이에 적힌 대화처럼, 사람이 바뀌거나 시간이 벌어질 때만 이름과 시각을 다시 적는다.
 * 그 묶는 규칙은 `../chatTime` 이 쥔다(화면은 묶인 것을 눕히기만 한다).
 *
 * 1:1 방과 일정 방이 이 한 벌을 함께 쓴다. 대화를 두 벌로 만들지 않는다.
 */

import * as React from "react";
import { ArrowUp, ChevronDown } from "lucide-react";

import { fmtTime } from "@/lib/format";
import { ME_ID, type ChatMessage } from "@/lib/types";
import { dayDivider, groupMessages } from "../chatTime";
import { useStickToBottom } from "../hooks";
import type { Lang } from "../i18n";

/** 대화에서 건져 올린 네 갈래. 근거가 없는 갈래는 서버가 비워 보내고, 화면에도 서지 않는다. */
export type ChatSummary = { recap: string; decided: string; pending: string; next: string;
  /** AI 가 대화에서 끌어낸 이름. 방을 만들 때는 알 수 없던 것이다. */
  title?: string };

/** 요약 한 겹 — 카드가 아니라 얇은 구획.
 *
 *  "AI 요약" 이라는 큰 라벨도, 아이콘도, 파란 상자도 두지 않는다(§16).
 *  정리된 정보가 대화 위에 조용히 놓여 있을 뿐이다 — 말하는 존재가 아니라 정리하는 시스템(§17). */
export function SummaryBlock({ summary, lang, busy, onRefresh }: {
  summary: ChatSummary;
  lang: Lang;
  busy: boolean;
  onRefresh?: () => void;
}) {
  const en = lang === "en";
  const rows: [string, string][] = [
    [en ? "Recap" : "최근 대화", summary.recap],
    [en ? "Decided" : "결정된 내용", summary.decided],
    [en ? "Open" : "미정 사항", summary.pending],
    [en ? "Next" : "다음 행동", summary.next],
  ];
  const shown = rows.filter(([, v]) => v);
  if (!shown.length) return null;

  return (
    <section className="rmg-sum" aria-label={en ? "Summary" : "요약"}>
      {shown.map(([k, v]) => (
        <div key={k} className="rmg-sum-row">
          <span className="rmg-sum-k">{k}</span>
          <span className="rmg-sum-v">{v}</span>
        </div>
      ))}
      {onRefresh && (
        <button type="button" className="rmg-sum-again" disabled={busy} onClick={onRefresh}>
          {busy ? (en ? "Reading…" : "읽는 중…") : (en ? "Refresh" : "다시 정리")}
        </button>
      )}
    </section>
  );
}

/** 내 말 한 줄에 붙는 조용한 손잡이 — 평소엔 없다.
 *  마우스가 그 줄에 닿을 때만 점 세 개가 떠오르고, 거기서 고치거나 지운다.
 *  버튼이 늘 떠 있으면 대화가 아니라 관리 화면이 된다(§1·§6). */
function MessageLine({ m, mine, lang, onEdit, onDelete }: {
  m: ChatMessage;
  mine: boolean;
  lang: Lang;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  const en = lang === "en";
  const [menu, setMenu] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [asking, setAsking] = React.useState(false);   // 지울까요?
  const [draft, setDraft] = React.useState(m.content);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!editing) return;
    setDraft(m.content);
    const el = ref.current;
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  // 메뉴는 바깥을 누르면 닫힌다 — 열어 둔 채로 다른 걸 하다 잊게 두지 않는다.
  React.useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  const save = () => {
    const text = draft.trim();
    setEditing(false);
    if (text && text !== m.content) onEdit(m.id, text);
  };

  if (editing) {
    return (
      <div className="rmg-mg-edit">
        <textarea
          ref={ref}
          className="rmg-mg-editin"
          value={draft}
          rows={Math.min(6, draft.split("\n").length)}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
            if (e.key === "Escape") setEditing(false);
          }}
          aria-label={en ? "Edit message" : "메시지 수정"}
        />
        <div className="rmg-mg-editacts">
          <button type="button" className="rmg-ppl-make" onClick={() => setEditing(false)}>{en ? "Cancel" : "취소"}</button>
          <button type="button" className="rmg-ppl-act primary" onClick={save} disabled={!draft.trim()}>{en ? "Save" : "저장"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rmg-mg-row">
      <p className="rmg-mg-line">
        {m.content}
        {m.edited && <span className="rmg-mg-edited">{en ? "(edited)" : "(수정됨)"}</span>}
      </p>

      {mine && !asking && (
        <div className="rmg-mg-act">
          <button
            type="button"
            className="rmg-mg-more"
            aria-label={en ? "Message actions" : "메시지 메뉴"}
            aria-expanded={menu}
            onClick={(e) => { e.stopPropagation(); setMenu((v) => !v); }}
          >···</button>
          {menu && (
            <div className="rmg-mg-menu" role="menu" onClick={(e) => e.stopPropagation()}>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); setEditing(true); }}>
                {en ? "Edit" : "수정"}
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); setAsking(true); }}>
                {en ? "Delete" : "삭제"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 지울까요 — 화면을 덮는 경고창을 띄우지 않는다. 그 줄 옆에서 한 번만 묻는다(§3). */}
      {asking && (
        <span className="rmg-mg-ask">
          <span className="rmg-mg-askq">{en ? "Delete?" : "지울까요?"}</span>
          <button type="button" className="rmg-ppl-make" onClick={() => setAsking(false)}>{en ? "Cancel" : "취소"}</button>
          <button type="button" className="rmg-mg-del" onClick={() => { setAsking(false); onDelete(m.id); }}>
            {en ? "Delete" : "삭제"}
          </button>
        </span>
      )}
    </div>
  );
}

/** 묶인 말 한 뭉치. 1:1 방과 일정 방이 이 한 모양을 함께 쓴다. */
export function MessageGroups({ messages, nameOf, myName, lang, onEdit, onDelete }: {
  messages: ChatMessage[];
  nameOf: (userId: string) => string;
  myName: string;
  lang: Lang;
  onEdit?: (id: string, text: string) => void;
  onDelete?: (id: string) => void;
}) {
  const groups = React.useMemo(() => groupMessages(messages), [messages]);
  let prevDay: Date | null = null;

  return (
    <>
      {groups.map((g) => {
        const divider = dayDivider(prevDay, g.at, lang);
        prevDay = g.at;
        return (
          <React.Fragment key={g.key}>
            {divider && <p className="rmg-msg-day">{divider}</p>}
            <div className={`rmg-mg ${g.senderId === ME_ID ? "mine" : ""}`}>
              <p className="rmg-mg-head">
                <span className="rmg-mg-who">{g.senderId === ME_ID ? myName : nameOf(g.senderId)}</span>
                <span className="rmg-mg-at">{fmtTime(g.at)}</span>
              </p>
              {g.items.map((m) => (
                <MessageLine
                  key={m.id}
                  m={m}
                  mine={g.senderId === ME_ID && !m.pending && !!onEdit}
                  lang={lang}
                  onEdit={(id, text) => onEdit?.(id, text)}
                  onDelete={(id) => onDelete?.(id)}
                />
              ))}
            </div>
          </React.Fragment>
        );
      })}
    </>
  );
}

/** 최근으로 — 위를 읽는 동안에만 대화 위에 낮게 떠 있는 한 점.
 *  없앴다 다시 만들지 않고 자리에 둔 채 사라지게 한다 — 나타남과 사라짐이 같아야 조용하다. */
export function JumpToLatest({ show, lang, onClick }: { show: boolean; lang: Lang; onClick: () => void }) {
  const label = lang === "en" ? "Jump to latest" : "최근 대화로";
  return (
    <button
      type="button"
      className="rmg-tolast"
      data-show={show}
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <ChevronDown className="rmg-tolast-ic" aria-hidden />
    </button>
  );
}

/** 대화 한 타래 — 1:1 방과 일정 방이 똑같은 모양을 쓴다.
 *  방이 달라도 '말이 쌓이는 방식'까지 달라지면 두 개의 다른 앱처럼 보인다. */
export function ChatThread({ messages, nameOf, myName, placeholder, focus, lang, onSend, onEditMessage, onDeleteMessage, context }: {
  messages: ChatMessage[];
  nameOf: (userId: string) => string;
  myName: string;
  placeholder: string;
  focus: boolean;
  lang: Lang;
  onSend: (text: string) => void;
  /** 내 말 고치기·지우기. 없으면 손잡이 자체가 나타나지 않는다. */
  onEditMessage?: (id: string, text: string) => void;
  onDeleteMessage?: (id: string) => void;
  /** 말과 입력칸 사이에 끼는 얇은 한 줄 — 대화에서 건져 올린 것(시간 따위)을 권하는 자리. */
  context?: React.ReactNode;
}) {
  const en = lang === "en";
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  // 이 타래가 어느 방인지는 말이 알고 있다 — 방이 바뀌면 스크롤도 새로 시작한다.
  const { listRef, endRef, atBottom, toBottom } = useStickToBottom(messages, messages[0]?.roomId);

  React.useEffect(() => { if (focus) inputRef.current?.focus(); }, [focus]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onSend(text);
  };

  return (
    <>
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
      {context}
      <form className="rmg-drawer-compose" onSubmit={submit}>
        <input
          ref={inputRef}
          className="rmg-drawer-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          aria-label={en ? "Message" : "메시지"}
        />
        <button type="submit" className="rmg-ask-send" disabled={!draft.trim()} aria-label={en ? "Send" : "보내기"}>
          <ArrowUp className="rmg-railicon" />
        </button>
      </form>
    </>
  );
}

/** 여러 사람이 함께할 자리를 새로 만든다 — Comein 에서 '단체방을 판다'는 곧 '자리를 잡는다'는 뜻.
 *  방을 따로 만들지 않는다. 일정이 생기면 그 일정의 방과 멤버가 함께 생긴다. */
