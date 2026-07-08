import { cn } from "@/lib/utils";

const styles = {
  default: "bg-primary/12 text-primary",
  muted: "bg-muted text-muted-foreground",
  high: "bg-destructive/12 text-destructive",
  mid: "bg-primary/12 text-primary",
  low: "bg-muted text-muted-foreground",
  outline: "border border-border text-muted-foreground",
} as const;

/** 작은 상태/태그 배지. */
export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof styles;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
