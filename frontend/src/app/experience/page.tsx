"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { refreshSession, signInWithPassword, signInWithProvider, signUpWithPassword } from "@/lib/remote";

/**
 * Comein · Opening — 로그인이 아니라 '들어서는 경험'.
 * 로고 페이드 → (호흡) → 문 등장 → (호흡) → 문이 천천히 열리며 보라 빛이 번짐
 *  → 빛에서 인증 카드가 태어남 → 로그인 → 문이 다시 열리며 워크스페이스로.
 * 문(Door)이 시그니처. 보라 = 지능. 모든 움직임은 느리고 차분하고 의도적으로.
 */

type Phase = "logo" | "door" | "open" | "reveal" | "auth" | "entering";
type Provider = "github" | "kakao";
const PROVIDERS: { key: Provider; label: string }[] = [
  { key: "github", label: "GitHub" },
  { key: "kakao", label: "카카오" },
];

// Comein = Co(ntext) · Me(mory) · In(sight) — 앞글자를 강조하면 곧 브랜드가 된다.
const TRIAD = [
  { frag: "Co", rest: "ntext", desc: "흩어진 맥락을 읽고," },
  { frag: "Me", rest: "mory", desc: "중요한 것을 기억하고," },
  { frag: "In", rest: "sight", desc: "정리된 통찰로 돌려드려요." },
];

