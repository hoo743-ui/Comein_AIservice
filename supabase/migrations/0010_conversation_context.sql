-- Comein · 대화가 기억을 갖는다 (Conversation Context)
--
-- 지금까지 대화의 상태는 화면 안에서만 살았다. 새로고침하면 사라지고, 상대의 화면과도
-- 어긋난다. 그래서 A 가 거절한 15시를 B 의 화면이 다시 권하는 일이 생긴다.
-- 상태를 여기 앉힌다 — 한 대화에 하나, 그 방의 사람들이 같은 것을 본다.
--
-- 이 파일이 지키는 약속 셋:
--
--   ① 같은 제안은 두 번 만들어지지 않는다.  나중에 지우는 대신 들어올 수 없게 한다(§28).
--   ② 확정 직전에 다시 확인한다.            클라이언트가 5분 전에 계산한 '가능' 을 믿지 않는다(§29).
--   ③ 남의 일정 내용은 여기서도 나가지 않는다. 나가는 것은 available / busy / unknown 뿐(§11·§31).
--
-- 기존 것을 지우지 않는다. schedule_proposals(0003) 는 그대로 쓰고,
-- 이 파일은 그 위에 '대화의 기억' 과 '출처' 를 얹는다(§21·§44).
--
-- 적용: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run. 여러 번 실행해도 안전하다.

-- ─────────────────────────────────────────────────────────
-- 1. 대화의 기억
-- ─────────────────────────────────────────────────────────
-- 한 방에 한 줄. 화면(lib/conversation/state.ts)의 ConversationMemory 와 같은 모양이다.
-- 상태 값도 그쪽 유니온과 글자 그대로 같게 둔다 — 두 곳이 다른 말을 쓰면 반드시 어긋난다.

create table if not exists public.conversation_states (
  room_id        uuid primary key references public.chat_rooms (id) on delete cascade,
  state          text not null default 'idle'
                 check (state in ('idle', 'scheduling_detected', 'collecting_preferences',
                                  'time_proposed', 'confirmed', 'cancelled')),
  -- 대화에서 쌓인 시간 조건. [{kind, at, text, hasDay}, …]
  constraints    jsonb not null default '[]'::jsonb,
  -- 상에 올려 본 시각 · 누군가 아니라고 한 시각(ISO). 다시 권하지 않기 위한 기억이다(§8).
  proposed       timestamptz[] not null default '{}',
  rejected       timestamptz[] not null default '{}',
  confirmed_at   timestamptz,
  -- 어디까지 읽었는가. 같은 말을 두 번 분석하지 않는다(§28·§34).
  last_message_id uuid references public.chat_messages (id) on delete set null,
  -- 동시에 두 화면이 같은 줄을 고칠 때 나중 것이 앞의 것을 덮지 않도록(§29).
  version        int not null default 0,
  updated_at     timestamptz not null default now()
);

create index if not exists conversation_states_updated_idx
  on public.conversation_states (updated_at desc);

-- ─────────────────────────────────────────────────────────
-- 2. AI 가 권한 것
-- ─────────────────────────────────────────────────────────
-- 화면에 띄웠던 제안을 남긴다. 남기는 이유는 두 가지다:
--   같은 것을 두 번 띄우지 않기 위해, 그리고 얼마나 받아들여지는지 보기 위해(§35).
-- 사람이 누르기 전까지 이것은 아무것도 아니다 — 일정을 만들지 않는다(§15).

create table if not exists public.ai_suggestions (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.chat_rooms (id) on delete cascade,
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  -- 왜 이 자리를 권했는지 한 줄. 남의 일정 내용을 적지 않는다("2명의 일정과 겹쳐요" 까지).
  reason      text,
  status      text not null default 'open'
              check (status in ('open', 'dismissed', 'accepted', 'superseded')),
  -- 어느 말에서 비롯됐는가 — 되짚어 볼 수 있게.
  source_message_id uuid references public.chat_messages (id) on delete set null,
  created_at  timestamptz not null default now(),
  answered_at timestamptz,
  constraint suggestion_time_order check (end_at > start_at)
);

-- ① 같은 방·같은 시각의 제안은 살아 있는 동안 하나뿐이다.
--    (재시도나 두 탭이 같은 것을 두 번 만들어도 두 번째는 들어오지 못한다.)
create unique index if not exists suggestions_one_per_slot
  on public.ai_suggestions (room_id, start_at, end_at)
  where status = 'open';

