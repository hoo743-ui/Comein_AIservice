"use client";

import * as React from "react";
import { CalendarDays, CheckCircle2, Sparkles, StickyNote, Users } from "lucide-react";

/**
 * Comein · Living Intelligence — 시그니처 AI 비주얼.
 * 그래프가 아니라 '지능이 흐르는' 감각. 문(원점)에서 빛이 나와 Intent(맥락)를 세우고,
 * 곡선 경로로 Calendar·Todo·Notes·People 로 관계를 키운 뒤, 마지막 빛이 다시 문으로 회귀해 닫힌다.
 * 보라색은 오직 AI가 일하는 순간에만. 배경은 거의 보이지 않게 살아있다(노이즈·소프트 라이팅·미세 입자).
 */

type NodeDef = { id: string; label: string; sub: string; icon: React.ComponentType<{ className?: string }>; x: number; y: number; hub?: boolean };
const DOOR = { x: 0.1, y: 0.5 };
const NODES: NodeDef[] = [
  { id: "intent", label: "김교수님 미팅", sub: "Intent · 맥락", icon: Sparkles, x: 0.38, y: 0.5, hub: true },
  { id: "cal", label: "Calendar", sub: "내일 15:00", icon: CalendarDays, x: 0.64, y: 0.21 },
  { id: "todo", label: "Todo", sub: "발표 자료 준비", icon: CheckCircle2, x: 0.86, y: 0.44 },
  { id: "note", label: "Notes", sub: "캡스톤 진행 메모", icon: StickyNote, x: 0.7, y: 0.77 },
  { id: "ppl", label: "People", sub: "김교수님 연결", icon: Users, x: 0.44, y: 0.83 },
];
// 연결 — 곡선(유기적). k = 수직 곡률(거리 비율). 마지막은 ppl → door 회귀.
const CONN: { from: string; to: string; k: number; win: [number, number]; arrive: number }[] = [
  { from: "door", to: "intent", k: 0.12, win: [0.2, 1.0], arrive: 1.0 },
  { from: "intent", to: "cal", k: 0.24, win: [1.0, 1.6], arrive: 1.6 },
  { from: "intent", to: "todo", k: -0.2, win: [1.6, 2.2], arrive: 2.2 },
  { from: "intent", to: "note", k: 0.22, win: [2.2, 2.8], arrive: 2.8 },
  { from: "intent", to: "ppl", k: -0.18, win: [2.8, 3.4], arrive: 3.4 },
  { from: "ppl", to: "door", k: 0.34, win: [3.9, 4.9], arrive: 4.9 },
];
const T_END = 5.7;
const ACC = "139,125,255";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export default function Lab() {
  const [playing, setPlaying] = React.useState(false);
  const [command, setCommand] = React.useState("내일 3시 김교수님이랑 캡스톤 미팅");

  const stageRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const doorRef = React.useRef<HTMLDivElement>(null);
  const nodeRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const rafRef = React.useRef(0);
  const playRef = React.useRef(false);
  const startRef = React.useRef(0);
  const connectedRef = React.useRef(false);
  const hoverRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;

    const pts: Record<string, { x: number; y: number }> = {};
    const layout = () => {
      const r = stageRef.current?.getBoundingClientRect();
      W = r?.width ?? 900; H = r?.height ?? 520;
      canvas.width = Math.max(1, W * dpr); canvas.height = Math.max(1, H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pts["door"] = { x: DOOR.x * W, y: DOOR.y * H };
      for (const n of NODES) pts[n.id] = { x: n.x * W, y: n.y * H };
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(canvas);

    // 미세 앰비언트 입자 — 거의 보이지 않게 살아있음
    const amb = Array.from({ length: 16 }, () => ({
      x: Math.random(), y: Math.random(), s: 0.02 + Math.random() * 0.04, a: 0.04 + Math.random() * 0.06,
      dx: (Math.random() - 0.5) * 0.00006, dy: (Math.random() - 0.5) * 0.00006,
    }));

    const ctrl = (a: { x: number; y: number }, b: { x: number; y: number }, k: number) => {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      return { x: mx + (-dy / d) * k * d, y: my + (dx / d) * k * d };
    };
    const bez = (a: any, c: any, b: any, t: number) => ({
      x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
      y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
    });
    const curve = (a: any, c: any, b: any, prog: number, alpha: number, width: number) => {
      if (prog <= 0) return;
      ctx.strokeStyle = alpha >= 1 ? `rgba(${ACC},1)` : `rgba(${ACC},${alpha})`;
      ctx.lineWidth = width; ctx.lineCap = "round"; ctx.beginPath();
      const N = 26;
      for (let i = 0; i <= N * prog; i++) { const p = bez(a, c, b, i / N); i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); }
      ctx.stroke();
    };
    const curveNeutral = (a: any, c: any, b: any, alpha: number) => {
      ctx.strokeStyle = `rgba(157,163,179,${alpha})`; ctx.lineWidth = 1; ctx.lineCap = "round"; ctx.beginPath();
      const N = 24; for (let i = 0; i <= N; i++) { const p = bez(a, c, b, i / N); i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); }
      ctx.stroke();
    };
    const orb = (x: number, y: number, r: number, alpha: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${ACC},${alpha})`); g.addColorStop(1, `rgba(${ACC},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };

    const setLit = (id: string, on: boolean) => nodeRefs.current[id]?.classList.toggle("lit", on);

    const frame = (ts: number) => {
      ctx.clearRect(0, 0, W, H);

      // 앰비언트 입자
      for (const p of amb) {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > 1) p.dx *= -1; if (p.y < 0 || p.y > 1) p.dy *= -1;
        ctx.fillStyle = `rgba(157,163,179,${p.a})`;
        ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.s * Math.min(W, H) * 0.04 + 0.6, 0, Math.PI * 2); ctx.fill();
      }

      const hover = hoverRef.current;
      // 연결 상태(정리 완료 후) — 중립·faint 지속선 = "이제 연결되어 있다"
      if (connectedRef.current && !playRef.current) {
        for (const cn of CONN) {
          const a = pts[cn.from], b = pts[cn.to];
          const hot = hover && (cn.from === hover || cn.to === hover);
          if (hot) curve(a, ctrl(a, b, cn.k), b, 1, 0.5, 1.4);
          else curveNeutral(a, ctrl(a, b, cn.k), b, 0.1);
        }
      }

      // 활성 흐름
      if (playRef.current) {
        const e = (ts - startRef.current) / 1000;
        const recede = e > T_END ? clamp01(1 - (e - T_END) / 0.7) : 1;
        for (const cn of CONN) {
          const a = pts[cn.from], b = pts[cn.to], c = ctrl(a, b, cn.k);
          const [s0, s1] = cn.win;
          if (e >= s0) {
            const prog = easeInOut(clamp01((e - s0) / (s1 - s0)));
            curve(a, c, b, prog, 0.55 * recede, 1.6);
            if (e >= s0 && e <= s1) { const h = bez(a, c, b, prog); orb(h.x, h.y, 24, 0.5 * recede); orb(h.x, h.y, 7, 0.95 * recede); }
          }
          // 도착 시 노드 펄스(캔버스 링) + 라이트 온
          if (e >= cn.arrive) setLit(cn.to === "door" ? "intent" : cn.to, true);
          if (e >= cn.arrive && e <= cn.arrive + 0.6 && cn.to !== "door") {
            const t = (e - cn.arrive) / 0.6; const p = pts[cn.to];
            ctx.strokeStyle = `rgba(${ACC},${0.4 * (1 - t) * recede})`; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.arc(p.x, p.y, 20 + t * 26, 0, Math.PI * 2); ctx.stroke();
          }
        }
        // 문 회귀 도착
        doorRef.current?.classList.toggle("active", e < T_END + 0.2);
        if (e >= T_END) { connectedRef.current = true; }
        if (e > T_END + 0.7) { playRef.current = false; setPlaying(false); doorRef.current?.classList.remove("active"); }
      }

      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, []);

  const run = () => {
    if (playRef.current) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    for (const n of NODES) nodeRefs.current[n.id]?.classList.remove("lit");
    if (reduce) { for (const n of NODES) nodeRefs.current[n.id]?.classList.add("lit"); connectedRef.current = true; return; }
    connectedRef.current = false;
    startRef.current = performance.now();
    playRef.current = true;
    setPlaying(true);
  };

  const hover = (id: string | null) => { hoverRef.current = id; };

  return (
    <div className="lab">
      <style>{CSS}</style>

      <header className="lab-top">
        <span className="lab-mark">Comein · Living Intelligence</span>
        <span className="lab-hint">문 → 빛 → 관계 → 회귀</span>
      </header>

      <div className="lab-stage" ref={stageRef}>
        <div className="lab-noise" aria-hidden />
        <canvas ref={canvasRef} className="lab-canvas" aria-hidden />

        {/* 문 — 원점 */}
        <div className="lab-door" ref={doorRef} style={{ left: `${DOOR.x * 100}%`, top: `${DOOR.y * 100}%` }}>
          <svg viewBox="0 0 40 52" className="lab-door-svg" fill="none" aria-hidden>
            <rect x="3" y="3" width="34" height="46" rx="2.5" className="lab-door-frame" strokeWidth="1.6" />
            <path d="M20 7 L31 10 V42 L20 45 Z" className="lab-door-panel" strokeWidth="1.6" />
            <circle cx="23.5" cy="26" r="1.1" className="lab-door-handle" />
          </svg>
        </div>

        {/* 노드 — Intent(허브) + 목적지 */}
        {NODES.map((n) => (
          <div
            key={n.id}
            ref={(el) => { nodeRefs.current[n.id] = el; }}
            className={`lab-node ${n.hub ? "hub" : ""}`}
            style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%` }}
            onMouseEnter={() => hover(n.id)}
            onMouseLeave={() => hover(null)}
          >
            <span className="lab-node-ic"><n.icon className="lab-node-icon" /></span>
            <div className="lab-node-txt">
              <span className="lab-node-label">{n.label}</span>
              <span className="lab-node-sub">{n.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <form className="lab-cmd" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <span className="lab-cmd-q">“</span>
        <input value={command} onChange={(e) => setCommand(e.target.value)} className="lab-cmd-input" aria-label="명령" />
        <span className="lab-cmd-q">”</span>
        <button type="submit" className="lab-run" disabled={playing}>{playing ? "이해하는 중…" : "실행"}</button>
      </form>

      <p className="lab-rec">
        빛은 문에서 나와 <b>맥락(Intent)</b>을 먼저 세우고, 곡선을 따라 관계를 키운 뒤 <i>다시 문으로 돌아와 닫힙니다.</i>
        정리가 끝나면 연결선은 조용한 중립선으로 남아 — 워크스페이스가 이제 <b>연결되어 있음</b>을 보여줍니다. 노드에 마우스를 올리면 관련 관계가 살아납니다.
      </p>
    </div>
  );
}

const CSS = `
.lab {
  --paper: #0B0C12; --surface: #11131B; --ink: #F4F5F7; --muted: #9DA3B3; --faint: #5C6273; --hair: #1E212C; --accent: #8B7DFF; --glow: rgba(139,125,255,0.18);
  min-height: 100vh; min-height: 100dvh; background: var(--paper); color: var(--ink);
  font-family: var(--font-sans), "Pretendard Variable", -apple-system, system-ui, sans-serif; -webkit-font-smoothing: antialiased;
  display: flex; flex-direction: column; gap: 18px; padding: clamp(24px, 5vw, 56px);
}
.lab-top { display: flex; align-items: baseline; justify-content: space-between; gap: 20px; }
.lab-mark { font-size: 13px; font-weight: 600; letter-spacing: 0.04em; color: var(--muted); }
.lab-hint { font-size: 11px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint); }

.lab-stage { position: relative; width: 100%; max-width: 1040px; margin: 0 auto; aspect-ratio: 16 / 9;
  border: 1px solid var(--hair); border-radius: 22px; overflow: hidden;
  background: radial-gradient(80% 90% at 12% 50%, #12131d 0%, transparent 55%), radial-gradient(70% 80% at 78% 42%, #0f1119 0%, var(--paper) 62%); }
.lab-noise { position: absolute; inset: 0; opacity: 0.035; pointer-events: none; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
.lab-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }

.lab-door { position: absolute; transform: translate(-50%, -50%); width: 52px; height: 68px; z-index: 2; }
.lab-door-svg { width: 100%; height: 100%; overflow: visible; }
.lab-door-frame { stroke: var(--muted); opacity: 0.5; transition: stroke 0.7s, opacity 0.7s; }
.lab-door-panel { stroke: var(--muted); fill: var(--accent); fill-opacity: 0; opacity: 0.6; transform-origin: 20px 26px; transition: all 0.7s cubic-bezier(0.22,1,0.36,1); }
.lab-door-handle { fill: var(--muted); transition: fill 0.7s; }
.lab-door.active .lab-door-frame { stroke: var(--accent); opacity: 0.92; }
.lab-door.active .lab-door-panel { stroke: var(--accent); fill-opacity: 0.16; opacity: 1; transform: scaleX(0.8); }
.lab-door.active .lab-door-handle { fill: var(--accent); }
.lab-door.active .lab-door-svg { filter: drop-shadow(0 0 10px var(--glow)) drop-shadow(0 0 26px var(--glow)); }

/* 노드 — 가볍게, 테두리 최소, 타이포 정제 */
.lab-node { position: absolute; transform: translate(-50%, -50%); z-index: 2; display: flex; align-items: center; gap: 10px; padding: 8px 13px; border-radius: 13px;
  background: color-mix(in srgb, var(--surface) 70%, transparent); backdrop-filter: blur(3px);
  transition: box-shadow 0.6s, background 0.6s, transform 0.5s cubic-bezier(0.22,1,0.36,1); cursor: default; max-width: 186px; }
.lab-node:hover { transform: translate(-50%, -50%) translateY(-1px); }
.lab-node-ic { display: grid; place-items: center; width: 25px; height: 25px; border-radius: 8px; background: color-mix(in srgb, var(--paper) 70%, transparent); color: var(--faint); flex-shrink: 0; transition: color 0.6s; }
.lab-node-icon { width: 15px; height: 15px; stroke-width: 1.7; }
.lab-node-txt { display: flex; flex-direction: column; min-width: 0; }
.lab-node-label { font-size: 12.5px; font-weight: 600; color: var(--ink); letter-spacing: -0.01em; line-height: 1.2; }
.lab-node-sub { font-size: 10.5px; font-weight: 300; color: var(--faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color 0.6s; }
.lab-node.hub { padding: 10px 16px; background: color-mix(in srgb, var(--surface) 88%, transparent); box-shadow: 0 0 0 1px var(--hair); }
.lab-node.hub .lab-node-label { font-size: 13.5px; }
.lab-node.lit { box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 26%, transparent), 0 0 30px -8px var(--glow); }
.lab-node.lit .lab-node-ic { color: var(--accent); }
.lab-node.lit .lab-node-sub { color: var(--muted); }

.lab-cmd { display: flex; align-items: center; gap: 8px; max-width: 640px; margin: 2px auto 0; width: 100%; padding: 8px 8px 8px 18px; border: 1px solid var(--hair); border-radius: 15px; background: var(--surface); }
.lab-cmd:focus-within { border-color: color-mix(in srgb, var(--accent) 42%, var(--hair)); box-shadow: 0 0 0 3px var(--glow); }
.lab-cmd-q { color: var(--faint); font-size: 1.1rem; }
.lab-cmd-input { flex: 1; background: transparent; border: 0; outline: none; padding: 8px 0; font-family: inherit; font-size: 1rem; font-weight: 400; color: var(--ink); caret-color: var(--accent); }
.lab-run { border: 0; border-radius: 11px; padding: 11px 22px; background: var(--accent); color: #0B0C12; font-family: inherit; font-size: 0.92rem; font-weight: 600; cursor: pointer; transition: opacity 0.25s, transform 0.15s; white-space: nowrap; }
.lab-run:disabled { opacity: 0.5; cursor: default; }
.lab-run:not(:disabled):hover { transform: translateY(-1px); }

.lab-rec { max-width: 740px; margin: 6px auto 0; text-align: center; font-size: 0.88rem; font-weight: 300; line-height: 1.7; color: var(--muted); }
.lab-rec b { color: var(--ink); font-weight: 600; }
.lab-rec i { color: var(--accent); font-style: normal; }
`;
