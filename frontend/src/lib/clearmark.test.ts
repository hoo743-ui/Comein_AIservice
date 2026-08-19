// Comein · 여기서부터 새로 — 접히는 자리를 못 박는다.
//
// 이 규칙에서 틀리면 아픈 것은 경계다. 한 칸 어긋나면 방금 접은 마지막 말이 다시 올라오고,
// 사용자는 접기가 안 먹었다고 읽는다. 그래서 경계와 '아무것도 안 함' 을 시험한다.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { splitByMark } from "./clearmark";

const at = (iso: string) => ({ createdAt: iso });
const A = at("2026-08-19T10:00:00.000Z");
const B = at("2026-08-19T11:00:00.000Z");
const C = at("2026-08-19T12:00:00.000Z");

describe("접힌 것과 보이는 것", () => {
  it("표시가 없으면 아무것도 접지 않는다", () => {
    const r = splitByMark([A, B, C], undefined);
    assert.equal(r.hidden.length, 0);
    assert.equal(r.shown.length, 3);
  });

  it("표시 시각까지는 접고, 그 뒤부터 보인다", () => {
    const r = splitByMark([A, B, C], B.createdAt);
    assert.deepEqual(r.hidden, [A, B]);
    assert.deepEqual(r.shown, [C]);
  });

  it("같은 밀리초는 접는 쪽이다 — 누른 그 순간까지가 '지금까지' 다", () => {
    // 경계를 '이상' 으로 두면 방금 접은 마지막 말이 그대로 남아, 접기가 안 먹은 것처럼 보인다.
    const r = splitByMark([B], B.createdAt);
    assert.deepEqual(r.hidden, [B]);
    assert.deepEqual(r.shown, []);
  });

  it("표시 뒤에 온 말은 다시 접히지 않는다 — 접고 나서 이어 나눈 말이 사라지면 안 된다", () => {
    const r = splitByMark([A, B, C], A.createdAt);
    assert.deepEqual(r.shown, [B, C]);
  });

  it("망가진 시각은 없는 것으로 본다 — 반쯤 맞는 상태로 접지 않는다", () => {
    const r = splitByMark([A, B], "그런 날짜 없음");
    assert.equal(r.hidden.length, 0);
    assert.equal(r.shown.length, 2);
  });

  it("모두 접혀도 빈 목록을 돌려줄 뿐이다", () => {
    const r = splitByMark([A, B], C.createdAt);
    assert.deepEqual(r.hidden, [A, B]);
    assert.deepEqual(r.shown, []);
  });
});
