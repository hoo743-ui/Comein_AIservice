// Comein · 서버가 받지 않았을 때 화면이 어떻게 되는가
//
// 이 앱의 쓰기는 전부 낙관적이다 — 먼저 그리고 뒤에 보낸다. 빠른 대신 값이 하나 붙는다:
// **서버가 거절하면 화면이 거짓말을 하게 된다.**
//
// 특히 RLS 는 오류를 주지 않는다. 정책이 행을 안 보이게 하므로 "조건에 맞는 행이 없다"와
// 같아지고, PostgREST 는 200 + 빈 응답으로 답한다. 그래서 남의 일정 이름을 고치면
// 내 화면에서만 바뀌었다가 다음 스냅샷에 슬며시 되돌아갔다 — 사용자는 자기가 무엇을
// 잘못했는지 끝내 알 수 없었다.
//
// 여기서 재는 것은 하나다: **거절당하면 되돌리고, 왜 되돌렸는지 말하는가.**

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

// 연결 정보를 먼저 세운다 — supabase.ts 는 모듈이 읽힐 때 이 값으로 configured 를 정한다.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

const UID = "11111111-1111-1111-1111-111111111111";
const PEER = "22222222-2222-2222-2222-222222222222";

/** 서버가 무엇으로 답할지는 시험이 정한다. */
let refuse = true;

/** PostgREST 흉내 — 거절은 오류가 아니라 **빈 배열**로 온다(그게 이 시험의 요점이다). */
const fakeRest = async () => ({
  ok: true,
  text: async () => (refuse ? "[]" : JSON.stringify([{ id: "e1" }])),
});

/** supabase-js 흉내 — 쓰기 셋(upsert·update·delete)만 있으면 된다. */
const table = () => {
  const b: any = {
    upsert: async () => (refuse ? { error: { message: "denied" } } : { error: null }),
    update: () => b,
    delete: () => b,
    eq: () => b,
    select: async () => (refuse ? { data: [], error: null } : { data: [{ user_id: PEER }], error: null }),
    then: (res: any) => Promise.resolve(refuse ? { error: { message: "denied" } } : { error: null }).then(res),
  };
  return b;
};

(globalThis as any).__comein_supabase__ = {
  auth: { getSession: async () => ({ data: { session: { user: { id: UID }, access_token: "t" } } }) },
  from: () => table(),
};
(globalThis as any).__comein_uid__ = UID;
(globalThis as any).fetch = fakeRest;

const { useWorkspace } = await import("@/lib/store");

/** 되돌림은 `.then()` 안에서 일어난다 — 마이크로태스크 몇 번을 흘려보낸다. */
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

const EV = {
  id: "e1", title: "팀 회의", start: "2026-08-20T14:00:00", status: "pending" as const, ownerId: PEER,
};

describe("서버가 거절하면 화면을 되돌린다", () => {
  beforeEach(() => {
    refuse = true;
    useWorkspace.setState({
      schedules: [{ ...EV }],
      eventParticipants: [
        { eventId: "e1", userId: PEER, role: "owner", status: "accepted" },
        { eventId: "e1", userId: "me", role: "participant", status: "invited" },
      ],
      chatRooms: [{ id: "room_e1", eventId: "e1" }],
      chatMessages: [{ id: "m1", roomId: "room_e1", senderId: "me", content: "안녕", createdAt: "2026-08-19T01:00:00Z" }],
      writeError: null,
      idAlias: {},
    });
  });

  it("이름 — 주최자가 아니면 되돌리고 그 이유를 말한다", async () => {
    useWorkspace.getState().renameSchedule("e1", "새 이름");
    assert.equal(useWorkspace.getState().schedules[0].title, "새 이름", "먼저 화면에 반영된다");
    await settle();
    assert.equal(useWorkspace.getState().schedules[0].title, "팀 회의", "거절당하면 옛 이름으로 돌아온다");
    assert.match(useWorkspace.getState().writeError ?? "", /주최자/);
  });

  it("이름 — 서버가 받으면 그대로 둔다", async () => {
    refuse = false;
    useWorkspace.getState().renameSchedule("e1", "새 이름");
    await settle();
    assert.equal(useWorkspace.getState().schedules[0].title, "새 이름");
    assert.equal(useWorkspace.getState().writeError, null);
  });

  it("확정 — 못 앉히면 제안으로 되돌린다", async () => {
    useWorkspace.getState().confirmSchedule("e1");
    assert.equal(useWorkspace.getState().schedules[0].status, "confirmed");
    await settle();
    assert.equal(useWorkspace.getState().schedules[0].status, "pending", "확정된 척 서 있는 일정이 가장 나쁘다");
    assert.ok(useWorkspace.getState().writeError);
  });

  it("삭제 — 못 지우면 매달려 있던 것까지 함께 되살린다", async () => {
    useWorkspace.getState().removeSchedule("e1");
    assert.equal(useWorkspace.getState().schedules.length, 0);
    await settle();
    const st = useWorkspace.getState();
    assert.equal(st.schedules.length, 1, "일정이 돌아온다");
    assert.equal(st.eventParticipants.length, 2, "참여자도 함께");
    assert.equal(st.chatRooms.length, 1, "방도 함께");
    assert.equal(st.chatMessages.length, 1, "그 안의 말도 함께 — 일정만 되살리면 대화를 잃는다");
    assert.ok(st.writeError);
  });

  it("참석 여부 — 못 보내면 되돌린다 (한쪽만 아는 참석이 되지 않게)", async () => {
    useWorkspace.getState().setParticipantStatus("e1", "me", "accepted");
    assert.equal(useWorkspace.getState().eventParticipants[1].status, "accepted");
    await settle();
    assert.equal(useWorkspace.getState().eventParticipants[1].status, "invited");
    assert.ok(useWorkspace.getState().writeError);
  });

  it("초대 — 부르지 못하면 그 줄을 걷는다", async () => {
    useWorkspace.getState().addParticipant("e1", "33333333-3333-3333-3333-333333333333");
    assert.equal(useWorkspace.getState().eventParticipants.length, 3);
    await settle();
    assert.equal(useWorkspace.getState().eventParticipants.length, 2, "한쪽만 아는 초대를 남기지 않는다");
    assert.ok(useWorkspace.getState().writeError);
  });

  it("같은 값으로 다시 누르면 아무 일도 하지 않는다", async () => {
    useWorkspace.setState({ schedules: [{ ...EV, status: "confirmed" }], writeError: null });
    useWorkspace.getState().confirmSchedule("e1");
    await settle();
    assert.equal(useWorkspace.getState().writeError, null, "이미 확정된 것을 또 확정하지 않는다");
  });
});
