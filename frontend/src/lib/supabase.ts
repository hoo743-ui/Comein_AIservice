"use client";

/**
 * Comein · Supabase 클라이언트 (브라우저)
 *
 * 왜 프론트에서 직접 Supabase 를 부르는가 —
 *   공유 일정·대화는 RLS(행 단위 권한)와 Realtime 이 핵심이다. 둘 다 Supabase 가
 *   연결 하나로 해 주는 일이고, 백엔드를 한 번 더 거치면 실시간이 끊긴다.
 *   반면 AI 파싱(/api/chat)은 계속 FastAPI 를 거친다 — LLM 키는 서버에만 둔다.
 *
 * 키가 없으면 null 을 돌려준다. 앱은 그대로 동작하고(로컬 스토어), 저장·실시간만 꺼진다.
 * "설정이 없으면 죽는다" 가 아니라 "설정이 없으면 조용히 혼자 쓴다" 가 이 앱의 태도다.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** 연결 정보가 갖춰졌는가. 화면에서 '연결됨/로컬' 을 알릴 때 쓴다. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/** 브라우저 전역에 하나만 둔다.
 *  모듈 변수가 아니라 globalThis 에 매다는 이유 — Next 는 번들을 쪼개면서 같은 모듈을
 *  두 벌 평가할 수 있다. 그러면 클라이언트가 둘이 되어, 한쪽에만 로그인 세션이 실린다.
 *  (그 상태로 쓰기를 하면 토큰 없이 요청이 나가고 RLS 가 전부 막는다.) */
const CLIENT_KEY = "__comein_supabase__";
type Holder = { [CLIENT_KEY]?: SupabaseClient };

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  const holder = globalThis as unknown as Holder;
  if (holder[CLIENT_KEY]) return holder[CLIENT_KEY]!;
  const client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // OAuth 리디렉트로 돌아왔을 때 세션을 주워 담는다
    },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  holder[CLIENT_KEY] = client;
  return client;
}

// 여기 있던 currentUserId() 는 걷어냈다. 신원은 remote.ts 가 한 곳에서 쥔다
// (ensureUid → getSession). 같은 것을 묻는 창구가 둘이면 한쪽은 반드시 낡는다 —
// 실제로 getUser() 와 getSession() 이 서로 다른 답을 주는 순간이 있었다.
