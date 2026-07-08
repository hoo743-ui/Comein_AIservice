"use client";

import * as React from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

// SSR 안전한 layout effect (첫 페인트 전에 커버 상태를 세팅해 깜빡임 방지)
const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/**
 * 워크스페이스 진입 연출.
 * 입장하기/로그인/회원가입에서 sessionStorage 플래그를 세팅하고 넘어오면,
 * Comein 로고 스플래시가 크게 떠오른 뒤 오버레이가 투명해지며 워크스페이스가 드러난다.
 * (직접 /workspace 방문 시엔 재생하지 않음)
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
          className="bg-app pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1], delay: 1.3 }}
          onAnimationComplete={() => setShow(false)}
        >
          <motion.div
            className="overflow-hidden rounded-[1.75rem] shadow-2xl ring-1 ring-border/50"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.9, 1, 1, 1.05] }}
            transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1], times: [0, 0.16, 0.78, 1] }}
          >
            <Image
              src="/brand-splash.webp"
              alt="Comein — 생각은 흩어집니다. 질서는 만들어집니다."
              width={1000}
              height={1000}
              priority
              className="h-auto w-[min(82vw,500px)]"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
