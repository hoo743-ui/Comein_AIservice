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
  type Availability, type ChatMessage, type ChatRoom, type ConnectionRequest, type Contact,
  type EventParticipant, type ID, type ProposalResponse, type ProposalStatus, type Schedule,
  type ScheduleProposal, type SlotSuggestion,
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
    // 카카오 scope 를 여기서 줄이려 해도 소용없다 — Supabase 는 provider 기본 scope
    // (account_email profile_image profile_nickname) 에 우리 값을 '덧붙이기만' 한다.
    // account_email 은 비즈 앱 전용 동의항목이므로, 개인 앱이면 카카오 콘솔에서
    // 비즈 앱으로 전환해 이메일을 열어야 한다. 코드로 우회할 수 있는 자리가 아니다.
    options: { redirectTo: redirectTo ?? window.location.href },
  });
}


/** 이메일 + 비밀번호 — 메일 전송이나 OAuth 설정 없이 바로 확인할 수 있는 가장 짧은 길.
 *  (Supabase 는 기본적으로 가입 시 메일 확인을 요구한다. 바로 쓰려면 대시보드에서
 *   Authentication → Sign In / Providers → Email → "Confirm email" 을 꺼 두면 된다.) */
export async function signUpWithPassword(email: string, password: string, name?: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase 설정이 없습니다.");
  // 이름은 `options.data` 로 실어 보낸다 — 그래야 auth.users.raw_user_meta_data 에 앉고,
  // 가입 트리거(0004 tg_new_user_profile)가 그걸 읽어 display_name 을 세운다.
  //
  // 예전에는 화면이 이름을 받아 놓고 여기까지 넘기지 않았다. 트리거는 늘 빈 칸을 읽었고,
  // 그래서 모든 사람의 표시 이름이 이메일 앞부분(= 핸들)이 됐다. 사용자는 제 이름을
  // 분명히 적었는데 어디에도 없었던 셈이다(§25).
  const display = (name ?? "").trim();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    ...(display ? { options: { data: { name: display } } } : {}),
  });
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
    // 지워진 말은 가져오지 않는다 — 자리를 남길지는 화면이 정할 일이지만,
    // 지금은 조용히 사라지는 편이 대화를 덜 어지럽힌다(행은 서버에 남아 있다).
    chatMessages: (ms.data ?? []).filter((m: any) => !m.deleted_at).map(toMessage),
  };
}

