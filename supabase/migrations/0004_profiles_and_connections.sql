-- Comein · 사람을 찾고 잇는 길
--
-- 지금까지 '사람'은 화면 안에만 있었다. 연락처는 지역 데이터라 진짜 계정이 아니었고,
-- 그래서 참여자로 부르면 외래키에서 튕겼다(auth.users 에 그런 사람이 없으니까).
-- 여기서 그 구멍을 메운다.
--
-- 지켜야 하는 선이 하나 있다.
--
--   사람을 찾을 수 있어야 하지만, 전체 명부를 훑을 수 있으면 안 된다.
--
-- 그래서 profiles 에 SELECT 를 통째로 열지 않는다. 검색은 search_people() 한 곳으로만
-- 지나가고, 그 함수는 두 글자 이상을 요구하고 결과 수를 자른다. 직접 읽을 수 있는 것은
-- '이미 나와 이어진 사람'과 '같은 일정에 있는 사람'뿐이다 — 화면에 이름을 띄우려면
-- 그만큼은 읽어야 한다.
--
-- 이메일은 profiles 에 아예 두지 않는다. 컬럼이 없으면 새어 나갈 일도 없다.
-- 이메일로 찾는 건 함수 안에서 auth.users 와 '정확히 일치'할 때만 맞춰 보고,
-- 찾았더라도 이메일 자체는 돌려주지 않는다. 부분 일치를 허용하면 주소를 긁을 수 있다.
--
-- 적용: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run

-- ─────────────────────────────────────────────────────────
-- 1. 프로필 — 계정의 '보여도 되는 면'
-- ─────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  handle       text not null unique check (handle ~ '^[a-z0-9_]{2,24}$'),
  display_name text not null check (length(btrim(display_name)) > 0),
  created_at   timestamptz not null default now()
);

-- 이름으로도 찾으므로 대소문자를 접어 색인한다.
create index if not exists profiles_name_idx on public.profiles (lower(display_name));

/* 가입하면 프로필이 함께 생긴다. 사람이 따로 만들 일이 아니다.
   핸들은 이메일 앞부분에서 뽑고, 겹치면 숫자를 붙여 비켜 간다. */
create or replace function public.tg_new_user_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text;
  cand text;
  n int := 0;
begin
  base := lower(regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^a-z0-9_]', '', 'g'));
  if length(base) < 2 then base := 'comein'; end if;
  base := left(base, 20);

  cand := base;
  while exists (select 1 from public.profiles p where p.handle = cand) loop
    n := n + 1;
    cand := left(base, 20) || n::text;
  end loop;

  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    cand,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'user_name'), ''),
      cand
    )
  )
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_new_user_profile();

-- 이미 가입해 있던 사람들 메우기(트리거는 앞으로 들어올 사람만 받는다).
do $$
declare u record; base text; cand text; n int;
begin
  for u in select id, email, raw_user_meta_data from auth.users
           where id not in (select id from public.profiles) loop
    base := lower(regexp_replace(split_part(coalesce(u.email, ''), '@', 1), '[^a-z0-9_]', '', 'g'));
    if length(base) < 2 then base := 'comein'; end if;
    base := left(base, 20);
    cand := base; n := 0;
    while exists (select 1 from public.profiles p where p.handle = cand) loop
      n := n + 1; cand := left(base, 20) || n::text;
    end loop;
    insert into public.profiles (id, handle, display_name)
    values (u.id, cand, coalesce(nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), cand))
    on conflict (id) do nothing;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────
-- 2. 연결 — 서로 아는 사이
-- ─────────────────────────────────────────────────────────
-- 한 방향씩 두 줄로 둔다. "내 사람 목록"을 뽑을 때 한쪽만 보면 되기 때문이다
-- (한 줄로 두면 조회할 때마다 양쪽을 or 로 뒤져야 하고 색인이 잘 안 든다).

create table if not exists public.connections (
  user_id    uuid not null references auth.users (id) on delete cascade,
  peer_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, peer_id),
  constraint connections_not_self check (user_id <> peer_id)
);

-- ─────────────────────────────────────────────────────────
-- 3. 찾기 · 잇기
-- ─────────────────────────────────────────────────────────

create or replace function public.is_connected(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.connections c where c.user_id = auth.uid() and c.peer_id = p);
$$;

/* 같은 일정에 함께 있는 사이인가 — 이름을 띄우려면 이만큼은 읽을 수 있어야 한다. */
create or replace function public.shares_event_with(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.event_participants a
    join public.event_participants b on b.event_id = a.event_id
    where a.user_id = auth.uid() and b.user_id = p
  );
