-- Comein · 공유 일정 · 참여자 · 대화
--
--   auth.users ─< event_participants >─ events ─ chat_rooms ─< chat_messages
--                                                    │
--                                      chat_room_members (1:1 방의 두 사람)
--
-- 규칙 하나만 기억하면 된다: 같은 일정을 여럿이 본다고 해서 일정을 복제하지 않는다.
-- canonical event 는 하나이고, 참여자들이 같은 event_id 를 함께 바라본다.
-- 그래서 시간이 바뀌면 한 줄만 고치면 모두의 캘린더가 함께 바뀐다.
--
-- 적용: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run
--       (또는 supabase db push)

-- ─────────────────────────────────────────────────────────
-- 1. 테이블
-- ─────────────────────────────────────────────────────────

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  title       text not null check (length(btrim(title)) > 0),
  start_at    timestamptz not null,
  end_at      timestamptz,
  location    text,
  description text,
  status      text not null default 'confirmed' check (status in ('pending', 'confirmed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint events_time_order check (end_at is null or end_at >= start_at)
);

create index if not exists events_owner_start_idx on public.events (owner_id, start_at);
create index if not exists events_start_idx       on public.events (start_at);

create table if not exists public.event_participants (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id  uuid not null references auth.users (id)    on delete cascade,
  role     text not null default 'participant' check (role   in ('owner', 'participant')),
  status   text not null default 'invited'     check (status in ('invited', 'accepted', 'declined')),
  added_at timestamptz not null default now(),
  -- 같은 사람을 두 번 초대해도 한 줄만 남는다. 동시 초대(경합)도 여기서 막힌다.
  primary key (event_id, user_id)
);
-- "내가 참여한 일정" 을 뽑는 방향 (PK 는 event_id 선행이라 반대 방향이 따로 필요하다)
create index if not exists event_participants_user_idx on public.event_participants (user_id);

-- 대화방은 두 종류. 일정에 매인 방(event_id) 이거나, 두 사람만의 방(dm_key) 이거나.
-- dm_key 는 두 uid 를 정렬해 이은 값이라, 누가 먼저 말을 걸든 같은 방으로 수렴한다.
create table if not exists public.chat_rooms (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid unique references public.events (id) on delete cascade,
  dm_key     text unique,
  created_at timestamptz not null default now(),
  constraint chat_rooms_kind check ((event_id is not null) <> (dm_key is not null))
);

create table if not exists public.chat_room_members (
  room_id   uuid not null references public.chat_rooms (id) on delete cascade,
  user_id   uuid not null references auth.users (id)        on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.chat_rooms (id) on delete cascade,
  -- 사람이 지워져도 남긴 말은 남는다(작성자만 비워진다).
  sender_id  uuid references auth.users (id) on delete set null,
  content    text not null check (length(btrim(content)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_room_time_idx on public.chat_messages (room_id, created_at);

-- ─────────────────────────────────────────────────────────
-- 2. 트리거 — 관계가 저절로 맞아떨어지게
-- ─────────────────────────────────────────────────────────

-- 일정을 만든 사람은 그 일정의 주인이자 참여자다. 그리고 일정에는 방이 하나 딸린다.
create or replace function public.tg_event_bootstrap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.event_participants (event_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'accepted')
  on conflict (event_id, user_id) do nothing;

  insert into public.chat_rooms (event_id) values (new.id)
  on conflict (event_id) do nothing;

  return new;
end $$;

drop trigger if exists event_bootstrap on public.events;
create trigger event_bootstrap
  after insert on public.events
  for each row execute function public.tg_event_bootstrap();

-- 일정 참여자가 되면 그 일정 방의 멤버가 되고, 빠지면 접근도 끊긴다.
-- (남긴 메시지는 지우지 않는다 — 대화의 앞뒤가 사라지면 남은 사람들이 맥락을 잃는다.)
create or replace function public.tg_participant_to_member()
returns trigger language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  select id into rid from public.chat_rooms where event_id = coalesce(new.event_id, old.event_id);
  if rid is null then return coalesce(new, old); end if;

  if tg_op = 'INSERT' then
    insert into public.chat_room_members (room_id, user_id) values (rid, new.user_id)
    on conflict (room_id, user_id) do nothing;
  elsif tg_op = 'DELETE' then
    delete from public.chat_room_members where room_id = rid and user_id = old.user_id;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists participant_to_member_ins on public.event_participants;
create trigger participant_to_member_ins
  after insert on public.event_participants
  for each row execute function public.tg_participant_to_member();

drop trigger if exists participant_to_member_del on public.event_participants;
create trigger participant_to_member_del
  after delete on public.event_participants
  for each row execute function public.tg_participant_to_member();

create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists events_touch on public.events;
create trigger events_touch
  before update on public.events
  for each row execute function public.tg_touch_updated_at();

-- ─────────────────────────────────────────────────────────
-- 3. RLS — 남의 일정과 남의 대화는 id 를 알아도 못 본다
-- ─────────────────────────────────────────────────────────
-- 정책 안에서 event_participants 를 다시 조회하면 그 표의 정책이 또 불려 무한 재귀가 난다.
-- security definer 함수로 한 겹 감싸 그 고리를 끊는다.

create or replace function public.is_event_participant(e uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.event_participants p
    where p.event_id = e and p.user_id = auth.uid()
  );
$$;

create or replace function public.is_event_owner(e uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.event_participants p
    where p.event_id = e and p.user_id = auth.uid() and p.role = 'owner'
  );
$$;

create or replace function public.is_room_member(r uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chat_room_members m
    where m.room_id = r and m.user_id = auth.uid()
  );
$$;

alter table public.events             enable row level security;
alter table public.event_participants enable row level security;
alter table public.chat_rooms         enable row level security;
alter table public.chat_room_members  enable row level security;
alter table public.chat_messages      enable row level security;

-- events — 참여한 일정만 보인다. 고치고 지우는 건 주최자만.
drop policy if exists events_select on public.events;
create policy events_select on public.events for select
  using (public.is_event_participant(id));

drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert
  with check (owner_id = auth.uid());

drop policy if exists events_update on public.events;
create policy events_update on public.events for update
  using (public.is_event_owner(id)) with check (public.is_event_owner(id));

drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete
  using (public.is_event_owner(id));

-- event_participants — 같은 일정에 있는 사람끼리만 서로 보인다.
-- 부르고 빼는 건 주최자. 단, 자기 참석 여부는 스스로 바꾼다.
drop policy if exists participants_select on public.event_participants;
create policy participants_select on public.event_participants for select
  using (public.is_event_participant(event_id));

drop policy if exists participants_insert on public.event_participants;
create policy participants_insert on public.event_participants for insert
  with check (public.is_event_owner(event_id) or user_id = auth.uid());

drop policy if exists participants_update on public.event_participants;
create policy participants_update on public.event_participants for update
  using (user_id = auth.uid() or public.is_event_owner(event_id))
  with check (user_id = auth.uid() or public.is_event_owner(event_id));

-- 스스로 나가는 것도 허용한다(주최자만 뺄 수 있게 하면 방에 갇힌다).
drop policy if exists participants_delete on public.event_participants;
create policy participants_delete on public.event_participants for delete
  using (public.is_event_owner(event_id) or user_id = auth.uid());

-- chat_rooms — 멤버이거나(1:1), 그 일정의 참여자이거나(일정 방).
drop policy if exists rooms_select on public.chat_rooms;
create policy rooms_select on public.chat_rooms for select
  using (
    public.is_room_member(id)
    or (event_id is not null and public.is_event_participant(event_id))
  );

-- 1:1 방은 사용자가 직접 만든다(일정 방은 트리거가 만든다).
drop policy if exists rooms_insert on public.chat_rooms;
create policy rooms_insert on public.chat_rooms for insert
  with check (dm_key is not null and position(auth.uid()::text in dm_key) > 0);

drop policy if exists members_select on public.chat_room_members;
create policy members_select on public.chat_room_members for select
  using (public.is_room_member(room_id));

-- 1:1 방을 연 사람이 자기와 상대를 넣는다.
drop policy if exists members_insert on public.chat_room_members;
create policy members_insert on public.chat_room_members for insert
  with check (
    exists (
      select 1 from public.chat_rooms r
      where r.id = room_id and r.dm_key is not null and position(auth.uid()::text in r.dm_key) > 0
    )
  );

-- chat_messages — 그 방의 멤버만 읽고, 자기 이름으로만 쓴다.
drop policy if exists messages_select on public.chat_messages;
create policy messages_select on public.chat_messages for select
  using (public.is_room_member(room_id));

drop policy if exists messages_insert on public.chat_messages;
create policy messages_insert on public.chat_messages for insert
  with check (sender_id = auth.uid() and public.is_room_member(room_id));

-- 남긴 말은 고치거나 지우지 않는다(정책을 만들지 않으면 막힌다).

-- ─────────────────────────────────────────────────────────
-- 4. Realtime — 참여자 화면이 새로고침 없이 따라오도록
-- ─────────────────────────────────────────────────────────
alter table public.events             replica identity full;
alter table public.event_participants replica identity full;
alter table public.chat_messages      replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.event_participants;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null; end $$;