/** chat_messages 한 줄 → 화면이 쓰는 ChatMessage. 스냅샷과 실시간이 같은 변환을 쓴다. */
function toMessage(m: any): ChatMessage {
  return {
    id: m.id,
    roomId: m.room_id,
    senderId: toLocalUser(m.sender_id),
    content: m.content,
    createdAt: m.created_at,
    edited: !!m.is_edited,
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

/** 고치기·지우기가 **정말로** 됐는가.
 *
 *  RLS 가 막으면 PostgREST 는 오류를 주지 않는다 — 정책이 행을 안 보이게 하므로 조건에
 *  맞는 행이 없는 것과 같고, 200 + 빈 응답이 돌아온다. 그래서 "주최자가 아니라 못 고쳤다"가
 *  지금까지 성공으로 읽혔다(화면만 바뀌고 서버는 그대로, 다음 스냅샷에서 조용히 되돌아갔다).
 *
 *  `return=representation` 을 붙이면 실제로 손댄 행이 돌아온다. 0행이면 못 한 것이다. */
async function touchedRows(path: string, init: RequestInit): Promise<boolean> {
  const rows = await rest(path, { ...init, prefer: "return=representation" });
  return Array.isArray(rows) && rows.length > 0;
}

/** AI 가 놓아 둔 제안(pending)을 사람이 확정한다. 확정은 언제나 사람의 손에서 일어난다. */
export async function confirmEvent(eventId: ID): Promise<boolean> {
  const uid = await ensureUid();
  if (!uid) return false;
  try {
    return await touchedRows(`events?id=eq.${eventId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "confirmed" }),
    });
  } catch (e: any) { console.error("일정 확정 실패:", e?.message); return false; }
}

/** 이름을 고쳐 단다. 서버는 주최자만 받아 준다(0001 events_update) —
 *  방 이름은 곧 일정 제목이라, 남의 일정 이름을 바꿀 수 있으면 안 된다. */
export async function renameEvent(eventId: ID, title: string): Promise<boolean> {
  const uid = await ensureUid();
  if (!uid) return false;
  try {
    return await touchedRows(`events?id=eq.${eventId}`, { method: "PATCH", body: JSON.stringify({ title }) });
  } catch (e: any) { console.error("일정 이름 변경 실패:", e?.message); return false; }
}

/** 되돌린다 — 방금 만든 것을 없던 일로. 서버에서도 지운다(화면에서만 지우면 다음에 다시 나타난다). */
export async function deleteEvent(eventId: ID): Promise<boolean> {
  const uid = await ensureUid();
  if (!uid) return false;
  try {
    return await touchedRows(`events?id=eq.${eventId}`, { method: "DELETE" });
  } catch (e: any) { console.error("일정 삭제 실패:", e?.message); return false; }
}

// 아래 셋은 **됐는지 안 됐는지를 돌려준다.** 예전에는 전부 void 였고 실패는 콘솔에만
// 남았다 — 화면은 이미 바꿔 놓은 뒤라, 서버가 거절해도 사용자는 그걸 알 길이 없었다.
// 스토어가 이 값을 보고 화면을 되돌린다(store.ts).

export async function pushParticipant(eventId: ID, userId: ID): Promise<boolean> {
  const sb = getSupabase();
  const me = await ensureUid();
  const uid = toRemoteUser(userId);
  if (!sb || !me || !uid) return false;
  // 같은 사람을 두 번 넣어도 한 줄 — DB 의 복합 PK 와 같은 약속을 여기서도 지킨다.
  const { error } = await sb
    .from("event_participants")
    .upsert({ event_id: eventId, user_id: uid, role: "participant", status: "invited" }, { onConflict: "event_id,user_id" });
  if (error) { console.error("참여자 추가 실패:", error.message); return false; }
  return true;
}

export async function pullParticipant(eventId: ID, userId: ID): Promise<boolean> {
  const sb = getSupabase();
  const uid = toRemoteUser(userId);
  if (!sb || !uid) return false;
  const { error } = await sb.from("event_participants").delete().eq("event_id", eventId).eq("user_id", uid);
  if (error) { console.error("참여자 제외 실패:", error.message); return false; }
  return true;
}

export async function pushParticipantStatus(eventId: ID, userId: ID, status: string): Promise<boolean> {
  const sb = getSupabase();
  const uid = toRemoteUser(userId);
  if (!sb || !uid) return false;
  // 정말로 그 줄이 바뀌었는지까지 본다 — 남의 참석 여부는 RLS 가 막는데, 그때도 오류가
  // 아니라 '0행 수정' 으로 조용히 지나간다.
  const { data, error } = await sb
    .from("event_participants")
    .update({ status })
    .eq("event_id", eventId)
    .eq("user_id", uid)
    .select("user_id");
  if (error) { console.error("참석 여부 저장 실패:", error.message); return false; }
  return (data?.length ?? 0) > 0;
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
  // 화면은 "@핸들로 찾기" 라고 권하는데 서버는 handle 을 '@' 없이 들고 있다.
  // 그대로 넘기면 "@fapp1004" 가 'handle like @fapp1004%' 가 되어 한 건도 안 나온다 —
  // 시킨 대로 쳤는데 아무도 없다고 답하는 셈이었다. 앞의 @ 는 여기서 벗긴다.
  const needle = q.replace(/^@+/, "");
  const { data, error } = await sb.rpc("search_people", { q: needle, limit_n: 8 });
  if (error) { console.error("사람 검색 실패:", error.message); return []; }
  return (data ?? []).map((r: any): Contact => ({
    id: r.id,
    name: r.display_name,
    handle: r.handle,
    source: "comein",
    connected: !!r.connected,
    requested: !!r.requested,
    incomingRequestId: r.incoming ?? undefined,
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

/** 하루를 슬롯으로 잘라 "몇 명이 되는가" 만 받아 온다.
 *
 *  누가 바쁜지도, 무엇 때문인지도 오지 않는다 — 숫자뿐이다(0006 마이그레이션).
 *  내 일정은 이미 스토어에 있으므로, 화면은 '내 것은 제목까지 · 남의 것은 숫자만' 으로 그린다.
 *  0006 이 아직 적용되지 않은 서버에서는 빈 배열을 돌려주고 화면은 내 일정만 그린다. */
export async function dayAvailability(
  eventId: ID,
  dayStart: Date,
  dayEnd: Date,
  slotMin = 30,
): Promise<{ start: string; available: number; total: number }[]> {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return [];
  const { data, error } = await sb.rpc("day_availability", {
    e: eventId,
    day_start: dayStart.toISOString(),
    day_end: dayEnd.toISOString(),
    slot_min: slotMin,
  });
  if (error) {
    console.warn("가용 시간 조회 실패(0006 마이그레이션 확인):", error.message);
    return [];
  }
  return (data ?? []).map((r: any) => ({
    start: r.slot_start,
    available: r.available_count ?? 0,
    total: r.total_count ?? 0,
  }));
}

/** 요청이 어떻게 끝났는가. 화면이 "보냈어요" 와 "이어졌어요" 를 다르게 말해야 한다. */
export type RequestOutcome = "sent" | "accepted" | "pending" | "connected" | "error";

/** 잇자고 청한다 — 즉시 잇지 않는다. 상대가 받아야 이어진다.
 *  상대도 나에게 보내 두었다면 그 자리에서 이어진다("accepted"). */
export async function requestConnection(peerId: ID): Promise<{ outcome: RequestOutcome; message?: string }> {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return { outcome: "error" };
  const { data, error } = await sb.rpc("request_connection", { peer: peerId });
  if (error) {
    // 거절 뒤 곧바로 다시 보낸 경우처럼, 서버가 이유를 말해 주면 그대로 옮긴다.
    console.error("연결 요청 실패:", error.message);
    return { outcome: "error", message: error.message };
  }
  return { outcome: (data as RequestOutcome) ?? "sent" };
}

/** 받은 요청에 답한다 — 받은 사람만 부를 수 있다(서버가 다시 확인한다). */
export async function answerConnectionRequest(id: ID, accept: boolean): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return false;
  const { data, error } = await sb.rpc("answer_connection_request", { req: id, accept });
  if (error) { console.error("요청 응답 실패:", error.message); return false; }
  return data === "accepted" || data === "declined";
}

/** 보낸 요청을 무른다. */
export async function cancelConnectionRequest(peerId: ID): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return false;
  const { error } = await sb.rpc("cancel_connection_request", { peer: peerId });
  if (error) { console.error("요청 취소 실패:", error.message); return false; }
  return true;
}

/** 핸들을 바꾼다. 막혔으면 왜 막혔는지 그대로 옮긴다 —
 *  "실패했습니다" 만 있으면 사용자는 자기가 뭘 잘못했는지 모른 채 같은 걸 또 시도한다. */
export async function changeMyHandle(next: string): Promise<{ ok: boolean; handle?: string; message?: string }> {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return { ok: false };
  const { data, error } = await sb.rpc("change_handle", { new_handle: next });
  if (error) return { ok: false, message: error.message };
  return { ok: true, handle: data as string };
}

/** 언제 다시 바꿀 수 있는가 — 30일 규칙을 화면이 미리 말해 줄 수 있게. */
export async function fetchHandleState(): Promise<{ handle: string; canChangeAt: string } | null> {
  const sb = getSupabase();
  if (!sb || !myUidOf()) return null;
  const { data, error } = await sb.rpc("my_handle_state");
  if (error || !data?.[0]) return null;
  return { handle: data[0].handle, canChangeAt: data[0].can_change_at };
}

/** 내가 보내 두고 아직 답을 못 받은 요청의 상대들.
 *  my_people() 은 이것을 모르므로, 연락처 줄은 새로고침하면 '요청' 을 다시 내밀었다 —
 *  이미 보냈는데 안 눌린 줄 알고 또 누르게 된다. RLS 가 from_user = 나 인 줄을 이미
 *  열어 주므로 함수를 새로 세우지 않고 그대로 읽는다. */
export async function fetchOutgoingRequests(): Promise<ID[]> {
  const sb = getSupabase();
  const me = myUidOf();
  if (!sb || !me) return [];
  try {
    const rows = await rest(`connection_requests?select=to_user&status=eq.pending&from_user=eq.${me}`);
    return (rows ?? []).map((r: any) => r.to_user as ID);
  } catch (e: any) { console.error("보낸 요청 조회 실패:", e?.message); return []; }
}

/** 나에게 온, 아직 답하지 않은 요청들. */
export async function fetchConnectionRequests(): Promise<ConnectionRequest[]> {
  const sb = getSupabase();
  if (!sb || !myUidOf()) return [];
  const { data, error } = await sb.rpc("my_connection_requests");
  if (error) { console.error("받은 요청 조회 실패:", error.message); return []; }
  return (data ?? []).map((r: any): ConnectionRequest => ({
    id: r.id,
    fromId: r.from_id,
    name: r.display_name,
    handle: r.handle,
    createdAt: r.created_at,
  }));
}

// 연결 해제(disconnect_from)와 확정 후 개인 일정 충돌(my_conflicts_with)은
// DB 함수만 세워 두고 화면을 붙이지 않았다 — 쓰지 않는 래퍼는 두지 않는다.
// 필요해지면 sb.rpc("disconnect_from" | "my_conflicts_with") 로 다시 감싸면 된다.

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

/** 답한다. 전원이 채워지면 서버가 그 자리에서 일정을 앉힌다(확정을 따로 부르지 않는다).
 *
 *  status 가 "conflict" 로 돌아올 수 있다 — 전원이 동의했지만, 그 사이 누군가 그 시간에
 *  다른 일정을 잡은 경우다. 서버가 확정 직전에 다시 확인하기 때문에 알 수 있는 일이고,
 *  이때 waiting 은 '겹치는 사람 수' 다. 확정은 일어나지 않았다. */
export type ProposalAnswer = {
  status: ProposalStatus | "conflict" | "error";
  eventId: ID | null;
  waiting: number;
  /** 막혔다면 왜 막혔는지. 콘솔에만 적어 두면 사용자에게는 '아무 일도 안 일어남' 으로 보인다. */
  message?: string;
};

export async function respondToProposal(
  proposalId: ID, response: "accepted" | "declined" | "alternative", alt?: string,
): Promise<ProposalAnswer> {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) {
    return { status: "error", eventId: null, waiting: 0, message: "아직 연결되지 않았어요. 잠시 뒤 다시 눌러 주세요." };
  }
  const { data, error } = await sb.rpc("respond_to_proposal", { p: proposalId, resp: response, alt: alt ?? null });
  if (error) {
    console.error("응답 실패:", error.message);
    return { status: "error", eventId: null, waiting: 0, message: humanRpcError(error) };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { status: "error", eventId: null, waiting: 0, message: "서버가 답을 주지 않았어요." };
  return { status: row.status as ProposalStatus | "conflict", eventId: row.event_id as string, waiting: row.waiting as number };
}

/** 서버가 준 말을 사람이 읽을 수 있게. 원인을 지우지 않고, 다만 겁주지 않는다. */
function humanRpcError(error: { message?: string; code?: string }): string {
  const m = error?.message ?? "";
  if (/ambiguous/i.test(m)) return "서버 함수가 예전 것이에요 — supabase/migrations 의 0007 을 적용해 주세요.";
  if (/does not exist|Could not find the function/i.test(m)) return "서버에 이 기능이 아직 없어요 — supabase/migrations 를 적용해 주세요.";
  if (/참여자가 아닙니다|42501|row-level security/i.test(m)) return "이 일정의 참여자가 아니라 답할 수 없어요.";
  return m || "잠시 문제가 있었어요.";
}

/** 지금 답을 기다리는 제안이 걸린 일정들.
 *  일정을 열어야만 제안을 읽으면, 열지 않은 사람에게는 제안이 없는 것과 같다. */
export async function fetchOpenProposalEvents(): Promise<ID[]> {
  const sb = getSupabase();
  if (!sb || !myUidOf()) return [];
  const { data, error } = await sb
    .from("schedule_proposals")
    .select("event_id")
    .in("status", ["proposed", "pending"]);
  if (error) return [];
  return Array.from(new Set((data ?? []).map((r: any) => String(r.event_id))));
}

// ── 대화의 기억 · 제안 (0010) ───────────────────────────
// 표를 직접 만지지 않는다. 서버의 함수만 부른다 — 권한 판정이 거기 있고,
// '사람이 확인해야 일정이 된다' 는 약속도 거기서 지켜진다.

export interface RemoteConversationState {
  roomId: ID;
  state: string;
  constraints: unknown[];
  proposed: string[];
  rejected: string[];
  confirmedAt: string | null;
  lastMessageId: string | null;
  version: number;
}

const toConvState = (row: Record<string, unknown> | null): RemoteConversationState | null =>
  row && row.room_id
    ? {
        roomId: String(row.room_id),
        state: String(row.state ?? "idle"),
        constraints: Array.isArray(row.constraints) ? row.constraints : [],
        proposed: (row.proposed as string[] | null) ?? [],
        rejected: (row.rejected as string[] | null) ?? [],
        confirmedAt: (row.confirmed_at as string | null) ?? null,
        lastMessageId: (row.last_message_id as string | null) ?? null,
        version: Number(row.version ?? 0),
      }
    : null;

/** 이 대화가 지금 어디쯤 와 있는가. 아직 아무 일도 없었으면 null. */
export async function fetchConversationState(roomId: ID): Promise<RemoteConversationState | null> {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return null;
  const { data, error } = await sb.rpc("get_conversation_state", { r: roomId });
  if (error) { console.error("대화 상태 읽기 실패:", error.message); return null; }
  return toConvState((Array.isArray(data) ? data[0] : data) ?? null);
}

/** 기억을 올린다.
 *
 *  version 을 함께 보내면 그 사이 다른 화면이 먼저 고쳤을 때 내 것은 들어가지 않는다.
 *  그때도 오류가 아니라 **지금 저장돼 있는 줄**이 돌아온다 — 돌아온 version 이 내가 보낸 것과
 *  다르면 내 것이 안 들어갔다는 뜻이고, 그때 할 일은 재시도가 아니라 다시 읽고 다시 판단하는 것이다.
 *  (어긋남을 40001 로 던지면 풀러가 자동 재시도해 영원히 같은 결과를 되풀이한다 — 실제로 매달렸다.) */
export async function saveConversationState(roomId: ID, patch: {
  state: string;
  constraints?: unknown[];
  proposed?: string[];
  rejected?: string[];
  confirmedAt?: string | null;
  lastMessageId?: string | null;
  version?: number | null;
}): Promise<RemoteConversationState | null> {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return null;
  const { data, error } = await sb.rpc("save_conversation_state", {
    r: roomId,
    p_state: patch.state,
    p_constraints: patch.constraints ?? [],
    p_proposed: patch.proposed ?? [],
    p_rejected: patch.rejected ?? [],
    p_confirmed_at: patch.confirmedAt ?? null,
    p_last_message_id: patch.lastMessageId ?? null,
    p_version: patch.version ?? null,
  });
  if (error) { console.error("대화 상태 저장 실패:", error.message); return null; }
  return toConvState((Array.isArray(data) ? data[0] : data) ?? null);
}

/** 화면에 띄운 제안을 남긴다. 같은 자리를 두 번 남기면 서버가 있던 것을 그대로 돌려준다. */
export async function recordSuggestion(roomId: ID, start: string, end: string, reason?: string, sourceMessageId?: ID) {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return null;
  const { data, error } = await sb.rpc("record_suggestion", {
    r: roomId, s: start, f: end, p_reason: reason ?? null, p_source_message_id: sourceMessageId ?? null,
  });
  if (error) { console.error("제안 기록 실패:", error.message); return null; }
  return (Array.isArray(data) ? data[0] : data) ?? null;
}

/** 둘 사이의 가능한 시간 — 일정이 아직 없을 때 쓴다.
 *
 *  돌아오는 것은 '이 시간대에 몇 명이 되는가' 뿐이다. 상대가 그때 무엇을 하는지도,
 *  정확히 언제 바쁜지도 넘어오지 않는다 — 판정은 서버 안에서 끝난다(§11).
 *  연결된 사이가 아니면 서버가 거절한다(§30). */
export async function pairSlots(peerId: ID, winStart: Date, winEnd: Date, durationMin = 60) {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return null;
  const { data, error } = await sb.rpc("pair_slots", {
    peer: peerId,
    win_start: winStart.toISOString(),
    win_end: winEnd.toISOString(),
    duration_min: durationMin,
  });
  if (error) { console.error("가능 시간 조회 실패:", error.message); return null; }
  return ((data ?? []) as { slot_start: string; slot_end: string; available_count: number; total_count: number }[]).map((r) => ({
    start: new Date(r.slot_start).toISOString(),
    end: new Date(r.slot_end).toISOString(),
    conflicts: Math.max(0, r.total_count - r.available_count),
    // 순위는 서버가 이미 매겼다 — 앞에 올수록 좋은 자리다.
    score: r.available_count * 100,
  }));
}

/** 이 방에서 이미 답이 끝난 제안들의 열쇠(`start|end`).
 *  새로 들어와도 넘긴 제안이 다시 떠오르지 않게 하는 데 쓴다. */
export async function fetchAnsweredSuggestions(roomId: ID): Promise<string[]> {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return [];
  const { data, error } = await sb
    .from("ai_suggestions")
    .select("start_at,end_at")
    .eq("room_id", roomId)
    .in("status", ["dismissed", "accepted"]);
  if (error || !data) return [];
  // 서버의 표기(+00:00)와 화면의 표기(Z)를 같은 모양으로 맞춘다 — 아니면 영영 안 맞는다.
  return data.map((r) => `${new Date(r.start_at).toISOString()}|${new Date(r.end_at).toISOString()}`);
}

/** 열쇠(`start|end`)로 그 방의 제안을 찾아 답한다. 못 찾으면 조용히 넘어간다. */
export async function answerSuggestionForRoom(roomId: ID, key: string, verdict: "accepted" | "dismissed") {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return null;
  const [start, end] = key.split("|");
  if (!start || !end) return null;
  const { data } = await sb
    .from("ai_suggestions")
    .select("id")
    .eq("room_id", roomId)
    .eq("start_at", start)
    .eq("end_at", end)
    .eq("status", "open")
    .maybeSingle();
  if (!data?.id) return null;
  return answerSuggestion(data.id as string, verdict);
}

/** 사람이 답했다 — 받아들였거나 넘겼거나. */
export async function answerSuggestion(suggestionId: ID, verdict: "accepted" | "dismissed") {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return null;
  const { data, error } = await sb.rpc("answer_suggestion", { sug: suggestionId, verdict });
  if (error) { console.error("제안 응답 실패:", error.message); return null; }
  return (Array.isArray(data) ? data[0] : data) ?? null;
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

/** 남긴 말을 고친다. 서버가 내 말인지 다시 확인한다(0008 RLS) — 화면에서 버튼을 숨기는 걸로 끝내지 않는다. */
export async function editMessage(messageId: ID, content: string): Promise<boolean> {
  const sb = getSupabase();
  const uid = await ensureUid();
  if (!sb || !uid) return false;
  const { error } = await sb
    .from("chat_messages")
    .update({ content })
    .eq("id", messageId)
    .eq("sender_id", uid);
  if (error) { console.error("메시지 수정 실패:", error.message); return false; }
  return true;
}

/** 지운다 — 행은 남고 내용만 비워진다(soft delete). 되돌릴 수 있게, 그러나 내용은 서버에도 남지 않게. */
export async function deleteMessage(messageId: ID): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !(await ensureUid())) return false;
  const { error } = await sb.rpc("delete_message", { m: messageId });
  if (error) { console.error("메시지 삭제 실패:", error.message); return false; }
  return true;
}

// ── 실시간 ──────────────────────────────────────────────

export type RemoteHandlers = {
  /** 새 말 · 고쳐진 말. 같은 id 면 그 자리를 갈아 끼운다. */
  onMessage: (m: ChatMessage) => void;
  /** 지워진 말 — 그 자리를 걷는다. */
  onMessageGone?: (id: ID) => void;
  onEventChange: () => void;
  /** 방이 새로 생겼다 — 아직 내 손에 없는 방이면 목록부터 받아야 그 말이 보인다. */
  onRoomChange?: () => void;
  /** 그 일정의 제안이 열리거나 누군가 답했다. */
  onProposalChange?: (eventId: ID | null) => void;
  /** 소켓이 붙었는가. 끊긴 줄 모르고 조용히 있는 것이 이 화면의 가장 나쁜 상태다. */
  onStatus?: (live: boolean, detail?: string) => void;
};

/** 채널 이름은 매번 다르게 짓는다.
 *  같은 이름을 두 번 쓰면 realtime-js 가 **이미 있는 채널 인스턴스를 그대로 돌려주고**
 *  (RealtimeClient.channel — 있으면 새로 만들지 않는다), 그 위에서 subscribe() 를 다시 불러도
 *  이미 join 된 채널이라 조용한 no-op 이 된다. 그 사이 앞선 정리(removeChannel)가 도착하면
 *  방금 '구독했다' 고 믿은 채널이 그대로 떠나 버린다 —
 *  **화면은 멀쩡한데 실시간만 죽은** 상태. 상대의 말이 새로고침해야 보이던 이유가 이것이었다. */
const TOPIC_KEY = "__comein_topic_n__";
const nextTopic = (tag: string) => {
  const h = globalThis as unknown as { [TOPIC_KEY]?: number };
  h[TOPIC_KEY] = (h[TOPIC_KEY] ?? 0) + 1;
  return `comein-${tag}-${myUidOf() ?? "anon"}-${h[TOPIC_KEY]}`;
};

/** 끊기면 스스로 다시 붙는 채널 하나.
 *  소켓은 노트북이 잠들거나 와이파이가 바뀌기만 해도 끊긴다. 그때 아무것도 하지 않으면
 *  앱은 '조용한 화면' 이 된다 — 오지 않는 말을 기다리는. */
function keepChannel(
  tag: string,
  bind: (ch: RealtimeChannel) => RealtimeChannel,
  onStatus?: (live: boolean, detail?: string) => void,
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  let ch: RealtimeChannel | null = null;
  let closed = false;
  let attempt = 0;
  let retry: ReturnType<typeof setTimeout> | null = null;

  const open = () => {
    if (closed) return;
    const c = bind(sb.channel(nextTopic(tag))).subscribe((status, err) => {
      if (closed) return;
      if (status === "SUBSCRIBED") { attempt = 0; onStatus?.(true); return; }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        onStatus?.(false, err?.message ?? status);
        // 1s → 2s → 4s … 최대 30s. 서버가 힘들 때 더 세게 두드리지 않는다.
        const wait = Math.min(30_000, 1_000 * 2 ** attempt++);
        void sb.removeChannel(c);
        if (retry) clearTimeout(retry);
        retry = setTimeout(open, wait);
      }
    });
    ch = c;
  };
  open();

  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    if (ch) void sb.removeChannel(ch);
  };
}

/** 일정·참여자·메시지·제안의 변화를 듣는다.
 *  메시지는 낱개로 반영하고(대화는 흐름이라 통째로 갈아끼우면 튄다),
 *  일정·참여자는 관계가 얽혀 있어 스냅샷을 다시 받는 편이 안전하다.
 *
 *  채널을 둘로 나눈 이유: 제안(0003)은 나중에 올린 마이그레이션이다. 아직 안 올린 프로젝트에서
 *  그 표를 함께 구독하면 채널 하나가 통째로 오류가 되어 **대화까지 같이 죽는다.**
 *  덜 중요한 것이 더 중요한 것을 끌고 내려가지 않게 갈라 둔다. */
export function subscribeRemote(handlers: RemoteHandlers): (() => void) | null {
  const sb = getSupabase();
  if (!sb || !myUidOf()) return null;

  const stopCore = keepChannel("core", (ch) => ch
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
      handlers.onMessage(toMessage(payload.new));
    })
    // 고침과 지움도 같은 길로 온다 — 상대 화면에서 바뀐 말이 내 화면에서도 바뀌어야 한다.
    // (지움은 hard delete 가 아니라 update 라서 UPDATE 로 도착한다.)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages" }, (payload) => {
      const m: any = payload.new;
      if (m.deleted_at) handlers.onMessageGone?.(m.id);
      else handlers.onMessage(toMessage(m));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => handlers.onEventChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "event_participants" }, () => handlers.onEventChange()),
    (live, detail) => {
      handlers.onStatus?.(live, detail);
      // 끊겨 있던 동안 놓친 것은 어떤 소켓으로도 오지 않는다 — 붙자마자 한 번 맞춘다.
      if (live) handlers.onEventChange();
    },
  );

  // 방이 생기는 순간 — 첫 1:1 대화는 방부터 생기고 말이 뒤따른다.
  // (0015 이전 프로젝트라면 이 표가 publication 에 없어 조용히 아무것도 오지 않는다.
  //  그때를 대비해 화면 쪽에서도 '모르는 방의 말' 을 보면 목록을 다시 받는다.)
  const stopRooms = keepChannel("rooms", (ch) => ch
    .on("postgres_changes", { event: "*", schema: "public", table: "chat_room_members" }, () => handlers.onRoomChange?.())
    .on("postgres_changes", { event: "*", schema: "public", table: "chat_rooms" }, () => handlers.onRoomChange?.()));

  // 제안과 그 답 — '동의하시겠어요' 는 상대 화면에도 스스로 서야 한다(0003 §5).
  const stopProps = keepChannel("proposals", (ch) => ch
    .on("postgres_changes", { event: "*", schema: "public", table: "schedule_proposals" }, (payload) => {
      const row: any = payload.new ?? payload.old;
      handlers.onProposalChange?.(row?.event_id ?? null);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "schedule_proposal_participants" }, () => {
      handlers.onProposalChange?.(null);
    }));

  // 화면이 돌아오거나 네트워크가 살아나면 소켓 상태와 무관하게 한 번 맞춘다.
  // 다만 창을 옮겨 다닐 때마다 서버를 부르지는 않는다 — 15초 안의 재확인은 흘려보낸다.
  let lastWake = 0;
  const wake = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    const t = Date.now();
    if (t - lastWake < 15_000) return;
    lastWake = t;
    handlers.onEventChange();
    handlers.onRoomChange?.();
    handlers.onProposalChange?.(null);
  };
  if (typeof window !== "undefined") {
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
  }

  return () => {
    if (typeof window !== "undefined") {
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
    }
    stopCore(); stopRooms(); stopProps();
  };
}

export const remoteReady = () => isSupabaseConfigured && !!myUidOf();
