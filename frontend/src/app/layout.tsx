import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";

// 본문(라틴) — Inter, 한글은 Pretendard(아래 CDN)로 우선 적용.
//
// 세리프(Fraunces)를 --font-display 로 함께 싣던 때가 있었다. normal·italic 두 벌을
// 받아 놓고 정작 그 변수를 읽는 곳이 한 군데도 없었다 — 화면에 한 글자도 그리지 않는
// 폰트를 매번 내려받고 있었던 셈이다. 디자인 언어도 세리프를 쓰지 않는다(CLAUDE.md §6).
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Comein — AI Workspace",
  description:
    "채팅 한 줄로 일정·메모·할 일·회의가 자동으로 정리되는 대화형 AI 워크스페이스",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans">
        {/* 한글 프리미엄 폰트 Pretendard (동적 서브셋) — React가 head로 hoist */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css"
        />
        {/* 화면 제목(오늘·캘린더·사람) 전용 — SUIT. 본문은 그대로 Pretendard 가 맡는다. */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2.0.5/fonts/variable/woff2/SUIT-Variable.css"
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
