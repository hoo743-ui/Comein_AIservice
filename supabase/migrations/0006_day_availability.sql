-- Comein · 함께 보는 하루 — 슬롯별 '몇 명이 되는가'
--
-- 대화방 옆에 하루를 세워 두고 거기서 시간을 맞춘다. 그러려면 "지금 이 시간에 몇 명이 되는지"를
-- 하루치로 알아야 하는데, 그걸 사람별 바쁜 구간으로 내보내면 남의 하루가 그대로 재구성된다.
-- 0003 의 suggest_slots 가 지킨 규칙을 여기서도 지킨다 — **나가는 건 숫자뿐이다.**
--
--   내 일정        → 클라이언트가 이미 갖고 있다(내 것이니 제목까지 보여도 된다)
--   남의 일정      → 여기서 집계만 한다. 누가 바쁜지도, 무엇 때문인지도 나가지 않는다
--
-- 적용: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run (0003 이후)

create or replace function public.day_availability(
  e         uuid,
  day_start timestamptz,
  day_end   timestamptz,
  slot_min  int default 30
)
returns table (slot_start timestamptz, available_count int, total_count int)
language plpgsql stable security definer set search_path = public as $$
declare
  step interval;
begin
  if not public.is_event_participant(e) then
    raise exception '이 일정의 참여자가 아닙니다' using errcode = '42501';
  end if;

  -- 너무 잘게 쪼개 달라는 요청은 받지 않는다. 1분 단위로 훑으면 그것도 재구성이다.
  slot_min := least(greatest(coalesce(slot_min, 30), 15), 120);
  step := make_interval(mins => slot_min);

  -- 하루를 넘는 창도 받지 않는다(한 번에 이틀치를 긁어 가지 못하게).
  if day_end > day_start + interval '32 hours' then
    day_end := day_start + interval '32 hours';
  end if;

  return query
  with slots as (
    select s as slot_from, s + step as slot_to
    from generate_series(day_start, day_end - step, step) as s
  ),
  parts as (
    select p.user_id from public.event_participants p where p.event_id = e
  )
  select
    sl.slot_from,
    count(*) filter (
      where not exists (
        select 1
        from public.events x
        join public.event_participants xp on xp.event_id = x.id and xp.user_id = pa.user_id
        where x.id <> e                       -- 이 일정 자신과의 충돌은 세지 않는다
          and xp.status <> 'declined'
          and x.start_at < sl.slot_to
          and coalesce(x.end_at, x.start_at + interval '1 hour') > sl.slot_from
      )
    )::int as available_count,
    count(*)::int as total_count
  from slots sl
  cross join parts pa
  group by sl.slot_from
  order by sl.slot_from;
end $$;

revoke all on function public.day_availability(uuid, timestamptz, timestamptz, int) from public, anon;
grant execute on function public.day_availability(uuid, timestamptz, timestamptz, int) to authenticated;
