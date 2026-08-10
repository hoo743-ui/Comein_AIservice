"use client";

/**
 * Comein · 서버와 화면을 맞춰 두는 고리.
 *
 * 워크스페이스가 뜰 때 한 번 불러 두면 —
 *   1) 로그인 상태를 확인하고
 *   2) 내 것(참여한 일정·방·대화)을 받아 스토어에 얹고
 *   3) 그 뒤로는 Realtime 이 알려주는 대로만 고친다.
 *
 * 로그인 전이거나 키가 없으면 아무 일도 하지 않는다 — 앱은 그대로 혼자 돈다.
 */

import * as React from "react";

import { useWorkspace } from "@/lib/store";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";
import { fetchSnapshot, refreshSession, subscribeRemote } from "@/lib/remote";
import type { ChatMessage } from "@/lib/types";

/** ready: 세션을 한 번이라도 확인했는가. 확인 전에 '로그인 안 됨' 으로 단정하면
 *  이미 들어와 있는 사람을 문밖으로 내보내게 된다. */
export type RemoteState = { configured: boolean; signedIn: boolean; ready: boolean; error: string | null };

export function useRemoteSync(opts?: { onIncoming?: (m: ChatMessage) => void }): RemoteState {
  const hydrateRemote = useWorkspace((s) => s.hydrateRemote);
  const applyRemoteMessage = useWorkspace((s) => s.applyRemoteMessage);
  // 콜백이 매 렌더 새로 만들어져도 구독을 다시 걸지 않는다(소켓이 계속 끊겼다 붙는다).
  const onIncoming = React.useRef(opts?.onIncoming);
  onIncoming.current = opts?.onIncoming;
  const [signedIn, setSignedIn] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isSupabaseConfigured) { setReady(true); return; }
    const sb = getSupabase();
    if (!sb) { setReady(true); return; }
    let stop: (() => void) | null = null;
    let alive = true;

    const load = async () => {
      try {
        const uid = await refreshSession();
        if (!alive) return;
        setSignedIn(!!uid);
        setReady(true);
        if (!uid) return;

        const snap = await fetchSnapshot();
        if (!alive || !snap) return;
        hydrateRemote(snap);
        setError(null);

        stop?.();
        stop = subscribeRemote({
          onMessage: (m) => { applyRemoteMessage(m); onIncoming.current?.(m); },
          // 일정·참여자는 관계가 얽혀 있어 한 건씩 깁지 않고 다시 받아 온다.
          onEventChange: () => { void fetchSnapshot().then((s) => s && alive && hydrateRemote(s)).catch(() => {}); },
        });
      } catch (e: any) {
        if (alive) { setError(e?.message ?? "연결에 실패했어요."); setReady(true); }
      }
    };

    void load();
    // 로그인/로그아웃이 일어나면 처음부터 다시 맞춘다.
    const { data } = sb.auth.onAuthStateChange(() => { void load(); });

    return () => {
      alive = false;
      stop?.();
      data.subscription.unsubscribe();
    };
  }, [hydrateRemote, applyRemoteMessage]);

  return { configured: isSupabaseConfigured, signedIn, ready, error };
}
