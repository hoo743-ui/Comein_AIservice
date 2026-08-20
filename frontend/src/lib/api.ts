// Comein · 백엔드 주소
//
// 한때 이 파일은 백엔드 HTTP 클라이언트였다. 지금은 주소 한 줄만 남았다.
//
// 저장이 Supabase 직행으로 바뀌면서 `/api/items` 경유 저장(saveItems·getDemoUserId)이
// 할 일이 없어졌고, 화면은 `/api/chat` 과 `/api/summary` 를 fetch 로 직접 부른다
// (요청 본문이 화면마다 달라, 얇은 래퍼를 한 겹 두는 편이 오히려 읽기 어려웠다).
// 목표 계약이던 `/api/ai/parse` 는 끝내 생기지 않았고 `parseMessage` 도 아무도 쓰지 않았다.
//
// 다시 클라이언트가 필요해지면 그때 여기에 세운다 — 쓰지 않는 층을 미리 두지 않는다.
// (그때가 왔다: 아래 postJson · wakeAi. 세 곳에서 같은 fetch 를 쓰면서 **상한이 아무 데도
//  없었다** — 본문은 여전히 부르는 쪽이 짓고, 여기가 쥐는 것은 시간뿐이다.)

/** 백엔드 베이스 URL. Vercel/로컬 모두 환경변수로 주입한다.
 *  - 로컬:  .env.local → NEXT_PUBLIC_API_BASE=http://localhost:8000
 *  - 배포:  Vercel 환경변수 → https://<render-service>.onrender.com
 *  미설정 시 상대경로("")로 폴백 → 목업/동일 오리진에서도 안전. */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");

/** 자고 있는 백엔드를 미리 깨운다 — 아무것도 기다리지 않는다.
 *
 *  Render 무료 티어는 15분 무요청이면 잠들고, 깨어나는 데 수십 초가 걸린다. 그동안
 *  화면은 '정리 중' 만 띄운 채 서 있었다 — 사용자가 첫 줄을 넣은 **뒤에야** 컨테이너가
 *  깨어나기 시작했기 때문이다. 그 수십 초를 사용자가 화면을 읽는 동안으로 옮긴다.
 *
 *  실패는 삼킨다. 이건 요청이 아니라 노크다 — 아무도 이 답을 기다리지 않는다. */
export function wakeAi() {
  if (!API_BASE) return;   // 같은 오리진이면 깨울 것이 없다
  try {
    void fetch(`${API_BASE}/health`, { method: "GET", cache: "no-store" }).catch(() => {});
  } catch { /* 노크일 뿐이다 */ }
}

/** 콜드스타트는 기다려 준다. 다만 영원히는 아니다.
 *
 *  화면의 fetch 에는 상한이 없었다. 백엔드가 끝내 답하지 않으면 '정리 중' 이 영원히 돌고,
 *  사용자는 자기가 친 한 줄이 어디로 갔는지 알 수 없었다 — 실패조차 하지 않는 상태다.
 *  기본 60초는 Render 가 깨어나는 시간(수십 초)은 넘기고, 사람의 인내는 넘지 않는 선이다.
 *  끊기면 AbortError 가 나고, 부르는 쪽이 '닿지 못했다' 로 받아 그 자리에서 말한다. */
export async function postJson(path: string, body: unknown, timeoutMs = 60_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
