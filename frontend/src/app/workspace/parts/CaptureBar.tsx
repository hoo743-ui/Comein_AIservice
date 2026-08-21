"use client";

/**
 * Comein · 모든 기능의 입구.
 *
 * 이 화면에서 사용자가 가장 자주 만지는 하나다. 그래서 규칙이 몇 개 있다:
 *   - 어디서든 ⌘K(또는 Ctrl K)로 열린다. Esc 로 물러난다.
 *   - 아래에 제 입력칸을 가진 화면 위에서는 접혀 물러난다(`tuck`) — 둘이 겹치면 손이 헷갈린다.
 *   - 접혀 있어도 문 표식은 남긴다. 그게 'AI 에게 말하는 자리' 라는 유일한 이름표다.
 *
 * 여기서 하는 일은 한 줄을 받아 위로 넘기는 것까지다. 그 한 줄이 무엇이 되는지는
 * page.tsx 의 `capture()` 가 정한다 — 입구는 판단하지 않는다.
 */

import * as React from "react";
import { ArrowUp } from "lucide-react";

import { applyMention, matchPeople, mentionAt, type MentionTyping } from "@/lib/mention";
import type { Contact } from "@/lib/types";
import { AiDoor } from "./Environment";
import { useKeyHint } from "../hooks";
import { L, type Lang } from "../i18n";
import type { View } from "../nav";

