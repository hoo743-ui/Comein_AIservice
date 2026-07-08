"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/modal";

export default function LoginPage() {
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      sessionStorage.setItem("comein:entering", "1");
    } catch {}
    router.push("/workspace"); // 데모: 실제 인증 없이 진입 연출 후 이동
  };

  return (
    <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">
          다시 오신 걸 환영해요
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          계정에 로그인하고 워크스페이스로 들어가세요.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field label="이메일">
            <input type="email" required placeholder="you@example.com" className={inputClass} />
          </Field>
          <Field label="비밀번호">
            <input type="password" required placeholder="••••••••" className={inputClass} />
          </Field>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-muted-foreground">
              <input type="checkbox" className="size-3.5 accent-[hsl(var(--primary))]" />
              자동 로그인
            </label>
            <button type="button" className="font-medium text-primary hover:underline">
              비밀번호 찾기
            </button>
          </div>

          <Button type="submit" size="lg" className="w-full">
            로그인
            <ArrowRight className="size-4" />
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          또는
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" size="lg" className="w-full">
          Google로 계속하기
        </Button>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          아직 계정이 없으신가요?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            회원가입
          </Link>
        </p>
      </div>
  );
}
