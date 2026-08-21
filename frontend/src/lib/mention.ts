/**
 * Comein · @ 로 사람을 못 박는다.
 *
 * 왜 필요했나 —
 *   캡처 바의 한 줄에서 사람을 알아내는 일은 지금까지 **추측**이었다. AI 가 "수훈이랑
 *   3시에 보자" 에서 `participants: ["수훈"]` 을 뽑아 주면, 화면이 그 글자를 연락처와
 *   맞춰 봤다(`page.tsx` 의 흐린 일치). 그 맞춤은 양방향 `includes` 라서 넓다 —
 *   "박" 한 글자가 "박시현" 에 걸리고, 사람 이름과 같은 지명("수원에서 보자")이 사람으로
 *   읽힐 수 있다. 그리고 **틀렸다는 것을 아무도 모른다**: 일정은 조용히 서고, 엉뚱한
 *   사람이 그 자리의 참여자가 되어 방에 초대된다.
 *
 *   `@` 는 그 추측을 없앤다. 고르는 것은 사람이고, 고른 결과는 핸들이라는 **유일한
 *   이름**이다. 추측이 필요 없는 자리에서는 추측하지 않는다.
 *
 * 이 파일은 글자만 다룬다 — 누구를 부를지 고르는 화면도, 그 사람을 일정에 넣는 일도
 * 하지 않는다. 그래야 캡처 바와 대화창이 같은 규칙을 나눠 쓸 수 있다.
 */

import { fmtDate, fmtTime } from "./format";
import type { Contact } from "./types";

/** 핸들에 쓸 수 있는 글자. 서버의 규칙(`0004`)과 같은 범위로 좁게 잡는다. */
const HANDLE = "A-Za-z0-9_.";

/** 지금 커서 자리에서 `@` 를 치는 중인가. 맞으면 그 조각을 돌려준다. */
export type MentionTyping = {
  /** `@` 의 위치(문자열 인덱스) */
  at: number;
  /** `@` 뒤에 지금까지 친 글자 */
  query: string;
};

/**
 * 커서 앞을 훑어 `@…` 를 치는 중인지 본다.
 *
 * 빗금(`/`)과 달리 **맨 앞이 아니어도** 연다 — 사람은 문장 한가운데서 사람을 부른다
 * ("내일 3시에 @sihyun 이랑 회의"). 대신 여는 조건을 좁힌다: `@` 바로 앞이 글자면
 * 열지 않는다. 그래야 메일 주소(`a@b.com`)를 치는 동안 목록이 튀어나오지 않는다.
 */
export function mentionAt(text: string, caret: number): MentionTyping | null {
  const upto = text.slice(0, caret);
  const at = upto.lastIndexOf("@");
  if (at < 0) return null;

  // `@` 앞이 공백이거나 줄 맨 앞이어야 한다 — 메일 주소 한가운데서 열리지 않게.
  const before = at > 0 ? upto[at - 1] : " ";
  if (!/\s/.test(before)) return null;

  const query = upto.slice(at + 1);
  // 핸들에 못 쓰는 글자가 섞이면 그 `@` 는 더 이상 부르는 중이 아니다(이미 지나간 말이다).
  if (query.length && !new RegExp(`^[${HANDLE}]*$`).test(query)) return null;
  return { at, query };
}

/** 부를 만한 사람을 고른다. 핸들·이름·부르는 이름 어디로든 걸린다. */
export function matchPeople(people: Contact[], query: string, limit = 6): Contact[] {
  const q = query.trim().toLowerCase();
  // 핸들이 없는 사람은 부를 수 없다 — @ 로 못 박는다는 것이 곧 핸들로 못 박는다는 뜻이다.
  const callable = people.filter((p) => !!p.handle);
  if (!q) return callable.slice(0, limit);
  const hit = (v: unknown) => String(v ?? "").toLowerCase().includes(q);
  return callable
    .filter((p) => hit(p.handle) || hit(p.name) || hit(p.realName))
    // 핸들이 앞에서부터 맞는 사람을 먼저 — 사람은 보통 아는 핸들을 처음부터 친다.
    .sort((a, b) => {
      const A = String(a.handle).toLowerCase().startsWith(q) ? 0 : 1;
      const B = String(b.handle).toLowerCase().startsWith(q) ? 0 : 1;
      return A - B;
    })
    .slice(0, limit);
}

/** 치던 `@조각` 을 고른 사람의 핸들로 바꾼다. 뒤에 공백 하나를 붙여 다음 말로 이어지게 한다. */
export function applyMention(text: string, typing: MentionTyping, handle: string): { text: string; caret: number } {
  const head = text.slice(0, typing.at);
  const tail = text.slice(typing.at + 1 + typing.query.length);
  const inserted = `@${handle} `;
  return {
    text: head + inserted + tail.replace(/^ /, ""),   // 이미 있던 공백과 겹치지 않게
    caret: head.length + inserted.length,
  };
}

/**
 * 다 쓴 한 줄에서 `@핸들` 을 거둔다.
 *
 * 돌려주는 것 둘 —
 *   `ids`   못 박힌 사람들. **여기 있는 사람은 다시 추측하지 않는다.**
 *   `text`  AI 에게 보낼 말. 핸들을 그 사람의 이름으로 바꿔 둔다 — 모델은 "@sihyun"
 *           보다 "시현" 을 훨씬 잘 읽고, 우리는 이미 누구인지 알고 있으므로 모델의
 *           읽기에 기댈 이유가 없다.
 *
 * 모르는 핸들은 **건드리지 않고 그대로 둔다.** 지우면 사용자가 쓴 말이 조용히 바뀌고,
 * 아는 사람으로 바꿔치우면 그거야말로 지어내는 것이다.
 */
export function harvestMentions(text: string, people: Contact[]): { text: string; ids: string[]; unknown: string[] } {
  const ids: string[] = [];
  const unknown: string[] = [];
  const byHandle = new Map(people.filter((p) => p.handle).map((p) => [String(p.handle).toLowerCase(), p]));

  const out = text.replace(new RegExp(`(^|\\s)@([${HANDLE}]+)`, "g"), (whole, lead: string, handle: string) => {
    const hit = byHandle.get(handle.toLowerCase());
    if (!hit) { unknown.push(handle); return whole; }
    if (!ids.includes(hit.id)) ids.push(hit.id);
    return `${lead}${hit.realName ?? hit.name}`;
  });

  return { text: out, ids, unknown };
}

/**
 * 방에 내미는 첫 마디.
 *
 * 짧게 둔다 — 이건 대화의 시작이지 통보가 아니다. 그리고 **묻는 말로** 끝낸다:
 * 시각은 아직 정해진 것이 아니라 내민 것이고(일정은 pending 으로 앉는다), 상대가
 * 답해야 자리가 된다. 확정된 것처럼 적으면 화면과 말이 서로 다른 것을 말하게 된다.
 */
export function proposalLine(title: string, start: Date, end: Date | null, lang: "ko" | "en"): string {
  const when = end ? `${fmtTime(start)}–${fmtTime(end)}` : fmtTime(start);
  return lang === "en"
    ? `${title} — ${fmtDate(start)} ${when}. Does that work?`
    : `${title} — ${fmtDate(start)} ${when} 어떠세요?`;
}
