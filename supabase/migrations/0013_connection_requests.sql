-- Comein · 잇기 전에 묻는다
--
-- 0004 는 사람을 찾고 잇는 길을 놓았다. 다만 connect_with() 는 누르는 즉시 양쪽을
-- 이어 버린다 — 상대는 자기가 누구의 목록에 들어갔는지 모르고, 거절할 자리도 없다.
-- 한쪽이 결정하고 다른 쪽은 통보조차 받지 못하는 관계다.
--
-- 여기서 그 사이에 한 걸음을 넣는다.
--
--   찾는다 → 요청한다 → (상대가) 받는다 → 그때 이어진다
--
-- 지키려는 선은 0004 와 같다: 찾을 수는 있어도 훑을 수는 없다.
-- 요청은 당사자 둘만 본다. 이름을 띄우려면 아직 이어지지 않은 사람의 프로필을
-- 읽어야 하는데, 그건 함수 안에서만 열어 준다(profiles 의 RLS 는 그대로 닫아 둔다).
--
-- 적용: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run

-- ─────────────────────────────────────────────────────────
-- 1. 요청
-- ─────────────────────────────────────────────────────────

create table if not exists public.connection_requests (
  id           uuid primary key default gen_random_uuid(),
  from_user    uuid not null references auth.users (id) on delete cascade,
  to_user      uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending'
               check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint cr_not_self check (from_user <> to_user)
);

-- 열려 있는 요청은 한 쌍에 하나뿐이다. 답이 난 것(수락·거절)은 자취로 남으므로
-- 전체 unique 로 묶지 않는다 — 끊었다가 다시 잇는 길까지 막아 버린다.
create unique index if not exists cr_one_open
  on public.connection_requests (from_user, to_user)
  where status = 'pending';

create index if not exists cr_inbox_idx
  on public.connection_requests (to_user, status, created_at desc);

-- ─────────────────────────────────────────────────────────
-- 2. 요청하기
-- ─────────────────────────────────────────────────────────

/* 요청을 보낸다. 무엇이 일어났는지 한 낱말로 돌려준다 —
   화면이 "보냈어요" 와 "이어졌어요" 를 다르게 말해야 하기 때문이다.

     connected : 이미 이어져 있던 사이
     accepted  : 상대도 나에게 보내 두었다 → 그 자리에서 이어진다
     pending   : 이미 보내 둔 요청이 있다(두 번 눌러도 한 번과 같다)
     sent      : 새로 보냈다

   엇갈린 요청을 새 줄로 쌓지 않는 이유: A→B 가 열려 있는데 B→A 를 또 만들면
   둘 다 서로를 기다리는 교착이 된다. 둘 다 원한다는 뜻이므로 그 자리에서 잇는다. */
