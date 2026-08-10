"use client";

/**
 * Comein · Supabase 연동 레이어
 *
 * 화면은 이 파일을 모른다. 스토어가 지역(local) 상태를 그대로 쥐고 있고,
 * 여기서는 그 상태를 서버와 맞추기만 한다 — 그래서 키가 없으면 앱이 그냥 혼자 돈다.
 *
 * 신원(identity) 경계
 *   로그인 전 '나'는 상수 ME_ID("me") 다. 로그인하면 진짜 uuid 가 생긴다.
 *   화면 전체를 uuid 로 갈아엎는 대신, 이 경계에서만 서로 바꿔 준다.
 *     읽을 때  내 uuid → ME_ID
 *     쓸 때    ME_ID  → 내 uuid
 *   덕분에 UI 코드는 로그인 여부를 신경 쓰지 않는다.
 */

import type { RealtimeChannel } from "@supabase/supabase-js";

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  ME_ID,
  type Availability, type ChatMessage, type ChatRoom, type Contact, type EventParticipant,
  type ID, type ProposalResponse, type ProposalStatus, type Schedule, type ScheduleProposal,
  type SlotSuggestion,
} from "@/lib/types";

export type RemoteSnapshot = {
  schedules: Schedule[];
  eventParticipants: EventParticipant[];
  chatRooms: ChatRoom[];
  chatMessages: ChatMessage[];
  contacts: Contact[];
};

/** 지금 로그인한 사람의 uuid. 로그인 전이면 null.
 *  클라이언트와 같은 이유로 globalThis 에 둔다 — 모듈이 두 벌 평가돼도 하나만 보게. */
const UID_KEY = "__comein_uid__";
type UidHolder = { [UID_KEY]?: string | null };
const uidHolder = globalThis as unknown as UidHolder;
const setMyUid = (v: string | null) => { uidHolder[UID_KEY] = v; };
const myUidOf = () => uidHolder[UID_KEY] ?? null;
export const getMyUid = () => myUidOf();

/** 쓰기 직전에 세션을 확실히 올린다.
 *  모듈 변수만 믿으면, 세션이 아직 클라이언트에 올라오지 않은 채 요청이 나가
 *  auth.uid() 가 null 이 되고 RLS 가 "violates row-level security policy" 로 막는다. */
async function ensureUid(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const uid = data.session?.user?.id ?? null;
  setMyUid(uid);
  return uid;
}

/** PostgREST 직접 호출 — 사용자 토큰을 손으로 실어 보낸다.
 *  supabase-js 클라이언트를 통하면 세션이 있는데도 요청이 anon 키로 나가는 일이 있었다.
 *  그러면 서버의 auth.uid() 가 null 이 되어 RLS 가 쓰기를 전부 막는다
 *  (읽기는 통과하므로 조용히 저장만 안 되는, 알아채기 어려운 형태로 나타난다). */
async function rest(path: string, init: RequestInit & { prefer?: string } = {}) {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const res = await fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.prefer ? { Prefer: init.prefer } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${body.slice(0, 200)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const toLocalUser = (uid: string | null | undefined): ID => (uid && uid === myUidOf() ? ME_ID : String(uid ?? ""));
const toRemoteUser = (id: ID): string | null => (id === ME_ID ? myUidOf() : id);

// ── 인증 ────────────────────────────────────────────────

export const refreshSession = ensureUid;

/** 소셜 로그인 — Supabase 대시보드에서 해당 provider 를 켜 두어야 동작한다.
 *  돌아올 자리는 호출한 쪽이 정한다(로컬이든 배포든 같은 코드로 동작하게). */
export async function signInWithProvider(provider: "github" | "kakao", redirectTo?: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase 설정이 없습니다.");
  return sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: redirectTo ?? window.location.href },
  });
}


/** 이메일 + 비밀번호 — 메일 전송이나 OAuth 설정 없이 바로 확인할 수 있는 가장 짧은 길.
 *  (Supabase 는 기본적으로 가입 시 메일 확인을 요구한다. 바로 쓰려면 대시보드에서
 *   Authentication → Sign In / Providers → Email → "Confirm email" 을 꺼 두면 된다.) */
export async function signUpWithPassword(email: string, password: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase 설정이 없습니다.");
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithPassword(email: string, password: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase 설정이 없습니다.");
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** 이메일 매직링크 — 비밀번호 없이 링크만으로. */
export async function signInWithEmail(email: string, redirectTo?: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase 설정이 없습니다.");
  return sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo ?? window.location.href },
  });
}

