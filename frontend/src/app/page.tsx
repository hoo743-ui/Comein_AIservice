"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { FeatureMindmap } from "@/components/feature-mindmap";
import { MarkSplash } from "@/components/brand/mark-splash";
import { useT } from "@/lib/i18n";

/**
 * Comein 랜딩(메인) 페이지 — 깔끔·고급·심플.
 * 전체 레이아웃은 반투명 글래스 패널 위에 얹는다.
 * 우측은 사진 위에서 기능이 마인드맵처럼 펼쳐지는 히어로.
 * [입장하기](투명 네온) → 첫 페이지가 부드럽게 투명해지며 워크스페이스로 크로스 디졸브.
 */
export default function Landing() {
  const router = useRouter();
  const t = useT();
  const [entering, setEntering] = React.useState(false);

  // 입장: 첫 페이지가 투명해지며 마크 스플래시가 뜨고 → 워크스페이스로 이어짐
  const enter = React.useCallback(() => setEntering(true), []);
  const goWorkspace = React.useCallback(() => {
    try {
      sessionStorage.setItem("comein:entering", "1");
    } catch {}
    router.push("/workspace");
  }, [router]);

  React.useEffect(() => {
    router.prefetch("/workspace");
  }, [router]);

  return (
    <>
      <motion.div
        className="relative flex min-h-screen flex-col overflow-hidden bg-background"
        animate={{ opacity: entering ? 0 : 1 }}
        transition={{ duration: 0.85, ease: [0.4, 0, 0.2, 1] }}
      >
      {/* 배경 사진 (미니멀 럭스 오피스) — 바람 부는 앰비언트 드리프트 */}
      <div
        aria-hidden
        className="animate-kenburns absolute inset-0 bg-[url('/hero-bg.webp')] bg-cover bg-center"
      />
      {/* 빛이 스치는 스윕 */}
      <div
        aria-hidden
        className="animate-sheen pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_42%,rgba(255,255,255,0.12)_50%,transparent_58%)]"
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
        <div className="flex items-center gap-1">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
          >
            {t("land.login")}
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* 히어로 — 전체를 반투명 글래스 패널 위에 */}
      <main className="relative z-10 flex flex-1 items-center px-4 py-[6vh] sm:px-8">
        <div className="mx-auto w-full max-w-6xl rounded-2xl border border-border bg-card/70 p-8 shadow-soft backdrop-blur-md sm:p-12 lg:pl-16">
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

              <h1 className="mt-5 font-display text-6xl font-semibold leading-none tracking-tight text-foreground sm:text-[5rem]">
                Comein<span className="text-brand-gradient">.</span>
              </h1>

              <p className="mt-8 max-w-xl whitespace-pre-line text-[1.65rem] font-medium leading-relaxed text-foreground/90 sm:text-[2.05rem]">
                {t("land.tagline")}
              </p>

              <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t("land.desc")}
              </p>

              {/* CTA — 정제된 네온 */}
              <div className="mt-10 flex items-center gap-4">
                <button
                  onClick={enter}
                  className="group relative flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-9 py-[18px] text-lg font-semibold text-primary shadow-[0_0_20px_-4px_hsl(var(--primary)/0.10)] backdrop-blur-md transition-all hover:border-primary/70 hover:bg-primary/[0.16] hover:shadow-[0_0_26px_-4px_hsl(var(--primary)/0.20)] active:scale-[0.98]"
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

      {/* 입장 크로스 디졸브 — 첫 페이지가 투명해지며 마크 스플래시 등장 */}
      {entering && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[100]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.85, delay: 0.15, ease: [0.4, 0, 0.2, 1] }}
          onAnimationComplete={goWorkspace}
        >
          <MarkSplash />
        </motion.div>
      )}
    </>
  );
}
