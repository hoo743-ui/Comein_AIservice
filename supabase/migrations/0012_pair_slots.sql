-- Comein · 둘 사이의 가능한 시간
--
-- 지금까지 '언제가 되는가' 는 일정(event)이 있어야 물을 수 있었다(suggest_slots).
-- 그런데 대화는 일정보다 먼저다 — "내일 언제 볼까?" 는 아직 아무 자리도 없을 때 나온다.
-- 그래서 일정 없이, 사람 둘만으로 묻는 창구를 연다.
--
-- 이 함수가 있어야 §10 이 완성된다. 그전까지 화면은 제 달력만 보고 있었고,
-- 그건 '모른다' 를 '한가하다' 로 바꿔 읽지 않으려고 일부러 조용히 있던 상태였다.
--
-- 지키는 선은 0003 과 같다:
--   나가는 것:     이 시간대에 몇 명이 되는가
--   나가지 않는 것: 그 사람이 그때 무엇을 하는지 · 정확히 언제 바쁜지
--
-- 그리고 아무에게나 묻지 못한다(§30). 서로 잇겠다고 한 사이이거나,
-- 이미 같은 일정에서 만난 사이여야 한다. 남의 하루를 훑어보는 창구가 되면 안 된다.
--
-- 적용: Supabase 대시보드 → SQL Editor. 여러 번 실행해도 안전하다.

create or replace function public.pair_slots(
  peer uuid,
  win_start timestamptz,
  win_end timestamptz,
  duration_min int default 60,
  step_min int default 30,
  limit_n int default 8
)
returns table (
  slot_start timestamptz,
  slot_end timestamptz,
  available_count int,
  total_count int
)
language plpgsql stable security definer set search_path = public as $$
begin
  if peer is null or peer = auth.uid() then
    raise exception '상대를 지정해 주세요' using errcode = '22023';
  end if;
  -- 아는 사이에게만 묻는다.
  if not (public.is_connected(peer) or public.shares_event_with(peer)) then
    raise exception '연결된 사이가 아닙니다' using errcode = '42501';
  end if;
  -- 창이 지나치게 넓으면 거절한다 — 여러 날을 한 번에 훑으면 남의 하루가 재구성된다.
  if win_end <= win_start or win_end - win_start > interval '2 days' then
    raise exception '조회 범위가 너무 넓습니다' using errcode = '22023';
  end if;

  return query
  with parts as (
    select auth.uid() as user_id
    union
    select peer
  ),
  busy as (
    select xp.user_id,
           x.start_at as bs,
           coalesce(x.end_at, x.start_at + interval '1 hour') as be
    from public.events x
    join public.event_participants xp on xp.event_id = x.id
    where xp.status <> 'declined'
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
    (select count(*) from parts)::int
  from slots sl
  order by 3 desc, 1 asc
  limit limit_n;
end $$;

revoke all on function public.pair_slots(uuid, timestamptz, timestamptz, int, int, int) from public, anon;
grant execute on function public.pair_slots(uuid, timestamptz, timestamptz, int, int, int) to authenticated;