create index if not exists suggestions_room_idx
  on public.ai_suggestions (room_id, created_at desc);

-- ─────────────────────────────────────────────────────────
-- 3. 이 일정은 어디서 왔는가
-- ─────────────────────────────────────────────────────────
-- 대화에서 생긴 일정은 그 대화를 기억한다(§16). 화면에 크게 내걸지는 않는다 —
-- 필요할 때 "이 일정은 어떤 대화에서 나왔더라" 를 되짚을 수 있으면 그걸로 족하다.

create table if not exists public.event_sources (
  event_id   uuid primary key references public.events (id) on delete cascade,
  room_id    uuid references public.chat_rooms (id) on delete set null,
  message_id uuid references public.chat_messages (id) on delete set null,
  -- 사람이 눌러서 생겼는가, 제안을 받아 생겼는가.
  origin     text not null default 'suggestion'
             check (origin in ('suggestion', 'manual', 'capture')),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────
-- 4. 대화의 기억을 읽고 쓰는 창구
-- ─────────────────────────────────────────────────────────
-- 표를 직접 열어 주지 않는다. 방 사람만 자기 방의 기억을 만질 수 있어야 하고,
-- 그 판정을 정책 한 줄에 맡기는 것보다 함수 안에서 끝내는 편이 분명하다.

create or replace function public.get_conversation_state(r uuid)
returns public.conversation_states
language plpgsql stable security definer set search_path = public as $$
declare row public.conversation_states;
begin
  if not public.can_access_room(r) then
    raise exception '이 대화의 참여자가 아닙니다' using errcode = '42501';
  end if;
  select * into row from public.conversation_states where room_id = r;
  return row;   -- 없으면 null — 아직 아무 일도 없었다는 뜻이다
end $$;

/* 기억을 올린다. version 이 어긋나면 거절한다 — 다른 화면이 먼저 고쳤다는 뜻이고,
   그때는 덮어쓰는 대신 다시 읽는 편이 맞다(§29). */
create or replace function public.save_conversation_state(
  r uuid,
  p_state text,
  p_constraints jsonb default '[]'::jsonb,
  p_proposed timestamptz[] default '{}',
  p_rejected timestamptz[] default '{}',
  p_confirmed_at timestamptz default null,
  p_last_message_id uuid default null,
  p_version int default null
)
returns public.conversation_states
language plpgsql security definer set search_path = public as $$
declare row public.conversation_states;
begin
  if not public.can_access_room(r) then
    raise exception '이 대화의 참여자가 아닙니다' using errcode = '42501';
  end if;
  if p_state not in ('idle', 'scheduling_detected', 'collecting_preferences',
                     'time_proposed', 'confirmed', 'cancelled') then
    raise exception '알 수 없는 대화 상태: %', p_state;
  end if;

  insert into public.conversation_states as cs
    (room_id, state, constraints, proposed, rejected, confirmed_at, last_message_id, version, updated_at)
  values
    (r, p_state, coalesce(p_constraints, '[]'::jsonb), coalesce(p_proposed, '{}'), coalesce(p_rejected, '{}'),
     p_confirmed_at, p_last_message_id, 1, now())
  on conflict (room_id) do update
    set state           = excluded.state,
        constraints     = excluded.constraints,
        proposed        = excluded.proposed,
        rejected        = excluded.rejected,
        confirmed_at    = excluded.confirmed_at,
        last_message_id = excluded.last_message_id,
        version         = cs.version + 1,
        updated_at      = now()
    where p_version is null or cs.version = p_version
  returning * into row;

  if row.room_id is null then
    raise exception '대화 상태가 그새 바뀌었습니다 — 다시 읽어 주세요' using errcode = '40001';
  end if;
  return row;
end $$;

/* 제안을 남긴다. 같은 자리를 두 번 남기려 하면 이미 있는 것을 그대로 돌려준다 —
   실패로 만들지 않는다. 재시도는 흔한 일이고, 흔한 일이 오류가 되면 안 된다(§28). */
create or replace function public.record_suggestion(
  r uuid,
  s timestamptz,
  f timestamptz,
  p_reason text default null,
  p_source_message_id uuid default null
)
returns public.ai_suggestions
language plpgsql security definer set search_path = public as $$
declare row public.ai_suggestions;
begin
  if not public.can_access_room(r) then
    raise exception '이 대화의 참여자가 아닙니다' using errcode = '42501';
  end if;
  if f <= s then raise exception '끝이 시작보다 앞섭니다'; end if;

  insert into public.ai_suggestions (room_id, start_at, end_at, reason, source_message_id)
  values (r, s, f, p_reason, p_source_message_id)
  on conflict do nothing
  returning * into row;

  if row.id is null then
    select * into row from public.ai_suggestions
     where room_id = r and start_at = s and end_at = f and status = 'open'
     limit 1;
  end if;
  return row;
end $$;

/* 사람이 답했다. 받아들였거나(accepted) 넘겼거나(dismissed). */
create or replace function public.answer_suggestion(sug uuid, verdict text)
returns public.ai_suggestions
language plpgsql security definer set search_path = public as $$
declare row public.ai_suggestions;
begin
  select * into row from public.ai_suggestions where id = sug;
  if row.id is null then raise exception '없는 제안입니다'; end if;
  if not public.can_access_room(row.room_id) then
    raise exception '이 대화의 참여자가 아닙니다' using errcode = '42501';
  end if;
  if verdict not in ('accepted', 'dismissed') then
    raise exception '알 수 없는 응답: %', verdict;
  end if;

  update public.ai_suggestions
     set status = verdict, answered_at = now()
   where id = sug
  returning * into row;
  return row;
end $$;

-- ─────────────────────────────────────────────────────────
-- 5. 확정 직전에 한 번 더 본다 (§29)
-- ─────────────────────────────────────────────────────────
-- 0007 의 respond_to_proposal 을 그대로 두되, 마지막 한 걸음 앞에 확인을 넣는다.
-- 클라이언트가 5분 전에 계산한 '모두 가능' 은 지금의 사실이 아닐 수 있다.
-- 그 사이 누군가 그 시간에 다른 일정을 잡았다면 확정하지 않고 'conflict' 로 돌려보낸다.
--
-- 바뀐 것은 이 확인 한 덩어리뿐이다. 나머지 흐름·반환 모양·잠금은 0007 그대로다.

create or replace function public.respond_to_proposal(
  p uuid,
  resp text,
  alt timestamptz default null
)
returns table (status text, event_id uuid, waiting int)
language plpgsql security definer set search_path = public as $$
declare
  pr public.schedule_proposals;
  left_n int;
  busy_n int;
begin
  select * into pr from public.schedule_proposals where id = p;
  if pr.id is null then raise exception '없는 제안입니다'; end if;
  if not public.is_event_participant(pr.event_id) then
    raise exception '이 일정의 참여자가 아닙니다' using errcode = '42501';
  end if;
  if resp not in ('accepted', 'declined', 'alternative') then
    raise exception '알 수 없는 응답: %', resp;
  end if;

  insert into public.schedule_proposal_participants (proposal_id, user_id, response, alt_start_at, responded_at)
  values (p, auth.uid(), resp, alt, now())
  on conflict (proposal_id, user_id) do update
    set response = excluded.response, alt_start_at = excluded.alt_start_at, responded_at = now();

  -- 여기서부터 한 번에 한 사람만 지나간다.
  select * into pr from public.schedule_proposals where id = p for update;

  if pr.status = 'confirmed' then
    return query select pr.status, pr.event_id, 0; return;
  end if;

  -- 한 명이라도 거절하면 자동으로 확정하지 않는다(§8). 일정은 서 있는 채로 둔다.
  if resp in ('declined', 'alternative') then
    update public.schedule_proposals sp2 set status = 'pending' where sp2.id = p;
    return query select 'pending'::text, pr.event_id, -1; return;
  end if;

  select count(*) into left_n
  from public.event_participants ep
  left join public.schedule_proposal_participants sp
         on sp.proposal_id = p and sp.user_id = ep.user_id
  where ep.event_id = pr.event_id
    and coalesce(sp.response, 'pending') <> 'accepted';

  if left_n = 0 then
    -- ★ 마지막 확인 — 그 사이 누가 그 시간에 다른 일정을 잡지 않았는가.
    --   여기서도 '무엇을 하는지' 는 세지 않는다. 겹치는 사람이 몇인지만 센다(§11).
    select count(*) into busy_n
      from public.availability_for(pr.event_id, pr.proposed_start_at, pr.proposed_end_at) a
     where a.state = 'busy';

    if busy_n > 0 then
      -- 확정하지 않고 제안을 열어 둔 채로 돌려보낸다. 사람이 다시 정하면 된다.
      update public.schedule_proposals sp2 set status = 'pending' where sp2.id = p;
      return query select 'conflict'::text, pr.event_id, busy_n;
      return;
    end if;

    -- 새 일정을 만들지 않는다. 서 있던 일정이 시각을 얻고 앉는다.
    update public.events ev
       set start_at = pr.proposed_start_at,
           end_at   = pr.proposed_end_at,
           title    = coalesce(pr.title, ev.title),
           status   = 'confirmed'
     where ev.id = pr.event_id;

    update public.schedule_proposals sp2 set status = 'confirmed' where sp2.id = p;
    update public.event_participants ep2 set status = 'accepted' where ep2.event_id = pr.event_id;

    -- 이 일정이 대화에서 왔다면 그 사실을 남긴다(§16). 방을 못 찾으면 조용히 넘어간다.
    insert into public.event_sources (event_id, room_id, origin)
    select pr.event_id, cr.id, 'suggestion'
      from public.chat_rooms cr
     where cr.event_id = pr.event_id
     limit 1
    on conflict (event_id) do nothing;

    return query select 'confirmed'::text, pr.event_id, 0;
  else
    update public.schedule_proposals sp2 set status = 'pending' where sp2.id = p;
    return query select 'pending'::text, pr.event_id, left_n;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────
-- 6. RLS — 방 사람만, 자기 방의 것만
-- ─────────────────────────────────────────────────────────

alter table public.conversation_states enable row level security;
alter table public.ai_suggestions      enable row level security;
alter table public.event_sources       enable row level security;

drop policy if exists conv_states_select on public.conversation_states;
create policy conv_states_select on public.conversation_states for select
  using (public.can_access_room(room_id));

drop policy if exists suggestions_select on public.ai_suggestions;
create policy suggestions_select on public.ai_suggestions for select
  using (public.can_access_room(room_id));

drop policy if exists event_sources_select on public.event_sources;
create policy event_sources_select on public.event_sources for select
  using (public.is_event_participant(event_id));

-- 쓰기는 정책으로 열지 않는다. 위의 함수들만이 이 표들을 고친다 —
-- 아무나 state 를 'confirmed' 로, suggestion 을 'accepted' 로 적을 수 있으면
-- '사람이 확인해야 일정이 된다' 는 약속이 약속이 아니게 된다(§15·§30).

-- ─────────────────────────────────────────────────────────
-- 7. 권한 — 익명에게는 아무것도 주지 않는다
-- ─────────────────────────────────────────────────────────

revoke all on function public.get_conversation_state(uuid) from public, anon;
revoke all on function public.save_conversation_state(uuid, text, jsonb, timestamptz[], timestamptz[], timestamptz, uuid, int) from public, anon;
revoke all on function public.record_suggestion(uuid, timestamptz, timestamptz, text, uuid) from public, anon;
revoke all on function public.answer_suggestion(uuid, text) from public, anon;
revoke all on function public.respond_to_proposal(uuid, text, timestamptz) from public, anon;

grant execute on function public.get_conversation_state(uuid) to authenticated;
grant execute on function public.save_conversation_state(uuid, text, jsonb, timestamptz[], timestamptz[], timestamptz, uuid, int) to authenticated;
grant execute on function public.record_suggestion(uuid, timestamptz, timestamptz, text, uuid) to authenticated;
grant execute on function public.answer_suggestion(uuid, text) to authenticated;
grant execute on function public.respond_to_proposal(uuid, text, timestamptz) to authenticated;

-- ─────────────────────────────────────────────────────────
-- 8. Realtime — 상대의 화면도 같은 기억을 본다
-- ─────────────────────────────────────────────────────────

alter table public.conversation_states replica identity full;
alter table public.ai_suggestions      replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.conversation_states;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.ai_suggestions;
exception when duplicate_object then null; end $$;
