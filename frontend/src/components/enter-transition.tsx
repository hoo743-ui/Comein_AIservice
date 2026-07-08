"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { MarkSplash } from "@/components/brand/mark-splash";

// SSR 안전한 layout effect (첫 페인트 전에 커버 상태를 세팅해 깜빡임 방지)
const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/**
 * 워크스페이스 진입 리빌 — 랜딩에서 넘어오면 스플래시가 덮인 상태로 시작해
 * 부드럽게 투명해지며 워크스페이스가 드러난다. (랜딩의 크로스 디졸브와 이어짐)
 */
export function EnterReveal() {
  const [show, setShow] = React.useState(false);

  useIsoLayoutEffect(() => {
    try {
      if (sessionStorage.getItem("comein:entering")) {
        sessionStorage.removeItem("comein:entering");
        setShow(true);
      }
    } catch {}
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="enter-reveal"
          className="pointer-events-none fixed inset-0 z-[100]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.95, ease: [0.4, 0, 0.2, 1], delay: 0.55 }}
          onAnimationComplete={() => setShow(false)}
        >
          <MarkSplash />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
