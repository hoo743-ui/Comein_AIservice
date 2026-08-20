// Comein · 백엔드로 나가는 길 시험
//
// 여기서 재는 것은 두 가지다 — **깨우는 노크**와 **기다림의 상한**.
// 둘 다 콜드스타트(무료 티어는 15분 무요청이면 잔다) 때문에 생긴 것이라,
// 평소에는 아무 일도 하지 않는 것처럼 보인다. 평소에 안 보이는 것일수록 시험이 필요하다.
//
//   npm test

import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.NEXT_PUBLIC_API_BASE = "https://backend.test";

// 모듈은 위 환경변수가 선 뒤에 읽어야 한다 — API_BASE 는 읽히는 순간 값이 굳는다.
const { API_BASE, postJson, wakeAi } = await import("@/lib/api");

/** globalThis.fetch 를 잠깐 바꿔 끼운다. 되돌리는 것까지가 한 벌이다. */
const withFetch = async (impl: typeof fetch, run: () => Promise<void>) => {
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  try { await run(); } finally { globalThis.fetch = real; }
};

describe("wakeAi · 자는 백엔드를 미리 두드린다", () => {
  it("주소만 두드리고 아무것도 기다리지 않는다", async () => {
    const hits: string[] = [];
    await withFetch(
      (async (url: any) => { hits.push(String(url)); return new Response("{}"); }) as any,
      async () => {
        const before = Date.now();
        const ret = wakeAi();
        // 동기로 끝난다 — 이건 요청이 아니라 노크다. 기다릴 것이 있으면 화면이 그만큼 늦는다.
        assert.equal(ret, undefined, "돌려주는 것이 없다");
        assert.ok(Date.now() - before < 50, "부르는 자리를 붙잡지 않는다");
        assert.deepEqual(hits, [`${API_BASE}/health`], "/health 한 번");
      },
    );
  });

  it("깨우지 못해도 조용하다", async () => {
    // 깨우기 실패는 사용자에게 할 말이 아니다 — 그때는 캡처가 제 자리에서 말한다.
    // 여기서 새어 나가면 잡는 곳이 없어 콘솔에 unhandled rejection 이 뜬다.
    await withFetch(
      (() => Promise.reject(new Error("network down"))) as any,
      async () => { assert.doesNotThrow(() => wakeAi()); },
    );
  });
});

describe("postJson · 콜드스타트는 기다리되 영원히는 아니다", () => {
  it("상한을 넘기면 끊는다 — 그리고 끊겼다고 말한다", async () => {
    // 답하지 않는 서버. 예전의 fetch 에는 상한이 없어 이 자리에서 영원히 돌았고,
    // 화면은 '정리 중' 인 채로 멈춰 있었다 — 실패조차 하지 않는 상태다.
    await withFetch(
      ((_u: any, init: any) => new Promise((_res, rej) => {
        init.signal.addEventListener("abort", () => rej(init.signal.reason ?? new Error("aborted")));
      })) as any,
      async () => {
        const started = Date.now();
        await assert.rejects(
          () => postJson("/api/chat", { message: "안녕" }, 60),
          (e: any) => e?.name === "AbortError",
          "AbortError 로 끊긴다 — 부르는 쪽이 '닿지 못했다' 와 구별할 수 있게",
        );
        assert.ok(Date.now() - started < 2000, "상한 언저리에서 끊긴다");
      },
    );
  });

  it("제때 오면 끊지 않는다", async () => {
    await withFetch(
      (async () => new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } })) as any,
      async () => {
        const res = await postJson("/api/chat", { message: "안녕" }, 1000);
        assert.equal(res.ok, true);
        assert.deepEqual(await res.json(), { ok: true });
      },
    );
  });

  it("본문은 부르는 쪽이 짓는다 — 여기가 쥐는 것은 시간뿐이다", async () => {
    let seen: { url: string; init: any } | null = null;
    await withFetch(
      (async (url: any, init: any) => { seen = { url: String(url), init }; return new Response("{}"); }) as any,
      async () => {
        await postJson("/api/summary", { transcript: "가나다", title: null });
        assert.equal(seen!.url, `${API_BASE}/api/summary`);
        assert.equal(seen!.init.method, "POST");
        assert.equal(seen!.init.headers["Content-Type"], "application/json");
        assert.deepEqual(JSON.parse(seen!.init.body), { transcript: "가나다", title: null });
      },
    );
  });
});
