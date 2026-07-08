"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// SSR 안전한 layout effect (첫 페인트 전에 커버 상태를 세팅해 깜빡임 방지)
const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/**
 * 워크스페이스 진입 연출.
 * 랜딩에서 sessionStorage 플래그를 세팅하고 넘어오면,
 * 반투명 문 두 짝이 가로로 갈라지며 워크스페이스를 드러낸다.
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
        <div className="pointer-events-none fixed inset-0 z-50">
          <motion.div
            className="absolute inset-y-0 left-0 w-1/2 bg-background/80 backdrop-blur-xl"
            initial={{ x: 0 }}
            animate={{ x: "-100%" }}
            transition={{ duration: 0.62, ease: [0.7, 0, 0.3, 1], delay: 0.05 }}
            onAnimationComplete={() => setShow(false)}
          >
            <div className="absolute right-0 top-0 h-full w-[3px] brand-gradient shadow-glow" />
          </motion.div>
          <motion.div
            className="absolute inset-y-0 right-0 w-1/2 bg-background/80 backdrop-blur-xl"
            initial={{ x: 0 }}
            animate={{ x: "100%" }}
            transition={{ duration: 0.62, ease: [0.7, 0, 0.3, 1], delay: 0.05 }}
          >
            <div className="absolute left-0 top-0 h-full w-[3px] brand-gradient shadow-glow" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
