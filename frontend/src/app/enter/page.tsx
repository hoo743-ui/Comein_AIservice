"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { refreshSession, signInWithProvider } from "@/lib/remote";

/**
 * Comein · Entrance — 로그인 페이지가 아니라 "워크스페이스로 들어오는 순간".
 * Sign in / Sign up 구분 없음. 소셜(Continue with …)이 유일한 주 인터랙션.
 * 성공은 거래가 아니라 '환대' — 문이 열리듯 환영하며 워크스페이스로 이어진다.
 *
 * States: idle → connecting(로딩) → welcome(성공) → workspace / error(다시 시도).
 * 미니멀 타이포 · 큰 여백 · 은은한 모노크롬 배경. (DESIGN.md)
 */

type Provider = "github" | "kakao";
type Phase = "idle" | "connecting" | "welcome" | "error";

const PROVIDERS: { key: Provider; label: string }[] = [
  { key: "github", label: "GitHub" },
  { key: "kakao", label: "카카오" },
];

export default function Enter() {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [active, setActive] = React.useState<Provider | null>(null);
  const [errMsg, setErrMsg] = React.useState<string | null>(null);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // 이미 들어와 있는 사람은 문 앞에 다시 세우지 않는다.
  React.useEffect(() => {
    void (async () => {
      const uid = await refreshSession();
      if (uid) router.replace("/workspace");
    })();
  }, [router]);

  const enter = async (p: Provider) => {
    if (phase === "connecting" || phase === "welcome") return;
    setActive(p);
    setPhase("connecting");
    try {
      // 이 순간이 곧 '문턱' — 돌아왔을 때 워크스페이스가 threshold 를 다시 재생하지 않게.
      try { sessionStorage.setItem("comein:reimagine", "1"); } catch {}
      // 돌아올 자리는 지금 이 주소를 기준으로 잡는다 — 로컬이든 배포든 같은 코드로 동작한다.
      const { error } = await signInWithProvider(p, `${window.location.origin}/workspace`);
      if (error) throw error;
      // 여기서 브라우저가 제공자 화면으로 넘어간다. 아래 줄은 대개 실행되지 않는다.
    } catch (e: any) {
      setErrMsg(e?.message ?? null);
      setPhase("error");
    }
  };

  const retry = () => {
    setPhase("idle");
    setActive(null);
    setErrMsg(null);
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

            {/* 소셜이 막혀 있을 때 들어올 다른 길 — 이메일·비밀번호 카드는 /experience 가 갖고 있다. */}
            <button type="button" className="ent-swap ent-tomail" onClick={() => router.push("/experience")}>
              이메일로 계속하기
            </button>

            {phase === "error" ? (
              <div className="ent-error" role="alert">
                <span>{active ? `${activeLabel} 연결에 문제가 생겼어요.` : "들어가지 못했어요."}{errMsg ? ` (${errMsg})` : ""}</span>
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
  if (provider === "kakao") {
    // 말풍선 — 카카오의 형태만 단색으로. 브랜드 노랑을 이 화면에 들이지 않는다.
    return (
      <svg className="ent-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 3C6.9 3 2.8 6.3 2.8 10.3c0 2.6 1.7 4.9 4.3 6.2l-1.1 4c-.1.3.3.6.6.4l4.7-3.1c.2 0 .5.1.7.1 5.1 0 9.2-3.3 9.2-7.6S17.1 3 12 3z" />
      </svg>
    );
  }
  if (provider === "github") {
    return (
      <svg className="ent-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.47c.53.1.72-.23.72-.5v-1.77c-2.92.64-3.54-1.4-3.54-1.4-.48-1.22-1.17-1.55-1.17-1.55-.95-.65.07-.64.07-.64 1.06.07 1.61 1.09 1.61 1.09.94 1.6 2.46 1.14 3.06.87.1-.68.37-1.14.67-1.4-2.33-.27-4.78-1.17-4.78-5.2 0-1.15.41-2.09 1.09-2.83-.11-.27-.47-1.34.1-2.79 0 0 .88-.28 2.89 1.08a10 10 0 0 1 5.26 0c2-1.36 2.89-1.08 2.89-1.08.57 1.45.21 2.52.1 2.79.68.74 1.09 1.68 1.09 2.83 0 4.04-2.46 4.93-4.8 5.19.38.33.71.97.71 1.96v2.9c0 .28.19.61.73.5A10.5 10.5 0 0 0 12 1.5z" />
      </svg>
    );
  }
  return null;
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
  /* 세로를 막지 않는다 — 낮은 화면에서 '약관' 줄과 아래쪽 버튼이 잘려 나갔다.
     배경 오브는 .ent-bg 가 스스로 가둔다(min-height 라 내용만큼 자란다). */
  overflow-x: hidden;
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

/* 이메일로 가는 길 — 소셜 아래 한 줄. 카드는 /experience 가 갖고 있다. */
.ent-swap { margin-top: 14px; border: 0; background: none; font: inherit; font-size: 12px; color: var(--muted); cursor: pointer; padding: 8px; border-radius: 8px; transition: color 0.2s; animation: ent-rise 0.9s cubic-bezier(0.22,1,0.36,1) 0.55s both; }
.ent-swap:hover { color: var(--ink); }

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
