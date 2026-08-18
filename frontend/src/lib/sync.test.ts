// Comein · 실시간 고리 시험
//
// 두 계정으로 써 봤을 때 나온 보고 — "상대가 채팅을 보내면 새로고침해야 뜬다" 를
// 브라우저 없이 재현하고, 고쳐졌음을 못 박는다.
//
//   npm test
//
// 가짜 Supabase 는 realtime-js 2.112 의 실제 동작을 옮겨 놨다(fakeSupabase.ts 주석 참고).
// 그게 이 시험의 전부다 — 흉내가 헐거우면 통과는 아무것도 증명하지 못한다.

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { makeFakeSupabase, type FakeChannel } from "./fakeSupabase";

// 연결 정보를 먼저 세운다 — supabase.ts 는 모듈이 읽힐 때 이 값으로 configured 를 정한다.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

const UID = "11111111-1111-1111-1111-111111111111";
const PEER = "22222222-2222-2222-2222-222222222222";

const fake = makeFakeSupabase({
  uid: UID,
  tables: {
    events: [{ id: "e1", owner_id: PEER, title: "팀 회의", start_at: "2026-08-20T05:00:00Z", end_at: null, status: "pending" }],
    event_participants: [
      { event_id: "e1", user_id: PEER, role: "owner", status: "accepted" },
      { event_id: "e1", user_id: UID, role: "participant", status: "invited" },
    ],
    chat_rooms: [{ id: "r1", event_id: "e1", dm_key: null }],
    chat_messages: [],
    schedule_proposals: [],
  },
  rpc: { my_people: () => [] },
});

// getSupabase() 는 globalThis 에 매달린 것을 그대로 돌려준다 — 진짜 클라이언트가 만들어지지 않게
// 먼저 자리를 채워 둔다. 신원도 같이 — subscribeRemote 를 직접 부르는 시험은
// refreshSession 을 거치지 않으므로 여기서 세워 두지 않으면 조용히 null 을 돌려준다.
(globalThis as any).__comein_supabase__ = fake.client;
(globalThis as any).__comein_uid__ = UID;

// 모듈은 위 준비가 끝난 뒤에 읽어야 한다.
const { startRemoteSync } = await import("@/lib/sync");
const { subscribeRemote } = await import("@/lib/remote");
const { useWorkspace } = await import("@/lib/store");

const tick = (n = 6) => new Promise<void>((r) => { let i = n; const step = () => (i-- > 0 ? queueMicrotask(step) : r()); step(); });
const settle = async (ms = 30) => { await new Promise((r) => setTimeout(r, ms)); await tick(); };

// ─────────────────────────────────────────────────────────
// 1. 진단이 맞았는가 — 옛 방식은 정말로 조용히 죽는가
// ─────────────────────────────────────────────────────────

describe("진단 · 같은 이름의 채널을 두 번 열면", () => {
  it("두 번째는 '구독했다'고 믿지만 실제로는 떠나는 채널을 쥔다", async () => {
    // 옛 subscribeRemote 를 그대로 재현한다: 이름이 고정이고, 상태 콜백이 없다.
    const legacy = (sb: any, onMessage: (row: any) => void) => {
      const ch = sb.channel("comein-workspace")
        .on("postgres_changes", { event: "INSERT", table: "chat_messages" }, (p: any) => onMessage(p.new))
        .subscribe();
      return () => { void sb.removeChannel(ch); };
    };

    const got: any[] = [];
    // 준비가 두 번 겹쳐 든다 — onAuthStateChange 의 INITIAL_SESSION 이 만들던 그 상황.
    let stop: (() => void) | null = null;
    stop = legacy(fake.client, (m) => got.push(m));
    await tick();
    stop?.();                                  // 두 번째 준비가 앞의 것을 정리하고
    stop = legacy(fake.client, (m) => got.push(m));  // 같은 이름으로 다시 연다
    await settle();

    assert.equal(fake.live().length, 0, "살아 있는 채널이 없다 — 실시간이 죽었다");
    fake.push("chat_messages", "INSERT", { id: "m0", room_id: "r1", sender_id: PEER, content: "안녕", created_at: "2026-08-18T01:00:00Z" });
    assert.deepEqual(got, [], "상대의 말이 도착하지 않는다 — 새로고침해야 보이던 그 상태");
    stop?.();
  });
});

