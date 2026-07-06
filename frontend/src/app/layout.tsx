import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Comein — AI Workspace",
  description: "채팅 한 줄로 일정·메모·할 일·회의가 자동으로 정리되는 대화형 AI 워크스페이스",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
