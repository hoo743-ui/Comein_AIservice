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

import { AiDoor } from "./Environment";
import { useKeyHint } from "../hooks";
import { L, type Lang } from "../i18n";
import type { View } from "../nav";

export function DoorInvoke({ view, lang, organizing, onSubmit, tuck }: {
  view: View; lang: Lang; organizing: boolean; onSubmit: (v: string) => void;
  /** 접힌 채로 물러나 있을 상황인가(대화가 열려 있어 입력칸이 겹칠 때 등). */
  tuck?: boolean;
}) {
  const tt = L(lang);
  const hints = tt.hints();
  const [draft, setDraft] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const [hi, setHi] = React.useState(0);
  const kbd = useKeyHint();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inputRef.current?.focus(); }
      else if (e.key === "Escape") inputRef.current?.blur();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  React.useEffect(() => {
    if (focused || draft) return;
    const iv = setInterval(() => setHi((i) => (i + 1) % hints.length), 3400);
    return () => clearInterval(iv);
  }, [focused, draft, hints.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    onSubmit(v);
    setDraft("");
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
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="rmg-ask-input"
        aria-label={lang === "en" ? "Ask Comein" : "Comein에게 입력"}
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

