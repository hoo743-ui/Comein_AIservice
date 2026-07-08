"use client";

import { motion } from "framer-motion";

import { LogoMark } from "@/components/brand/logo";

/**
 * 브랜드 로딩 연출 — 도어 마크가 하단에서 중앙으로 떠오르고,
 * 얇은 라인이 차오른 뒤 onDone. (로그인/회원가입 진입 시)
 */
export function BrandLoader({ onDone }: { onDone: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        initial={{ y: 130, opacity: 0, scale: 0.55 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      >
        <LogoMark size={76} />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="mt-6 font-display text-2xl font-semibold tracking-tight text-foreground"
      >
        Comein
      </motion.p>

      <div className="mt-6 h-px w-44 overflow-hidden rounded-full bg-border">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.15, delay: 0.55, ease: [0.4, 0, 0.2, 1] }}
          onAnimationComplete={onDone}
        />
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-4 text-xs tracking-wide text-muted-foreground"
      >
        워크스페이스를 준비하고 있어요…
      </motion.p>
    </motion.div>
  );
}
