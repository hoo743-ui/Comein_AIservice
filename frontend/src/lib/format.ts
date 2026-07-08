// 날짜/시간 포맷 (ko-KR). 고정 ISO 입력은 결정적이라 SSR 안전.

const d = (iso: string | Date) => (iso instanceof Date ? iso : new Date(iso));

export const fmtTime = (iso: string | Date) =>
  new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d(iso));

export const fmtDate = (iso: string | Date) =>
  new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(d(iso));

export const fmtDateShort = (iso: string | Date) =>
  new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit" }).format(d(iso));

export const isSameDay = (a: string | Date, b: string | Date) => {
  const x = d(a);
  const y = d(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
};

/** 마감 라벨: 오늘/내일/지남/날짜 (기준일 base 를 넘겨 결정적으로 계산) */
export function dueLabel(dueISO: string | undefined, base: Date): string {
  if (!dueISO) return "";
  const due = new Date(dueISO);
  const b = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const t = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((+t - +b) / 86400000);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === -1) return "어제";
  if (diff < 0) return `${-diff}일 지남`;
  return fmtDateShort(dueISO);
}
