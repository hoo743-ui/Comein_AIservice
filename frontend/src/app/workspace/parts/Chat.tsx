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
            {divider && <p className="rmg-msg-day" role="separator"><span>{divider}</span></p>}
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
/**
 * 빗금 한 줄 — 손이 자판을 떠나지 않고 쓰는 길.
 *
 * 왜 두는가 — 여기 있는 것들은 **모두 다른 곳에도 손잡이가 있다.** 빗금은 유일한 문이
 * 아니라 지름길이다. 유일한 문이면 그건 외워야 하는 것이 되고, 외워야 하는 인터페이스는
 * §0 이 하지 말라고 한 '소프트웨어를 조작하는' 쪽이다.
 *
 * 왜 몇 개뿐인가 — 목록이 길어지면 그 자체가 또 하나의 화면이 된다. 말을 쓰다 말고
 * 읽어야 하는 목록은 대화를 끊는다. 대화 중에 정말로 하고 싶은 것만 남긴다.
 */
const EMPTY_CMDS: SlashCmd[] = [];

export type SlashCmd = {
  /** 빗금 뒤에 치는 말. 소문자·한 낱말. */
  name: string;
  /** 무엇을 하는지 한 줄. 이름만으로 알 수 있으면 짧게. */
  hint: string;
  run: () => void;
};

export function useSlash(draft: string, setDraft: (v: string) => void, cmds: SlashCmd[]) {
  // 빗금은 **맨 앞에서만** 뜻을 갖는다. "3/4 쯤" 을 쓰다가 목록이 열리면 그게 방해다.
  const typing = draft.startsWith("/");
  const q = typing ? draft.slice(1).toLowerCase() : "";
  const matches = React.useMemo(
    () => (typing ? cmds.filter((c) => c.name.startsWith(q)) : []),
    [typing, q, cmds],
  );
  const [i, setI] = React.useState(0);
  React.useEffect(() => { setI(0); }, [draft]);
  const open = typing && matches.length > 0;
  const run = (c: SlashCmd) => { setDraft(""); c.run(); };

  /** 자판을 가로챈다. true 를 돌려주면 입력칸은 그 키를 못 본다. */
  const onKeyDown = (e: React.KeyboardEvent): boolean => {
    if (!open) return false;
    if (e.key === "ArrowDown") { e.preventDefault(); setI((v) => (v + 1) % matches.length); return true; }
    if (e.key === "ArrowUp") { e.preventDefault(); setI((v) => (v - 1 + matches.length) % matches.length); return true; }
    if (e.key === "Tab") { e.preventDefault(); setDraft(`/${matches[i]?.name ?? matches[0].name}`); return true; }
    if (e.key === "Escape") { e.preventDefault(); setDraft(""); return true; }
    return false;
  };

  /** 보내기 전에 부른다. 빗금이면 실행하고 true — 말로 보내지 않는다. */
  const consume = (): boolean => {
    if (!open) return false;                    // 빗금이지만 아는 말이 아니면 그냥 말이다
    run(matches[i] ?? matches[0]);
    return true;
  };

  return { open, matches, index: i, setIndex: setI, run, onKeyDown, consume };
}

/** 입력칸 바로 위에 뜨는 목록. 화면을 덮지 않는다 — 대화가 계속 보여야 한다. */
export function SlashList({ menu, lang }: { menu: ReturnType<typeof useSlash>; lang: Lang }) {
  if (!menu.open) return null;
  return (
    <div className="rmg-slash" role="listbox" aria-label={lang === "en" ? "Commands" : "명령"}>
      {menu.matches.map((c, n) => (
        <button
          key={c.name}
          type="button"
          role="option"
          aria-selected={n === menu.index}
          className={`rmg-slash-row ${n === menu.index ? "on" : ""}`}
          // 눌러서 고를 수도 있어야 한다 — 자판만 되는 목록은 마우스를 쓰는 사람에게 막혀 있다.
          onMouseEnter={() => menu.setIndex(n)}
          onMouseDown={(e) => { e.preventDefault(); menu.run(c); }}   // blur 보다 먼저 잡는다
        >
          <span className="rmg-slash-name">/{c.name}</span>
          <span className="rmg-slash-hint">{c.hint}</span>
        </button>
      ))}
    </div>
  );
}

/** 접힌 말이 있다는 한 줄. 지운 것이 아니라 접은 것이므로 되돌리는 길을 함께 둔다. */
export function ClearedLine({ count, lang, onUndo }: { count: number; lang: Lang; onUndo: () => void }) {
  if (count <= 0) return null;
  const en = lang === "en";
  return (
    <button type="button" className="rmg-cleared" onClick={onUndo}>
      {en ? `${count} earlier messages · show` : `이전 대화 ${count}개 · 다시 보기`}
    </button>
  );
}

export function ChatThread({ messages, nameOf, myName, placeholder, focus, lang, onSend, onEditMessage, onDeleteMessage, context, cmds, cleared }: {
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
  /** 빗금으로 부를 수 있는 것들. 없으면 빗금은 그냥 글자다. */
  cmds?: SlashCmd[];
  /** 접어 둔 이전 대화 — 개수와 되돌리는 길. */
  cleared?: { count: number; onUndo: () => void };
}) {
  const en = lang === "en";
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  // 이 타래가 어느 방인지는 말이 알고 있다 — 방이 바뀌면 스크롤도 새로 시작한다.
  const { listRef, endRef, atBottom, toBottom } = useStickToBottom(messages, messages[0]?.roomId);

  React.useEffect(() => { if (focus) inputRef.current?.focus(); }, [focus]);

  const menu = useSlash(draft, setDraft, cmds ?? EMPTY_CMDS);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // 빗금이 먼저다 — 아는 말이면 실행하고 끝난다. 모르는 말이면 그냥 말로 보낸다.
    if (menu.consume()) return;
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onSend(text);
  };

  return (
    <>
      <div className="rmg-msgwrap">
        <div className="rmg-drawer-msgs" ref={listRef}>
          {cleared && <ClearedLine count={cleared.count} lang={lang} onUndo={cleared.onUndo} />}
          {/* 접고 나면 '아직 대화가 없어요' 는 거짓말이다 — 말은 바로 위에 접혀 있다.
             빈 칸이 왜 비었는지를 그 자리에서 말해야 사용자가 자기가 지운 줄 알지 않는다. */}
          {messages.length === 0 ? (
            <p className="rmg-drawer-empty">
              {cleared?.count
                ? (en ? "Starting fresh from here." : "여기서부터 새로 시작해요.")
                : (en ? "No messages yet." : "아직 대화가 없어요.")}
            </p>
          ) : (
            <MessageGroups messages={messages} nameOf={nameOf} myName={myName} lang={lang} onEdit={onEditMessage} onDelete={onDeleteMessage} />
          )}
          <div ref={endRef} />
        </div>
        <JumpToLatest show={!atBottom} lang={lang} onClick={() => toBottom()} />
      </div>
      {context}
      <SlashList menu={menu} lang={lang} />
      <form className="rmg-drawer-compose" onSubmit={submit}>
        <input
          ref={inputRef}
          className="rmg-drawer-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { menu.onKeyDown(e); }}
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
