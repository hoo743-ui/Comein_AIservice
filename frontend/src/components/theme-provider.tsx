"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * next-themes 래퍼 — <html> 에 .dark 클래스를 토글한다.
 * SSR-safe(FOUC 없음). layout.tsx 에서 앱 전체를 감싼다.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
