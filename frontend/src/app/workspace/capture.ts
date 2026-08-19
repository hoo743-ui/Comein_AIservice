/**
 * Comein · 서버가 읽어 온 것을 화면이 쓸 수 있게 다듬는 자리.
 *
 * AI 는 프롬프트가 부탁한 모양으로 대개 답하지만 **보장하지는 않는다.** 그래서 화면에
 * 닿기 전에 한 겹 더 검사한다 — 없는 값은 지어내지 않고, 이상한 값은 조용히 버린다.
 * (백엔드도 같은 일을 한 번 한다. 두 번 하는 것이 낭비가 아닌 유일한 자리다.)
 */

import { analyzeMessage } from "@/lib/conversation";
import type { TodoPriority } from "@/lib/types";
import type { Kind, Parsed } from "./nav";

/** 두 자리로 — 시각을 문자로 옮길 때만 쓴다. */
const pad = (n: number | string) => String(n).padStart(2, "0");

/** 백엔드(`/api/chat`)의 item 하나 → 화면이 쓰는 Parsed.
 *  모르는 필드는 버리고, 없으면 입력 원문으로 메꾼다 — AI가 흔들려도 화면은 안 흔들린다. */
export function toParsed(raw: unknown, fallbackTitle: string): Parsed {
  const it = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  // 백엔드는 세 갈래(schedule/meeting/todo)로 준다 → 화면의 두 갈래로 접는다.
  // 시간 위의 일(일정·회의)은 캘린더로, 시간 밖의 일(할 일)은 갈 곳이 없다(DEST 참고).
  const kind: Kind =
    it.category === "schedule" || it.category === "meeting" ? "일정" : "할 일";

  let time: string | null = null;
  let date: Date | undefined;
  const when = str(it.start) ?? str(it.due);
  if (when) {
    const d = new Date(when);
    if (!Number.isNaN(d.getTime())) {
      date = d;
      time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }

  // 끝 시각 — 사용자가 말했을 때만 온다.
  //
  // 예전에는 이 칸을 아예 읽지 않았다. 그래서 "2시부터 5시까지 회의" 가 캘린더에
  // 2~3시로 앉았다(화면이 무조건 한 시간을 붙였다). AI 는 옳게 뽑아 보냈는데 그 값이
  // 여기서 조용히 버려진 것이라, 화면에서는 AI 가 못 읽은 것처럼 보였다.
  // 시작보다 앞서거나 같은 값은 버린다 — 자정을 넘긴 표기가 뒤집혀 오는 일이 있다.
  let end: Date | undefined;
  const till = str(it.end);
  if (till && date) {
    const e = new Date(till);
    if (!Number.isNaN(e.getTime()) && +e > +date) end = e;
  }

  // 회의는 백엔드가 title 없이 notes·summary 만 주는 경우가 있다 → 본문 첫 줄을 제목으로 세운다.
  const body = str(it.content) ?? str(it.notes) ?? str(it.summary);
  const title = str(it.title) ?? (body ? body.split("\n")[0].slice(0, 40) : null) ?? fallbackTitle;
  const priority = it.priority === "high" || it.priority === "low" || it.priority === "mid"
    ? (it.priority as TodoPriority)
    : undefined;

  // 회의에 부른 사람들 — AI 가 "이하늘이랑 회의" 에서 이름을 뽑아 준다.
  const participants = Array.isArray(it.participants)
    ? (it.participants as unknown[]).map((p) => str(p)).filter((p): p is string => !!p)
    : [];

  return {
    title,
    kind,
    time,
    date,
    end,
    participants,
    // 일정은 장소가, 할 일은 본문이 부가 정보다.
    note: (kind === "일정" ? str(it.location) : null) ?? body ?? str(it.location) ?? "",
    priority,
  };
}

// 백엔드가 잠들었을 때만 쓰는 로컬 폴백. 시각·약속의 낌새가 있으면 일정, 아니면 전부 할 일.
export function classify(text: string): Kind {
  // 다만 낱말만 보고 접지 않는다. "나 그때 다른 일정 있어서" 는 '일정' 이라는 글자 때문에
  // 일정으로 접혔지만, 실은 **거절**이다 — 시간을 잡자는 말이 아니라 못 잡겠다는 말이다.
  // 그 판단은 lib/conversation 이 이미 하고 있으므로 여기서 규칙을 또 짓지 않고 물어본다.
  const read = analyzeMessage(text, new Date()).intent;
  if (read === "rejection" || read === "cancellation") return "할 일";
  if (/회의|미팅|\d\s*시|\d:\d|내일|오늘|모레|다음\s*주|요일|약속|일정/.test(text)) return "일정";
  return "할 일";
}

export function parseTime(text: string): string | null {
  const hm = text.match(/(\d{1,2}):(\d{2})/);
  if (hm) return `${pad(hm[1])}:${hm[2]}`;
  const k = text.match(/(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
  if (k) {
    let hr = +k[2];
    if (k[1] === "오후" && hr < 12) hr += 12;
    if (k[1] === "오전" && hr === 12) hr = 0;
    return `${pad(hr)}:${pad(k[3] ?? 0)}`;
  }
  return null;
}