export async function signOutRemote() {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
  setMyUid(null);
}

// ── 읽기 ────────────────────────────────────────────────

/** 내가 참여한 일정과 그에 매인 것들을 한 번에 가져온다.
 *  RLS 가 이미 '내 것' 만 통과시키므로 여기서 또 거르지 않는다. */
export async function fetchSnapshot(): Promise<RemoteSnapshot | null> {
  const sb = getSupabase();
  if (!sb || !myUidOf()) return null;

  const [ev, pa, ro] = await Promise.all([
    sb.from("events").select("*").order("start_at"),
    sb.from("event_participants").select("*"),
    sb.from("chat_rooms").select("*"),
  ]);
  if (ev.error) throw ev.error;
  if (pa.error) throw pa.error;
  if (ro.error) throw ro.error;

  const roomIds = (ro.data ?? []).map((r: any) => r.id);
  const ms = roomIds.length
    ? await sb.from("chat_messages").select("*").in("room_id", roomIds).order("created_at")
    : { data: [], error: null };
  if (ms.error) throw ms.error;

  // 사람은 실패해도 나머지를 막지 않는다 — 아직 0004 를 올리지 않았을 수 있다.
  const contacts = await fetchPeople().catch(() => []);

  return {
    contacts,
    schedules: (ev.data ?? []).map((e: any): Schedule => ({
      id: e.id,
      title: e.title,
      start: e.start_at,
      end: e.end_at ?? undefined,
      location: e.location ?? undefined,
      description: e.description ?? undefined,
      ownerId: toLocalUser(e.owner_id),
      status: e.status,
    })),
    eventParticipants: (pa.data ?? []).map((p: any): EventParticipant => ({
      eventId: p.event_id,
      userId: toLocalUser(p.user_id),
      role: p.role,
      status: p.status,
    })),
    chatRooms: (ro.data ?? []).map((r: any): ChatRoom => ({
      id: r.id,
      eventId: r.event_id ?? undefined,
      // dm_key 는 "uidA:uidB" — 나를 뺀 나머지가 상대다.
      peerId: r.dm_key ? String(r.dm_key).split(":").find((u: string) => u !== myUidOf()) : undefined,
    })),
    chatMessages: (ms.data ?? []).map((m: any): ChatMessage => ({
      id: m.id,
      roomId: m.room_id,
      senderId: toLocalUser(m.sender_id),
      content: m.content,
      createdAt: m.created_at,
    })),
  };
}

// ── 쓰기 ────────────────────────────────────────────────
// 모두 "실패해도 화면은 막지 않는다". 저장이 안 되면 로그만 남기고 지역 상태로 계속 간다.

export async function pushEvent(s: Schedule): Promise<string | null> {
  const uid = await ensureUid();
  if (!uid) return null;
  try {
    const rows = await rest("events", {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify({
        title: s.title,
        start_at: s.start,
        end_at: s.end ?? null,
        location: s.location ?? null,
        description: s.description ?? null,
        status: s.status,
        owner_id: uid,
      }),
    });
    return rows?.[0]?.id ?? null;
  } catch (e: any) { console.error("일정 저장 실패:", e?.message); return null; }
}

export async function pushParticipant(eventId: ID, userId: ID) {
  const sb = getSupabase();
  const me = await ensureUid();
  const uid = toRemoteUser(userId);
  if (!sb || !me || !uid) return;
  // 같은 사람을 두 번 넣어도 한 줄 — DB 의 복합 PK 와 같은 약속을 여기서도 지킨다.
  const { error } = await sb
    .from("event_participants")
    .upsert({ event_id: eventId, user_id: uid, role: "participant", status: "invited" }, { onConflict: "event_id,user_id" });
  if (error) console.error("참여자 추가 실패:", error.message);
}

export async function pullParticipant(eventId: ID, userId: ID) {
  const sb = getSupabase();
  const uid = toRemoteUser(userId);
  if (!sb || !uid) return;
  const { error } = await sb.from("event_participants").delete().eq("event_id", eventId).eq("user_id", uid);
  if (error) console.error("참여자 제외 실패:", error.message);
}

export async function pushParticipantStatus(eventId: ID, userId: ID, status: string) {
  const sb = getSupabase();
  const uid = toRemoteUser(userId);
  if (!sb || !uid) return;
  const { error } = await sb.from("event_participants").update({ status }).eq("event_id", eventId).eq("user_id", uid);
  if (error) console.error("참석 여부 저장 실패:", error.message);
}

