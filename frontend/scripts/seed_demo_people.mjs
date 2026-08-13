// 데모용 사람 심기 — 팀에게 보여 줄 계정 하나와, 그 계정이 아는 사람 몇을 만든다.
//
// 왜 스크립트인가. 화면의 '사람' 은 지어낼 수 없다. seedContacts 는 일부러 비어 있고
// (store.ts: "사람은 지어낼 수 없다"), 로그인하면 그 자리는 서버가 준 진짜 계정으로
// 통째로 갈린다(my_people RPC → profiles + connections). 그래서 코드에 가짜 이름을
// 적어 넣는 방법은 로그인하는 순간 사라진다. 진짜 계정을 만들어 이어 주는 수밖에 없다.
//
// 실행 (frontend 폴더에서):
//   SUPABASE_URL=https://<project>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role 키> \
//   DEMO_EMAIL=demo@comein.app DEMO_PASSWORD=<데모 비번> \
//   node scripts/seed_demo_people.mjs
//
// service_role 키는 RLS 를 전부 우회한다. 로컬 셸에서만 쓰고, 코드·커밋·프론트 env 에
// 절대 남기지 않는다(docs/24 §11.9 — 예전에 한 번 노출된 적이 있다).
//
// 두 번 돌려도 안전하다: 이미 있는 계정은 건너뛰고, 연결은 upsert 한다.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_EMAIL = process.env.DEMO_EMAIL;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;

if (!URL || !KEY || !DEMO_EMAIL || !DEMO_PASSWORD) {
  console.error("SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY · DEMO_EMAIL · DEMO_PASSWORD 가 모두 필요하다.");
  process.exit(1);
}

// 데모에 세울 사람들. 이름은 사람처럼, 소속은 짧게 — 화면에서 이름과 핸들만 보인다.
// 비밀번호는 데모 계정과 같은 것을 쓴다(팀이 서로 바꿔 들어가 볼 수 있게).
const PEOPLE = [
  { email: "demo.jiwon@comein.app", name: "김지원" },
  { email: "demo.minsu@comein.app", name: "이민수" },
  { email: "demo.haneul@comein.app", name: "박하늘" },
  { email: "demo.seoyeon@comein.app", name: "정서연" },
  { email: "demo.taeho@comein.app", name: "최태호" },
];

const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

/** 이미 있는 계정인지 이메일로 찾는다 — 두 번 돌려도 새로 만들지 않게. */
async function findByEmail(email) {
  // admin.listUsers 는 페이지 단위다. 데모 규모(수십)에서는 첫 페이지로 충분하다.
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function ensureUser(email, password, name) {
  const existing = await findByEmail(email);
  if (existing) {
    console.log(`  이미 있음 · ${email} (${existing.id})`);
    return existing.id;
  }
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    // 데모 계정은 받을 메일함이 없다 — 확인 절차를 건너뛰지 않으면 로그인 자체가 막힌다.
    email_confirm: true,
    user_metadata: name ? { name } : undefined,
  });
  if (error) throw error;
  console.log(`  만듦     · ${email} (${data.user.id})`);
  return data.user.id;
}

/** 서로 아는 사이로 만든다. 한쪽만 넣으면 한쪽 화면에만 보인다(connections 는 방향이 있다). */
async function connect(a, b) {
  const { error } = await sb
    .from("connections")
    .upsert([{ user_id: a, peer_id: b }, { user_id: b, peer_id: a }], { onConflict: "user_id,peer_id" });
  if (error) throw error;
}

console.log("데모 계정");
const demoId = await ensureUser(DEMO_EMAIL, DEMO_PASSWORD, "데모");

console.log("함께 보일 사람들");
const ids = [];
for (const p of PEOPLE) ids.push(await ensureUser(p.email, DEMO_PASSWORD, p.name));

