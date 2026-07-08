"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Comein 랜딩(메인) 페이지 — 깔끔·고급·심플.
 * 큰 카피 + ComeIn 히어로 이미지(열린 문 오피스) + 단순한 [입장하기].
 * [입장하기] → 반투명 문 두 짝이 가로로 갈라지며 워크스페이스로 진입.
 */
export default function Landing() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [entering, setEntering] = React.useState(false);

  const goWorkspace = React.useCallback(() => {
    try {
      sessionStorage.setItem("comein:entering", "1");
    } catch {}
    router.push("/workspace");
  }, [router]);

  const enter = React.useCallback(() => {
    if (entering) return;
    if (reduce) return goWorkspace();
    setEntering(true);
  }, [entering, reduce, goWorkspace]);

  React.useEffect(() => {
    router.prefetch("/workspace");
  }, [router]);

  return (
    <div className="bg-app relative flex min-h-screen flex-col overflow-hidden">
      {/* 상단 바 */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo subtitle />
        <ThemeToggle />
      </header>

      {/* 히어로 */}
      <main className="relative z-10 flex flex-1 items-center px-6 pb-[8vh] sm:px-10">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-2">
          {/* 좌: 카피 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-start"
          >
            <span className="rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              당신의 AI Workspace
            </span>

            <h1 className="mt-6 text-4xl font-bold leading-[1.14] tracking-tight text-foreground sm:text-5xl xl:text-6xl">
              사용자를 들여보내라,
              <span className="mt-2 block text-brand-gradient">Comein.</span>
            </h1>

            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
              Your workspace is thinking for you.
              <br />
              들어오세요. 채팅 한 줄이면 일정·메모·할 일·회의가 자동으로 정리됩니다.
            </p>

            {/* 단순한 CTA */}
            <div className="mt-9 flex items-center gap-4">
              <button
                onClick={enter}
                disabled={entering}
                className="group flex items-center gap-2 rounded-full brand-gradient px-8 py-4 text-base font-semibold text-white shadow-soft transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:opacity-80"
              >
                입장하기
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </button>
              <span className="text-xs text-muted-foreground">회원가입 없이 둘러보기</span>
            </div>
          </motion.div>

          {/* 우: ComeIn 히어로 이미지 (열린 문 오피스) */}
          <motion.button
            onClick={enter}
            aria-label="입장하기"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="group relative hidden lg:block"
          >
            <div className="absolute -inset-4 rounded-[2.5rem] brand-gradient opacity-20 blur-3xl transition-opacity group-hover:opacity-30" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/50 shadow-soft ring-1 ring-black/5">
              <Image
                src="/brand-hero.webp"
                alt="문이 열린 Comein 워크스페이스 — AI 오브와 Chat·Calendar·Memo·Todo·Meeting"
                width={846}
                height={430}
                priority
                className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.02]"
              />
              {/* 하단 부드러운 페이드 */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/40 to-transparent" />
            </div>
          </motion.button>
        </div>
      </main>

      {/* 입장 연출 — 반투명 문 두 짝이 가로로 닫힘 → 전환 */}
      <AnimatePresence>
        {entering && (
          <div className="pointer-events-none fixed inset-0 z-50">
            <motion.div
              className="absolute inset-y-0 left-0 w-1/2 bg-background/80 backdrop-blur-xl"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              transition={{ duration: 0.44, ease: [0.7, 0, 0.3, 1] }}
              onAnimationComplete={goWorkspace}
            >
              <div className="absolute right-0 top-0 h-full w-[3px] brand-gradient shadow-glow" />
            </motion.div>
            <motion.div
              className="absolute inset-y-0 right-0 w-1/2 bg-background/80 backdrop-blur-xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              transition={{ duration: 0.44, ease: [0.7, 0, 0.3, 1] }}
            >
              <div className="absolute left-0 top-0 h-full w-[3px] brand-gradient shadow-glow" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
