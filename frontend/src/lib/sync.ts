"use client";

/**
 * Comein · 서버와 화면을 맞춰 두는 engine.
 *
 * 화면(React)이 아니라 여기가 순서를 쥔다 — 훅은 이것을 켜고 끄기만 한다.
 * 그래야 이 순서를 **브라우저 없이 시험할 수 있다**. 실제로 상대의 말이 새로고침해야
 * 보이던 버그가 바로 이 순서 안에 있었고, 이펙트 안에 있는 동안에는 아무도 그걸 못 봤다.
 *
 * 하는 일
 *   1) 로그인 상태를 확인하고
 *   2) 내 것(참여한 일정·방·대화·제안)을 받아 스토어에 얹고
 *   3) 그 뒤로는 Realtime 이 알려주는 대로만 고친다.
 *
 * 한 번에 하나만 (single-flight)
 *   supabase-js 는 auth 구독을 거는 순간 `INITIAL_SESSION` 으로 **반드시 한 번 운다.**
 *   예전에는 그때마다 처음부터 다시 걸었고, 아직 끝나지 않은 준비와 새 준비가 겹치면서
 *   **같은 이름의 채널**을 두 번 열었다. realtime-js 는 같은 이름이면 있던 인스턴스를
 *   그대로 돌려주고, 이미 join 된 채널의 subscribe() 는 조용한 no-op 이다 — 그래서
 *   두 번째는 "구독했다" 고 믿지만 실제로는 첫 번째가 정리하며 떠나보내는 채널을 쥐었다.
 *   결과는 화면은 멀쩡한데 실시간만 죽은 상태. 그래서 여기서는
 *     (a) 같은 신원이면 소켓을 다시 열지 않고
 *     (b) 겹쳐 들어온 준비는 세대 번호로 버린다.
 */

import { useWorkspace } from "@/lib/store";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { fetchSnapshot, refreshSession, subscribeRemote } from "@/lib/remote";
import type { ChatMessage } from "@/lib/types";

/** ready: 세션을 한 번이라도 확인했는가. 확인 전에 '로그인 안 됨' 으로 단정하면
 *  이미 들어와 있는 사람을 문밖으로 내보내게 된다.
 *  live: 실시간이 실제로 붙어 있는가. 끊긴 줄 모르는 것이 가장 나쁜 상태다. */
export type SyncState = { signedIn: boolean; ready: boolean; live: boolean; error: string | null };

export const idleSync: SyncState = { signedIn: false, ready: false, live: false, error: null };

export type SyncHandle = {
  /** 이 고리를 끊는다. 두 번 불러도 안전하다. */
  stop: () => void;
  /** 시험용 — 지금 실시간이 걸려 있는 신원. 걸려 있지 않으면 null. */
  boundUid: () => string | null;
};

export function startRemoteSync(opts: {
  onState: (patch: Partial<SyncState>) => void;
  onIncoming?: () => ((m: ChatMessage) => void) | undefined;
}): SyncHandle {
  const { onState } = opts;

  if (!isSupabaseConfigured) { onState({ ready: true }); return { stop: () => {}, boundUid: () => null }; }
  const sb = getSupabase();
  if (!sb) { onState({ ready: true }); return { stop: () => {}, boundUid: () => null }; }

  const store = () => useWorkspace.getState();

  let unsubscribe: (() => void) | null = null;
  let alive = true;
  let gen = 0;              // 겹쳐 들어온 준비 중 마지막 것만 살린다
  let boundUid: string | null = null;  // 지금 구독이 걸려 있는 신원
  let snapping = false;     // 스냅샷 재요청이 몰릴 때 하나로 접는다
  let again = false;

  /** 서버 상태를 다시 받아 스토어에 얹는다. 여러 번 불려도 한 번만 나간다. */
  const resync = async () => {
    if (!alive) return;
    if (snapping) { again = true; return; }
    snapping = true;
    try {
      do {
        again = false;
        const snap = await fetchSnapshot();
        if (!alive) return;
        if (snap) store().hydrateRemote(snap);
        await store().loadOpenProposals();
      } while (again && alive);
    } catch { /* 한 번 못 받았다고 화면을 멈추지 않는다 */ }
    finally { snapping = false; }
  };

  const load = async () => {
    const mine = ++gen;
    try {
      const uid = await refreshSession();
      if (!alive || mine !== gen) return;
      onState({ signedIn: !!uid, ready: true });

      if (!uid) {
        boundUid = null;
        unsubscribe?.(); unsubscribe = null;
        onState({ live: false });
        return;
      }
      // 같은 사람으로 이미 붙어 있으면 소켓을 다시 열지 않는다.
      // (토큰 갱신마다 다시 열면 그때마다 대화가 잠깐 끊긴다.)
      if (boundUid === uid && unsubscribe) { await resync(); return; }

      await resync();
      if (!alive || mine !== gen) return;

      onState({ error: null });
      unsubscribe?.();
      boundUid = uid;
      unsubscribe = subscribeRemote({
        onMessage: (m) => {
          store().applyRemoteMessage(m);
          opts.onIncoming?.()?.(m);
          // 모르는 방에서 온 말이면 방 목록부터 다시 받는다.
          // 첫 1:1 대화가 그렇다 — 방은 상대가 만들고, 내 화면은 그 방을 아직 모른다.
          // 그대로 두면 말은 스토어에 들어와 있는데 어느 화면에도 걸리지 않는다
          // (방을 못 찾으니 걸러진다) — 새로고침해야 보이던 자리가 여기다.
          if (!store().chatRooms.some((r) => r.id === m.roomId)) void resync();
        },
        onMessageGone: (id) => store().dropMessage(id),
        // 일정·참여자는 관계가 얽혀 있어 한 건씩 깁지 않고 다시 받아 온다.
        onEventChange: () => { void resync(); },
        // 방이 새로 생겼다 — 첫 1:1 대화는 방부터 생긴다. 방을 모르면 그 말이 갈 곳이 없다.
        onRoomChange: () => { void resync(); },
        onProposalChange: (eventId) => {
          if (eventId) void store().loadProposal(eventId);
          else void store().loadOpenProposals();
        },
        onStatus: (ok, detail) => {
          if (!alive) return;
          onState({
            live: ok,
            error: ok ? null : detail ? `실시간 연결이 끊겼어요 (${detail}). 다시 잇는 중…` : null,
          });
        },
      });
    } catch (e: any) {
      if (alive && mine === gen) onState({ error: e?.message ?? "연결에 실패했어요.", ready: true });
    }
  };

  void load();

  // 신원이 바뀔 때만 처음부터 다시 맞춘다.
  // (TOKEN_REFRESHED · INITIAL_SESSION 은 같은 사람이므로 load 안에서 조용히 통과한다.)
  const { data } = sb.auth.onAuthStateChange((event: string) => {
    if (!alive) return;
    if (event === "SIGNED_OUT") {
      boundUid = null;
      unsubscribe?.(); unsubscribe = null;
      onState({ live: false, signedIn: false });
      return;
    }
    void load();
  });

  return {
    stop: () => {
      alive = false;
      unsubscribe?.(); unsubscribe = null;
      data.subscription.unsubscribe();
    },
    boundUid: () => boundUid,
  };
}