create or replace function public.request_connection(peer uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  me       uuid := auth.uid();
  mirrored uuid;
  recent   timestamptz;
begin
  if me is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if peer = me then
    raise exception '자기 자신에게는 요청할 수 없습니다';
  end if;
  if not exists (select 1 from public.profiles p where p.id = peer) then
    raise exception '없는 사람입니다';
  end if;

  if exists (select 1 from public.connections c where c.user_id = me and c.peer_id = peer) then
    return 'connected';
  end if;

  -- 상대가 먼저 손을 내밀어 두었는가.
  select r.id into mirrored
    from public.connection_requests r
   where r.from_user = peer and r.to_user = me and r.status = 'pending'
   limit 1;

  if mirrored is not null then
    update public.connection_requests
       set status = 'accepted', responded_at = now()
     where id = mirrored;
    insert into public.connections (user_id, peer_id) values (me, peer)   on conflict do nothing;
    insert into public.connections (user_id, peer_id) values (peer, me)   on conflict do nothing;
    return 'accepted';
  end if;

  if exists (
    select 1 from public.connection_requests r
     where r.from_user = me and r.to_user = peer and r.status = 'pending'
  ) then
    return 'pending';
  end if;

  -- 거절당한 뒤 곧바로 다시 보낼 수는 없다. 거절이 한 번 누르면 끝나는 일이 되려면,
  -- 그 답이 얼마간은 지켜져야 한다(그러지 않으면 거절 버튼은 있으나 마나 하다).
  select max(r.responded_at) into recent
    from public.connection_requests r
   where r.from_user = me and r.to_user = peer and r.status = 'declined';

  if recent is not null and recent > now() - interval '30 days' then
    raise exception '이미 거절된 요청입니다. 잠시 뒤에 다시 시도해 주세요';
  end if;

  insert into public.connection_requests (from_user, to_user) values (me, peer);
  return 'sent';
end $$;

/* 답한다 — 받은 사람만. 수락이면 그때 양쪽이 이어진다.
   보낸 사람이 자기 요청을 스스로 수락할 수 없어야 하므로 to_user 로 잠근다. */
create or replace function public.answer_connection_request(req uuid, accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare r public.connection_requests;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;

  select * into r from public.connection_requests
   where id = req and to_user = auth.uid() and status = 'pending';

  if not found then
    -- 이미 답했거나, 내게 온 요청이 아니다. 어느 쪽인지는 말하지 않는다
    -- (남의 요청 id 를 넣어 보며 존재를 알아낼 수 있으면 안 된다).
    return 'gone';
  end if;

  update public.connection_requests
     set status = case when accept then 'accepted' else 'declined' end,
         responded_at = now()
   where id = req;

  if accept then
    insert into public.connections (user_id, peer_id) values (r.to_user, r.from_user) on conflict do nothing;
    insert into public.connections (user_id, peer_id) values (r.from_user, r.to_user) on conflict do nothing;
    return 'accepted';
  end if;
  return 'declined';
end $$;

/* 취소 — 보낸 쪽이 무르는 길. 줄을 지운다(거절과 달리 자취를 남길 이유가 없다). */
create or replace function public.cancel_connection_request(peer uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.connection_requests
   where from_user = auth.uid() and to_user = peer and status = 'pending';
end $$;

-- ─────────────────────────────────────────────────────────
-- 3. 받은 요청 읽기
-- ─────────────────────────────────────────────────────────

/* 나에게 온, 아직 답하지 않은 요청.
   아직 이어지지 않은 사람이므로 profiles 의 RLS 로는 이름을 읽을 수 없다 —
   그래서 이 함수가 security definer 로 그만큼만 열어 준다(핸들과 표시 이름뿐). */
create or replace function public.my_connection_requests()
returns table (id uuid, from_id uuid, handle text, display_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  return query
  select r.id, p.id, p.handle, p.display_name, r.created_at
    from public.connection_requests r
    join public.profiles p on p.id = r.from_user
   where r.to_user = auth.uid() and r.status = 'pending'
   order by r.created_at desc;
end $$;

-- ─────────────────────────────────────────────────────────
-- 4. 검색 결과에 '어디까지 왔는가'를 함께
-- ─────────────────────────────────────────────────────────
-- 이어졌는지만으로는 부족하다. 이미 보내 둔 요청에 '연결' 버튼을 다시 내밀면
-- 사용자는 그게 안 눌린 줄 알고 또 누른다. 검색 한 줄이 자기 상태를 알아야 한다.

drop function if exists public.search_people(text, int);

create or replace function public.search_people(q text, limit_n int default 8)
returns table (
  id uuid, handle text, display_name text,
  connected boolean,
  requested boolean,   -- 내가 보내 둔 요청이 열려 있다
  incoming  uuid       -- 그 사람이 나에게 보낸 요청(있으면 그 id) — 여기서 바로 받을 수 있다
)
language plpgsql stable security definer set search_path = public as $$
declare needle text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  needle := lower(btrim(coalesce(q, '')));
  if length(needle) < 2 then return; end if;

  return query
  select p.id, p.handle, p.display_name,
         public.is_connected(p.id),
         exists (
           select 1 from public.connection_requests r
            where r.from_user = auth.uid() and r.to_user = p.id and r.status = 'pending'
         ),
         (select r.id from public.connection_requests r
           where r.from_user = p.id and r.to_user = auth.uid() and r.status = 'pending'
           limit 1)
  from public.profiles p
  where p.id <> auth.uid()
    and (
      p.handle like needle || '%'
      or lower(p.display_name) like needle || '%'
      or p.id = (select u.id from auth.users u where lower(u.email) = needle)
    )
  order by
    (p.handle = needle) desc,
    length(p.display_name),
    p.handle
  limit least(greatest(limit_n, 1), 20);
end $$;

-- ─────────────────────────────────────────────────────────
-- 5. 동의 없이 잇는 길을 막는다
-- ─────────────────────────────────────────────────────────
-- 요청을 세워 두고 옛 함수를 남겨 두면 문을 잠그고 창문을 열어 둔 셈이다.
-- connect_with 는 누구든 RPC 로 그대로 부를 수 있었다.

drop function if exists public.connect_with(uuid);

-- ─────────────────────────────────────────────────────────
-- 6. RLS
-- ─────────────────────────────────────────────────────────

alter table public.connection_requests enable row level security;

-- 당사자 둘만 본다. 남에게 온 요청은 존재조차 보이지 않는다.
drop policy if exists cr_select on public.connection_requests;
create policy cr_select on public.connection_requests for select
  using (from_user = auth.uid() or to_user = auth.uid());

-- 보내기·답하기·취소는 위 함수로만 지나간다. 직접 insert/update 를 열어 두면
-- 남의 이름으로 요청을 만들거나, 받은 적 없는 요청을 스스로 수락할 수 있다.

-- ─────────────────────────────────────────────────────────
-- 7. Realtime — 요청이 오면 그 자리에서 보인다
-- ─────────────────────────────────────────────────────────
alter table public.connection_requests replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.connection_requests;
exception when duplicate_object then null; end $$;
