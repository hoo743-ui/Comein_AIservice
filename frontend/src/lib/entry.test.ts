// Comein · 문턱 판정 시험
//
// 보고: "새로고침하면 home 으로 간다."
// 이 표가 그때 잘못 읽던 자리다 — 이제 눈이 아니라 시험이 지킨다.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { entryVerdict, type EntrySignals } from "./entry";

const base: EntrySignals = {
  entered: false, remembered: false, leaving: false, exiting: false,
  configured: true, ready: false, signedIn: false,
};
const at = (patch: Partial<EntrySignals>) => entryVerdict({ ...base, ...patch });

describe("문턱 판정", () => {
  it("처음 온 사람은 인트로로", () => {
    assert.equal(at({ ready: true, signedIn: false }), "intro");
  });

  it("로그인 여부를 알기 전에는 아무 쪽으로도 밀지 않는다", () => {
    // ★ 이게 없어서 새로고침이 사람을 문밖으로 내보냈다.
    //   마운트 직후에는 세션 확인이 끝나지 않았는데, 그 한 순간을 '로그인 안 됨' 으로 읽었다.
    assert.equal(at({ ready: false }), "hold");
  });

  it("이미 로그인해 있으면 새로고침해도 그대로 들여보낸다", () => {
    assert.equal(at({ ready: true, signedIn: true }), "enter");
  });

  it("이 브라우저가 기억하고 있으면 다시 묻지 않는다", () => {
    // localStorage 로 옮긴 이유 — sessionStorage 는 탭 하나의 기억이라
    // 새 탭·북마크·복구된 세션에서는 늘 비어 있었다.
    assert.equal(at({ remembered: true, ready: true, signedIn: false }), "hold");
  });

  it("기억이 상태보다 먼저다", () => {
    // 같은 커밋 안에서 setEntered(true) 는 아직 반영되지 않는다.
    // 그 한 프레임에 '처음 온 사람' 으로 읽으면 들어와 있던 사람이 밖으로 밀린다.
    assert.equal(at({ entered: false, remembered: true, configured: false }), "hold");
  });

  it("나가는 중에는 판정하지 않는다", () => {
    // 로그아웃과 문턱이 서로 다른 곳으로 밀면 화면이 두 번 바뀐다.
    assert.equal(at({ exiting: true, ready: true, signedIn: false }), "hold");
    assert.equal(at({ leaving: true, ready: true, signedIn: false }), "hold");
  });

  it("연결이 없는 로컬 앱이면 기다리지 않고 곧바로 정한다", () => {
    assert.equal(at({ configured: false, ready: false }), "intro");
    assert.equal(at({ configured: false, remembered: true }), "hold");
  });
});