// ─────────────────────────────────────────────────────────
// 2. 고친 뒤 — 같은 상황에서 살아남는가
// ─────────────────────────────────────────────────────────

describe("subscribeRemote", () => {
  it("겹쳐 걸어도 채널 이름이 달라 서로를 덮지 않는다", async () => {
    const got: string[] = [];
    const noop = () => {};
    let stop: (() => void) | null = subscribeRemote({ onMessage: (m) => got.push(m.content), onEventChange: noop });
    await tick();
    stop?.();
    stop = subscribeRemote({ onMessage: (m) => got.push(m.content), onEventChange: noop });
    await settle();

    assert.ok(fake.liveWith("core"), "대화 채널이 살아 있다");
    fake.push("chat_messages", "INSERT", { id: "m1", room_id: "r1", sender_id: PEER, content: "들리나요", created_at: "2026-08-18T01:00:00Z" });
    assert.deepEqual(got, ["들리나요"]);
    stop?.();
    await settle();
  });

  it("끊기면 스스로 다시 붙고, 붙으면 놓친 것을 맞춘다", async () => {
    const status: boolean[] = [];
    let resynced = 0;
    const stop = subscribeRemote({
      onMessage: noopMsg,
      onEventChange: () => { resynced++; },
      onStatus: (live) => status.push(live),
    });
    assert.ok(stop, "신원이 있으면 고리가 걸린다");
    await settle();
    assert.deepEqual(status, [true], "붙었다");
    assert.equal(resynced, 1, "붙자마자 한 번 맞춘다");

    (fake.liveWith("core") as FakeChannel).fail("socket dropped");
    await settle(0);
    assert.deepEqual(status, [true, false], "끊긴 것을 화면에 알린다");

    await settle(1400);   // 첫 재시도는 1초 뒤
    assert.equal(status.at(-1), true, "스스로 다시 붙었다");
    assert.ok(resynced >= 2, "다시 붙으면서 놓친 것을 맞춘다");

    stop();
    await settle();
  });

  it("제안은 별도 채널이라 대화를 끌고 내려가지 않는다", async () => {
    const stop = subscribeRemote({ onMessage: noopMsg, onEventChange: () => {} });
    assert.ok(stop, "신원이 있으면 고리가 걸린다");
    await settle();
    const props = fake.liveWith("proposals");
    assert.ok(props, "제안 채널이 따로 선다");
    assert.ok(fake.liveWith("core"), "대화 채널도 따로 선다");

    (props as FakeChannel).fail("relation does not exist");  // 0003 을 안 올린 프로젝트
    await settle(0);
    assert.ok(fake.liveWith("core"), "제안이 죽어도 대화는 살아 있다");
    stop();
    await settle();
  });
});

function noopMsg() {}

// ─────────────────────────────────────────────────────────
// 3. 고리 전체 — 겹쳐 든 준비, 토큰 갱신, 들어온 말
// ─────────────────────────────────────────────────────────