/** Context·Memory·Insight — Comein 아래로 뻗는 세 가지. 부모 클래스로 크기·모션을 다르게 준다. */
function Triad() {
  return (
    <ul className="opn-tree-list">
      {TRIAD.map((t, i) => (
        <li key={t.frag} className={`opn-tree-item opn-t${i}`}>
          <span className="opn-tree-word"><span className="opn-frag">{t.frag}</span>{t.rest}</span>
          <span className="opn-tree-desc">{t.desc}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Opening() {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("logo");
  const [busy, setBusy] = React.useState<Provider | null>(null);
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    // 리빌(Context·Memory·Insight → Comein)은 이 경험의 핵심이라 항상 거친다.
    // reduced-motion에선 CSS 모션만 죽이고(정적 표시) 흐름은 유지 — 대신 대기를 짧게.
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const t = reduce
      ? { door: 200, open: 500, reveal: 900, auth: 3200 }
      : { door: 2000, open: 3800, reveal: 5000, auth: 8200 };
    const timers = [
      setTimeout(() => setPhase("door"), t.door),
      setTimeout(() => setPhase("open"), t.open),
      setTimeout(() => setPhase("reveal"), t.reveal),
      setTimeout(() => setPhase("auth"), t.auth),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const cross = React.useCallback(() => {
    // 문이 다시 열리고 빛이 앞으로 — 워크스페이스로 건너간다(문턱은 이 순간이 대신함).
    setPhase("entering");
    try { sessionStorage.setItem("comein:reimagine", "1"); sessionStorage.setItem("comein:justEntered", "1"); } catch {}
    setTimeout(() => router.push("/workspace"), 1300);
  }, [router]);

  /** 건너뛰기 — 인트로만 넘긴다. 다른 페이지로 내보내지 않고, 이 화면의 로그인 카드로 바로 간다.
   *  이미 들어와 있으면 그대로 통과. */
  const skip = React.useCallback(() => {
    // 먼저 반응하고 나서 확인한다 — 세션 조회(네트워크)를 기다리면 누른 게 씹힌 것처럼 느껴진다.
    setPhase("auth");
    void refreshSession().then((uid) => { if (uid) cross(); });
  }, [cross]);

  const social = async (p: Provider) => {
    if (busy || phase === "entering") return;
    setBusy(p);
    setErr(null);
    try {
      const { error } = await signInWithProvider(p, `${window.location.origin}/workspace`);
      if (error) throw error;
    } catch (e: any) { setErr(e?.message ?? "연결에 문제가 생겼어요."); setBusy(null); }
  };
  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      if (mode === "signup") await signUpWithPassword(email, pw);
      else await signInWithPassword(email, pw);
      cross();
    } catch (e: any) { setErr(e?.message ?? "로그인에 실패했어요."); }
  };

  const doorOpen = phase === "open" || phase === "reveal" || phase === "auth" || phase === "entering";

  return (
    <div className={`opn phase-${phase}`}>
      <style>{CSS}</style>
      <div className="opn-bg" aria-hidden />
      <div className="opn-light" aria-hidden />
      <div className="opn-flash" aria-hidden />

      <button type="button" className="opn-skip" onClick={skip} aria-label="인트로 건너뛰기">
        건너뛰기
        <span className="opn-skip-ar" aria-hidden>→</span>
      </button>

      <div className="opn-stage">
        <p className="opn-logo">Comein</p>
        <p className="opn-tag">Scattered thoughts become structured flow.</p>

        <div className={`opn-door ${doorOpen ? "open" : ""}`} aria-hidden>
          <svg viewBox="0 0 40 52" fill="none" className="opn-door-svg">
            <rect x="3" y="3" width="34" height="46" rx="2.5" className="opn-door-frame" strokeWidth="1.6" />
            <path d="M20 7 L31 10 V42 L20 45 Z" className="opn-door-panel" strokeWidth="1.6" />
            <circle cx="23.5" cy="26" r="1.1" className="opn-door-handle" />
          </svg>
        </div>

        {phase === "reveal" && (
          <div className="opn-reveal" aria-hidden>
            <Triad />
          </div>
        )}

        {(phase === "auth" || phase === "entering") && (
          <div className="opn-authwrap">
            <aside className="opn-brand" aria-hidden>
              <p className="opn-brand-logo">Comein</p>
              <p className="opn-brand-tag">Scattered thoughts become structured flow.</p>
              <Triad />
            </aside>

            <div className="opn-card">
            <p className="opn-card-hi">{mode === "login" ? "Welcome back." : "Welcome."}</p>

            <div className="opn-providers">
              {PROVIDERS.map((p, i) => (
                <button
                  key={p.key}
                  onClick={() => social(p.key)}
                  className="opn-provider"
                  disabled={busy !== null || phase === "entering"}
                  data-busy={busy === p.key}
                  style={{ animationDelay: `${0.25 + i * 0.08}s` }}
                >
                  <Glyph provider={p.key} />
                  <span>{busy === p.key ? "들어가는 중…" : `Continue with ${p.label}`}</span>
                </button>
              ))}
            </div>

            <div className="opn-div"><span>or with email</span></div>

            <form className="opn-form" onSubmit={submitAuth}>
              {mode === "signup" && (
                <input className="opn-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" aria-label="이름" autoComplete="name" />
              )}
              <input className="opn-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" aria-label="이메일" autoComplete="email" />
              <input className="opn-field" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="비밀번호" aria-label="비밀번호" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
              {err && <p className="opn-err">{err}</p>}
              <button type="submit" className="opn-submit" disabled={phase === "entering"}>{mode === "login" ? "Enter Comein" : "Create your space"}</button>
            </form>

            <p className="opn-switch">
              {mode === "login" ? "처음이신가요? " : "이미 계정이 있나요? "}
              <button type="button" onClick={() => { setErr(null); setMode(mode === "login" ? "signup" : "login"); }}>
                {mode === "login" ? "회원가입" : "로그인"}
              </button>
            </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Glyph({ provider }: { provider: Provider }) {
  // 말풍선 — 카카오의 형태만 단색으로. 브랜드 노랑을 이 화면에 들이지 않는다.
  if (provider === "kakao") return (
    <svg className="opn-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 3C6.9 3 2.8 6.3 2.8 10.3c0 2.6 1.7 4.9 4.3 6.2l-1.1 4c-.1.3.3.6.6.4l4.7-3.1c.2 0 .5.1.7.1 5.1 0 9.2-3.3 9.2-7.6S17.1 3 12 3z" /></svg>
  );
  return (
    <svg className="opn-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.47c.53.1.72-.23.72-.5v-1.77c-2.92.64-3.54-1.4-3.54-1.4-.48-1.22-1.17-1.55-1.17-1.55-.95-.65.07-.64.07-.64 1.06.07 1.61 1.09 1.61 1.09.94 1.6 2.46 1.14 3.06.87.1-.68.37-1.14.67-1.4-2.33-.27-4.78-1.17-4.78-5.2 0-1.15.41-2.09 1.09-2.83-.11-.27-.47-1.34.1-2.79 0 0 .88-.28 2.89 1.08a10 10 0 0 1 5.26 0c2-1.36 2.89-1.08 2.89-1.08.57 1.45.21 2.52.1 2.79.68.74 1.09 1.68 1.09 2.83 0 4.04-2.46 4.93-4.8 5.19.38.33.71.97.71 1.96v2.9c0 .28.19.61.73.5A10.5 10.5 0 0 0 12 1.5z" /></svg>
  );
}

const CSS = `
.opn {
  --paper: #0E0D12; --ink: #F2F0EC; --muted: #98938A; --faint: #565049;
  --accent: #9B8E86; --glow: rgba(155,142,134,0.16); --surface: #17140F; --hair: #262019;
  position: fixed; inset: 0; z-index: 1;
  background: var(--paper); color: var(--ink);
  font-family: var(--font-sans), "Pretendard Variable", -apple-system, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased; overflow-y: auto; overflow-x: hidden;
}

/* 문에서 번지는 보라 빛 — 지능. 느리게 확장. */
/* 배경 — 사무실 무드 사진을 흐릿하게, 아주 옅게. 어둠 위 은은한 온기. (public/comein-opening.png) */
.opn-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background: url('/comein-opening.png') center/cover no-repeat;
  filter: blur(9px) saturate(0.92) brightness(0.9); transform: scale(1.06); opacity: 0.16; }
.opn-bg::after { content: ""; position: absolute; inset: 0;
  background: radial-gradient(120% 90% at 50% 42%, transparent 0%, var(--paper) 78%), linear-gradient(180deg, rgba(14,13,18,0.35), rgba(14,13,18,0.68)); }
:root:not(.dark) .opn-bg { opacity: 0.3; filter: blur(9px) saturate(0.98) brightness(1.03); }
:root:not(.dark) .opn-bg::after { background: radial-gradient(120% 90% at 50% 42%, transparent 0%, var(--paper) 80%), linear-gradient(180deg, rgba(246,247,249,0.3), rgba(246,247,249,0.62)); }

.opn-light { position: fixed; left: 50%; top: 52%; width: 60vmax; height: 60vmax; transform: translate(-50%, -50%) scale(0.3);
  border-radius: 50%; pointer-events: none; opacity: 0;
  background: radial-gradient(circle, var(--glow) 0%, rgba(155,142,134,0.05) 34%, transparent 62%);
  transition: opacity 2.4s ease, transform 2.6s cubic-bezier(0.22,1,0.36,1); }
.opn.phase-open .opn-light { opacity: 1; transform: translate(-50%, -50%) scale(1); }
.opn.phase-auth .opn-light { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
.opn.phase-entering .opn-light { opacity: 1; transform: translate(-50%, -50%) scale(3.4); transition: opacity 1.3s ease, transform 1.4s cubic-bezier(0.4,0,0.2,1); }

/* 건너뛰기 — 인트로는 8초가 넘는다. 처음부터 '누를 수 있는 것'으로 보여야 기다릴지 넘길지 고를 수 있다.
   (예전엔 앞 3.8초 동안 숨어 있었고, 테두리도 배경도 없어 버튼으로 읽히지 않았다.) */
.opn-skip { position: fixed; top: 24px; right: 32px; z-index: 6;
  display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px;
  border: 1px solid color-mix(in srgb, var(--ink) 20%, transparent); border-radius: 999px;
  background: color-mix(in srgb, var(--ink) 7%, transparent); backdrop-filter: blur(10px);
  cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 500; letter-spacing: 0.02em;
  color: var(--ink); opacity: 0; animation: opn-skip-in 0.7s cubic-bezier(0.22,1,0.36,1) 0.9s both;
  transition: color 0.25s, border-color 0.25s, background 0.25s; }
@keyframes opn-skip-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 0.72; transform: none; } }
.opn-skip:hover { opacity: 1; border-color: color-mix(in srgb, var(--ink) 38%, transparent); background: color-mix(in srgb, var(--ink) 13%, transparent); }
.opn-skip:focus-visible { opacity: 1; outline: 2px solid color-mix(in srgb, var(--accent) 65%, transparent); outline-offset: 3px; }
.opn-skip-ar { font-size: 14px; line-height: 1; color: var(--muted); transition: transform 0.25s cubic-bezier(0.22,1,0.36,1), color 0.25s; }
.opn-skip:hover .opn-skip-ar { transform: translateX(3px); color: var(--ink); }
/* 이미 건너뛴 뒤(전환 중)에는 물러난다 — 두 번 눌리지 않게. */
.opn.phase-entering .opn-skip { opacity: 0; pointer-events: none; transition: opacity 0.3s; }
@media (prefers-reduced-motion: reduce) { .opn-skip { animation: none; opacity: 0.72; } }

.opn-stage { position: relative; z-index: 2; min-height: 100dvh; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 64px 24px; gap: 0; transition: opacity 0.9s ease; }
.opn.phase-entering .opn-stage { opacity: 0; transform: scale(1.045); transition: opacity 1.1s ease 0.12s, transform 1.25s cubic-bezier(0.4,0,0.2,1); }
.opn.phase-entering .opn-authwrap { animation: opn-leave 1.15s cubic-bezier(0.4,0,0.2,1) both; }
@keyframes opn-leave { from { opacity: 1; transform: translateY(0); filter: blur(0); } to { opacity: 0; transform: translateY(-14px); filter: blur(2px); } }

/* 진입 플래시 — 로그인 순간 따뜻한 빛이 화면을 감싸며 워크스페이스로 건너간다 (컷 느낌 제거) */
.opn-flash { position: fixed; inset: 0; z-index: 3; pointer-events: none; opacity: 0;
  background: radial-gradient(circle at 50% 46%, rgba(232,216,196,0.5) 0%, rgba(200,186,168,0.26) 34%, rgba(155,142,134,0.1) 56%, transparent 74%); }
.opn.phase-entering .opn-flash { opacity: 1; transition: opacity 1.2s ease 0.1s; }

/* 로고 — 히어로. 천천히 페이드 인. */
.opn-logo { margin: 0; font-size: clamp(2.6rem, 7vw, 4.2rem); font-weight: 300; letter-spacing: -0.035em; color: var(--ink);
  opacity: 0; transform: translateY(6px); animation: opn-logo-in 1.6s cubic-bezier(0.22,1,0.36,1) 0.2s both; transition: opacity 0.9s ease; }
@keyframes opn-logo-in { to { opacity: 1; transform: translateY(0); } }

/* 브랜드 스테이트먼트 — 로고를 조용히 받쳐준다(문 등장과 함께). */
.opn-tag { margin: 18px 0 0; font-size: clamp(0.9rem, 2vw, 1.02rem); font-weight: 300; letter-spacing: 0.005em; color: var(--muted);
  opacity: 0; transition: opacity 1.4s ease; }
.opn.phase-door .opn-tag, .opn.phase-open .opn-tag, .opn.phase-auth .opn-tag, .opn.phase-entering .opn-tag { opacity: 1; }

/* 문 — 시그니처. 등장 후 천천히 열린다. */
.opn-door { width: 46px; height: 60px; margin-top: clamp(40px, 7vh, 72px);
  opacity: 0; transform: translateY(8px); transition: opacity 1.4s ease, transform 1.4s cubic-bezier(0.22,1,0.36,1); }
.opn.phase-door .opn-door, .opn.phase-open .opn-door, .opn.phase-auth .opn-door, .opn.phase-entering .opn-door { opacity: 1; transform: translateY(0); }
.opn-door-svg { width: 100%; height: 100%; overflow: visible; }
.opn-door-frame { stroke: var(--muted); opacity: 0.55; transition: stroke 1.4s ease, opacity 1.4s ease; }
.opn-door-panel { stroke: var(--muted); fill: var(--accent); fill-opacity: 0; opacity: 0.62; transform-origin: 20px 26px; transition: all 1.4s cubic-bezier(0.22,1,0.36,1); }
.opn-door-handle { fill: var(--muted); transition: fill 1.4s ease; }
.opn-door.open .opn-door-frame { stroke: var(--accent); opacity: 0.9; }
.opn-door.open .opn-door-panel { stroke: var(--accent); fill-opacity: 0.16; opacity: 1; transform: scaleX(0.78); }
.opn-door.open .opn-door-handle { fill: var(--accent); }
.opn-door.open .opn-door-svg { filter: drop-shadow(0 0 10px var(--glow)) drop-shadow(0 0 26px var(--glow)); }

/* 인증 카드 — 빛에서 태어난다. 가볍게, 하나의 수직 리듬. */
.opn-card { width: min(392px, 92vw); margin-top: clamp(34px, 6vh, 56px);
  display: flex; flex-direction: column; align-items: stretch;
  padding: 30px 28px 26px; border-radius: 22px;
  background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0) 46%), rgba(18,19,27,0.72);
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 28px -20px rgba(0,0,0,0.4), 0 30px 70px -34px rgba(0,0,0,0.55), 0 0 64px -22px var(--glow);
  backdrop-filter: blur(10px);
  animation: opn-card-in 1.3s cubic-bezier(0.22,1,0.36,1) 0.2s both; }
@keyframes opn-card-in { from { opacity: 0; transform: translateY(14px) scale(0.975); } to { opacity: 1; transform: translateY(0) scale(1); } }
.opn-card-hi { margin: 0 0 20px; text-align: center; font-size: 1.02rem; font-weight: 500; letter-spacing: -0.01em; color: var(--ink); }

.opn-providers { display: flex; flex-direction: column; gap: 13px; }
.opn-provider { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 52px; padding: 0 16px;
  background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.08); border-radius: 13px;
  font-family: inherit; font-size: 0.94rem; font-weight: 500; color: var(--ink); cursor: pointer;
  transition: border-color 0.35s ease, background 0.35s ease, transform 0.25s cubic-bezier(0.22,1,0.36,1), opacity 0.3s;
  animation: opn-rise 0.9s cubic-bezier(0.22,1,0.36,1) both; }
.opn-provider:hover:not(:disabled) { background: rgba(255,255,255,0.045); border-color: color-mix(in srgb, var(--accent) 30%, rgba(255,255,255,0.08)); transform: translateY(-1px); }
.opn-provider:active:not(:disabled) { transform: translateY(0) scale(0.99); }
.opn-provider:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 3px; }
.opn-provider:disabled { cursor: default; }
.opn-provider[data-busy="true"] { border-color: color-mix(in srgb, var(--accent) 45%, rgba(255,255,255,0.08)); }
.opn-provider:disabled:not([data-busy="true"]) { opacity: 0.45; }
.opn-glyph { width: 18px; height: 18px; flex-shrink: 0; }
@keyframes opn-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.opn-div { display: flex; align-items: center; gap: 12px; margin: 18px 0 14px; }
.opn-div::before, .opn-div::after { content: ""; height: 1px; flex: 1; background: rgba(255,255,255,0.07); }
.opn-div span { font-size: 11px; font-weight: 500; letter-spacing: 0.04em; color: var(--faint); }
.opn-form { display: flex; flex-direction: column; gap: 10px; }
.opn-field { width: 100%; min-height: 52px; padding: 0 15px; border-radius: 13px;
  background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.08);
  font-family: inherit; font-size: 0.94rem; font-weight: 400; color: var(--ink); outline: none;
  transition: border-color 0.25s, box-shadow 0.25s; }
.opn-field::placeholder { color: var(--faint); }
.opn-field:focus { border-color: color-mix(in srgb, var(--accent) 40%, rgba(255,255,255,0.08)); box-shadow: 0 0 0 3px var(--glow); }
.opn-err { margin: 2px 0 0; font-size: 0.82rem; color: #E57373; text-align: left; }
.opn-submit { margin-top: 6px; width: 100%; min-height: 52px; border: 0; border-radius: 13px;
  background: var(--accent); color: #17140F; font-family: inherit; font-size: 0.96rem; font-weight: 600; cursor: pointer;
  box-shadow: 0 6px 18px -10px rgba(0,0,0,0.5), 0 0 24px -8px var(--glow); transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s; }
.opn-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 28px -12px rgba(0,0,0,0.55), 0 0 36px -6px var(--glow); }
.opn-submit:active:not(:disabled) { transform: scale(0.98); box-shadow: 0 4px 14px -10px rgba(0,0,0,0.5), 0 0 22px -8px var(--glow); }
.opn-submit:disabled { opacity: 0.5; cursor: default; }
.opn-submit:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 3px; }
.opn-switch { margin: 18px 0 0; text-align: center; font-size: 0.84rem; font-weight: 300; color: var(--muted); }
.opn-switch button { background: none; border: 0; cursor: pointer; font-family: inherit; font-size: 0.84rem; font-weight: 600; color: var(--ink); text-decoration: underline; text-underline-offset: 2px; }
.opn-switch button:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 2px; border-radius: 3px; }

/* 리빌 — Comein(위 로고) 아래로 Context·Memory·Insight 세 단어가 가지처럼 강조되며 나타난다. (Comein 은 하나뿐) */
.opn.phase-reveal .opn-light { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
.opn.phase-reveal .opn-tag, .opn.phase-reveal .opn-door { display: none; }
.opn.phase-auth .opn-logo, .opn.phase-auth .opn-tag, .opn.phase-auth .opn-door,
.opn.phase-entering .opn-logo, .opn.phase-entering .opn-tag, .opn.phase-entering .opn-door { display: none; }
.opn-reveal { position: relative; z-index: 2; margin-top: clamp(18px, 3.2vh, 34px); width: 100%; display: flex; justify-content: center; }

/* 세 가지 리스트 — 리빌·브랜드 공용 */
.opn-tree-list { position: relative; list-style: none; margin: 0; padding: 0; display: inline-block; text-align: left; }
.opn-tree-item { position: relative; padding: clamp(6px, 1.2vh, 10px) 0 clamp(6px, 1.2vh, 10px) 30px; }
.opn-tree-item::before { content: ""; position: absolute; left: 9px; top: 0; bottom: 0; width: 1.5px; background: color-mix(in srgb, var(--accent) 45%, var(--hair)); }
.opn-tree-item:last-child::before { bottom: 50%; }
.opn-tree-item::after { content: ""; position: absolute; left: 9px; top: 50%; width: 16px; height: 1.5px; background: color-mix(in srgb, var(--accent) 45%, var(--hair)); }
.opn-tree-word { display: block; font-weight: 300; letter-spacing: -0.02em; color: var(--ink); line-height: 1.15; }
.opn-tree-word .opn-frag { color: var(--accent); font-weight: 600; }
.opn-tree-desc { display: block; margin-top: 4px; font-weight: 300; color: var(--muted); line-height: 1.4; }

/* 리빌 변형 — 크게 + 순차 강조 */
.opn-reveal .opn-tree-word { font-size: clamp(1.5rem, 4.5vw, 2.2rem); }
.opn-reveal .opn-tree-desc { font-size: clamp(0.86rem, 2vw, 1rem); }
.opn-reveal .opn-tree-item { opacity: 0; animation: opn-branch-in 0.7s cubic-bezier(0.22,1,0.36,1) both; }
.opn-reveal .opn-t0 { animation-delay: 0.15s; }
.opn-reveal .opn-t1 { animation-delay: 0.5s; }
.opn-reveal .opn-t2 { animation-delay: 0.85s; }
@keyframes opn-word-in { from { opacity: 0; transform: translateY(12px); filter: blur(3px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
@keyframes opn-branch-in { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }

/* 인증 — 가로 2단: 브랜드(좌) + 로그인(우). 세로로 길지 않게 여백(가로)을 쓴다. */
.opn-authwrap { position: relative; z-index: 2; display: grid; grid-template-columns: 1.05fr 0.95fr; align-items: center; gap: clamp(32px, 6vw, 88px); width: min(940px, 92vw); animation: opn-card-in 1s cubic-bezier(0.22,1,0.36,1) 0.1s both; }
.opn-authwrap .opn-card { margin: 0 auto; animation: none; }
.opn-brand { text-align: left; }
.opn-brand-logo { margin: 0; font-size: clamp(2.85rem, 6vw, 4.05rem); font-weight: 400; letter-spacing: -0.038em; color: var(--ink); text-shadow: 0 0 56px var(--glow); }
.opn-brand-tag { margin: 20px 0 26px; font-size: clamp(0.86rem, 1.6vw, 0.98rem); font-weight: 300; color: var(--muted); }
.opn-brand .opn-tree-word { font-size: clamp(1.05rem, 2.4vw, 1.35rem); }
.opn-brand .opn-tree-desc { font-size: clamp(0.8rem, 1.5vw, 0.9rem); }
@media (max-width: 800px) {
  .opn-authwrap { grid-template-columns: 1fr; gap: 0; width: min(360px, 90vw); }
  .opn-brand { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .opn-logo, .opn-card, .opn-provider { animation: none; }
  .opn-light, .opn-tag, .opn-door, .opn-stage { transition: none; }
  .opn-logo { opacity: 1; transform: none; }
  /* 리빌 — 모션 없이도 세 단어가 정적으로 보인다 */
  .opn-reveal .opn-tree-item { animation: none; opacity: 1; transform: none; filter: none; }
  .opn-authwrap { animation: none; }
  .opn-flash { display: none; }
}
`;
