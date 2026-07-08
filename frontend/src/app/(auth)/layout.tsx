import Image from "next/image";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

/** 인증(로그인/회원가입) 레이아웃 — 좌: 폼 / 우: 오피스 이미지 + 문구. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* 좌: 폼 */}
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <div className="flex items-center justify-between">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Logo subtitle />
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-sm">{children}</div>
        </div>

        <p className="text-xs text-muted-foreground">© 2026 Comein · 당신의 AI 워크스페이스</p>
      </div>

      {/* 우: 이미지 + 문구 */}
      <div className="relative hidden overflow-hidden border-l border-border lg:block">
        <Image
          src="/hero-bg.webp"
          alt="Comein 워크스페이스"
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <p className="max-w-md font-display text-3xl font-medium leading-snug tracking-tight text-foreground">
            “들어오면, 오늘이 이미 정리되어 있습니다.”
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            일정·메모·할 일·회의를 대신 생각하는 워크스페이스.
          </p>
        </div>
      </div>
    </div>
  );
}