describe("startRemoteSync", () => {
  before(() => { fake.setSessionDelay(5); });

  it("INITIAL_SESSION 이 겹쳐 들어도 소켓은 하나만 남는다", async () => {
    const seen: any[] = [];
    const handle = startRemoteSync({ onState: (p) => seen.push(p) });
    await settle(60);

    assert.equal(handle.boundUid(), UID, "내 신원으로 붙었다");
    assert.equal(fake.live().filter((c) => c.topic.includes("core")).length, 1, "대화 채널은 하나뿐");
    assert.ok(seen.some((p) => p.ready === true && p.signedIn === true), "로그인 상태를 알렸다");
    assert.ok(seen.some((p) => p.live === true), "실시간이 붙었다고 알렸다");

    handle.stop();
    await settle();
  });

  it("상대의 말이 새로고침 없이 스토어에 얹힌다", async () => {
    const incoming: string[] = [];
    const handle = startRemoteSync({ onState: () => {}, onIncoming: () => (m) => incoming.push(m.content) });
    await settle(60);

    fake.push("chat_messages", "INSERT", {
      id: "m2", room_id: "r1", sender_id: PEER, content: "지금 봐요", created_at: "2026-08-18T02:00:00Z",
    });
    await tick();

    assert.deepEqual(incoming, ["지금 봐요"]);
    assert.ok(useWorkspace.getState().chatMessages.some((m) => m.id === "m2"), "스토어에도 앉았다");
    handle.stop();
    await settle();
  });

  it("모르는 방에서 온 말이면 방 목록부터 다시 받는다 (첫 1:1 대화)", async () => {
    const handle = startRemoteSync({ onState: () => {} });
    await settle(60);
    assert.ok(!useWorkspace.getState().chatRooms.some((r) => r.id === "r2"), "아직 모르는 방");

    // 상대가 방을 만들고 말을 걸었다 — 서버에는 둘 다 있지만 내 화면은 방을 모른다.
    const first = { id: "m3", room_id: "r2", sender_id: PEER, content: "처음 인사", created_at: "2026-08-18T03:00:00Z" };
    fake.tables.chat_rooms.push({ id: "r2", event_id: null, dm_key: `${PEER}:${UID}` });
    fake.tables.chat_messages.push(first);
    fake.push("chat_messages", "INSERT", first);
    await settle(40);

    assert.ok(useWorkspace.getState().chatRooms.some((r) => r.id === "r2"), "방 목록을 다시 받아 왔다");
    assert.ok(useWorkspace.getState().chatMessages.some((m) => m.id === "m3"), "그 말이 앉을 자리가 생겼다");
    handle.stop();
    await settle();
  });

  it("토큰이 갱신돼도 소켓을 다시 열지 않는다", async () => {
    const handle = startRemoteSync({ onState: () => {} });
    await settle(60);
    const before = fake.liveWith("core");

    fake.fireAuth("TOKEN_REFRESHED");
    await settle(60);

    assert.equal(fake.liveWith("core"), before, "같은 채널 그대로 — 대화가 끊기지 않는다");
    assert.equal(fake.live().filter((c) => c.topic.includes("core")).length, 1);
    handle.stop();
    await settle();
  });

  it("로그아웃하면 고리를 끊는다", async () => {
    const handle = startRemoteSync({ onState: () => {} });
    await settle(60);
    assert.ok(fake.liveWith("core"));

    fake.fireAuth("SIGNED_OUT");
    await settle(20);

    assert.equal(handle.boundUid(), null);
    assert.equal(fake.liveWith("core"), undefined, "남의 계정 화면에 내 말이 흘러들지 않게");
    handle.stop();
    await settle();
  });
});

// ─────────────────────────────────────────────────────────
// 4. 조용한 실패 — 눌렀는데 아무 일도 일어나지 않는 것이 가장 나쁜 답이다
// ─────────────────────────────────────────────────────────

describe("연결 요청에 답하기", () => {
  const req = { id: "req-1", userId: PEER, name: "동료", handle: "peer", createdAt: "2026-08-18T00:00:00Z" };

  it("서버가 받으면 그 줄은 걷힌 채로 둔다", async () => {
    fake.rpc.answer_connection_request = () => "accepted";
    useWorkspace.setState({ connectionRequests: [req as any], requestError: null });
    await useWorkspace.getState().answerRequest("req-1", true);

    assert.deepEqual(useWorkspace.getState().connectionRequests, []);
    assert.equal(useWorkspace.getState().requestError, null);
  });

  it("서버가 받지 않으면 줄을 되돌리고 이유를 남긴다", async () => {
    // 예전에는 걷어낸 채로 끝이었다 — 이어지지도 않았는데 요청만 사라졌고,
    // 화면은 아무 말도 하지 않았다.
    fake.rpc.answer_connection_request = () => "gone";
    useWorkspace.setState({ connectionRequests: [req as any], requestError: null });
    await useWorkspace.getState().answerRequest("req-1", true);

    assert.equal(useWorkspace.getState().connectionRequests.length, 1, "요청이 그 자리에 돌아온다");
    assert.equal(useWorkspace.getState().connectionRequests[0].id, "req-1");
    assert.ok(useWorkspace.getState().requestError, "왜 막혔는지 말한다");
  });

  it("되돌리다 같은 줄을 두 벌 만들지 않는다", async () => {
    fake.rpc.answer_connection_request = () => "gone";
    useWorkspace.setState({ connectionRequests: [req as any] });
    await Promise.all([
      useWorkspace.getState().answerRequest("req-1", true),
      useWorkspace.getState().answerRequest("req-1", true),
    ]);
    assert.equal(useWorkspace.getState().connectionRequests.filter((r) => r.id === "req-1").length, 1);
  });
});