$$;

/* 사람 찾기 — 이 함수가 유일한 입구다.
   핸들·이름은 앞부분 일치로, 이메일은 '정확히 같을 때'만 맞춰 본다.
   이메일을 부분 일치로 열어 주면 주소를 한 글자씩 늘려 가며 긁어낼 수 있다.
   그리고 무엇을 찾았든 이메일은 돌려주지 않는다. */
create or replace function public.search_people(q text, limit_n int default 8)
returns table (id uuid, handle text, display_name text, connected boolean)
language plpgsql stable security definer set search_path = public as $$
declare needle text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  needle := lower(btrim(coalesce(q, '')));
  -- 한 글자로는 찾지 않는다 — 그건 검색이 아니라 명부 훑기다.
  if length(needle) < 2 then return; end if;

  return query
  select p.id, p.handle, p.display_name, public.is_connected(p.id)
  from public.profiles p
  where p.id <> auth.uid()
    and (
      p.handle like needle || '%'
      or lower(p.display_name) like needle || '%'
      or p.id = (select u.id from auth.users u where lower(u.email) = needle)
    )
  order by
    (p.handle = needle) desc,              -- 정확히 그 핸들이면 맨 위로
    length(p.display_name),
    p.handle
  limit least(greatest(limit_n, 1), 20);
end $$;

/* 잇는다. 양쪽 다 넣는다 — 한쪽만 알고 다른 쪽은 모르는 관계는 만들지 않는다.
   두 번 눌러도 한 번 이은 것과 같다. */
create or replace function public.connect_with(peer uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if peer = auth.uid() then
    raise exception '자기 자신과는 이을 수 없습니다';
  end if;
  if not exists (select 1 from public.profiles p where p.id = peer) then
    raise exception '없는 사람입니다';
  end if;

  insert into public.connections (user_id, peer_id) values (auth.uid(), peer)
  on conflict do nothing;
  insert into public.connections (user_id, peer_id) values (peer, auth.uid())
  on conflict do nothing;
end $$;

/* 끊는다 — 양쪽 다. 남긴 대화와 함께한 일정은 지우지 않는다(지난 일까지 없던 일이 되지는 않는다). */
create or replace function public.disconnect_from(peer uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.connections
  where (user_id = auth.uid() and peer_id = peer)
     or (user_id = peer and peer_id = auth.uid());
end $$;

/* 내 사람들 — 이어진 사람 + 같은 일정에서 만난 사람.
   일정으로 만난 사람도 여기 나온다: 함께 일정을 잡아 놓고 목록에 없으면 이상하다. */
create or replace function public.my_people()
returns table (id uuid, handle text, display_name text, connected boolean, shared_events int)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  return query
  with peers as (
    select c.peer_id as uid from public.connections c where c.user_id = auth.uid()
    union
    select b.user_id from public.event_participants a
      join public.event_participants b on b.event_id = a.event_id
     where a.user_id = auth.uid() and b.user_id <> auth.uid()
  )
  select p.id, p.handle, p.display_name,
         public.is_connected(p.id),
         (select count(*)::int from public.event_participants x
           join public.event_participants y on y.event_id = x.event_id
          where x.user_id = auth.uid() and y.user_id = p.id)
  from public.profiles p
  join peers on peers.uid = p.id
  order by p.display_name;
end $$;

-- ─────────────────────────────────────────────────────────
-- 4. RLS
-- ─────────────────────────────────────────────────────────

alter table public.profiles    enable row level security;
alter table public.connections enable row level security;

-- 직접 읽을 수 있는 건 나 자신, 이어진 사람, 같은 일정의 사람뿐이다.
-- 검색은 이 정책을 지나지 않는다(search_people 이 security definer 라서) —
-- 그래서 '찾을 수는 있지만 훑을 수는 없는' 상태가 된다.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (
    id = auth.uid()
    or public.is_connected(id)
    or public.shares_event_with(id)
  );

-- 표시 이름은 본인만 바꾼다. 핸들은 함부로 바꾸지 않는다(남이 기억하는 이름이라서).
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists connections_select on public.connections;
create policy connections_select on public.connections for select
  using (user_id = auth.uid() or peer_id = auth.uid());

-- 잇고 끊는 건 위 함수로만. 직접 insert 를 열어 두면 상대 동의 없이
-- 한쪽 방향만 만들어 관계를 반쪽으로 만들 수 있다.

-- ─────────────────────────────────────────────────────────
-- 5. Realtime
-- ─────────────────────────────────────────────────────────
alter table public.connections replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.connections;
exception when duplicate_object then null; end $$;
