-- Comein · 방 접근을 '순서'에 기대지 않게 고친다
--
-- 0001 에서 events 가 그랬듯, 대화 쪽에도 같은 함정이 두 개 더 있었다.
-- 둘 다 뿌리가 같다: "지금 만들고 있는 것을 볼 권한이, 아직 만들어지지 않은
-- 다른 줄에 달려 있다."
--
--   (1) 1:1 방을 만들면 만든 사람 눈에 안 보인다.
--       rooms_select 가 is_room_member(id) 뿐인데, 멤버 줄은 방을 만든 다음에
--       넣는다. INSERT ... RETURNING 이 그 사이에 걸려 42501 로 튕긴다.
--
--   (2) 일정 방의 주최자가 그 방 멤버가 아니다.
--       tg_event_bootstrap 이 참여자를 먼저 넣고 방을 나중에 만든다.
--       참여자 트리거가 방을 찾지 못해 조용히 지나가고, 주최자는 자기 일정
--       방에 말을 쓸 수 없게 된다(messages_insert 의 is_room_member).
--
-- 고치는 방향: 방에 들어갈 자격을 chat_room_members 라는 '따라오는 표' 에
-- 묻지 않고, 방 자신에게 묻는다.
--   일정 방이면  → 그 일정의 참여자인가
--   1:1 방이면   → dm_key 안에 내 uid 가 있는가
-- 그러면 어느 줄이 먼저 만들어지든 답이 같다. 순서에 기대지 않는다.
--
-- 적용: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run

-- ─────────────────────────────────────────────────────────
-- 1. 방 접근 판정 — 방 자신에게 묻는다
-- ─────────────────────────────────────────────────────────
-- chat_room_members 는 남겨 둔다(누가 있는지 보여주는 데 쓴다).
-- 다만 '들어갈 수 있는가' 를 더는 거기에 묻지 않는다.

create or replace function public.can_access_room(r uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chat_rooms c
    where c.id = r
      and (
        (c.event_id is not null and exists (
          select 1 from public.event_participants p
          where p.event_id = c.event_id and p.user_id = auth.uid()
        ))
        or (c.dm_key is not null and position(auth.uid()::text in c.dm_key) > 0)
      )
  );
$$;

-- ─────────────────────────────────────────────────────────
-- 2. 정책 다시 세우기
-- ─────────────────────────────────────────────────────────

-- chat_rooms — 방금 만든 방을 돌려받아야 하므로, 남의 표를 뒤지지 않고
-- 그 줄의 컬럼만 본다. (stable 함수는 같은 명령이 방금 넣은 줄을 못 본다.
--  can_access_room(id) 로 적으면 (1) 이 그대로 재발한다.)
drop policy if exists rooms_select on public.chat_rooms;
create policy rooms_select on public.chat_rooms for select
  using (
    (dm_key is not null and position(auth.uid()::text in dm_key) > 0)
    or (event_id is not null and public.is_event_participant(event_id))
  );

drop policy if exists rooms_insert on public.chat_rooms;
create policy rooms_insert on public.chat_rooms for insert
  with check (dm_key is not null and position(auth.uid()::text in dm_key) > 0);

-- chat_room_members — 이제 '누가 있는지' 를 보여주는 표일 뿐이다.
drop policy if exists members_select on public.chat_room_members;
create policy members_select on public.chat_room_members for select
  using (public.can_access_room(room_id));

drop policy if exists members_insert on public.chat_room_members;
create policy members_insert on public.chat_room_members for insert
  with check (public.can_access_room(room_id));

drop policy if exists members_delete on public.chat_room_members;
create policy members_delete on public.chat_room_members for delete
  using (user_id = auth.uid() or public.can_access_room(room_id));

-- chat_messages — 방에 들어갈 수 있으면 읽고, 자기 이름으로만 쓴다.
drop policy if exists messages_select on public.chat_messages;
create policy messages_select on public.chat_messages for select
  using (public.can_access_room(room_id));

drop policy if exists messages_insert on public.chat_messages;
create policy messages_insert on public.chat_messages for insert
  with check (sender_id = auth.uid() and public.can_access_room(room_id));

-- ─────────────────────────────────────────────────────────
-- 3. 트리거 순서 — 방을 먼저 만들고 사람을 넣는다
-- ─────────────────────────────────────────────────────────
-- 접근은 이제 순서와 무관하지만, chat_room_members 가 비어 있으면
-- "이 방에 누가 있나" 를 못 보여준다. 순서를 바로잡아 그것도 채운다.

create or replace function public.tg_event_bootstrap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- 방이 먼저다. 참여자 트리거가 방을 찾을 수 있어야 한다.
  insert into public.chat_rooms (event_id) values (new.id)
  on conflict (event_id) do nothing;

  insert into public.event_participants (event_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'accepted')
  on conflict (event_id, user_id) do nothing;

  return new;
end $$;

-- ─────────────────────────────────────────────────────────
-- 4. 이미 만들어진 것들 메우기
-- ─────────────────────────────────────────────────────────
-- 3 이전에 만들어진 일정들은 방은 있는데 멤버가 비어 있다.

-- dm_key 는 "uuid:uuid" 여야 한다. 그 꼴이 아닌 방은 들어올 길이 없던 것이므로 지운다.
delete from public.chat_rooms
where dm_key is not null
  and dm_key !~ '^[0-9a-f-]{36}:[0-9a-f-]{36}$';

insert into public.chat_rooms (event_id)
select e.id from public.events e
where not exists (select 1 from public.chat_rooms c where c.event_id = e.id)
on conflict (event_id) do nothing;

insert into public.chat_room_members (room_id, user_id)
select c.id, p.user_id
from public.chat_rooms c
join public.event_participants p on p.event_id = c.event_id
on conflict (room_id, user_id) do nothing;
