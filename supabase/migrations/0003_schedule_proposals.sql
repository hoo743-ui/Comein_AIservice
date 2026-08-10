-- Comein · 대화에서 일정이 정해지는 길
--
--   대화 → AI 가 의도를 읽음 → 후보 시각 → 각자의 달력과 대조 → 제안 → 전원 동의 → 확정
--
-- 여기서 지켜야 하는 약속이 하나 있고, 그게 이 파일의 이유다.
--
--   "저 사람이 그 시간에 되는지는 알되, 그때 무엇을 하는지는 모른다."
--
-- 그래서 충돌 판정을 클라이언트로 내보내지 않는다. 남의 일정을 읽어야 판정할 수 있는데,
-- 읽게 해 주면 그 순간 §11 이 무너진다. 판정은 이 안에서 끝내고 결론만 내보낸다.
--   나가는 것:   available / busy / unknown
--   나가지 않는 것: 제목 · 장소 · 설명 · 메모 · 그 사람이 정확히 언제 바쁜지
--
-- 그리고 일정을 새로 만들지 않는다. 자리(일정)는 이미 서 있고 — 대화방은 일정 하나에
-- 매여 있으므로 — 제안이 하는 일은 서 있던 일정을 앉히는 것이다.
-- 그래서 "동시에 여러 명이 동의해도 Event 가 여러 개 생기는" 문제는 애초에 생기지 않는다.
--
-- 적용: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run

-- ─────────────────────────────────────────────────────────
-- 1. 제안 · 응답
-- ─────────────────────────────────────────────────────────

create table if not exists public.schedule_proposals (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.events (id) on delete cascade,
  created_by         uuid not null references auth.users (id)    on delete cascade,
  title              text,
  proposed_start_at  timestamptz not null,
  proposed_end_at    timestamptz not null,
  -- AI 가 왜 이 시각을 골랐는지 한 줄. 근거 없는 제안은 사람을 설득하지 못한다.
  rationale          text,
  status             text not null default 'proposed'
                     check (status in ('proposed', 'pending', 'confirmed', 'declined', 'superseded')),
  created_at         timestamptz not null default now(),
  expires_at         timestamptz,
  constraint proposal_time_order check (proposed_end_at > proposed_start_at)
);

-- 한 일정에 살아 있는 제안은 하나뿐이다.
-- (§18 의 중복 방지를 '나중에 지우는' 대신 '들어올 수 없게' 만든다.)
create unique index if not exists proposals_one_open_per_event
  on public.schedule_proposals (event_id)
  where status in ('proposed', 'pending');

create index if not exists proposals_event_idx on public.schedule_proposals (event_id, created_at desc);

create table if not exists public.schedule_proposal_participants (
  proposal_id  uuid not null references public.schedule_proposals (id) on delete cascade,
  user_id      uuid not null references auth.users (id)                on delete cascade,
  response     text not null default 'pending'
               check (response in ('pending', 'accepted', 'declined', 'alternative')),
  -- 다른 시간을 제안한 경우 그 시각. AI 가 다음 후보를 찾을 때 이걸 선호로 삼는다.
  alt_start_at timestamptz,
  responded_at timestamptz,
  primary key (proposal_id, user_id)
);

-- ─────────────────────────────────────────────────────────
-- 2. 가능/불가능만 내보내는 창구
-- ─────────────────────────────────────────────────────────

/* 이 일정의 참여자들이 [s, f) 에 되는가.
   돌려주는 것은 사람마다 한 글자짜리 상태뿐이다.
     available — 겹치는 일정이 없다
     busy      — 겹치는 일정이 있다 (무엇인지는 말하지 않는다)
     unknown   — 달력에 아무것도 없다. 한가한 것과 모르는 것은 다르다.
   자기가 만든 이 일정 자신은 세지 않는다 — 자기 시간과 충돌한다고 말하면 우습다. */
