/**
 * Comein · 여기서부터 새로 — 지우지 않고 접는다.
 *
 * 왜 지우지 않는가 —
 *   대화는 나 혼자의 것이 아니다. 방을 비우면 상대의 기록까지 지워진다. 서버도 그렇게
 *   두었다: 남의 말은 지울 수 없고, 내 말조차 soft delete 다(`0008` — "대화의 앞뒤가
 *   통째로 사라지면 남은 사람들이 맥락을 잃는다").
 *
 *   그리고 `/clear` 가 원래 뜻하는 것도 '지우기' 가 아니다. 쓰던 도구들에서 그것은
 *   **새로 시작한다**는 뜻이고, 거기서는 상대가 없어서 둘이 같아 보였을 뿐이다.
 *   여기서는 갈라진다 — 그래서 이 파일은 접기만 한다.
 *
 * 그래서 표시는 **이 기기에만** 남는다(localStorage). 서버에 두면 그것대로 뜻이 생긴다:
 *   "이 사람이 여기서 대화를 접었다" 가 상대에게 새어 나갈 수 있는 값이 된다.
 *   접는 것은 읽는 방식이지 관계에 대한 사실이 아니다.
 */

const KEY = "comein:cleared";

/** 방 → 그 시각 이전은 접는다(ISO). */
export type ClearMarks = Record<string, string>;

export function loadMarks(): ClearMarks {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const v = JSON.parse(raw);
    // 남이 손댔거나 예전 모양이면 통째로 버린다 — 반쯤 맞는 상태로 읽는 것보다 낫다.
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: ClearMarks = {};
    for (const [k, at] of Object.entries(v)) {
      if (typeof at === "string" && Number.isFinite(+new Date(at))) out[k] = at;
    }
    return out;
  } catch {
    return {};                                  // 사생활 모드 — 접기는 그냥 안 될 뿐이다
  }
}

function save(marks: ClearMarks): ClearMarks {
  try { localStorage.setItem(KEY, JSON.stringify(marks)); } catch { /* 저장 못 해도 화면은 접힌다 */ }
  return marks;
}

export function markCleared(marks: ClearMarks, roomId: string, at: Date = new Date()): ClearMarks {
  return save({ ...marks, [roomId]: at.toISOString() });
}

/** 다시 펼친다 — 접은 것은 언제나 되돌릴 수 있다(아무것도 지우지 않았으므로). */
export function unmark(marks: ClearMarks, roomId: string): ClearMarks {
  const next = { ...marks };
  delete next[roomId];
  return save(next);
}

/**
 * 접힌 것과 보이는 것으로 가른다.
 *
 * 경계는 **그 시각 이후**만 남긴다(같은 밀리초는 접는다) — `/clear` 를 누른 그 순간까지가
 * '지금까지' 이고, 그 뒤에 오는 말이 '여기서부터' 다.
 */
export function splitByMark<T extends { createdAt: string }>(
  messages: T[],
  at: string | undefined,
): { hidden: T[]; shown: T[] } {
  if (!at) return { hidden: [], shown: messages };
  const t = +new Date(at);
  if (!Number.isFinite(t)) return { hidden: [], shown: messages };
  const hidden: T[] = [];
  const shown: T[] = [];
  for (const m of messages) (+new Date(m.createdAt) <= t ? hidden : shown).push(m);
  return { hidden, shown };
}