/** 일정 방의 id 를 가져온다(트리거가 이미 만들어 두었다). */
export async function roomIdForEvent(eventId: ID): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.from("chat_rooms").select("id").eq("event_id", eventId).maybeSingle();
  return data?.id ?? null;
}

/** 1:1 방 — 두 uuid 를 정렬해 이은 키라, 누가 먼저 걸든 같은 방으로 수렴한다. */
export async function ensureDmRoomRemote(peerUid: string): Promise<string | null> {
  const sb = getSupabase();
  const me = await ensureUid();
  if (!sb || !me) return null;
  const key = [me, peerUid].sort().join(":");
  const found = await sb.from("chat_rooms").select("id").eq("dm_key", key).maybeSingle();
  if (found.data?.id) return found.data.id;

  const { data, error } = await sb.from("chat_rooms").insert({ dm_key: key }).select("id").single();
  if (error) { console.error("1:1 방 생성 실패:", error.message); return null; }
  await sb.from("chat_room_members").upsert(
    [{ room_id: data.id, user_id: me }, { room_id: data.id, user_id: peerUid }],
    { onConflict: "room_id,user_id" },
  );
  return data.id;
}

export async function pushMessage(roomId: ID, content: string): Promise<string | null> {
  const sb = getSupabase();
  const uid = await ensureUid();
  if (!sb || !uid) return null;
  const { data, error } = await sb
    .from("chat_messages")
    .insert({ room_id: roomId, sender_id: uid, content })
    .select("id")
    .single();
  if (error) { console.error("메시지 전송 실패:", error.message); return null; }
  return data?.id ?? null;
}

// ── 사람 ────────────────────────────────────────────────
// 지어낸 연락처는 여기 들어오지 않는다. 여기 있는 사람은 전부 실재하는 계정이라
// 일정에 부를 수 있고 말을 걸 수 있다(그래서 참여자 추가가 외래키에서 튕기지 않는다).

/** 사람 찾기. 두 글자부터 찾고, 이메일은 정확히 같을 때만 맞는다(서버가 그렇게 정해 뒀다). */
export async function searchPeople(q: string): Promise<Contact[]> {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return [];
  const { data, error } = await sb.rpc("search_people", { q, limit_n: 8 });
  if (error) { console.error("사람 검색 실패:", error.message); return []; }
  return (data ?? []).map((r: any): Contact => ({
    id: r.id,
    name: r.display_name,
    handle: r.handle,
    source: "comein",
    connected: !!r.connected,
  }));
}

/** 내 사람들 — 이은 사람과 같은 일정에서 만난 사람. */
export async function fetchPeople(): Promise<Contact[]> {
  const sb = getSupabase();
  if (!sb || !myUidOf()) return [];
  const { data, error } = await sb.rpc("my_people");
  if (error) { console.error("사람 목록 실패:", error.message); return []; }
  return (data ?? []).map((r: any): Contact => ({
    id: r.id,
    name: r.display_name,
    handle: r.handle,
    source: "comein",
    connected: !!r.connected,
    sharedEvents: r.shared_events ?? 0,
  }));
}

export async function connectWith(peerId: ID): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return false;
  const { error } = await sb.rpc("connect_with", { peer: peerId });
  if (error) { console.error("연결 실패:", error.message); return false; }
  return true;
}

export async function disconnectFrom(peerId: ID): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return false;
  const { error } = await sb.rpc("disconnect_from", { peer: peerId });
  if (error) { console.error("연결 해제 실패:", error.message); return false; }
  return true;
}

// ── 일정 제안 ──────────────────────────────────────────
// 충돌 판정은 전부 서버 안에서 끝난다. 여기로 넘어오는 건 결론뿐이다 —
// 남의 일정을 읽어야 판정할 수 있는데, 읽게 해 주면 그 순간 약속이 무너진다.

/** 그 시간대에 참여자들이 되는가. 제목·장소는 서버가 아예 내보내지 않는다. */
export async function availabilityFor(eventId: ID, start: string, end: string) {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return [];
  const { data, error } = await sb.rpc("availability_for", { e: eventId, s: start, f: end });
  if (error) { console.error("가용성 조회 실패:", error.message); return []; }
  return (data ?? []).map((r: any) => ({ userId: toLocalUser(r.user_id), state: r.state as Availability }));
}

/** 쓸 만한 시간대를 서버가 골라 준다. 사람별로 언제 바쁜지는 넘어오지 않는다 —
 *  여러 시간대를 훑어 놓고 그걸 다 받으면 남의 하루가 그대로 재구성된다. */
