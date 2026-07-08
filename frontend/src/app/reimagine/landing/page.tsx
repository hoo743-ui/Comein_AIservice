"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowRight, Moon, Sun } from "lucide-react";

/**
 * Comein · Landing — "Comein이 무엇인가"에만 답하는 갤러리형 정체성 화면.
 * 기능 설명 없음. 철학이 곧 히어로. 타이포·여백·절제만으로 프리미엄을 만든다. (DESIGN.md)
 *
 * 배경 아트워크: 흩어진 점들이 등장과 함께 '질서'로 정렬된다 — 철학을 3초 안에 시각으로 전달.
 * 장식이 아니라 의미. (모노크롬·초저대비, 단 한 번 정렬 후 정지)
 * 흐름: Landing → (들어가기) Experience → Enter → Workspace. 재방문은 '바로 입장' → Enter.
 */

const COLS = 8;
const ROWS = 6;
// 결정적 스캐터(위경도 아님) — SSR/CSR 동일하도록 index 기반. 각 점의 '흩어진' 시작 오프셋.
const DOTS = Array.from({ length: COLS * ROWS }, (_, i) => {
  const c = i % COLS;
  const r = Math.floor(i / COLS);
  return {
    left: ((c + 0.5) / COLS) * 100,
    top: ((r + 0.5) / ROWS) * 100,
    ox: ((((i * 37) % 23) - 11) * 1.5).toFixed(1),
    oy: ((((i * 53) % 19) - 9) * 1.7).toFixed(1),
    delay: (((i * 17) % 20) / 20) * 0.6,
  };
});

