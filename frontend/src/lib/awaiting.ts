/**
 * Comein · 답을 기다리는 것 — 상대가 부르거나 시간을 내밀었는데 내가 아직 답하지 않은 자리.
 *
 * 예전에는 이것이 그 일정을 **열었을 때만** 보였다. 그래서 상대가 일정을 만들고 시간을
 * 제안해도, 받은 쪽 화면에는 아무 일도 일어나지 않았다 — 물음이 서랍 안에서만 기다린 셈이다.
 * 물음은 먼저 와야 물음이다.
 *
 * 판단은 화면이 아니라 여기서 한다(§39). 화면은 이 목록을 한 줄씩 눕히기만 한다.
 */

import { ME_ID, type EventParticipant, type ID, type Schedule, type ScheduleProposal } from "@/lib/types";

export type AwaitingKind = "proposal" | "invite";

export type Awaiting = {
  /** 목록 키 — 같은 일정이라도 제안과 초대는 다른 물음이다. */
  key: string;
  eventId: ID;
  kind: AwaitingKind;
  /** 화면에 그대로 나가는 한 줄. */
  text: string;
};

/** 셋을 넘기면 목록이 되고, 목록이 되면 화면이 시끄러워진다. */
export const AWAITING_MAX = 3;

export function pendingAnswers(input: {
  proposals: Record<ID, ScheduleProposal | null>;
  eventParticipants: EventParticipant[];
  schedules: Schedule[];
  lang: "ko" | "en";
  /** 시각을 사람의 말로. 화면이 쓰는 것과 같은 것을 넘긴다. */
  fmt: (d: Date) => string;
}): Awaiting[] {
  const { proposals, eventParticipants, schedules, lang, fmt } = input;
  const en = lang === "en";
  const rows: Awaiting[] = [];

  // 1) 시간이 제안된 자리 — 내가 아직 답하지 않은 것.
  for (const [eventId, p] of Object.entries(proposals)) {
    if (!p) continue;
    const mine = p.responses.find((r) => r.userId === ME_ID)?.response ?? "pending";
    if (mine !== "pending") continue;
    // 내가 참여자인 일정만 — 남의 방 물음이 내 화면에 설 이유가 없다.
    if (!eventParticipants.some((x) => x.eventId === eventId && x.userId === ME_ID)) continue;

    const ev = schedules.find((x) => x.id === eventId);
    const title = ev?.title ?? p.title ?? (en ? "a time" : "일정");
    const when = fmt(new Date(p.start));
    rows.push({
      key: `prop-${p.id}`, eventId, kind: "proposal",
      text: en ? `"${title}" — ${when} proposed. Does that work?` : `"${title}" — ${when} 로 제안됐어요. 괜찮으세요?`,
    });
  }

  // 2) 아직 답하지 않은 초대.
  for (const q of eventParticipants) {
    if (q.userId !== ME_ID || q.status !== "invited") continue;
    if (rows.some((r) => r.eventId === q.eventId)) continue; // 제안이 이미 같은 것을 묻고 있다
    const ev = schedules.find((x) => x.id === q.eventId);
    if (!ev) continue;  // 아직 실려 오지 않은 일정은 이름을 지어내지 않는다
    rows.push({
      key: `inv-${q.eventId}`, eventId: q.eventId, kind: "invite",
      text: en ? `You're invited to "${ev.title}". Joining?` : `"${ev.title}"에 초대됐어요. 참석하시겠어요?`,
    });
  }

  return rows.slice(0, AWAITING_MAX);
}
