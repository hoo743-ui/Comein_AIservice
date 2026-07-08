"use client";

import * as React from "react";

/** 클라이언트 마운트 완료 여부. 런타임(시간 등) 의존 렌더 전 SSR 불일치 방지용. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);
  return hydrated;
}
