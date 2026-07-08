import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";

// 본문(라틴) — Inter, 한글은 Pretendard(아래 CDN)로 우선 적용
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// 디스플레이(헤드라인) — 우아한 세리프 Fraunces
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Comein — AI Workspace",
  description:
    "채팅 한 줄로 일정·메모·할 일·회의가 자동으로 정리되는 대화형 AI 워크스페이스",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning className={`${inter.variable} ${fraunces.variable}`}>
      <body className="font-sans">
        {/* 한글 프리미엄 폰트 Pretendard (동적 서브셋) — React가 head로 hoist */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css"
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
