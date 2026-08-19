"use client";

/**
 * Comein · 문과 입자 — 화면의 재질.
 *
 * 둘 다 아무것도 하지 않는다. 누를 수도 없고 값을 돌려주지도 않는다 —
 * 이 화면이 무엇으로 만들어졌는지만 말한다. 그래서 다른 조각과 섞이지 않게 갈라 둔다.
 *
 * `active` 는 "AI 가 지금 일하고 있는가" 하나뿐이다. 문은 그때 열리고, 입자는 그때 흐른다.
 * 보라색이 이 화면에서 유일하게 뜻을 갖는 자리다(CLAUDE.md §6).
 */

import * as React from "react";

/** 환경 입자 — 평소 중립·faint, AI가 일하면 문에서 보라 빛이 흐른다. */
export function Ambient({ active }: { active: boolean }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const activeRef = React.useRef(active);
  activeRef.current = active;
  React.useEffect(() => {
    const canvas = ref.current; const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, hh = 0, raf = 0, flow: { x: number; y: number; vx: number; vy: number; len: number; a: number }[] = [];
    const resize = () => { const r = canvas.getBoundingClientRect(); w = r.width; hh = r.height; canvas.width = Math.max(1, w * dpr); canvas.height = Math.max(1, hh * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(canvas);
    const amb = Array.from({ length: 16 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random(), a: 0.04 + Math.random() * 0.05, dx: (Math.random() - 0.5) * 0.00005, dy: (Math.random() - 0.5) * 0.00005 }));
    const srcX = () => w * 0.72, srcY = () => hh * 0.4;
    const spawn = () => ({ x: srcX() + (Math.random() * 14 - 7), y: srcY() + (Math.random() * hh * 0.24 - hh * 0.12), vx: -(0.3 + Math.random() * 0.9), vy: (Math.random() - 0.5) * 0.1, len: 8 + Math.random() * 26, a: 0.14 + Math.random() * 0.4 });
    const frame = () => {
      ctx.clearRect(0, 0, w, hh);
      for (const p of amb) { p.x += p.dx; p.y += p.dy; if (p.x < 0 || p.x > 1) p.dx *= -1; if (p.y < 0 || p.y > 1) p.dy *= -1; ctx.fillStyle = `rgba(150,143,132,${p.a})`; ctx.beginPath(); ctx.arc(p.x * w, p.y * hh, p.s, 0, Math.PI * 2); ctx.fill(); }
      if (activeRef.current) { if (flow.length < 30) flow.push(spawn() as any); }
      flow = flow.filter((p) => p.x > -30 && p.a > 0.01);
      for (const p of flow) { p.x += p.vx; p.y += p.vy; if (!activeRef.current) p.a *= 0.94; const g = ctx.createLinearGradient(p.x + p.len, p.y, p.x, p.y); g.addColorStop(0, "rgba(155,142,134,0)"); g.addColorStop(1, `rgba(155,142,134,${Math.min(0.7, p.a)})`); ctx.strokeStyle = g; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x + p.len, p.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }
      raf = requestAnimationFrame(frame);
    };
    if (!reduce) raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} className="rmg-ambient-canvas" aria-hidden />;
}

export function AiDoor({ active = false, className }: { active?: boolean; className?: string }) {
  return (
    <div className={`aidoor ${active ? "active" : ""} ${className ?? ""}`}>
      <svg className="aidoor-svg" viewBox="0 0 40 52" fill="none" aria-hidden>
        <rect x="3" y="3" width="34" height="46" rx="2.5" className="aidoor-frame" strokeWidth="1.6" />
        <path d="M20 7 L31 10 V42 L20 45 Z" className="aidoor-panel" strokeWidth="1.6" />
        <circle cx="23.5" cy="26" r="1.1" className="aidoor-handle" />
      </svg>
    </div>
  );
}

