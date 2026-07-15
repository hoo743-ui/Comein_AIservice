// 날짜/시간 포맷 (ko-KR). 고정 ISO 입력은 결정적이라 SSR 안전.

const d = (iso: string | Date) => (iso instanceof Date ? iso : new Date(iso));

export const fmtTime = (iso: string | Date) =>
  new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d(iso));

export const fmtDate = (iso: string | Date) =>
  new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(d(iso));
