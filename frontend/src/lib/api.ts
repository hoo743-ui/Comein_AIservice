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

/** 백엔드 베이스 URL. Vercel/로컬 모두 환경변수로 주입한다.
 *  - 로컬:  .env.local → NEXT_PUBLIC_API_BASE=http://localhost:8000
 *  - 배포:  Vercel 환경변수 → https://<render-service>.onrender.com
 *  미설정 시 상대경로("")로 폴백 → 목업/동일 오리진에서도 안전. */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");
