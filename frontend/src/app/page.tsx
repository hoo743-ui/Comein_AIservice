"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { FeatureMindmap } from "@/components/feature-mindmap";

/**
 * Comein 랜딩(메인) 페이지 — 깔끔·고급·심플.
 * 전체 레이아웃은 반투명 글래스 패널 위에 얹는다.
 * 우측은 사진 위에서 기능이 마인드맵처럼 펼쳐지는 히어로.
 * [입장하기](투명 네온) → 첫 페이지가 부드럽게 투명해지며 워크스페이스로 크로스 디졸브.
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
    <motion.div
      className="bg-app relative flex min-h-screen flex-col overflow-hidden"
      animate={
        entering
          ? { opacity: 0, scale: 1.03, filter: "blur(6px)" }
          : { opacity: 1, scale: 1, filter: "blur(0px)" }
      }
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      onAnimationComplete={() => {
        if (entering) goWorkspace();
      }}
    >
      {/* 배경: 유리가 비쳐 보이도록 은은한 컬러 블롭 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-4 size-[26rem] rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute -right-16 top-1/4 size-[30rem] rounded-full bg-[hsl(232_74%_64%/0.22)] blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 size-[24rem] rounded-full bg-accent/50 blur-3xl" />
      </div>

      {/* 상단 바 — 글래스 스트립 */}
      <header className="glass sticky top-0 z-20 flex items-center justify-between border-b border-white/20 px-6 py-4 sm:px-10">
        <Logo subtitle />
        <ThemeToggle />
      </header>

      {/* 히어로 — 전체를 반투명 글래스 패널 위에 */}
      <main className="relative z-10 flex flex-1 items-center px-4 py-[6vh] sm:px-8">
        <div className="mx-auto w-full max-w-6xl rounded-[2.5rem] border border-white/40 bg-card/40 p-8 shadow-soft backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 sm:p-12">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
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
                Come in,
                <span className="mt-2 block text-brand-gradient">Comein.</span>
              </h1>

              <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
                들어오세요. 당신의 워크스페이스가 대신 생각합니다.
                <br />
                채팅 한 줄이면 일정·메모·할 일·회의가 자동으로 정리됩니다.
              </p>

              {/* CTA — 투명 네온 버튼 */}
              <div className="mt-9 flex items-center gap-4">
                <button
                  onClick={enter}
                  disabled={entering}
                  className="group relative flex items-center gap-2 rounded-full border border-primary/60 bg-primary/10 px-8 py-4 text-base font-semibold text-primary shadow-[0_0_22px_-4px_hsl(var(--primary)/0.65)] backdrop-blur-md transition-all hover:bg-primary/20 hover:shadow-[0_0_34px_-2px_hsl(var(--primary)/0.9)] active:scale-[0.98] disabled:opacity-70 dark:text-primary"
                >
                  입장하기
                  <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
                </button>
                <span className="text-xs text-muted-foreground">회원가입 없이 둘러보기</span>
              </div>
            </motion.div>

            {/* 우: 기능 마인드맵 (사진 위에서 펼쳐짐) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:block"
            >
              <FeatureMindmap />
            </motion.div>
          </div>
        </div>
      </main>
    </motion.div>
  );
}
