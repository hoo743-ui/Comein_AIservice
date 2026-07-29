"use client";

import * as React from "react";

/**
 * 라우트 전환 시 리마운트되어 부드러운 페이드 인을 재생한다.
 * (App Router에서 template.tsx 는 네비게이션마다 다시 마운트된다)
 *
 * 주의: 하위 페이지들이 position: fixed 를 사용하므로 래퍼에 transform/filter 를 걸면
 * fixed 요소의 기준(containing block)이 바뀌어 레이아웃이 깨진다 → opacity 전환만 사용한다.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="route-fade">{children}</div>;
}
