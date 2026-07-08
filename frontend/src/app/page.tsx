"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { FeatureMindmap } from "@/components/feature-mindmap";
import { useT } from "@/lib/i18n";

/**
 * Comein 랜딩(메인) 페이지 — 깔끔·고급·심플.
 * 전체 레이아웃은 반투명 글래스 패널 위에 얹는다.
 * 우측은 사진 위에서 기능이 마인드맵처럼 펼쳐지는 히어로.
 * [입장하기](투명 네온) → 첫 페이지가 부드럽게 투명해지며 워크스페이스로 크로스 디졸브.
 */
export default function Landing() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const t = useT();
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
      className="relative flex min-h-screen flex-col overflow-hidden bg-background"
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
      {/* 배경 사진 (미니멀 럭스 오피스) */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[url('/hero-bg.webp')] bg-cover bg-center"
      />
      {/* 가독성·테마 워시 */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/25 to-background/70 dark:from-background/85 dark:via-background/70 dark:to-background/95"
      />
      <div aria-hidden className="absolute inset-0 bg-primary/[0.04]" />
      {/* 미세 그레인 텍스처 */}
      <div
        aria-hidden
        className="grain-overlay pointer-events-none fixed inset-0 z-[1] opacity-[0.05] mix-blend-overlay dark:opacity-[0.09]"
      />

      {/* 상단 바 — 투명(배경 위에 자연스럽게) */}
      <header className="relative z-20 flex items-center justify-between px-6 py-6 sm:px-10">
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
              <span className="text-[13px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                {t("land.eyebrow")}
              </span>

              <h1 className="mt-5 font-display text-7xl font-semibold leading-none tracking-tight text-foreground sm:text-8xl">
                Comein<span className="text-brand-gradient">.</span>
              </h1>

              <p className="mt-8 max-w-lg whitespace-pre-line text-2xl font-medium leading-snug text-foreground/90 sm:text-3xl">
                {t("land.tagline")}
              </p>

              <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t("land.desc")}
              </p>

              {/* CTA — 정제된 네온 */}
              <div className="mt-10 flex items-center gap-4">
                <button
                  onClick={enter}
                  disabled={entering}
                  className="group relative flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-9 py-4 text-lg font-semibold text-primary shadow-[0_0_18px_-6px_hsl(var(--primary)/0.5)] backdrop-blur-md transition-all hover:border-primary/70 hover:bg-primary/[0.16] hover:shadow-[0_0_26px_-6px_hsl(var(--primary)/0.7)] active:scale-[0.98] disabled:opacity-70"
                >
                  {t("land.enter")}
                  <ArrowRight className="size-[22px] transition-transform group-hover:translate-x-1" />
                </button>
                <span className="text-sm text-muted-foreground">{t("land.browse")}</span>
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
