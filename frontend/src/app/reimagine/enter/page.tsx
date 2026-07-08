"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Comein · Entrance — 로그인 페이지가 아니라 "워크스페이스로 들어오는 순간".
 * Sign in / Sign up 구분 없음. 소셜(Continue with …)이 유일한 주 인터랙션.
 * 성공은 거래가 아니라 '환대' — 문이 열리듯 환영하며 워크스페이스로 이어진다.
 *
 * States: idle → connecting(로딩) → welcome(성공) → workspace / error(다시 시도).
 * 미니멀 타이포 · 큰 여백 · 은은한 모노크롬 배경. (DESIGN.md)
 */

type Provider = "google" | "apple" | "microsoft";
type Phase = "idle" | "connecting" | "welcome" | "error";

const PROVIDERS: { key: Provider; label: string }[] = [
  { key: "google", label: "Google" },
  { key: "apple", label: "Apple" },
  { key: "microsoft", label: "Microsoft" },
];

export default function Enter() {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [active, setActive] = React.useState<Provider | null>(null);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const enter = (p: Provider) => {
    if (phase === "connecting" || phase === "welcome") return;
    setActive(p);
    setPhase("connecting");
    // 프로토타입: 실제 OAuth 대신 연결→환영→입장. (실연동 시 실패는 setPhase("error"))
    timers.current.push(
      setTimeout(() => {
        setPhase("welcome");
        try {
          // 이 순간이 곧 '문턱' — 워크스페이스는 threshold를 다시 재생하지 않는다.
          sessionStorage.setItem("comein:reimagine", "1");
        } catch {}
        timers.current.push(setTimeout(() => router.push("/reimagine"), 1100));
      }, 1050)
    );
  };

  const retry = () => {
    setPhase("idle");
    setActive(null);
  };

  const activeLabel = PROVIDERS.find((p) => p.key === active)?.label ?? "";

  return (
    <div className="ent">
      <style>{CSS}</style>

      <div aria-hidden className="ent-bg">
        <span className="ent-orb a" />
        <span className="ent-orb b" />
      </div>

      <main className="ent-stage">
        {phase === "welcome" ? (
          <div className="ent-welcome" role="status" aria-live="polite">
            <DoorMark className="ent-welcome-door" open />
            <p className="ent-welcome-title">환영합니다</p>
            <p className="ent-welcome-sub">
              당신의 공간을 여는 중<span className="ent-dots" />
            </p>
          </div>
        ) : (
          <div className="ent-inner">
            <DoorMark className="ent-door" />

            <h1 className="ent-title">Comein</h1>
            <p className="ent-sub">당신의 생각이 정리되는 공간으로.</p>

            <div className="ent-providers">
              {PROVIDERS.map((p, i) => {
                const isActive = active === p.key;
                const connecting = phase === "connecting";
                return (
                  <button
                    key={p.key}
                    onClick={() => enter(p.key)}
                    className="ent-provider"
                    style={{ animationDelay: `${0.3 + i * 0.08}s` }}
                    disabled={connecting}
                    data-active={isActive}
                  >
                    <span className="ent-provider-glyph">
                      {connecting && isActive ? <span className="ent-spin" /> : <ProviderGlyph provider={p.key} />}
                    </span>
                    <span className="ent-provider-label">
                      {connecting && isActive ? "연결하는 중" : `Continue with ${p.label}`}
                    </span>
                  </button>
                );
              })}
            </div>

            {phase === "error" ? (
              <div className="ent-error" role="alert">
                <span>{activeLabel} 연결에 문제가 생겼어요.</span>
                <button type="button" onClick={retry} className="ent-retry">
                  다시 시도
                </button>
              </div>
            ) : (
              <p className="ent-legal">
                계속하면 Comein의 <u>약관</u>과 <u>개인정보처리방침</u>에 동의하게 됩니다.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function DoorMark({ className, open = false }: { className?: string; open?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 40 52" fill="none" aria-hidden>
      <rect x="3" y="3" width="34" height="46" rx="2.5" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
      <path
        d="M20 7 L31 10 V42 L20 45 Z"
        fill="currentColor"
        fillOpacity={open ? 0.14 : 0.06}
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="23.5" cy="26" r="1.1" fill="currentColor" />
    </svg>
  );
}

function ProviderGlyph({ provider }: { provider: Provider }) {
  if (provider === "apple") {
    return (
      <svg className="ent-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M16.365 1.43c0 1.14-.49 2.27-1.18 3.08-.74.9-1.98 1.57-2.98 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.57-2.27 1.2-2.98.8-.94 2.14-1.64 3.25-1.68.03.13.05.28.05.43zM20.93 17.14c-.03.09-.46 1.6-1.53 3.16-.95 1.35-1.94 2.7-3.5 2.7s-1.96-.9-3.76-.9c-1.76 0-2.4.93-3.83.93-1.44 0-2.53-1.25-3.53-2.6-1.4-1.94-2.53-4.96-2.53-7.82 0-4.6 2.99-7.04 5.93-7.04 1.56 0 2.87.98 3.86.98.95 0 2.41-1.04 4.18-1.04.68 0 3.11.06 4.75 2.4-.14.09-2.63 1.55-2.6 4.68.03 3.74 3.27 4.99 3.31 5.01z" />
      </svg>
    );
  }
  if (provider === "microsoft") {
    return (
      <svg className="ent-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <rect x="2" y="2" width="9" height="9" />
        <rect x="13" y="2" width="9" height="9" opacity="0.72" />
        <rect x="2" y="13" width="9" height="9" opacity="0.72" />
        <rect x="13" y="13" width="9" height="9" opacity="0.5" />
      </svg>
    );
  }
  return (
    <svg className="ent-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 11v2.6h5.9c-.24 1.5-1.75 4.1-5.9 4.1-3.55 0-6.45-2.94-6.45-6.55S8.45 4.7 12 4.7c2.02 0 3.38.86 4.16 1.6l2.84-2.74C17.17 1.9 14.83 1 12 1 6.48 1 2 5.48 2 11s4.48 10 10 10c5.77 0 9.6-4.06 9.6-9.77 0-.66-.07-1.16-.16-1.66H12z" />
    </svg>
  );
}

const CSS = `
.ent {
  --paper: hsl(210 28% 99%);
  --surface: hsl(220 24% 98%);
  --ink: hsl(222 24% 11%);
  --muted: hsl(220 9% 46%);
  --faint: hsl(220 12% 70%);
  --hair: hsl(220 18% 90%);
  --accent: hsl(250 46% 56%);
  position: relative;
  min-height: 100vh; min-height: 100dvh;
  display: grid; place-items: center;
  background: var(--paper); color: var(--ink);
  font-family: var(--font-sans), "Pretendard Variable", -apple-system, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}
.dark .ent {
  --paper: hsl(224 30% 6%);
  --surface: hsl(224 28% 10%);
  --ink: hsl(216 26% 94%);
  --muted: hsl(220 10% 58%);
  --faint: hsl(220 10% 42%);
  --hair: hsl(220 20% 16%);
  --accent: hsl(250 62% 74%);
}

/* 은은한 배경 — 아주 느린 luminance 드리프트 (모노크롬 + 액센트 극소량) */
.ent-bg { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.ent-orb { position: absolute; border-radius: 50%; opacity: 0.6; }
.ent-orb.a { width: 60vw; height: 60vw; left: 12%; top: -10%; background: radial-gradient(circle, hsl(220 24% 96%) 0%, transparent 62%); animation: ent-drift-a 26s ease-in-out infinite; }
.ent-orb.b { width: 52vw; height: 52vw; right: 8%; bottom: -12%; background: radial-gradient(circle, hsl(250 46% 56% / 0.05) 0%, transparent 60%); animation: ent-drift-b 32s ease-in-out infinite; }
.dark .ent-orb.a { background: radial-gradient(circle, hsl(224 34% 12%) 0%, transparent 62%); }
.dark .ent-orb.b { background: radial-gradient(circle, hsl(250 60% 60% / 0.08) 0%, transparent 60%); }
@keyframes ent-drift-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(4%, 5%) scale(1.08); } }
@keyframes ent-drift-b { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-5%, -4%) scale(1.1); } }

.ent-stage { position: relative; z-index: 2; width: 100%; display: grid; place-items: center; padding: 32px; }
.ent-inner { width: 100%; max-width: 360px; display: flex; flex-direction: column; align-items: center; text-align: center; }

.ent-door { width: 40px; height: 52px; color: var(--ink); animation: ent-rise 0.9s cubic-bezier(0.22,1,0.36,1) both; }
.ent-title { margin: 32px 0 0; font-size: 1.75rem; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); animation: ent-rise 0.9s cubic-bezier(0.22,1,0.36,1) 0.1s both; }
.ent-sub { margin: 10px 0 0; font-size: 0.95rem; font-weight: 300; letter-spacing: -0.01em; color: var(--muted); animation: ent-rise 0.9s cubic-bezier(0.22,1,0.36,1) 0.2s both; }

.ent-providers { margin-top: 48px; width: 100%; display: flex; flex-direction: column; gap: 10px; }
.ent-provider {
  display: flex; align-items: center; justify-content: center; gap: 11px;
  width: 100%; min-height: 54px; padding: 0 18px;
  background: var(--surface); border: 1px solid var(--hair); border-radius: 14px;
  font-family: inherit; font-size: 0.96rem; font-weight: 500; letter-spacing: -0.01em; color: var(--ink);
  cursor: pointer;
  transition: border-color 0.3s cubic-bezier(0.22,1,0.36,1), transform 0.2s cubic-bezier(0.22,1,0.36,1), opacity 0.3s;
  animation: ent-rise 0.9s cubic-bezier(0.22,1,0.36,1) both;
}
.ent-provider:hover:not(:disabled) { border-color: color-mix(in srgb, var(--accent) 42%, var(--hair)); transform: translateY(-1px); }
.ent-provider:active:not(:disabled) { transform: translateY(0) scale(0.99); }
.ent-provider:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 3px; }
.ent-provider:disabled { cursor: default; }
.ent-provider[data-active="true"] { border-color: color-mix(in srgb, var(--accent) 55%, var(--hair)); }
.ent-provider:disabled:not([data-active="true"]) { opacity: 0.45; }
.ent-provider-glyph { display: grid; place-items: center; width: 19px; height: 19px; }
.ent-glyph { width: 19px; height: 19px; }

/* 로딩 스피너 — 상태 전달용(장식 아님) */
.ent-spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--accent) 22%, transparent); border-top-color: var(--accent); animation: ent-spin 0.7s linear infinite; }
@keyframes ent-spin { to { transform: rotate(360deg); } }

.ent-legal { margin: 30px 0 0; font-size: 11px; font-weight: 400; line-height: 1.6; color: var(--faint); animation: ent-rise 0.9s cubic-bezier(0.22,1,0.36,1) 0.7s both; }
.ent-legal u { text-decoration-color: var(--hair); text-underline-offset: 2px; cursor: pointer; }

/* 에러 — 붉게 소리치지 않는다. 차분하게 안내하고 재시도. */
.ent-error { margin: 28px 0 0; display: flex; flex-direction: column; align-items: center; gap: 12px; animation: ent-rise 0.5s cubic-bezier(0.22,1,0.36,1) both; }
.ent-error > span { font-size: 0.9rem; font-weight: 400; color: var(--muted); }
.ent-retry { background: none; border: 0; padding: 4px 2px; font-family: inherit; font-size: 0.9rem; font-weight: 600; color: var(--ink); cursor: pointer; border-bottom: 1px solid var(--hair); transition: border-color 0.25s; }
.ent-retry:hover { border-color: var(--ink); }
.ent-retry:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 3px; border-radius: 3px; }

/* 성공 — 환대의 순간 */
.ent-welcome { display: flex; flex-direction: column; align-items: center; text-align: center; animation: ent-welcome-in 0.8s cubic-bezier(0.22,1,0.36,1) both; }
.ent-welcome-door { width: 48px; height: 62px; color: var(--ink); animation: ent-door-open 1s cubic-bezier(0.22,1,0.36,1) both; }
.ent-welcome-title { margin: 30px 0 0; font-size: 1.6rem; font-weight: 600; letter-spacing: -0.025em; color: var(--ink); }
.ent-welcome-sub { margin: 10px 0 0; font-size: 0.9rem; font-weight: 300; color: var(--muted); }
.ent-dots::after { content: "···"; letter-spacing: 0.1em; animation: ent-dots 1.4s steps(4) infinite; }
@keyframes ent-welcome-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes ent-door-open { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
@keyframes ent-dots { 0% { opacity: 0.3; } 50% { opacity: 1; } 100% { opacity: 0.3; } }

@keyframes ent-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

@media (prefers-reduced-motion: reduce) {
  .ent-orb, .ent-door, .ent-title, .ent-sub, .ent-provider, .ent-legal, .ent-error, .ent-welcome, .ent-welcome-door { animation: none; }
  .ent-spin { animation: ent-spin 0.9s linear infinite; }
  .ent-dots::after { animation: none; }
}
`;
