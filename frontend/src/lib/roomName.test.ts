// Comein · 자리의 첫 이름 시험
//
// 같은 사람들이 다시 모이는 것이 예외가 아니라 기본이다.
// 그래서 "이름이 겹치지 않는가" 가 이 함수의 전부다.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { suggestEventTitle } from "./roomName";

const at = (day: number, h: number, m = 0) => new Date(2026, 7, day, h, m, 0, 0); // 2026-08
const call = (o: Partial<Parameters<typeof suggestEventTitle>[0]>) =>
  suggestEventTitle({ peerNames: ["김서준"], start: at(19, 19), existing: [], lang: "ko", ...o });

describe("자리의 첫 이름", () => {
  it("처음 만나는 사람과는 사람 이름으로 — 그게 그 자리의 전부다", () => {
    assert.equal(call({}), "김서준님과의 자리");
  });

  it("여럿이면 한 사람 이름과 나머지 수로", () => {
    assert.equal(call({ peerNames: ["김서준", "이하늘", "박도윤"] }), "김서준님 외 2명과의 자리");
  });

  it("두 번째부터는 시간으로 — 사람은 이미 같으니 이름이 아무것도 구별해 주지 않는다", () => {
    // 2026-08-19 는 수요일, 19시는 저녁
    assert.equal(call({ existing: ["김서준님과의 자리"] }), "수요일 저녁");
  });

  it("그 시간 이름도 쓰였으면 날짜까지 좁힌다", () => {
    assert.equal(
      call({ existing: ["김서준님과의 자리", "수요일 저녁"] }),
      "8월 19일 저녁",
    );
  });

  it("날짜까지 겹치면 시각까지", () => {
    assert.equal(
      call({ existing: ["김서준님과의 자리", "수요일 저녁", "8월 19일 저녁"] }),
      "8월 19일 19:00",
    );
  });

  it("같은 날 같은 시각에 또 생기면 그때만 숫자를 붙인다 — 마지막 수단이다", () => {
    const all = ["김서준님과의 자리", "수요일 저녁", "8월 19일 저녁", "8월 19일 19:00"];
    assert.equal(call({ existing: all }), "8월 19일 19:00 (2)");
    assert.equal(call({ existing: [...all, "8월 19일 19:00 (2)"] }), "8월 19일 19:00 (3)");
  });

  it("하루를 다섯으로 부른다 — 14시보다 점심이 먼저 떠오른다", () => {
    const skip = ["김서준님과의 자리"];
    assert.match(call({ existing: skip, start: at(19, 8) }), /아침$/);
    assert.match(call({ existing: skip, start: at(19, 12) }), /점심$/);
    assert.match(call({ existing: skip, start: at(19, 15) }), /오후$/);
    assert.match(call({ existing: skip, start: at(19, 20) }), /저녁$/);
    assert.match(call({ existing: skip, start: at(19, 23) }), /밤$/);
    assert.match(call({ existing: skip, start: at(19, 3) }), /밤$/);
  });

  it("공백이나 대소문자가 다른 것은 같은 이름으로 본다", () => {
    // "수요일  저녁" 이 이미 있으면 "수요일 저녁" 을 또 만들지 않는다.
    assert.equal(
      call({ existing: ["김서준님과의 자리", "수요일  저녁"] }),
      "8월 19일 저녁",
    );
  });

  it("사람이 없으면 사람 이름 단계를 건너뛴다", () => {
    assert.equal(call({ peerNames: [], existing: [] }), "수요일 저녁");
  });

  it("영어도 같은 사다리를 탄다", () => {
    const en = { lang: "en" as const, peerNames: ["Seojun"] };
    assert.equal(call({ ...en, existing: [] }), "With Seojun");
    assert.equal(call({ ...en, existing: ["With Seojun"] }), "Wed evening");
    assert.equal(call({ ...en, existing: ["With Seojun", "Wed evening"] }), "Aug 19 evening");
    assert.equal(
      call({ ...en, existing: ["With Seojun", "Wed evening", "Aug 19 evening"] }),
      "Aug 19 19:00",
    );
  });

  it("여럿이 다시 모이면 사람 이름 대신 시간으로 — 목록에 같은 줄이 서지 않는다", () => {
    const people = ["김서준", "이하늘"];
    const first = call({ peerNames: people, existing: [] });
    const second = call({ peerNames: people, existing: [first] });
    const third = call({ peerNames: people, existing: [first, second], start: at(20, 12) });
    assert.equal(new Set([first, second, third]).size, 3, "셋이 서로 다르다");
  });
});
