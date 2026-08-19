-- Comein · 1:1 방은 정확히 두 사람의 것이다
--
-- 지금까지 '이 방에 들어갈 수 있는가' 를 이렇게 물었다:
--
--     position(auth.uid()::text in c.dm_key) > 0
--
-- **내 uuid 가 그 문자열 어딘가에 있으면** 통과다. 두 사람의 방이라는 약속은
-- 클라이언트(`[me, peer].sort().join(":")`)에만 있었고 서버는 그걸 모르고 있었다.
--
-- 그래서 이런 것이 됐다:
--   · `dm_key = "<나>:<A>:<B>"` 로 방을 만들면 A 와 B 도 그 방에 들어온다.
--     둘은 서로 부른 적도, 나와 이어진 적도 없다.
--   · 1:1 방의 멤버 표에 아무 uuid 나 넣을 수 있었다 — 만든 사람이면 통과였으므로.
--
-- 남의 기존 대화를 읽을 수 있는 구멍은 아니다(`chat_rooms` 에 UPDATE 정책이 없어
-- 남의 방 dm_key 를 고칠 수 없다). 그러나 초대한 적 없는 사람을 대화에 앉힐 수 있다는
-- 것만으로 충분히 나쁘다 — 이 제품이 사람에 대해 지키기로 한 선이 "상대의 승낙 없이
-- 누군가가 목록에 들어오는 일은 없다" 이기 때문이다(0013, 그리고 사용 가이드의 그 문장).
--
-- 여기서 문자열 포함(position)을 **정확한 일치**로 바꾼다. 규칙을 클라이언트에서
-- 서버로 옮기는 일이고, 그래야 클라이언트를 우회해도 같은 약속이 지켜진다.
--
-- 적용: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run

-- ─────────────────────────────────────────────────────────
-- 1. dm_key 의 모양 — uuid 둘, 정렬된 순서로
-- ─────────────────────────────────────────────────────────
-- 정렬을 요구하는 이유: 누가 먼저 말을 걸든 같은 방으로 수렴해야 한다(0001 의 약속).
-- `a:b` 와 `b:a` 가 둘 다 허용되면 같은 두 사람에게 방이 두 개 생긴다.
--
-- NOT VALID 로 붙인다 — 새로 들어오는 행은 막고, 이미 있는 행은 건드리지 않는다.
-- (시험 중에 만들어진 낡은 행이 있어도 마이그레이션이 그 자리에서 멈추지 않게.
--  낡은 행은 아래 is_dm_peer 가 어차피 통과시키지 않는다.)
alter table public.chat_rooms drop constraint if exists chat_rooms_dm_key_pair;
alter table public.chat_rooms add constraint chat_rooms_dm_key_pair
  check (
    dm_key is null
    or (
      dm_key ~ '^[0-9a-f-]{36}:[0-9a-f-]{36}$'
      -- `collate "C"` 로 바이트 순서를 못 박는다. 이 키를 만드는 쪽은 브라우저의
      -- `[me, peer].sort()` 이고 그건 코드 유닛 순서다 — DB 의 기본 콜레이션(en_US 등)이
      -- 다른 답을 주면 정상적인 방 생성이 제약에 걸려 튕긴다. 같은 자를 쓴다.
      and split_part(dm_key, ':', 1) collate "C" < split_part(dm_key, ':', 2) collate "C"
    )
  ) not valid;

-- ─────────────────────────────────────────────────────────
-- 2. '그 둘 중 하나인가' — 포함이 아니라 일치로
-- ─────────────────────────────────────────────────────────
create or replace function public.is_dm_peer(key text)
returns boolean language sql stable security definer set search_path = public as $$
  select key is not null
     and auth.uid()::text in (split_part(key, ':', 1), split_part(key, ':', 2));
$$;

-- 방에 들어갈 수 있는가 — 일정 방은 그대로, 1:1 방만 좁힌다.
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
        or (c.dm_key is not null and public.is_dm_peer(c.dm_key))
      )
  );
$$;

-- ─────────────────────────────────────────────────────────
-- 3. 정책 — 만들 때도, 사람을 넣을 때도 같은 자를 쓴다
-- ─────────────────────────────────────────────────────────

-- 1:1 방은 그 두 사람 중 하나만 열 수 있다.
drop policy if exists rooms_insert on public.chat_rooms;
create policy rooms_insert on public.chat_rooms for insert
  with check (dm_key is not null and public.is_dm_peer(dm_key));

-- 멤버로 넣을 수 있는 사람도 그 둘뿐이다.
--
-- 일정 방은 이 조건에 걸리지 않는다(dm_key 가 null 이라 아래 not exists 가 참).
-- 거긴 참여자 표가 정하고, 트리거(tg_participant_to_member)가 security definer 로 넣는다.
drop policy if exists members_insert on public.chat_room_members;
create policy members_insert on public.chat_room_members for insert
  with check (
    public.can_access_room(room_id)
    and not exists (
      select 1 from public.chat_rooms c
      where c.id = room_id
        and c.dm_key is not null
        and user_id::text not in (split_part(c.dm_key, ':', 1), split_part(c.dm_key, ':', 2))
    )
  );

-- ─────────────────────────────────────────────────────────
-- 4. 확인하는 법 (SQL Editor 에서 손으로)
-- ─────────────────────────────────────────────────────────
-- 아래는 **막혀야** 정상이다. 통과하면 이 마이그레이션이 안 올라간 것이다.
--
--   -- ① 세 사람짜리 키로 방 만들기 → check 제약에서 막힌다
--   insert into chat_rooms (dm_key)
--   values (auth.uid()::text || ':11111111-1111-1111-1111-111111111111'
--                            || ':22222222-2222-2222-2222-222222222222');
--
--   -- ② 남들끼리의 방 만들기 → rooms_insert 에서 막힌다
--   insert into chat_rooms (dm_key)
--   values ('11111111-1111-1111-1111-111111111111:22222222-2222-2222-2222-222222222222');
--
--   -- ③ 내 1:1 방에 제3자 넣기 → members_insert 에서 막힌다
--   insert into chat_room_members (room_id, user_id)
--   values ('<내 dm 방 id>', '33333333-3333-3333-3333-333333333333');
