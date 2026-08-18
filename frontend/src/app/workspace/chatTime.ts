/**
 * Comein · 대화의 시간을 사람의 말로.
 *
 * 목록에서 필요한 건 정확한 시각이 아니라 '얼마나 최근인가' 다(chatStamp).
 * 타래 안에서 필요한 건 '하루가 바뀌었는가' 와 '이 뭉치가 언제 시작했는가' 다.
 * 말풍선을 그리지 않는 대신 이름과 시각을 언제 다시 적을지가 읽는 흐름을 만든다.
 */

import { dayKey } from "./datetime";
import { fmtDate, fmtTime } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";
import type { Lang } from "./i18n";

/** 대화 목록의 시각 — 오늘이면 시:분, 어제면 '어제', 그 앞은 요일·날짜.
 *  목록에서 필요한 건 정확한 시각이 아니라 '얼마나 최근인가' 다. */
export function chatStamp(d: Date, en: boolean): string {
  const now = new Date();
  const days = Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86_400_000,
  );
  if (days === 0) return fmtTime(d);
  if (days === 1) return en ? "Yesterday" : "어제";
  if (days < 7) return d.toLocaleDateString(en ? "en-US" : "ko-KR", { weekday: "short" });
  if (d.getFullYear() !== now.getFullYear()) return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 말을 덩어리로 묶는다 — 한 사람이 잇달아 한 말은 한 뭉치다.
 *
 *  말풍선을 그리지 않는 대신, 이름과 시각을 언제 '다시' 적을지가 읽는 흐름을 만든다.
 *  같은 사람이 5분 안에 이어 말하면 이름도 시각도 다시 적지 않는다 — 종이에 적힌 대화처럼.
 *  (모든 줄에 이름과 시각을 붙이면 그 순간 메신저가 된다.) */
export const GROUP_GAP_MS = 5 * 60 * 1000;

export type MsgGroup = { key: string; senderId: string; at: Date; items: ChatMessage[] };

export function groupMessages(messages: ChatMessage[]): MsgGroup[] {
  const out: MsgGroup[] = [];
  for (const m of messages) {
    const last = out[out.length - 1];
    const at = new Date(m.createdAt);
    if (last && last.senderId === m.senderId && +at - +new Date(last.items[last.items.length - 1].createdAt) < GROUP_GAP_MS) {
      last.items.push(m);
      continue;
    }
    out.push({ key: m.id, senderId: m.senderId, at, items: [m] });
  }
  return out;
}

/** 날짜가 바뀌는 자리에만 조용한 한 줄 — 스크롤을 거슬러 올라갈 때 길을 잃지 않게. */
export function dayDivider(prev: Date | null, cur: Date, lang: Lang): string | null {
  if (prev && dayKey(prev) === dayKey(cur)) return null;
  const now = new Date();
  if (dayKey(now) === dayKey(cur)) return lang === "en" ? "Today" : "오늘";
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (dayKey(y) === dayKey(cur)) return lang === "en" ? "Yesterday" : "어제";
  // 해가 다르면 연도까지 — "8월 20일" 만으로는 그게 올해인지 작년인지 알 수 없다.
  if (cur.getFullYear() !== now.getFullYear()) {
    return lang === "en" ? `${fmtDate(cur)}, ${cur.getFullYear()}` : `${cur.getFullYear()}년 ${fmtDate(cur)}`;
  }
  return fmtDate(cur);
}
