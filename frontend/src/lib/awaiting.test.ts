// Comein · 답을 기다리는 것 시험
//
// 보고: "상대방이 일정을 만들고 생성했을 때 우리가 원하는 동의 화면이 안 뜬다."
// 물음이 그 일정을 열었을 때만 보였기 때문이다. 물음은 먼저 와야 물음이다.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pendingAnswers } from "./awaiting";
import { ME_ID, type EventParticipant, type Schedule, type ScheduleProposal } from "./types";

const PEER = "peer-1";
const fmt = () => "8월 20일 14:00";

const ev = (id: string, title: string): Schedule =>
  ({ id, title, start: "2026-08-20T05:00:00Z", status: "pending" }) as Schedule;

const part = (eventId: string, userId: string, status: EventParticipant["status"]): EventParticipant =>
  ({ eventId, userId, role: userId === PEER ? "owner" : "participant", status });

const proposal = (id: string, eventId: string, mine?: "accepted" | "declined"): ScheduleProposal =>
  ({
    id, eventId, createdBy: PEER, start: "2026-08-20T05:00:00Z", end: "2026-08-20T06:00:00Z",
    status: "proposed",
    responses: [
      { userId: PEER, response: "accepted" },
      ...(mine ? [{ userId: ME_ID, response: mine }] : []),
    ],
  }) as ScheduleProposal;

const run = (o: Partial<Parameters<typeof pendingAnswers>[0]>) =>
  pendingAnswers({ proposals: {}, eventParticipants: [], schedules: [], lang: "ko", fmt, ...o });

describe("답을 기다리는 것", () => {
  it("상대가 시간을 내밀면 일정을 열지 않아도 물음이 선다", () => {
    const rows = run({
      proposals: { e1: proposal("p1", "e1") },
      eventParticipants: [part("e1", PEER, "accepted"), part("e1", ME_ID, "accepted")],
      schedules: [ev("e1", "팀 회의")],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].kind, "proposal");
    assert.equal(rows[0].eventId, "e1");
    assert.match(rows[0].text, /팀 회의/);
    assert.match(rows[0].text, /8월 20일 14:00/);
  });

  it("이미 답했으면 다시 묻지 않는다", () => {
    for (const answer of ["accepted", "declined"] as const) {
      const rows = run({
        proposals: { e1: proposal("p1", "e1", answer) },
        eventParticipants: [part("e1", PEER, "accepted"), part("e1", ME_ID, "accepted")],
        schedules: [ev("e1", "팀 회의")],
      });
      assert.deepEqual(rows, [], `${answer} 뒤에는 물음이 사라진다`);
    }
  });

  it("내가 참여자가 아닌 일정의 물음은 내 화면에 서지 않는다", () => {
    const rows = run({
      proposals: { e1: proposal("p1", "e1") },
      eventParticipants: [part("e1", PEER, "accepted")],   // 나는 없다
      schedules: [ev("e1", "남의 회의")],
    });
    assert.deepEqual(rows, []);
  });

  it("아직 답하지 않은 초대도 함께 선다", () => {
    const rows = run({
      eventParticipants: [part("e1", PEER, "accepted"), part("e1", ME_ID, "invited")],
      schedules: [ev("e1", "점심")],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].kind, "invite");
    assert.match(rows[0].text, /점심/);
  });

  it("참석/불참을 답한 초대는 묻지 않는다", () => {
    for (const status of ["accepted", "declined"] as const) {
      const rows = run({
        eventParticipants: [part("e1", ME_ID, status)],
        schedules: [ev("e1", "점심")],
      });
      assert.deepEqual(rows, []);
    }
  });

  it("같은 일정을 두 번 묻지 않는다 — 제안이 이미 묻고 있으면 초대는 비켜선다", () => {
    const rows = run({
      proposals: { e1: proposal("p1", "e1") },
      eventParticipants: [part("e1", PEER, "accepted"), part("e1", ME_ID, "invited")],
      schedules: [ev("e1", "팀 회의")],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].kind, "proposal");
  });

  it("아직 실려 오지 않은 일정은 이름을 지어내지 않는다", () => {
    const rows = run({ eventParticipants: [part("ghost", ME_ID, "invited")], schedules: [] });
    assert.deepEqual(rows, []);
  });

  it("셋을 넘기지 않는다 — 목록이 되면 화면이 시끄러워진다", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const rows = run({
      eventParticipants: ids.map((id) => part(id, ME_ID, "invited")),
      schedules: ids.map((id) => ev(id, `일정 ${id}`)),
    });
    assert.equal(rows.length, 3);
  });

  it("영어로도 같은 것을 묻는다", () => {
    const rows = run({
      eventParticipants: [part("e1", ME_ID, "invited")],
      schedules: [ev("e1", "Standup")],
      lang: "en",
    });
    assert.match(rows[0].text, /You're invited to "Standup"/);
  });
});
