"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/modal";

export default function SignupPage() {
  const router = useRouter();

  // 데모: 실제 가입 없이 진입 연출 후 이동 (이메일/Google 공통)
  const enterDemo = () => {
    try {
      sessionStorage.setItem("comein:entering", "1");
    } catch {}
    router.push("/workspace");
  };
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    enterDemo();
  };

  return (
    <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">
          Comein에 들어오세요
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          몇 초면 충분해요. 오늘부터 워크스페이스가 대신 생각합니다.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field label="이름">
            <input type="text" required placeholder="홍길동" className={inputClass} />
          </Field>
          <Field label="이메일">
            <input type="email" required placeholder="you@example.com" className={inputClass} />
          </Field>
          <Field label="비밀번호">
            <input type="password" required placeholder="8자 이상" className={inputClass} />
          </Field>

          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" required className="mt-0.5 size-3.5 accent-[hsl(var(--primary))]" />
            <span>
              <span className="text-primary">이용약관</span> 및{" "}
              <span className="text-primary">개인정보 처리방침</span>에 동의합니다.
            </span>
          </label>

          <Button type="submit" size="lg" className="w-full">
            회원가입
            <ArrowRight className="size-4" />
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          또는
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" size="lg" className="w-full" onClick={enterDemo}>
          Google로 계속하기
        </Button>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            로그인
          </Link>
        </p>
      </div>
  );
}
