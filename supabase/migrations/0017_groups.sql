-- Comein · 그룹 — 같은 사람들이 다시 모인다
--
-- 지금까지 '여럿'은 일정 하나에 매인 것이었다. 자리를 만들 때마다 같은 사람들을 다시
-- 골랐고, 그 자리가 끝나면 그 묶음도 함께 사라졌다. 그런데 사람이 일하는 방식은
-- 그렇지 않다 — 같은 사람들과 계속 모인다(팀·스터디·동아리).
--
-- 그래서 **사람의 묶음**을 일정보다 오래 사는 것으로 세운다.
--
--     groups ─< group_members >─ auth.users
--        │
--        └─< events (group_id)
--
-- 규칙 셋만 기억하면 된다.
--
--   ① 그룹 일정을 만들면 **멤버 전원이 자동으로 참여자가 된다**(트리거).
--      사람을 다시 고르는 일이 없어진다 — 그게 이 표가 존재하는 이유다.
--
--   ② 나중에 멤버가 늘면 지난 일정에는 자동으로 붙지 않는다. 붙이려면
--      `sync_group_calendar()` 를 부른다. **자동으로 하지 않는 이유**: 이미 지나간
--      자리에 사람을 소급해 앉히는 것은 조용히 할 일이 아니다. 사람이 눌러야 한다.
--
--   ③ 멤버에서 빠져도 **이미 참여 중인 일정에서는 걷지 않는다.** 그룹으로 들어온
--      참여자와 개별로 초대된 참여자를 서버가 구별할 수 없기 때문이다. 남의 약속을
--      추측으로 지우는 것보다, 남겨 두고 사람이 빼는 편이 낫다.
--
-- 적용: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run

-- ─────────────────────────────────────────────────────────
-- 1. 표
-- ─────────────────────────────────────────────────────────

create table if not exists public.groups (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists groups_owner_idx on public.groups (owner_id);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id  uuid not null references auth.users (id)   on delete cascade,
  role     text not null default 'member' check (role in ('owner', 'member')),
  added_at timestamptz not null default now(),
  -- 같은 사람을 두 번 넣어도 한 줄. 동시에 넣어도 여기서 막힌다.
  primary key (group_id, user_id)
);

-- "내가 속한 그룹" 을 뽑는 방향 (PK 는 group_id 선행이라 반대 방향이 따로 필요하다)
create index if not exists group_members_user_idx on public.group_members (user_id);

-- 일정이 어느 그룹의 것인가. 없으면 그냥 개인/일회성 자리다.
-- 그룹이 사라져도 일정은 남는다(set null) — 모임이 해체됐다고 지난 약속까지 지울 이유가 없다.
alter table public.events
  add column if not exists group_id uuid references public.groups (id) on delete set null;

create index if not exists events_group_idx on public.events (group_id) where group_id is not null;

-- ─────────────────────────────────────────────────────────
-- 2. 누가 볼 수 있는가 — 재귀를 끊는 창구
-- ─────────────────────────────────────────────────────────
-- 정책 안에서 group_members 를 다시 조회하면 그 표의 정책이 또 불려 무한 재귀가 난다.
-- 0001 의 is_event_participant 와 같은 이유로 security definer 함수 한 겹을 둔다.

