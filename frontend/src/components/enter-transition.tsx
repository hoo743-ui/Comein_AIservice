"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { LogoMark } from "@/components/brand/logo";

// SSR 안전한 layout effect (첫 페인트 전에 커버 상태를 세팅해 깜빡임 방지)
const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/**
 * 워크스페이스 진입 연출.
 * 랜딩([입장하기])에서 sessionStorage 플래그를 세팅하고 넘어오면,
 * 솔리드 배경 오버레이가 도어 마크와 함께 부드럽게 사라지며 워크스페이스가 드러난다.
 * (직접 /workspace 방문 시엔 재생하지 않음)
 */
export function EnterReveal() {
  const reduce = useReducedMotion();
  const [show, setShow] = React.useState(false);

  useIsoLayoutEffect(() => {
    try {
      if (sessionStorage.getItem("comein:entering")) {
        sessionStorage.removeItem("comein:entering");
        if (!reduce) setShow(true);
      }
    } catch {}
  }, [reduce]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="enter-reveal"
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-background"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.75, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
          onAnimationComplete={() => setShow(false)}
        >
          <motion.div
            initial={{ opacity: 1, scale: 0.9, y: 8 }}
            animate={{ opacity: 0, scale: 1.15, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <LogoMark size={64} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
