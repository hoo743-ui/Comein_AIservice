"use client";

/**
 * Comein · 진짜 화면 위를 짚는 안내.
 *
 * 가짜 UI 를 만들지 않는다. 각 걸음은 필요한 화면으로 먼저 옮겨 두고(`before`)
 * 그 위의 진짜 요소(`data-tour`)를 가리킨다 — 사용자가 배우는 것은 지금 눈앞의 그 버튼이다.
 *
 * 아홉 걸음을 세 막(둘러보기·함께·맡기기)으로 나눠 둔 이유는, 평평하게 늘어놓으면
 * 세 번째쯤에서 "몇 개나 더 남았지" 가 되기 때문이다. 막 이름이 있으면 남은 개수가 아니라
 * 무엇을 배우는 중인지가 먼저 읽힌다. Esc 로 언제든 나간다.
 */

import * as React from "react";

import type { Lang } from "../i18n";

export type TourStep = {
  key: string;
  target: string;
  /** 어느 막(幕)에 속하는가 — "지금 어디쯤 왔는가" 를 점 아홉 개보다 잘 말한다. */
  act: string;
  title: string;
  body: string;
  example?: string;
  /** 가리킬 실물이 아직 화면에 없을 때 대신 하는 말.
   *  가짜 UI 를 지어내지 않는다 — 없으면 없다고 말하고, 언제 생기는지 알려 준다. */
  whenMissing?: string;
  /** 그 실물이 지금 있는가. 없으면 target 은 '그리로 가는 길'(레일 버튼)을 가리키고,
   *  카드는 whenMissing 을 함께 말한다.
   *
   *  왜 rect 로 판단하지 않는가 — 대체 대상(레일 버튼)은 늘 화면에 있어서 rect 가 잡힌다.
   *  그러면 "아직 이어진 사람이 없어요" 를 말할 기회가 영영 오지 않는다.
   *  (반대로 '답을 기다리는 것' 줄은 정말로 없을 때 사라지므로 rect 만으로 충분하다.) */
  available?: boolean;
  before?: () => void;
};