export function DoorInvoke({ view, lang, organizing, onSubmit, tuck, people = [] }: {
  view: View; lang: Lang; organizing: boolean; onSubmit: (v: string) => void;
  /** 접힌 채로 물러나 있을 상황인가(대화가 열려 있어 입력칸이 겹칠 때 등). */
  tuck?: boolean;
  /** `@` 로 부를 수 있는 사람들. 비어 있으면 `@` 는 그냥 글자다. */
  people?: Contact[];
}) {
  const tt = L(lang);
  const hints = tt.hints();
  const [draft, setDraft] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const [hi, setHi] = React.useState(0);
  const kbd = useKeyHint();
  const inputRef = React.useRef<HTMLInputElement>(null);

  /** 사람 목록이 열려 있는가 — 창 전역 Esc 가 입력칸을 놓아 버리지 않게 여기서 본다.
   *  (아래 onKeyDown 의 stopPropagation 은 window 리스너까지 막지 못한다.) */
  const menuRef = React.useRef(false);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inputRef.current?.focus(); }
      // Esc 한 번은 목록을 닫는 데 쓴다. 쓰던 말과 커서를 함께 잃지 않도록.
      else if (e.key === "Escape" && !menuRef.current) inputRef.current?.blur();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  React.useEffect(() => {
    if (focused || draft) return;
    const iv = setInterval(() => setHi((i) => (i + 1) % hints.length), 3400);
    return () => clearInterval(iv);
  }, [focused, draft, hints.length]);

  // ── @ 로 사람 부르기 ──
  // 규칙과 글자 다루기는 `lib/mention` 에 있다. 여기서는 '언제 열고 무엇을 고르나' 만 쥔다.
  const [typing, setTyping] = React.useState<MentionTyping | null>(null);
  const [pick, setPick] = React.useState(0);
  const hits = React.useMemo(
    () => (typing ? matchPeople(people, typing.query) : []),
    [typing, people],
  );
  const menuOpen = !!typing && hits.length > 0;
  menuRef.current = menuOpen;
  React.useEffect(() => { setPick(0); }, [typing?.query]);

  /** 입력이 바뀔 때마다 커서 앞을 다시 본다 — 지우다가 `@` 로 돌아오면 목록도 돌아온다. */
  const sync = (el: HTMLInputElement) => {
    setTyping(people.length ? mentionAt(el.value, el.selectionStart ?? el.value.length) : null);
  };

  const choose = (c: Contact) => {
    if (!typing) return;
    const next = applyMention(draft, typing, String(c.handle));
    setDraft(next.text);
    setTyping(null);
    // 커서를 넣은 자리 뒤로 옮긴다 — 안 하면 문장 끝으로 튀어 이어 쓸 수가 없다.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // 목록이 열려 있으면 Enter 는 '고르기' 다 — 보내기가 아니다.
    if (menuOpen) { choose(hits[pick] ?? hits[0]); return; }
    const v = draft.trim();
    if (!v) return;
    onSubmit(v);
    setDraft("");
    setTyping(null);
  };
  const placeholder = focused ? tt.placeholder(view) : hints[hi];

  // 캘린더에서는 접힌 채로 물러나 있는다.
  // 하루의 시간을 보는 화면에서 넓은 입력창이 아래를 가로막으면, 정작 저녁 시간대가 가려진다.
  // 부를 때만 펼친다 — 누르거나 ⌘K. (문은 늘 거기 있지만, 열려 있진 않다.)
  const tucked = (view === "calendar" || tuck) && !focused && !draft;

  return (
    <form
      onSubmit={submit}
      className={`rmg-ask ${focused ? "focus" : ""} ${tucked ? "tuck" : ""}`}
      data-tour="capture"
      /* 알약 어디를 눌러도 입력이 열린다.
         바는 62px 인데 안쪽 input 은 32px 이라, 위아래 14px 씩은 눌러도 아무 일도
         일어나지 않았다 — 커서로는 가운데를 정확히 겨누지만 손끝에는 그 띠가 넓다.
         예전에는 접힌 알약일 때만 열어 줬다. 펼쳐져 있을 때가 오히려 더 자주 눌린다.
         padding 을 input 으로 옮기는 방법도 있지만, 그러면 접힌 알약의 높이가
         남은 자식에 끌려 함께 무너진다. 여기서는 손이 닿은 곳만 옮겨 준다. */
      onPointerDown={(e) => {
        // 보내기 버튼과 입력 자신은 제 일을 하게 둔다.
        if ((e.target as HTMLElement).closest("button, input, textarea")) return;
        e.preventDefault();   // 기본 동작이 포커스를 도로 가져가지 않게
        inputRef.current?.focus();
      }}
    >
      {/* 접혀 있어도 문은 남긴다 — ⌘K 만 떠 있으면 그 알약이 무엇인지 알 길이 없다.
          문은 이 화면 어디서나 'AI 에게 말하는 자리'를 뜻하므로, 접힌 상태의 이름표가 된다. */}
      <span className="rmg-ask-door" aria-hidden><AiDoor active={organizing || focused} className="rmg-ask-doormark" /></span>
      {/* 부를 사람 목록 — 입력칸 **위로** 뜬다. 캡처 바는 화면 아래에 있어서
          아래로 펴면 창 밖으로 나간다. 화면을 덮지 않는다(목록은 여섯 줄까지). */}
      {menuOpen && (
        <div className="rmg-ment" role="listbox" aria-label={lang === "en" ? "People" : "사람"}>
          {hits.map((c, n) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={n === pick}
              className={`rmg-ment-row ${n === pick ? "on" : ""}`}
              onMouseEnter={() => setPick(n)}
              // blur 보다 먼저 잡는다 — mousedown 을 놓치면 목록이 닫히며 고르기가 취소된다.
              onMouseDown={(e) => { e.preventDefault(); choose(c); }}
            >
              <span className="rmg-ment-av" aria-hidden>{c.name?.slice(0, 1) ?? "·"}</span>
              <span className="rmg-ment-name">{c.realName ?? c.name}</span>
              <span className="rmg-ment-handle">@{c.handle}</span>
            </button>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); sync(e.target); }}
        // 커서만 옮겨도 상황이 바뀐다 — 화살표로 `@조각` 안팎을 드나들 수 있다.
        onKeyUp={(e) => sync(e.currentTarget)}
        onClick={(e) => sync(e.currentTarget)}
        onKeyDown={(e) => {
          if (!menuOpen) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setPick((v) => (v + 1) % hits.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setPick((v) => (v - 1 + hits.length) % hits.length); }
          else if (e.key === "Tab") { e.preventDefault(); choose(hits[pick] ?? hits[0]); }
          // Esc 는 목록만 닫는다. 입력칸까지 비우지 않는다 — 쓰던 말을 잃는 건 과하다.
          else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setTyping(null); }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setTyping(null); }}
        placeholder={placeholder}
        className="rmg-ask-input"
        aria-label={lang === "en" ? "Ask Comein" : "Comein에게 입력"}
        autoComplete="off"
      />
      {draft.trim() ? (
        <button type="submit" className="rmg-ask-send" aria-label={lang === "en" ? "Send" : "보내기"}><ArrowUp className="rmg-railicon" /></button>
      ) : (
        <>
          <span className="rmg-ask-kbd">{kbd}</span>
          {/* 손가락만 있는 기기에서는 키캡이 감춰진다. 접힌 알약은 그러면 빈 채로 떠 있게 되므로
              — 접혔을 때만 — 무엇을 여는지 낱말로 남긴다(문 표식은 접히면 걸지 않는다, 위 참고). */}
          {tucked && <span className="rmg-ask-tap">{lang === "en" ? "Ask" : "입력"}</span>}
        </>
      )}
    </form>
  );
}

