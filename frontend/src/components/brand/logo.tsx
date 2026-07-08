import { cn } from "@/lib/utils";

/**
 * Comein 로고 — "살짝 열린 문" 마크 (브랜드 스토리: 문을 열고 들어오는 순간).
 * 그라디언트 바이올렛→페리윙클. size 로 마크 크기를 조절한다.
 */
export function LogoMark({
  className,
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={className}
    >
      <defs>
        <linearGradient id="comein-door" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B7BE8" />
          <stop offset="1" stopColor="#5B62DC" />
        </linearGradient>
      </defs>
      {/* 문틀 */}
      <rect x="5" y="3" width="22" height="26" rx="5" fill="url(#comein-door)" />
      {/* 열린 문짝 (안쪽 밝은 면) */}
      <path d="M11 7h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-9V7Z" fill="#fff" fillOpacity="0.92" />
      {/* 손잡이 */}
      <circle cx="13" cy="16" r="1.4" fill="url(#comein-door)" />
    </svg>
  );
}

/** 로고 마크 + 워드마크(Comein) 조합. */
export function Logo({
  className,
  withWordmark = true,
  subtitle = false,
}: {
  className?: string;
  withWordmark?: boolean;
  subtitle?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={30} />
      {withWordmark && (
        <div className="flex flex-col leading-none">
          <span className="text-lg font-bold tracking-tight text-foreground">
            Comein
          </span>
          {subtitle && (
            <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">
              당신의 AI Workspace
            </span>
          )}
        </div>
      )}
    </div>
  );
}