export default function Landing() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [settled, setSettled] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => setSettled(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="lnd">
      <style>{CSS}</style>

      {/* 배경 아트워크 — 흩어짐 → 질서 */}
      <div className={`lnd-field ${settled ? "settled" : ""}`} aria-hidden>
        {DOTS.map((d, i) => (
          <span
            key={i}
            className="lnd-dot"
            style={
              {
                left: `${d.left}%`,
                top: `${d.top}%`,
                "--ox": `${d.ox}px`,
                "--oy": `${d.oy}px`,
                transitionDelay: `${d.delay}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <header className="lnd-top">
        <span className="lnd-mark">Comein</span>
        <button
          type="button"
          aria-label="테마 전환"
          className="lnd-theme"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {mounted && resolvedTheme === "dark" ? <Sun className="lnd-theme-icon" /> : <Moon className="lnd-theme-icon" />}
        </button>
      </header>

      <main className="lnd-stage">
        <DoorMark className="lnd-door" />

        <h1 className="lnd-phil">
          <span className="lnd-phil-1">생각은 흩어집니다.</span>
          <span className="lnd-phil-2">질서는 만들어집니다.</span>
        </h1>

        <p className="lnd-essence">말 한 줄이면, 워크스페이스가 대신 정리합니다.</p>

        <div className="lnd-actions">
          <Link href="/reimagine/opening" className="lnd-cta">
            들어가기
            <ArrowRight className="lnd-cta-arrow" />
          </Link>
          <Link href="/reimagine/enter" className="lnd-whisper">
            이미 Comein을 아시나요 · 바로 입장
          </Link>
        </div>
      </main>

      <footer className="lnd-foot">
        <span>Comein — a thinking workspace</span>
      </footer>
    </div>
  );
}

function DoorMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 52" fill="none" aria-hidden>
      <rect x="3" y="3" width="34" height="46" rx="2.5" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
      <path d="M20 7 L31 10 V42 L20 45 Z" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="23.5" cy="26" r="1.1" fill="currentColor" />
    </svg>
  );
}

const CSS = `
.lnd {
  --paper: hsl(210 28% 99%);
  --ink: hsl(222 24% 11%);
  --muted: hsl(220 9% 46%);
  --faint: hsl(220 12% 68%);
  --hair: hsl(220 18% 91%);
  --accent: hsl(250 46% 56%);
  position: relative;
  display: flex; flex-direction: column;
  min-height: 100vh; min-height: 100dvh;
  background: var(--paper); color: var(--ink);
  font-family: var(--font-sans), "Pretendard Variable", -apple-system, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  overflow: hidden;
}
.dark .lnd {
  --paper: hsl(224 30% 6%);
  --ink: hsl(216 26% 94%);
  --muted: hsl(220 10% 58%);
  --faint: hsl(220 10% 40%);
  --hair: hsl(220 20% 15%);
  --accent: hsl(250 62% 74%);
}

/* 배경 아트워크 — 초저대비, 텍스트와 경쟁하지 않음. 중앙으로 갈수록 옅어지는 마스크로 헤드라인 보호 */
.lnd-field {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  opacity: 0.5;
  -webkit-mask: radial-gradient(58% 46% at 50% 46%, transparent 0%, transparent 34%, #000 82%);
  mask: radial-gradient(58% 46% at 50% 46%, transparent 0%, transparent 34%, #000 82%);
}
.lnd-dot {
  position: absolute; width: 2.5px; height: 2.5px; border-radius: 50%;
  background: var(--faint);
  transform: translate(var(--ox), var(--oy));
  transition: transform 1.7s cubic-bezier(0.22, 1, 0.36, 1);
}
.lnd-field.settled .lnd-dot { transform: translate(0, 0); }

/* 상단 — 최소한의 흔적 */
.lnd-top { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; padding: 32px clamp(24px, 7vw, 72px); }
.lnd-mark { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; color: var(--muted); }
.lnd-theme { display: grid; place-items: center; width: 36px; height: 36px; margin: -8px; border: 0; background: none; color: var(--faint); border-radius: 10px; cursor: pointer; transition: color 0.3s, background 0.3s; }
.lnd-theme:hover { color: var(--ink); }
.lnd-theme:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 2px; }
.lnd-theme-icon { width: 17px; height: 17px; stroke-width: 1.6; }

/* 무대 — 갤러리 */
.lnd-stage {
  position: relative; z-index: 1;
  flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center;
  padding: 4vh clamp(28px, 6vw, 56px);
}
.lnd-door { width: 46px; height: 60px; color: var(--ink); margin-bottom: clamp(40px, 7vh, 68px); animation: lnd-rise 1s cubic-bezier(0.22,1,0.36,1) 0.1s both; }

.lnd-phil { margin: 0; display: flex; flex-direction: column; }
.lnd-phil-1, .lnd-phil-2 { font-size: clamp(2.1rem, 6vw, 3.5rem); line-height: 1.16; display: block; }
/* 흩어짐 = 가볍고 넓게 · 질서 = 무겁고 조여서. 개념을 무게·자간으로만 표현 */
.lnd-phil-1 { font-weight: 300; letter-spacing: 0.005em; color: var(--muted); animation: lnd-rise 1s cubic-bezier(0.22,1,0.36,1) 0.28s both; }
.lnd-phil-2 { font-weight: 600; letter-spacing: -0.032em; color: var(--ink); animation: lnd-rise 1s cubic-bezier(0.22,1,0.36,1) 0.46s both; }

.lnd-essence { margin: clamp(28px, 4vh, 40px) 0 0; font-size: clamp(1rem, 2.2vw, 1.12rem); font-weight: 300; letter-spacing: -0.01em; color: var(--muted); animation: lnd-rise 1s cubic-bezier(0.22,1,0.36,1) 0.66s both; }

.lnd-actions { margin-top: clamp(44px, 6vh, 64px); display: flex; flex-direction: column; align-items: center; gap: 20px; animation: lnd-rise 1s cubic-bezier(0.22,1,0.36,1) 0.8s both; }
.lnd-cta {
  display: inline-flex; align-items: center; gap: 9px;
  padding: 15px 28px; border-radius: 14px;
  background: var(--ink); color: var(--paper);
  font-size: 0.98rem; font-weight: 500; letter-spacing: -0.01em; text-decoration: none;
  transition: transform 0.25s cubic-bezier(0.22,1,0.36,1);
}
.lnd-cta:hover { transform: translateY(-1px); }
.lnd-cta:active { transform: translateY(0) scale(0.985); }
.lnd-cta:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 65%, transparent); outline-offset: 3px; }
.lnd-cta-arrow { width: 17px; height: 17px; stroke-width: 1.8; transition: transform 0.25s cubic-bezier(0.22,1,0.36,1); }
.lnd-cta:hover .lnd-cta-arrow { transform: translateX(3px); }

.lnd-whisper { font-size: 13px; font-weight: 400; letter-spacing: -0.005em; color: var(--faint); text-decoration: none; transition: color 0.3s; }
.lnd-whisper:hover { color: var(--muted); }
.lnd-whisper:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 3px; border-radius: 4px; }

/* 하단 — 침묵에 가까운 서명 */
.lnd-foot { position: relative; z-index: 1; padding: 26px clamp(24px, 7vw, 72px) 34px; text-align: center; }
.lnd-foot span { font-size: 11px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint); animation: lnd-fade 1.4s ease 1s both; }

@keyframes lnd-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes lnd-fade { from { opacity: 0; } to { opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  .lnd-door, .lnd-phil-1, .lnd-phil-2, .lnd-essence, .lnd-actions, .lnd-foot span { animation: none; }
  .lnd-cta, .lnd-cta-arrow { transition: none; }
  .lnd-dot { transition: none; transform: translate(0, 0); }
}
`;
