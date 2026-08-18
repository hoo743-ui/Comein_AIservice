"use client";

/**
 * Comein · 서버와의 고리를 화면 수명에 매다는 얇은 훅.
 *
 * 순서와 판단은 전부 `lib/sync.ts` 에 있다 — 여기서는 켜고, 끄고, 상태를 화면 말로 옮긴다.
 * (그 순서가 이펙트 안에 있는 동안에는 아무도 시험할 수 없었다. 실제로 거기에 버그가 있었다.)
 *
 * 로그인 전이거나 키가 없으면 아무 일도 하지 않는다 — 앱은 그대로 혼자 돈다.
 */

import * as React from "react";

import { isSupabaseConfigured } from "@/lib/supabase";
import { idleSync, startRemoteSync, type SyncState } from "@/lib/sync";
import type { ChatMessage } from "@/lib/types";

export type RemoteState = SyncState & { configured: boolean };

export function useRemoteSync(opts?: { onIncoming?: (m: ChatMessage) => void }): RemoteState {
  const [state, setState] = React.useState<SyncState>(idleSync);
  // 콜백이 매 렌더 새로 만들어져도 구독을 다시 걸지 않는다(소켓이 계속 끊겼다 붙는다).
  const onIncoming = React.useRef(opts?.onIncoming);
  onIncoming.current = opts?.onIncoming;

  React.useEffect(() => {
    const handle = startRemoteSync({
      onState: (patch) => setState((s) => ({ ...s, ...patch })),
      onIncoming: () => onIncoming.current,
    });
    return () => handle.stop();
  }, []);

  return { ...state, configured: isSupabaseConfigured };
}
