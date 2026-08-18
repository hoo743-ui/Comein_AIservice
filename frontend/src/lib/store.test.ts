// Comein · 스토어가 스냅샷을 받을 때 무엇을 지키는가
//
// 실시간을 고치면서 스냅샷을 훨씬 자주 받게 됐다(붙을 때 · 화면이 돌아올 때 · 일정이 바뀔 때).
// 그래서 "스냅샷이 오면 무엇이 사라지는가" 가 갑자기 중요해졌다.

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { settleSent, useWorkspace } from "./store";
import { ME_ID, type ChatMessage } from "./types";

const msg = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "m1", roomId: "r1", senderId: ME_ID, content: "안녕", createdAt: "2026-08-18T01:00:00Z", ...over,
});

const emptySnap = { schedules: [], eventParticipants: [], chatRooms: [], chatMessages: [], contacts: [] };

describe("hydrateRemote", () => {
  beforeEach(() => {
    useWorkspace.setState({ remoteLive: false, todos: [], chatMessages: [] });
  });

  it("처음 한 번은 시드 할 일을 물린다 — 지어낸 데이터가 진짜인 줄 알게 하지 않는다", () => {
    useWorkspace.setState({ remoteLive: false, todos: [{ id: "seed", title: "데모", status: "todo" } as any] });
    useWorkspace.getState().hydrateRemote(emptySnap);
    assert.deepEqual(useWorkspace.getState().todos, []);
  });

  it("그 다음부터는 사용자가 적어 둔 할 일을 건드리지 않는다", () => {
    useWorkspace.getState().hydrateRemote(emptySnap);          // 첫 하이드레이션
    useWorkspace.getState().addTodo({ title: "논문 초고", status: "todo" } as any);
    useWorkspace.getState().hydrateRemote(emptySnap);          // 일정 하나 바뀌어 다시 받음
    assert.equal(useWorkspace.getState().todos.length, 1, "일정이 바뀌었다고 할 일이 사라지면 안 된다");
    assert.equal(useWorkspace.getState().todos[0].title, "논문 초고");
  });

  it("보내는 중인 내 말은 남긴다 — 방금 친 문장이 눈앞에서 사라지지 않게", () => {
    useWorkspace.setState({ chatMessages: [msg({ id: "temp", pending: true })] });
    useWorkspace.getState().hydrateRemote(emptySnap);
    assert.equal(useWorkspace.getState().chatMessages.length, 1);
    assert.equal(useWorkspace.getState().chatMessages[0].id, "temp");
  });

  it("서버가 이미 실어 온 말은 두 번 남기지 않는다", () => {
    useWorkspace.setState({ chatMessages: [msg({ id: "m9", pending: true })] });
    useWorkspace.getState().hydrateRemote({ ...emptySnap, chatMessages: [msg({ id: "m9" })] });
    assert.equal(useWorkspace.getState().chatMessages.length, 1);
    assert.equal(useWorkspace.getState().chatMessages[0].pending, undefined);
  });

  it("이미 저장된 남의 말은 스냅샷이 정한다", () => {
    useWorkspace.setState({ chatMessages: [msg({ id: "stale" })] });   // pending 아님
    useWorkspace.getState().hydrateRemote(emptySnap);
    assert.deepEqual(useWorkspace.getState().chatMessages, []);
  });
});

describe("settleSent · 낙관적으로 얹은 말이 서버 id 를 받을 때", () => {
  it("서버 id 로 갈아 단다", () => {
    const out = settleSent([msg({ id: "temp", pending: true })], "temp", "real", "r9");
    assert.equal(out.length, 1);
    assert.equal(out[0].id, "real");
    assert.equal(out[0].roomId, "r9");
    assert.equal(out[0].pending, false);
  });

  it("그 사이 같은 말이 이미 도착해 있으면 임시 줄을 걷는다", () => {
    // 안 그러면 같은 id 가 둘이 되고, 그때부터 지워도 하나만 지워진다.
    const out = settleSent([msg({ id: "real" }), msg({ id: "temp", pending: true })], "temp", "real", "r1");
    assert.equal(out.length, 1);
    assert.equal(out[0].id, "real");
  });

  it("저장에 실패했으면 임시 줄만 걷는다 — 보내지지 않은 말이 보내진 척 남지 않게", () => {
    const out = settleSent([msg({ id: "temp", pending: true })], "temp", null, "r1");
    assert.deepEqual(out, []);
  });
});

describe("applyRemoteMessage", () => {
  beforeEach(() => { useWorkspace.setState({ chatMessages: [] }); });

  it("새 말은 얹는다", () => {
    useWorkspace.getState().applyRemoteMessage(msg({ id: "a" }));
    assert.equal(useWorkspace.getState().chatMessages.length, 1);
  });

  it("같은 말이 다시 오면 그 자리를 갈아 끼운다 — 두 번 쌓지 않는다", () => {
    useWorkspace.getState().applyRemoteMessage(msg({ id: "a", content: "처음" }));
    useWorkspace.getState().applyRemoteMessage(msg({ id: "a", content: "고침", edited: true }));
    const all = useWorkspace.getState().chatMessages;
    assert.equal(all.length, 1);
    assert.equal(all[0].content, "고침");
    assert.equal(all[0].edited, true);
  });
});
