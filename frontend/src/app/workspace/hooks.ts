/**
 * Comein · 화면이 쓰는 작은 습관들.
 *
 * 컴포넌트 안에 두면 그 컴포넌트만의 것이 되고, 같은 습관을 다른 조각이 또 쓰려 할 때
 * 두 벌이 된다(실제로 손끝 크기 판정이 그랬다 — 두 군데에서 같은 것을 말하다가
 * 한쪽만 고쳐졌다).
 */

import * as React from "react";
import { ME_ID, type ChatMessage } from "@/lib/types";
import { HINTS } from "./i18n";

/** Ask Comein — 항상 보이는 주 입력. 문(브랜드) + 명확한 필드 + 회전 예시. 1초 안에 '여기서 시작'임을 안다. */
/** 키캡은 기기마다 다른 말이다 — 맥은 ⌘, 그 밖은 Ctrl. 우리 손잡이는 처음부터 둘 다 받는데
    (metaKey || ctrlKey) 그림에는 ⌘ 만 그려 두고 있었다. 서버는 어느 기기인지 모르므로
    첫 그림은 ⌘ 로 두고 붙은 뒤에 고친다(그래야 hydration 이 어긋나지 않는다).
    물리 키보드가 아예 없는 기기는 글자를 바꿀 일이 아니라 감출 일이라 CSS 가 맡는다. */
export function useKeyHint() {
  const [hint, setHint] = React.useState("⌘K");
  React.useEffect(() => {
    const ua = navigator.userAgent || "";
    const plat = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || "";
    if (!/Mac|iPhone|iPad|iPod/.test(plat + ua)) setHint("Ctrl K");
  }, []);
  return hint;
}

/** 손가락으로 쓰는 기기인가. 서버는 모르므로 붙은 뒤에 답한다(첫 그림은 마우스 기준). */
export function useCoarsePointer() {
  const [coarse, setCoarse] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const sync = () => setCoarse(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return coarse;
}

/** '맨 아래'로 쳐 주는 여유 — 한 줄 남짓. 1px 떨어졌다고 손잡이를 세우지 않는다. */
export const NEAR_BOTTOM = 48;

/** 맨 아래에 붙어 있기 — 그리고 떨어졌을 때 돌아갈 길 하나.
 *
 *  대화는 마지막 말이 보여야 한다. 그래서 새 말이 오면 따라 내려간다 — 다만
 *  사람이 위를 읽고 있을 때는 그러지 않는다. 읽던 자리를 낚아채는 것만큼
 *  대화를 끊는 일이 없다. 대신 '최근으로' 한 점을 띄우고, 누를 때까지 기다린다.
 *  내가 방금 한 말은 예외다 — 보내 놓고 보이지 않으면 보낸 것 같지 않다.
 *
 *  방을 옮기면 흐르지 않고 곧장 맨 아래에 선다 — 열자마자 미끄러지는 화면은 산만하다. */
export function useStickToBottom(messages: ChatMessage[], roomKey?: string) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = React.useState(true);

  const toBottom = React.useCallback((smooth = true) => {
    const el = listRef.current;
    if (!el) return;
    // 모션을 줄여 달라고 한 사람에게는 미끄러뜨리지 않는다.
    const calm = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth && !calm ? "smooth" : "auto" });
    setAtBottom(true);
  }, []);

  // 붙어 있는가 — 스크롤마다 상태를 건드리지 않고 한 프레임에 한 번만 읽는다.
  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let raf = 0;
    const read = () => { raf = 0; setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM); };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
    el.addEventListener("scroll", onScroll, { passive: true });
    read();
    return () => { el.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // 방이 바뀌면(그리고 처음 열릴 때) 마지막 말 앞에 세운다.
  React.useEffect(() => { toBottom(false); }, [roomKey, toBottom]);

  // 새 말 — 붙어 있었거나, 내가 한 말이면 따라 내려간다.
  const count = messages.length;
  const lastMine = messages[count - 1]?.senderId === ME_ID;
  const stuck = React.useRef(true);
  stuck.current = atBottom;   // 아래 효과가 '붙었는지' 때문에 다시 돌지 않도록, 값은 이 길로만 흐른다
  React.useEffect(() => {
    if (!stuck.current && !lastMine) return;
    endRef.current?.scrollIntoView({ block: "end" });
    setAtBottom(true);
  }, [count, lastMine]);

  return { listRef, endRef, atBottom, toBottom };
}