export async function suggestSlots(
  eventId: ID,
  winStart: string,
  winEnd: string,
  durationMin = 60,
  preferred?: string,
): Promise<SlotSuggestion[]> {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return [];
  const { data, error } = await sb.rpc("suggest_slots", {
    e: eventId, win_start: winStart, win_end: winEnd,
    duration_min: durationMin, preferred: preferred ?? null, step_min: 30, limit_n: 5,
  });
  if (error) { console.error("시간 후보 실패:", error.message); return []; }
  return (data ?? []).map((r: any): SlotSuggestion => ({
    start: r.slot_start, end: r.slot_end,
    availableCount: r.available_count, totalCount: r.total_count,
    bufferMin: r.buffer_min, distanceMin: r.distance_min,
  }));
}

export async function openProposal(eventId: ID, title: string | null, start: string, end: string, rationale?: string) {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return null;
  const { data, error } = await sb.rpc("open_proposal", {
    e: eventId, p_title: title, s: start, f: end, p_rationale: rationale ?? null,
  });
  if (error) { console.error("제안 실패:", error.message); return null; }
  return data as string;
}

/** 답한다. 전원이 채워지면 서버가 그 자리에서 일정을 앉힌다(확정을 따로 부르지 않는다). */
export async function respondToProposal(proposalId: ID, response: "accepted" | "declined" | "alternative", alt?: string) {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return null;
  const { data, error } = await sb.rpc("respond_to_proposal", { p: proposalId, resp: response, alt: alt ?? null });
  if (error) { console.error("응답 실패:", error.message); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { status: row.status as ProposalStatus, eventId: row.event_id as string, waiting: row.waiting as number } : null;
}

/** 이 일정에 열려 있는 제안 하나(없으면 null). 지난 제안은 가져오지 않는다. */
export async function fetchOpenProposal(eventId: ID): Promise<ScheduleProposal | null> {
  const sb = getSupabase();
  if (!sb || !myUidOf()) return null;
  const { data, error } = await sb
    .from("schedule_proposals")
    .select("*")
    .eq("event_id", eventId)
    .in("status", ["proposed", "pending"])
    .maybeSingle();
  if (error || !data) return null;

  const rs = await sb.from("schedule_proposal_participants").select("*").eq("proposal_id", data.id);
  const av = await availabilityFor(eventId, data.proposed_start_at, data.proposed_end_at);

  return {
    id: data.id,
    eventId: data.event_id,
    createdBy: toLocalUser(data.created_by),
    title: data.title ?? undefined,
    start: data.proposed_start_at,
    end: data.proposed_end_at,
    rationale: data.rationale ?? undefined,
    status: data.status,
    responses: (rs.data ?? []).map((r: any) => ({
      userId: toLocalUser(r.user_id),
      response: r.response as ProposalResponse,
      altStart: r.alt_start_at ?? undefined,
    })),
    availability: av,
  };
}

/** 확정된 뒤 내 개인 일정과 겹치는가 (§13). 나에 대해서만 답한다. */
export async function myConflictsWith(eventId: ID) {
  const sb = getSupabase();
  if (!sb || !myUidOf()) return [];
  const { data, error } = await sb.rpc("my_conflicts_with", { e: eventId });
  if (error) return [];
  return (data ?? []).map((r: any) => ({ id: r.conflict_id, title: r.title as string, start: r.start_at as string, end: r.end_at as string | null }));
}

// ── 실시간 ──────────────────────────────────────────────

export type RemoteHandlers = {
  onMessage: (m: ChatMessage) => void;
  onEventChange: () => void;
};

/** 일정·참여자·메시지 변화를 듣는다.
 *  메시지는 낱개로 반영하고(대화는 흐름이라 통째로 갈아끼우면 튄다),
 *  일정·참여자는 관계가 얽혀 있어 스냅샷을 다시 받는 편이 안전하다. */
export function subscribeRemote(handlers: RemoteHandlers): (() => void) | null {
  const sb = getSupabase();
  if (!sb || !myUidOf()) return null;

  const ch: RealtimeChannel = sb
    .channel("comein-workspace")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
      const m: any = payload.new;
      handlers.onMessage({
        id: m.id,
        roomId: m.room_id,
        senderId: toLocalUser(m.sender_id),
        content: m.content,
        createdAt: m.created_at,
      });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => handlers.onEventChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "event_participants" }, () => handlers.onEventChange())
    .subscribe();

  return () => { void sb.removeChannel(ch); };
}

export const remoteReady = () => isSupabaseConfigured && !!myUidOf();
