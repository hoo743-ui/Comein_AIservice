"use client";

import * as React from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  Calendar,
  CheckSquare,
  MessageCircle,
  MousePointerClick,
  NotebookPen,
  Smile,
  Users,
  type LucideIcon,
} from "lucide-react";

type Node = { icon: LucideIcon; label: string; desc: string; x: number; y: number };

const CENTER = { x: 50, y: 48 };

// 중앙 오브에서 5개 기능이 뻗어나간다 (좌표는 %)
const NODES: Node[] = [
  { icon: MessageCircle, label: "Chat", desc: "모든 업무의 입구", x: 23, y: 16 },
  { icon: Calendar, label: "Calendar", desc: "일정·충돌 관리", x: 78, y: 14 },
  { icon: NotebookPen, label: "Memo", desc: "AI 자동 정리·태깅", x: 17, y: 55 },
  { icon: CheckSquare, label: "Todo", desc: "우선순위 자동 추천", x: 83, y: 57 },
  { icon: Users, label: "Meeting", desc: "요약·액션아이템", x: 50, y: 86 },
];

/**
 * 기능 마인드맵 — 클릭하면 중앙 오브를 기준으로 확대되며,
 * 5개 기능 노드가 선을 그리며 펼쳐지고 각 기능 설명이 나타난다(토글).
 * 페이지 이동은 하지 않는다(진입은 별도 [입장하기] 버튼).
 */
export function FeatureMindmap() {
  const reduce = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const shown = open || reduce; // 모션 최소화 설정이면 항상 펼친 상태

  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-expanded={open}
      aria-label="기능 마인드맵 펼치기"
      className="group relative block aspect-[5/4] w-full overflow-hidden rounded-[2rem] border border-white/40 bg-card/30 text-left shadow-soft backdrop-blur-md"
    >
      {/* 배경 사진 */}
      <Image
        src="/brand-hero.webp"
        alt="문이 열린 Comein 워크스페이스"
        fill
        sizes="(max-width: 1024px) 90vw, 520px"
        priority
        className="object-cover opacity-35"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-background/55 via-background/25 to-background/65" />

      {/* 그래프 그룹 — 클릭 시 확대(확대되며 펼쳐짐) */}
      <motion.div
        className="absolute inset-0"
        style={{ transformOrigin: `${CENTER.x}% ${CENTER.y}%` }}
        animate={{ scale: shown ? 1 : 0.6 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* 연결선 */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {NODES.map((n, i) => (
            <motion.path
              key={n.label}
              d={`M${CENTER.x},${CENTER.y} L${n.x},${n.y}`}
              stroke="hsl(var(--primary))"
              strokeWidth={0.4}
              strokeLinecap="round"
              fill="none"
              animate={{ pathLength: shown ? 1 : 0, opacity: shown ? 0.5 : 0 }}
              transition={{ duration: 0.45, delay: shown ? 0.1 + i * 0.08 : 0 }}
            />
          ))}
        </svg>

        {/* 기능 노드 (설명 포함) */}
        {NODES.map((n, i) => (
          <div
            key={n.label}
            className="absolute"
            style={{ left: `${n.x}%`, top: `${n.y}%`, transform: "translate(-50%, -50%)" }}
          >
            <motion.div
              className="w-max"
              animate={{ opacity: shown ? 1 : 0, scale: shown ? 1 : 0.4 }}
              transition={{ duration: 0.4, delay: shown ? 0.12 + i * 0.08 : 0, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="flex items-center gap-2 rounded-xl border border-white/50 bg-card/80 px-3 py-2 shadow-soft backdrop-blur-md">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
                  <n.icon className="size-4" />
                </span>
                <span className="leading-tight">
                  <span className="block text-xs font-semibold text-foreground">{n.label}</span>
                  <span className="block text-[10px] text-muted-foreground">{n.desc}</span>
                </span>
              </span>
            </motion.div>
          </div>
        ))}
      </motion.div>

      {/* 중앙 AI 오브 (항상 표시, 클릭 유도) */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${CENTER.x}%`, top: `${CENTER.y}%` }}
      >
        <motion.div
          className="grid size-16 place-items-center rounded-full brand-gradient text-white shadow-glow"
          animate={reduce ? undefined : { scale: open ? 1 : [1, 1.06, 1] }}
          transition={reduce ? undefined : { duration: 2.4, repeat: open ? 0 : Infinity, ease: "easeInOut" }}
        >
          <Smile className="size-8" />
        </motion.div>
      </div>

      {/* 안내 칩 — 접힘일 때만 */}
      <motion.span
        className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/50 bg-card/80 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-soft backdrop-blur-md"
        animate={{ opacity: shown ? 0 : 1, y: shown ? 6 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <MousePointerClick className="size-3.5 text-primary" />
        클릭하여 기능 펼치기
      </motion.span>
    </button>
  );
}
