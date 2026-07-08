"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// SSR 안전한 layout effect (첫 페인트 전에 커버 상태를 세팅해 깜빡임 방지)
const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/**
 * 워크스페이스 진입 연출.
 * 랜딩에서 sessionStorage 플래그를 세팅하고 넘어오면,
 * 배경색으로 덮인 오버레이가 부드럽게 사라지며(페이드아웃) 워크스페이스가 열린다.
 * 랜딩의 페이드아웃과 이어져 하나의 크로스 디졸브처럼 보인다.
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
          className="bg-app pointer-events-none fixed inset-0 z-50"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          onAnimationComplete={() => setShow(false)}
        />
      )}
    </AnimatePresence>
  );
}