create or replace function public.availability_for(e uuid, s timestamptz, f timestamptz)
returns table (user_id uuid, state text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_event_participant(e) then
    raise exception '이 일정의 참여자가 아닙니다' using errcode = '42501';
  end if;

  return query
    select p.user_id,
           case
             when exists (
               select 1
               from public.events x
               join public.event_participants xp on xp.event_id = x.id and xp.user_id = p.user_id
               where x.id <> e
                 and xp.status <> 'declined'
                 and x.start_at < f
                 and coalesce(x.end_at, x.start_at + interval '1 hour') > s
             ) then 'busy'
             when exists (
               select 1 from public.event_participants xp
               where xp.user_id = p.user_id and xp.event_id <> e
             ) then 'available'
             else 'unknown'
           end
    from public.event_participants p
    where p.event_id = e;
end $$;

/* 창(window) 안을 훑어 쓸 만한 시간대를 찾는다.
   §5 의 다섯 기준을 순서대로 적용한다.
     1. 모두가 가능한가            → available_count
     2. 기존 일정과 여유가 있는가   → buffer_min (붙여 놓으면 둘 다 망가진다)
     3. 원래 말한 시각과 가까운가   → distance_min
   사람별 바쁜 시각은 이 함수 밖으로 나가지 않는다. 나가는 건 "몇 명이 되는가" 뿐이다 —
   여러 시간대를 훑어 놓고 그걸 다 내보내면 남의 하루가 그대로 재구성된다. */
create or replace function public.suggest_slots(
  e uuid,
  win_start timestamptz,
  win_end timestamptz,
  duration_min int default 60,
  preferred timestamptz default null,
  step_min int default 30,
  limit_n int default 5
)
returns table (
  slot_start timestamptz,
  slot_end timestamptz,
  available_count int,
  total_count int,
  buffer_min int,
  distance_min int
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_event_participant(e) then
    raise exception '이 일정의 참여자가 아닙니다' using errcode = '42501';
  end if;

  return query
  with parts as (
    select ep.user_id from public.event_participants ep where ep.event_id = e
  ),
  busy as (
    select xp.user_id,
           x.start_at as bs,
           coalesce(x.end_at, x.start_at + interval '1 hour') as be
    from public.events x
    join public.event_participants xp on xp.event_id = x.id
    where x.id <> e
      and xp.status <> 'declined'
      and xp.user_id in (select p.user_id from parts p)
      and x.start_at < win_end
      and coalesce(x.end_at, x.start_at + interval '1 hour') > win_start
  ),
  slots as (
    select g as ss, g + make_interval(mins => duration_min) as se
    from generate_series(win_start,
                         win_end - make_interval(mins => duration_min),
                         make_interval(mins => step_min)) g
  )
  select
    sl.ss,
    sl.se,
    (select count(*) from parts p
      where not exists (
        select 1 from busy b
        where b.user_id = p.user_id and b.bs < sl.se and b.be > sl.ss
      ))::int,
    (select count(*) from parts)::int,
    -- 앞뒤로 가장 가까운 일정까지 몇 분 비어 있는가. 아무것도 없으면 넉넉하다고 본다.
    coalesce((
      select min(
        case when b.be <= sl.ss then extract(epoch from (sl.ss - b.be)) / 60
             when b.bs >= sl.se then extract(epoch from (b.bs - sl.se)) / 60
             else 0 end
      )::int
      from busy b
    ), 240),
    case when preferred is null then 0
         else (abs(extract(epoch from (sl.ss - preferred))) / 60)::int end
  from slots sl
  order by 3 desc, 5 desc, 6 asc, 1 asc
  limit limit_n;
end $$;

-- ─────────────────────────────────────────────────────────
-- 3. 제안하고 · 답하고 · 앉히기
-- ─────────────────────────────────────────────────────────

/* 새 제안을 연다. 이전에 열려 있던 제안은 물러난다(superseded) —
   답을 기다리는 제안이 둘이면 사람들은 어느 쪽에 답해야 할지 모른다. */
create or replace function public.open_proposal(
  e uuid,
  p_title text,
  s timestamptz,
  f timestamptz,
  p_rationale text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_event_participant(e) then
    raise exception '이 일정의 참여자가 아닙니다' using errcode = '42501';
  end if;

  update public.schedule_proposals
     set status = 'superseded'
   where event_id = e and status in ('proposed', 'pending');

  insert into public.schedule_proposals (event_id, created_by, title, proposed_start_at, proposed_end_at, rationale)
  values (e, auth.uid(), nullif(btrim(coalesce(p_title, '')), ''), s, f, p_rationale)
  returning id into new_id;

  -- 제안을 연 사람은 그 시각에 동의한 것으로 본다(자기가 낸 안에 다시 묻지 않는다).
  insert into public.schedule_proposal_participants (proposal_id, user_id, response, responded_at)
  values (new_id, auth.uid(), 'accepted', now());

  return new_id;
end $$;

/* 답한다. 그리고 그 답으로 전원이 채워지면 그 자리에서 일정을 앉힌다.
   확정을 별도 호출로 떼어 놓지 않는 이유: 마지막 두 사람이 동시에 동의하면
   "다 모였네" 를 둘 다 보고 둘 다 확정하려 든다. 답과 확정을 한 트랜잭션에 묶고
   제안 줄을 잠가서, 확정은 어떤 순서로 눌러도 한 번만 일어나게 한다. */
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
    update public.schedule_proposals set status = 'pending' where id = p;
    return query select 'pending'::text, pr.event_id, -1; return;
  end if;

  select count(*) into left_n
  from public.event_participants ep
  left join public.schedule_proposal_participants sp
         on sp.proposal_id = p and sp.user_id = ep.user_id
  where ep.event_id = pr.event_id
    and coalesce(sp.response, 'pending') <> 'accepted';

  if left_n = 0 then
    -- 새 일정을 만들지 않는다. 서 있던 일정이 시각을 얻고 앉는다.
    update public.events
       set start_at = pr.proposed_start_at,
           end_at   = pr.proposed_end_at,
           title    = coalesce(pr.title, title),
           status   = 'confirmed'
     where id = pr.event_id;

    update public.schedule_proposals set status = 'confirmed' where id = p;
    update public.event_participants set status = 'accepted' where event_id = pr.event_id;

    return query select 'confirmed'::text, pr.event_id, 0;
  else
    update public.schedule_proposals set status = 'pending' where id = p;
    return query select 'pending'::text, pr.event_id, left_n;
  end if;
end $$;

/* 확정된 뒤에 내 개인 일정이 겹쳤는가 (§13).
   나에 대해서만 답한다. 남의 달력은 여기서도 건드리지 않고, 겹쳤다고 해서
   공유 일정을 자동으로 옮기지도 않는다 — 그건 사람이 정할 일이다. */
create or replace function public.my_conflicts_with(e uuid)
returns table (conflict_id uuid, title text, start_at timestamptz, end_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare ev public.events;
begin
  if not public.is_event_participant(e) then
    raise exception '이 일정의 참여자가 아닙니다' using errcode = '42501';
  end if;
  select * into ev from public.events where id = e;
  if ev.id is null then return; end if;

  return query
    select x.id, x.title, x.start_at, x.end_at
    from public.events x
    join public.event_participants xp on xp.event_id = x.id and xp.user_id = auth.uid()
    where x.id <> e
      and xp.status <> 'declined'
      and x.start_at < coalesce(ev.end_at, ev.start_at + interval '1 hour')
      and coalesce(x.end_at, x.start_at + interval '1 hour') > ev.start_at;
end $$;

-- ─────────────────────────────────────────────────────────
-- 4. RLS — 제안은 그 일정 사람들만 본다
-- ─────────────────────────────────────────────────────────

alter table public.schedule_proposals             enable row level security;
alter table public.schedule_proposal_participants enable row level security;

drop policy if exists proposals_select on public.schedule_proposals;
create policy proposals_select on public.schedule_proposals for select
  using (public.is_event_participant(event_id));

-- 쓰기는 정책으로 열지 않는다. 위의 함수들만이 제안을 만들고 바꾼다 —
-- 아무나 직접 status 를 'confirmed' 로 적을 수 있으면 '전원 동의' 는 약속이 아니게 된다.

drop policy if exists proposal_parts_select on public.schedule_proposal_participants;
create policy proposal_parts_select on public.schedule_proposal_participants for select
  using (exists (
    select 1 from public.schedule_proposals pr
    where pr.id = proposal_id and public.is_event_participant(pr.event_id)
  ));

-- ─────────────────────────────────────────────────────────
-- 5. Realtime — 누가 동의했는지 새로고침 없이 따라오도록
-- ─────────────────────────────────────────────────────────

alter table public.schedule_proposals             replica identity full;
alter table public.schedule_proposal_participants replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.schedule_proposals;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.schedule_proposal_participants;
exception when duplicate_object then null; end $$;