create or replace function public.is_group_member(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = g and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_group_owner(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.groups gr
    where gr.id = g and gr.owner_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────
-- 3. 트리거
-- ─────────────────────────────────────────────────────────

-- 그룹 일정을 만들면 멤버 전원이 참여자가 된다.
--
-- 이름을 `event_group_fanout` 으로 둔 이유: 같은 시점(AFTER INSERT)의 트리거는 **이름
-- 순서로** 돈다. `event_bootstrap`(b) 이 먼저 돌아 방(chat_rooms)을 만들어야, 여기서
-- 넣는 참여자들이 `participant_to_member` 를 타고 그 방의 멤버가 될 수 있다.
-- b < f 라 순서가 보장된다 — 우연에 기대지 않으려고 적어 둔다.
create or replace function public.tg_event_group_fanout()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.group_id is null then return new; end if;

  insert into public.event_participants (event_id, user_id, role, status)
  select new.id, m.user_id, 'participant', 'invited'
    from public.group_members m
   where m.group_id = new.group_id
     and m.user_id <> new.owner_id          -- 주최자는 bootstrap 이 owner/accepted 로 이미 앉혔다
  on conflict (event_id, user_id) do nothing;

  return new;
end $$;

drop trigger if exists event_group_fanout on public.events;
create trigger event_group_fanout
  after insert on public.events
  for each row execute function public.tg_event_group_fanout();

-- 그룹을 만든 사람은 그 그룹의 주인이자 멤버다.
create or replace function public.tg_group_bootstrap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (group_id, user_id) do nothing;
  return new;
end $$;

drop trigger if exists group_bootstrap on public.groups;
create trigger group_bootstrap
  after insert on public.groups
  for each row execute function public.tg_group_bootstrap();

drop trigger if exists groups_touch on public.groups;
create trigger groups_touch
  before update on public.groups
  for each row execute function public.tg_touch_updated_at();

-- ─────────────────────────────────────────────────────────
-- 4. 동기화 — 멱등하게, 중복 없이
-- ─────────────────────────────────────────────────────────
-- 멤버가 늘어난 뒤 그룹의 일정들에 그 사람을 채운다. 몇 번을 눌러도 결과가 같다
-- (`on conflict do nothing`). 이미 답한 사람의 status 는 건드리지 않는다 — '참석' 이라고
-- 답해 둔 것을 동기화가 'invited' 로 되돌리면, 사람이 한 말을 기계가 지우는 셈이다.
--
-- 지난 일정도 포함한다: 그룹에 늦게 들어온 사람도 그 방들의 대화를 볼 수 있어야
-- '같은 사람들의 묶음' 이라는 말이 성립한다. 다만 그래서 **사람이 눌러야** 한다(위 ②).
create or replace function public.sync_group_calendar(g uuid)
returns table (events_touched int, members_added int)
language plpgsql security definer set search_path = public as $$
declare
  added int := 0;
  evs   int := 0;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not public.is_group_member(g) then
    raise exception '이 그룹의 멤버가 아닙니다.';
  end if;

  with ins as (
    insert into public.event_participants (event_id, user_id, role, status)
    select e.id, m.user_id, 'participant', 'invited'
      from public.events e
      join public.group_members m on m.group_id = e.group_id
     where e.group_id = g
       and m.user_id <> e.owner_id
    on conflict (event_id, user_id) do nothing
    returning event_id
  )
  select count(*)::int, count(distinct event_id)::int into added, evs from ins;

  return query select evs, added;
end $$;

-- ─────────────────────────────────────────────────────────
-- 5. RLS
-- ─────────────────────────────────────────────────────────

alter table public.groups        enable row level security;
alter table public.group_members enable row level security;

-- groups — 멤버만 본다. 만드는 건 자기 이름으로만, 고치고 지우는 건 주인만.
-- (주인은 멤버 표를 거치지 않고도 자기 그룹을 본다 — 멤버 행은 AFTER INSERT 트리거가
--  만들므로, 방금 넣은 행을 RETURNING 으로 돌려받는 순간에는 아직 없다. 0001 의
--  events_select 가 owner_id 를 함께 보는 것과 같은 이유다.)
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select
  using (owner_id = auth.uid() or public.is_group_member(id));

drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups for insert
  with check (owner_id = auth.uid());

drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups for update
  using (public.is_group_owner(id)) with check (public.is_group_owner(id));

drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups for delete
  using (public.is_group_owner(id));

-- group_members — 같은 그룹 사람끼리만 서로 보인다.
-- 부르는 건 주인. 나가는 건 스스로도 할 수 있다(주인만 뺄 수 있으면 그룹에 갇힌다).
drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members for select
  using (public.is_group_member(group_id));

drop policy if exists group_members_insert on public.group_members;
create policy group_members_insert on public.group_members for insert
  with check (public.is_group_owner(group_id));

drop policy if exists group_members_delete on public.group_members;
create policy group_members_delete on public.group_members for delete
  using (public.is_group_owner(group_id) or user_id = auth.uid());

-- events 에 group_id 가 생겼으니, 그 칸도 잠가야 한다.
--
-- 0001 의 events_insert 는 `owner_id = auth.uid()` 만 본다. 그대로 두면 **남의 그룹 id 를
-- 적어 넣을 수 있고**, 그러면 위 fanout 트리거가 그 그룹 멤버 전원을 내 일정의 참여자로
-- 앉힌다 — 초대한 적 없는 사람들의 달력에 내 자리가 서고, 그 방의 대화까지 열린다.
--
-- 0016 에서 dm_key 를 두고 고친 것과 **정확히 같은 종류의 구멍**이다: 클라이언트가
-- 지키는 약속(내 그룹에만 단다)을 서버가 모르는 자리. 같은 실수를 새 표에서 반복하지 않는다.
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert
  with check (
    owner_id = auth.uid()
    and (group_id is null or public.is_group_member(group_id))
  );

-- 고칠 때도 같다 — 나중에 남의 그룹으로 옮겨 달 수 있으면 위와 같은 일이 된다.
drop policy if exists events_update on public.events;
create policy events_update on public.events for update
  using (public.is_event_owner(id))
  with check (
    public.is_event_owner(id)
    and (group_id is null or public.is_group_member(group_id))
  );

-- ─────────────────────────────────────────────────────────
-- 6. Realtime — 그룹이 바뀌면 다른 화면도 따라온다
-- ─────────────────────────────────────────────────────────
alter table public.groups        replica identity full;
alter table public.group_members replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.groups;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.group_members;
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────
-- 7. 확인하는 법 (SQL Editor 에서 손으로)
-- ─────────────────────────────────────────────────────────
--   -- 그룹을 만들면 나는 주인이자 멤버여야 한다
--   insert into groups (owner_id, name) values (auth.uid(), '시험 그룹') returning id;
--   select * from group_members where group_id = '<위 id>';        -- 내 줄 하나(owner)
--
--   -- 그룹 일정을 만들면 멤버 전원이 참여자가 되어야 한다
--   insert into events (owner_id, title, start_at, group_id)
--   values (auth.uid(), '시험 모임', now() + interval '1 day', '<위 id>') returning id;
--   select * from event_participants where event_id = '<일정 id>';
--
--   -- 아래는 **막혀야** 정상이다
--   insert into groups (owner_id, name) values ('11111111-1111-1111-1111-111111111111', '남의 그룹');
--
--   -- 남의 그룹 id 를 단 일정 만들기 → events_insert 에서 막힌다
--   insert into events (owner_id, title, start_at, group_id)
--   values (auth.uid(), '끼어들기', now(), '<내가 멤버가 아닌 그룹 id>');
