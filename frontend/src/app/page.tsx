"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import {
  ArrowRight,
  Calendar,
  CheckSquare,
  MessageCircle,
  NotebookPen,
  Users,
} from "lucide-react";

import { Logo, LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Comein 랜딩(메인) 페이지.
 * 브랜드 스토리 "문을 열고 들어오는 순간"을 히어로로 삼고,
 * [입장하기] → 빛이 번지며 워크스페이스로 진입하는 연출을 담는다.
 */
export default function Landing() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [entering, setEntering] = React.useState(false);

  const enter = React.useCallback(() => {
    if (entering) return;
    if (reduce) {
      router.push("/workspace");
      return;
    }
    setEntering(true);
  }, [entering, reduce, router]);

  // 진입 프리페치로 전환을 매끄럽게
  React.useEffect(() => {
    router.prefetch("/workspace");
  }, [router]);

  return (
    <div className="bg-app relative flex min-h-screen flex-col overflow-hidden">
      {/* 상단 바 */}
      <header className="z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo subtitle />
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* 히어로 */}
      <motion.main
        className="z-10 flex flex-1 items-center px-6 sm:px-10"
        animate={
          entering
            ? { opacity: 0, scale: 1.06, filter: "blur(4px)" }
            : { opacity: 1, scale: 1 }
        }
        transition={{ duration: 0.55, ease: [0.7, 0, 0.3, 1] }}
      >
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-2">
          {/* 좌: 카피 */}
          <div className="flex flex-col items-start">
            <span className="rounded-full border border-border/70 bg-card/50 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              당신의 AI Workspace
            </span>

            <h1 className="mt-5 text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
              Come <span className="text-brand-gradient">in.</span>
            </h1>
            <p className="mt-4 max-w-md text-lg font-medium text-foreground/80">
              Your workspace is thinking for you.
            </p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              채팅 한 줄이면 일정·메모·할 일·회의가 자동으로 정리됩니다.
              들어오세요. 나머지는 워크스페이스가 대신 생각합니다.
            </p>

            {/* 기능 칩 */}
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                { icon: MessageCircle, label: "Chat" },
                { icon: Calendar, label: "Calendar" },
                { icon: NotebookPen, label: "Memo" },
                { icon: CheckSquare, label: "Todo" },
                { icon: Users, label: "Meeting" },
              ].map((f) => (
                <span
                  key={f.label}
                  className="flex items-center gap-1.5 rounded-full border border-border/70 bg-card/50 px-3 py-1.5 text-xs font-medium text-foreground/80 backdrop-blur"
                >
                  <f.icon className="size-3.5 text-primary" />
                  {f.label}
                </span>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-9 flex items-center gap-3">
              <button
                onClick={enter}
                disabled={entering}
                className="group relative flex items-center gap-2 overflow-hidden rounded-2xl brand-gradient px-7 py-3.5 text-base font-semibold text-white shadow-soft transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:opacity-80"
              >
                입장하기
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
              </button>
              <span className="text-xs text-muted-foreground">
                회원가입 없이 둘러보기
              </span>
            </div>
          </div>

          {/* 우: 문 비주얼 + 떠 있는 기능 카드 */}
          <DoorVisual reduce={!!reduce} onEnter={enter} />
        </div>
      </motion.main>

      {/* 입장 연출 오버레이 — 빛이 번지며 whiteout */}
      <AnimatePresence>
        {entering && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="aspect-square rounded-full brand-gradient"
              initial={{ width: 96, opacity: 0.2 }}
              animate={{ width: "260vmax", opacity: 1 }}
              transition={{ duration: 0.85, ease: [0.7, 0, 0.3, 1] }}
              onAnimationComplete={() => router.push("/workspace")}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const FEATURES = [
  { icon: MessageCircle, label: "Chat", pos: "left-[-6%] top-[10%]" },
  { icon: Calendar, label: "Calendar", pos: "right-[-4%] top-[4%]" },
  { icon: NotebookPen, label: "Memo", pos: "left-[-10%] bottom-[26%]" },
  { icon: CheckSquare, label: "Todo", pos: "right-[-8%] bottom-[18%]" },
  { icon: Users, label: "Meeting", pos: "bottom-[2%] left-1/2 -translate-x-1/2" },
];

const floatVariants: Variants = {
  float: (i: number) => ({
    y: [0, -8, 0],
    transition: {
      duration: 3.4 + i * 0.35,
      repeat: Infinity,
      ease: "easeInOut",
      delay: i * 0.2,
    },
  }),
};

/** 살짝 열린 문 + 빛, 주위를 떠도는 기능 카드 (포스터 우측 무드). */
function DoorVisual({
  reduce,
  onEnter,
}: {
  reduce: boolean;
  onEnter: () => void;
}) {
  return (
    <div className="relative mx-auto hidden aspect-square w-full max-w-md place-items-center lg:grid">
      {/* 배경 글로우 */}
      <div className="absolute inset-8 rounded-[3rem] brand-gradient opacity-20 blur-3xl" />

      {/* 문 카드 */}
      <button
        onClick={onEnter}
        aria-label="입장하기"
        className="glass group relative grid size-56 place-items-center rounded-[2rem] border border-white/40 shadow-soft transition-transform hover:scale-[1.02]"
      >
        {/* 열리는 빛의 슬릿 */}
        <div className="absolute right-6 top-6 h-[calc(100%-3rem)] w-2 rounded-full brand-gradient opacity-70 blur-[2px] transition-all group-hover:w-3 group-hover:opacity-100" />
        <div className="relative flex flex-col items-center gap-3">
          <div className="grid size-20 place-items-center rounded-full brand-gradient text-white shadow-glow">
            <LogoMark size={40} className="[&_rect]:fill-white/0" />
          </div>
          <span className="text-sm font-semibold text-foreground">
            Come <span className="text-brand-gradient">in.</span>
          </span>
        </div>
      </button>

      {/* 떠 있는 기능 카드 */}
      {FEATURES.map((f, i) => (
        <motion.div
          key={f.label}
          custom={i}
          variants={floatVariants}
          animate={reduce ? undefined : "float"}
          className={`glass absolute ${f.pos} flex items-center gap-2 rounded-xl border border-white/40 px-3 py-2 text-xs font-semibold text-foreground shadow-soft`}
        >
          <f.icon className="size-4 text-primary" />
          {f.label}
        </motion.div>
      ))}
    </div>
  );
}
