import Image from "next/image";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

/** 인증(로그인/회원가입) 레이아웃 — 좌: 폼(넉넉) / 우: 오피스 이미지 + 문구. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* 좌: 폼 */}
      <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-20">
        <div className="flex items-center justify-between">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Logo subtitle />
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-md">{children}</div>
        </div>

        <p className="text-xs text-muted-foreground">© 2026 Comein · 당신의 AI 워크스페이스</p>
      </div>

      {/* 우: 이미지 + 문구 (바람 부는 듯한 앰비언트 모션) */}
      <div className="relative hidden overflow-hidden border-l border-border lg:block">
        <Image
          src="/hero-bg.webp"
          alt="Comein 워크스페이스"
          fill
          priority
          sizes="50vw"
          className="animate-kenburns object-cover"
        />
        {/* 빛이 스치는 스윕 */}
        <div
          aria-hidden
          className="animate-sheen pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_42%,rgba(255,255,255,0.14)_50%,transparent_58%)]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-background/10" />
        <div className="absolute inset-0 flex flex-col justify-between p-14">
          <span className="text-sm font-medium tracking-wide text-foreground/70">
            당신의 AI 워크스페이스
          </span>
          <div>
            <p className="font-display text-[2.75rem] font-medium leading-[1.15] tracking-tight text-foreground">
              들어오면,
              <br />
              오늘이 이미
              <br />
              정리되어 있습니다.
            </p>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              일정·메모·할 일·회의를 대신 생각하는 워크스페이스, Comein.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
