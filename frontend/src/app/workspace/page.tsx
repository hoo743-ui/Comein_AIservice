import { ArrowUp, Calendar, CheckSquare, MessageCircle, NotebookPen, Users } from "lucide-react";

/**
 * Comein 워크스페이스 홈 — "대화가 곧 인터페이스".
 * 빈 상태(히어로) + 하단 입력창. 실제 대화 스트림/인라인 카드는 이후 연결.
 */
export default function ChatHome() {
  return (
    <div className="flex h-full flex-col">
      {/* 상단바 */}
      <header className="glass flex h-16 items-center justify-between border-b border-border/60 px-6">
        <h1 className="text-sm font-semibold text-foreground">Chat</h1>
        <span className="rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-secondary-foreground">
          오늘 · {new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(new Date())}
        </span>
      </header>

      {/* 대화 영역 (현재는 웰컴 히어로) */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6">
        <div className="animate-fade-up flex w-full max-w-2xl flex-col items-center text-center">
          {/* 글로우 오브 */}
          <div className="relative mb-7">
            <div className="absolute inset-0 rounded-full brand-gradient blur-2xl opacity-50" />
            <div className="relative flex size-20 items-center justify-center rounded-full brand-gradient text-white shadow-glow">
              <MessageCircle className="size-9" />
            </div>
          </div>

          <h2 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Come <span className="text-brand-gradient">in.</span>
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            무엇이든 말씀하세요. 워크스페이스가 대신 정리합니다.
          </p>

          {/* 기능 제안 필 */}
          <div className="mt-8 grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
            <FeaturePill icon={<Calendar className="size-4" />} label="일정 잡기" hint="다음 주 화요일 3시 미팅" />
            <FeaturePill icon={<NotebookPen className="size-4" />} label="메모하기" hint="아이디어 정리·태깅" />
            <FeaturePill icon={<CheckSquare className="size-4" />} label="할 일" hint="우선순위 자동 추천" />
            <FeaturePill icon={<Users className="size-4" />} label="회의 정리" hint="요약·액션아이템 추출" />
            <FeaturePill icon={<MessageCircle className="size-4" />} label="물어보기" hint="오늘 일정 알려줘" />
            <FeaturePill icon={<Calendar className="size-4" />} label="빈 시간 찾기" hint="겹치지 않는 시간 추천" />
          </div>
        </div>
      </div>

      {/* 입력창 */}
      <div className="px-6 py-4">
        <form className="glass mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-border/70 p-2 shadow-soft focus-within:ring-2 focus-within:ring-ring">
          <textarea
            rows={1}
            placeholder="무엇을 도와드릴까요?  예) 내일 오후 2시에 스터디 잡아줘"
            className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            aria-label="보내기"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl brand-gradient text-white shadow-soft transition-transform hover:scale-105 active:scale-95"
          >
            <ArrowUp className="size-5" />
          </button>
        </form>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          AI가 생성한 결과는 확인 후 반영됩니다.
        </p>
      </div>
    </div>
  );
}

function FeaturePill({
  icon,
  label,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button className="glass group flex flex-col items-start gap-1 rounded-xl border border-border/70 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft">
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}
