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

const { data: profiles, error } = await sb
  .from("profiles")
  .select("handle, display_name")
  .in("id", [demoId, ...ids]);
if (error) throw error;

console.log("\n심은 사람들 (핸들은 트리거가 이메일 앞부분에서 짓는다)");
for (const p of profiles) console.log(`  ${p.display_name} · @${p.handle}`);
console.log(`\n데모 계정으로 로그인: ${DEMO_EMAIL}`);
console.log("사람 탭 → 연락처에 위 이름들이 보이면 된 것이다.");
