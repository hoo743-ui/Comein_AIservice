-- 이 프로젝트에 어느 마이그레이션까지 올라가 있는가
--
-- 왜 필요한가 —
--   supabase/migrations/ 의 파일은 사람이 대시보드에 붙여넣어 올린다. 그래서 **파일이
--   저장소에 있다는 것과 그 DB 에 올라가 있다는 것이 전혀 다른 일**인데, 지금까지
--   그 둘을 구별할 방법이 없었다. 확인하는 유일한 길이 앱을 써 보다 터지는 것이었다.
--
--   실제로 0016 을 올리다 `relation "public.chat_rooms" does not exist` 를 만났다.
--   원인은 다른 프로젝트의 SQL Editor 였는데, 그걸 알아내는 데 왕복이 몇 번 들었다.
--   이 쿼리 하나면 그 자리에서 답이 나온다.
--
-- 쓰는 법 —
--   Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. **읽기만 한다**(DDL 없음).
--   아무 프로젝트에서나 안전하게 돌려도 된다.
--
-- 읽는 법 —
--   `status` 가 전부 `OK` 여야 한다. `MISSING` 이 하나라도 있으면 그 번호의 파일부터
--   순서대로 올린다. 위에서부터 처음 MISSING 이 나오는 지점이 곧 '여기서 멈췄다' 이다.
--
--   **어느 프로젝트인지는 이 쿼리가 답해 주지 못한다.** Supabase 의 프로젝트 ref 를
--   DB 안에서 읽는 표준 자리가 없다. 브라우저 주소의 `/project/<ref>/` 를 눈으로 대조한다 —
--   `frontend/.env.local` 의 `NEXT_PUBLIC_SUPABASE_URL` 과 같은 ref 여야 한다.
--   (0016 을 엉뚱한 프로젝트에 올리다 겪은 일이 정확히 이것이다.)

with fns as (
  select p.proname as name, pg_get_functiondef(p.oid) as src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
tbls as (
  select table_name from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
),
cols as (
  select table_name, column_name from information_schema.columns
  where table_schema = 'public'
),
pubs as (
  select tablename from pg_publication_tables where pubname = 'supabase_realtime'
),
checked(seq, migration, looked_for, present) as (
  values
    (1,  '0001 shared_events_and_chat', '표 5개 — events · event_participants · chat_rooms · chat_room_members · chat_messages',
         (select count(*) from tbls where table_name in
            ('events','event_participants','chat_rooms','chat_room_members','chat_messages')) = 5),

    (2,  '0002 room_access_without_ordering', '함수 can_access_room',
         exists (select 1 from fns where name = 'can_access_room')),

    (3,  '0003 schedule_proposals', '표 schedule_proposals · schedule_proposal_participants',
         (select count(*) from tbls where table_name in
            ('schedule_proposals','schedule_proposal_participants')) = 2),

    (4,  '0004 profiles_and_connections', '표 profiles · connections, 함수 search_people',
         (select count(*) from tbls where table_name in ('profiles','connections')) = 2
         and exists (select 1 from fns where name = 'search_people')),

    (5,  '0005 suggest_slots_ranking', 'suggest_slots 가 distance_min 을 돌려주는가',
         exists (select 1 from fns where name = 'suggest_slots' and src like '%distance_min%')),

    (6,  '0006 day_availability', '함수 day_availability',
         exists (select 1 from fns where name = 'day_availability')),

    (7,  '0007 fix_respond_ambiguous_event_id', 'respond_to_proposal 이 event_id 를 한정해 부르는가',
         exists (select 1 from fns where name = 'respond_to_proposal' and src like '%pr.event_id%')),

    (8,  '0008 message_edit_delete', 'chat_messages 의 deleted_at · is_edited 칸',
         (select count(*) from cols where table_name = 'chat_messages'
            and column_name in ('deleted_at','is_edited')) = 2),

    (9,  '0009 handle_without_email', 'tg_new_user_profile 이 이메일 없이도 핸들을 짓는가',
         exists (select 1 from fns where name = 'tg_new_user_profile' and src like '%preferred_username%')),

    (10, '0010 conversation_context', '표 conversation_states · ai_suggestions · event_sources',
         (select count(*) from tbls where table_name in
            ('conversation_states','ai_suggestions','event_sources')) = 3),

    (11, '0011 state_conflict_without_retry_storm', 'save_conversation_state 에 p_version 인자',
         exists (select 1 from fns where name = 'save_conversation_state' and src like '%p_version%')),

    (12, '0012 pair_slots', '함수 pair_slots',
         exists (select 1 from fns where name = 'pair_slots')),

    (13, '0013 connection_requests', '표 connection_requests, 함수 request_connection',
         exists (select 1 from tbls where table_name = 'connection_requests')
         and exists (select 1 from fns where name = 'request_connection')),

    (14, '0014 handle_change', '표 handle_history, 함수 change_handle',
         exists (select 1 from tbls where table_name = 'handle_history')
         and exists (select 1 from fns where name = 'change_handle')),

    (15, '0015 realtime_rooms', 'Realtime 이 chat_rooms · chat_room_members 를 싣는가',
         (select count(*) from pubs where tablename in ('chat_rooms','chat_room_members')) = 2),

    (16, '0016 dm_is_exactly_two_people', '함수 is_dm_peer',
         exists (select 1 from fns where name = 'is_dm_peer')),

    (17, '0017 groups', '표 groups · group_members, events.group_id, 함수 sync_group_calendar',
         (select count(*) from tbls where table_name in ('groups','group_members')) = 2
         and exists (select 1 from cols where table_name = 'events' and column_name = 'group_id')
         and exists (select 1 from fns where name = 'sync_group_calendar')),

    (18, '0018 event_priority', 'events.priority 칸',
         exists (select 1 from cols where table_name = 'events' and column_name = 'priority'))
)
select
  seq,
  migration,
  case when present then 'OK' else 'MISSING' end as status,
  looked_for
from checked

union all

select
  99,
  '── 요약 ──',
  (select (count(*) filter (where present))::text || '/' || count(*)::text from checked),
  -- 프로젝트 ref 는 DB 안에서 알 수 없다(Supabase 가 심어 두는 표준 자리가 없다).
  -- 대시보드 URL 의 /project/<ref>/ 를 눈으로 대조한다 — 위 주석 참고.
  '표 ' || (select count(*)::text from tbls)
    || ' · 함수 ' || (select count(distinct name)::text from fns)
    || ' · Realtime ' || (select count(*)::text from pubs)
    -- 대략의 기대치다. Supabase 가 스스로 심는 것이 섞일 수 있어 정확히 맞을 필요는 없다 —
    -- 자릿수가 크게 다르면 그때 위 표에서 어느 줄이 MISSING 인지 보면 된다.
    || '  (대략의 기대: 표 16 · 함수 38 · Realtime 13)'

order by seq;