console.log("잇는 중");
for (const id of ids) await connect(demoId, id);
// 서로도 이어 둔다 — 팀원이 다른 계정으로 들어가 봐도 사람 탭이 비어 있지 않게.
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) await connect(ids[i], ids[j]);

// ── 여기서부터 'AI 가 일할 거리' 를 심는다 ────────────────────────────────
//
// 사람만 있으면 화면은 채워지지만 AI 는 할 일이 없다. 세 가지가 더 필요하다:
//   ① 함께 보는 일정 하나 — 그 방이 대화와 시간표가 서는 자리다
//   ② 그 방의 대화 — 요약(recap·decided·pending·next)이 뽑아 갈 재료
//   ③ 참여자 각자의 바쁜 시간 — 이게 없으면 '몇 명 가능' 이 전부 같은 값이라
//      후보 시각을 계산해도 볼 것이 없다(pair_slots 는 이 구간들을 뺀 자리를 찾는다)

/** 오늘로부터 n 일 뒤의 시각을, 한국 시각으로 못 박아 ISO 로. 서버가 어디서 돌든 같은 값이다. */
function kst(daysAhead, hh, mm = 0) {
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000); // UTC → KST
  const y = nowKst.getUTCFullYear();
  const m = nowKst.getUTCMonth();
  const d = nowKst.getUTCDate() + daysAhead;
  const at = new Date(Date.UTC(y, m, d, hh, mm));
  const p = (n) => String(n).padStart(2, "0");
  return `${at.getUTCFullYear()}-${p(at.getUTCMonth() + 1)}-${p(at.getUTCDate())}T${p(hh)}:${p(mm)}:00+09:00`;
}