export function GuideTour({ steps, index, lang, onIndex, onClose }: {
  steps: TourStep[];
  index: number;
  lang: Lang;
  onIndex: (i: number) => void;
  onClose: (completed: boolean) => void;
}) {
  const en = lang === "en";
  const step = steps[index];
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  // 대상이 화면에 나타날 때까지 잠깐 기다린다 — 뷰를 옮긴 직후엔 아직 그려지지 않았을 수 있다.
  React.useEffect(() => {
    step.before?.();
    let raf = 0;
    let tries = 0;
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
        setRect(el.getBoundingClientRect());
        return;
      }
      if (tries++ < 90) raf = requestAnimationFrame(find);
      else setRect(null);
    };
    raf = requestAnimationFrame(find);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  // 창이 바뀌면 자리도 따라간다.
  React.useEffect(() => {
    const sync = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => { window.removeEventListener("resize", sync); window.removeEventListener("scroll", sync, true); };
  }, [step]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
      if (e.key === "ArrowRight") onIndex(Math.min(index + 1, steps.length - 1));
      if (e.key === "ArrowLeft") onIndex(Math.max(index - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, steps.length, onIndex, onClose]);

  const last = index === steps.length - 1;
  const pad = 8;

  // 카드 크기는 재서 쓴다 — 짐작한 값을 쓰면 단계마다 본문 길이가 다른 만큼 어긋나고,
  // 가장 긴 마지막 단계에서 아래가 화면 밖으로 잘린다(실제로 그랬다).
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState({ w: 380, h: 240 });
  React.useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    if (Math.abs(w - box.w) > 1 || Math.abs(h - box.h) > 1) setBox({ w, h });
  });

  // 카드는 대상 **옆**에 서되 화면 밖으로 나가지 않는다. 오른쪽이 좁으면 왼쪽으로 돈다.
  //
  // 옆이 둘 다 좁으면 위나 아래로 돈다 — 예전에는 이때 그냥 화면 안으로 죄어 넣었고,
  // 그 결과 카드가 **자기가 가리키는 것 위에** 앉았다. 첫 걸음이 특히 그랬다: 대상이
  // 작업면 폭을 거의 다 쓰는 블록이라 좌우 어디에도 자리가 없어서, "인사말 아래 한 줄은
  // AI 가 오늘을 읽고 하는 말이에요" 라고 설명하면서 정확히 그 줄을 덮고 있었다.
  // 가리키는 것을 가리는 안내는 안내가 아니다.
  const card = (() => {
    const { w: W, h: H } = box;
    const M = 20;
    const VW = window.innerWidth, VH = window.innerHeight;
    // 화면이 카드보다 낮으면 위쪽에 붙인다 — 가운데 맞추려다 위아래가 같이 잘린다.
    const clampTop = (t: number) => (VH - H - M < M ? M : Math.max(M, Math.min(t, VH - H - M)));
    const clampLeft = (l: number) => (VW - W - M < M ? M : Math.max(M, Math.min(l, VW - W - M)));
    if (!rect) return { left: VW / 2 - W / 2, top: clampTop(VH / 2 - H / 2) };

    // ① 오른쪽 — 대상 옆, 세로는 대상 가운데에 맞춘다.
    if (rect.right + M + W <= VW - M) {
      return { left: rect.right + M, top: clampTop(rect.top + rect.height / 2 - H / 2) };
    }
    // ② 왼쪽.
    if (rect.left - M - W >= M) {
      return { left: rect.left - M - W, top: clampTop(rect.top + rect.height / 2 - H / 2) };
    }
    // ③ 아래 — 가로는 대상 왼쪽에 맞춰 세운다(가운데 정렬은 넓은 대상에서 어디를 가리키는지 흐려진다).
    if (rect.bottom + M + H <= VH - M) {
      return { left: clampLeft(rect.left), top: rect.bottom + M };
    }
    // ④ 위.
    if (rect.top - M - H >= M) {
      return { left: clampLeft(rect.left), top: rect.top - M - H };
    }
    // ⑤ 어디에도 자리가 없다(작은 창에서 큰 대상). 이때만 겹친다 —
    //    겹치더라도 대상의 위쪽 절반은 남기는 쪽으로 붙인다.
    return { left: clampLeft(rect.left), top: clampTop(rect.bottom - H) };
  })();

  return (
    <div className="rmg-tour" role="dialog" aria-label={en ? "Guide" : "사용 가이드"}>
      {/* 나머지 화면을 아주 옅게 눌러 둔다 — 스포트라이트가 아니라 '지금 여기'만 남기는 정도. */}
      {rect && (
        <div
          className="rmg-tour-ring"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      )}
      <div ref={cardRef} className="rmg-tour-card" style={{ left: card.left, top: card.top }}>
        {/* 지금 어디쯤 왔는가 — 점 아홉 개만으로는 "몇 개 남았지" 밖에 읽히지 않는다.
            막 이름을 앞에 두면 남은 개수가 아니라 무엇을 배우는 중인지가 먼저 읽힌다. */}
        <p className="rmg-tour-act">
          <span className="rmg-tour-actname">{step.act}</span>
          <span className="rmg-tour-count">{index + 1} / {steps.length}</span>
        </p>
        <p className="rmg-tour-title">{step.title}</p>
        <p className="rmg-tour-body">{step.body}</p>
        {/* 가리킬 실물이 아직 없다 — 없는 것을 있는 척 그리지 않고, 언제 생기는지 말한다. */}
        {step.whenMissing && (step.available === false || !rect) && (
          <p className="rmg-tour-none">{step.whenMissing}</p>
        )}
        {/* 이런 모습이 된다 — 한 조각. */}
        {step.example && <p className="rmg-tour-eg">{step.example}</p>}
        <div className="rmg-tour-foot">
          {/* 점은 표식이 아니라 손잡이다 — 되짚고 싶은 걸음으로 바로 간다.
              아홉 걸음을 되돌아가려고 '이전' 을 여덟 번 누르게 두지 않는다. */}
          <span className="rmg-tour-dots" role="tablist" aria-label={en ? "Steps" : "걸음"}>
            {steps.map((st, i) => (
              <button
                key={st.key}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${i + 1}. ${st.title}`}
                title={st.title}
                className={`rmg-tour-dot ${i === index ? "on" : ""} ${i < index ? "past" : ""}`}
                onClick={() => onIndex(i)}
              />
            ))}
          </span>
          <div className="rmg-tour-acts">
            {index > 0 && (
              <button type="button" className="rmg-ppl-act" onClick={() => onIndex(index - 1)}>{en ? "Back" : "이전"}</button>
            )}
            <button type="button" className="rmg-ppl-act primary" onClick={() => (last ? onClose(true) : onIndex(index + 1))}>
              {last ? (en ? "Start" : "시작하기") : (en ? "Next" : "다음")}
            </button>
          </div>
        </div>
        {/* 꼬리 한 줄 — 왼쪽에 키보드 안내, 오른쪽에 건너뛰기.
            건너뛰기는 전에 카드 오른쪽 위 모서리에 절대 위치로 떠 있었는데, 거기는 걸음
            수(1 / 9)가 이미 서 있는 자리라 둘이 겹쳐 읽혔다. '다음' 아래로 내려 오른쪽
            끝에 맞춘다 — 나가는 길은 나아가는 길 다음에 오는 것이 순서에도 맞는다. */}
        <div className="rmg-tour-tail">
          <p className="rmg-tour-keys" aria-hidden>{en ? "← → to move · Esc to leave" : "← → 로 이동 · Esc 로 나가기"}</p>
          <button type="button" className="rmg-tour-skip" onClick={() => onClose(true)}>{en ? "Skip" : "건너뛰기"}</button>
        </div>
      </div>
    </div>
  );
}

/** 계정 — 로그인해야 이 워크스페이스가 이 기기 밖으로 나간다.
 *  연결 전에는 "이 브라우저에만 있습니다" 라고 정직하게 말한다(조용히 안 되는 척하지 않는다). */
