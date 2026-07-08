"use client";

import * as React from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  Calendar,
  CheckSquare,
  MessageCircle,
  NotebookPen,
  Smile,
  Users,
  type LucideIcon,
} from "lucide-react";

type Node = { icon: LucideIcon; label: string; desc: string; x: number; y: number };

const CENTER = { x: 50, y: 48 };

// 포스터 배치를 따라 중앙 오브에서 5개 기능이 뻗어나간다 (좌표는 %)
const NODES: Node[] = [
  { icon: MessageCircle, label: "Chat", desc: "모든 업무의 입구", x: 23, y: 16 },
  { icon: Calendar, label: "Calendar", desc: "일정·충돌 관리", x: 78, y: 14 },
  { icon: NotebookPen, label: "Memo", desc: "AI 자동 정리·태깅", x: 17, y: 55 },
  { icon: CheckSquare, label: "Todo", desc: "우선순위 자동 추천", x: 83, y: 57 },
  { icon: Users, label: "Meeting", desc: "요약·액션아이템", x: 50, y: 86 },
];

/**
 * 기능 마인드맵 — 배경에 ComeIn 사진을 깔고, 중앙 오브에서
 * 5개 기능 노드가 선을 그리며 펼쳐진다(확대·언폴드). 각 노드에 설명 포함.
 */
export function FeatureMindmap() {
  const reduce = useReducedMotion();

  return (
    <div className="relative aspect-[5/4] w-full overflow-hidden rounded-[2rem] border border-white/40 bg-card/30 shadow-soft backdrop-blur-md">
      {/* 배경 사진 (은은하게) */}
      <Image
        src="/brand-hero.webp"
        alt="문이 열린 Comein 워크스페이스"
        fill
        sizes="(max-width: 1024px) 90vw, 520px"
        priority
        className="object-cover opacity-35"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-background/55 via-background/25 to-background/65" />

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
            initial={reduce ? { opacity: 0.45 } : { pathLength: 0, opacity: 0 }}
            animate={reduce ? { opacity: 0.45 } : { pathLength: 1, opacity: 0.5 }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.12 }}
          />
        ))}
      </svg>

      {/* 중앙 AI 오브 */}
      <motion.div
        className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${CENTER.x}%`, top: `${CENTER.y}%` }}
        initial={reduce ? { opacity: 1 } : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="grid size-16 place-items-center rounded-full brand-gradient text-white shadow-glow">
          <Smile className="size-8" />
        </div>
      </motion.div>

      {/* 기능 노드 (설명 포함) */}
      {NODES.map((n, i) => (
        <motion.div
          key={n.label}
          className="absolute z-10 w-max -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
          initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.45,
            delay: 0.42 + i * 0.12,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <div className="flex items-center gap-2 rounded-xl border border-white/50 bg-card/75 px-3 py-2 shadow-soft backdrop-blur-md">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
              <n.icon className="size-4" />
            </span>
            <span className="leading-tight">
              <span className="block text-xs font-semibold text-foreground">{n.label}</span>
              <span className="block text-[10px] text-muted-foreground">{n.desc}</span>
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