/** 같은 사람의 같은 제목·같은 시작이면 이미 심은 것으로 본다(두 번 돌려도 늘지 않게). */
async function ensureEvent(ownerId, title, startISO, endISO, extra = {}) {
  const found = await sb
    .from("events")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("title", title)
    .eq("start_at", startISO)
    .maybeSingle();
  if (found.data?.id) return found.data.id;

  const { data, error } = await sb
    .from("events")
    .insert({ owner_id: ownerId, title, start_at: startISO, end_at: endISO, status: "confirmed", ...extra })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

console.log("함께 보는 일정");
// 내일 15:00 — 아무도 새벽에 만나지 않는다. 오후 한복판이라 앞뒤로 후보가 생긴다.
const eventId = await ensureEvent(demoId, "8월 스프린트 리뷰", kst(1, 15), kst(1, 16), {
  location: "AI관 305",
  description: "이번 스프린트에서 한 것과, 다음 두 주에 할 것.",
});
// 참여자를 넣으면 트리거가 그 방의 멤버로도 넣어 준다(0001 participant_to_member).
const guests = ids.slice(0, 3); // 김지원 · 이민수 · 박하늘
await sb
  .from("event_participants")
  .upsert(
    guests.map((id) => ({ event_id: eventId, user_id: id, role: "participant", status: "accepted" })),
    { onConflict: "event_id,user_id" },
  )
  .throwOnError();
console.log(`  8월 스프린트 리뷰 · 참여자 ${guests.length + 1}명`);

console.log("각자의 바쁜 시간 (AI 가 빈자리를 찾을 재료)");
// 일부러 어긋나게 깐다 — 셋 다 되는 자리, 둘만 되는 자리, 아무도 안 되는 자리가 섞이도록.
const busy = [
  [guests[0], "전공 수업", kst(1, 10), kst(1, 12)],
  [guests[0], "동아리 회의", kst(1, 17), kst(1, 18)],
  [guests[1], "인턴 면접", kst(1, 13), kst(1, 14, 30)],
  [guests[1], "스터디", kst(2, 10), kst(2, 12)],
  [guests[2], "연구실 미팅", kst(1, 11), kst(1, 12)],
  [guests[2], "알바", kst(1, 18), kst(1, 22)],
  [demoId, "교수님 면담", kst(2, 14), kst(2, 15)],
];
for (const [uid, title, s, e] of busy) await ensureEvent(uid, title, s, e);
console.log(`  ${busy.length}건`);

// ── 대화는 심지 않는다 ────────────────────────────────────────────────
//
// 한때 여기서 아홉 줄을 심었다. 요약이 네 갈래(recap·decided·pending·next)로
// 갈려 나오도록 '정한 것 한 줄 · 못 정한 것 한 줄 · 할 일 한 줄' 을 일부러 섞어서.
// 그건 시험 문제를 보고 답을 심어 둔 것이다 — 그렇게 만든 요약이 잘 나와도
// **AI 가 잘하는지는 하나도 증명되지 않는다.**
//
// 대화는 데모하는 자리에서 직접 친다. 방은 비어 있는 채로 둔다.
// (요약을 눌러 볼 재료가 급히 필요하면 SEED_CHAT=1 로 몇 줄 넣을 수 있게 해 뒀다.
//  그 줄들은 일부러 네 갈래에 맞추지 않았다 — 그래야 나온 요약이 진짜 결과다.)
const room = await sb.from("chat_rooms").select("id").eq("event_id", eventId).single();
if (room.error) throw room.error;

if (process.env.SEED_CHAT === "1") {
  const existing = await sb.from("chat_messages").select("id").eq("room_id", room.data.id).limit(1);
  if (existing.data?.length) {
    console.log("대화: 이미 있다 — 건너뛴다");
  } else {
    // 그냥 사람들이 주고받을 법한 말. 무엇이 요약될지는 모델이 정한다.
    const lines = [
      [0, "내일 리뷰 몇 시에 시작하죠?"],
      [1, "저는 3시라고 알고 있었어요."],
      [2, "아 저는 4시로 알고 있었는데요."],
      [0, "그럼 3시로 하고, 늦는 사람은 중간에 들어오는 걸로 해요."],
      [3, "네 저는 그때 괜찮습니다."],
      [1, "자료는 어디에 올리면 되나요?"],
      [2, "예전에 쓰던 폴더에 올려두면 될 것 같아요."],
    ];
    const senders = [demoId, ...guests];
    const base = Date.now() - lines.length * 4 * 60 * 1000;
    await sb
      .from("chat_messages")
      .insert(
        lines.map(([who, content], i) => ({
          room_id: room.data.id,
          sender_id: senders[who],
          content,
          created_at: new Date(base + i * 4 * 60 * 1000).toISOString(),
        })),
      )
      .throwOnError();
    console.log(`대화: ${lines.length}줄 (SEED_CHAT=1)`);
  }
} else {
  console.log("대화: 심지 않음 — 데모에서 직접 친다");
}

const { data: profiles, error } = await sb
  .from("profiles")
  .select("handle, display_name")
  .in("id", [demoId, ...ids]);
if (error) throw error;

console.log("\n심은 사람들 (핸들은 트리거가 이메일 앞부분에서 짓는다)");
for (const p of profiles) console.log(`  ${p.display_name} · @${p.handle}`);
console.log(`\n데모 계정으로 로그인: ${DEMO_EMAIL}`);
console.log(`
심어 둔 것은 '상황' 뿐이다 — 사람, 함께 보는 일정, 각자의 바쁜 시간.
AI 가 만들어 낼 것(요약·후보 시각·제안)은 하나도 심지 않았다. 그건 자리에서 돌려 봐야 한다.

돌려 볼 곳:
  방을 열고 대화를 몇 줄 친다 → '요약' 을 누른다
      무엇이 정해진 것이고 무엇이 남았는지는 그때 모델이 가른다
  오른쪽 '함께하는 일정' 시간표
      참여자들의 바쁜 시간이 겹쳐 보인다. 빈칸을 누르면 그 시각을 제안하고,
      전원이 동의하기 전까지 일정은 pending 으로 남는다
  캡처 바
      "내일 3시 회의" → 일정이 선다 / "회의 잡아줘" → 시각을 되묻는다`);
