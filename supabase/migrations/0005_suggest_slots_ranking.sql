-- Comein · 후보 시간의 순서를 바로잡는다
--
-- 0003 의 suggest_slots 는 여유(buffer)를 '많을수록 좋다'로 두고 근접도보다 앞에 세웠다.
-- 그래서 "금요일 7시에 보자" 고 말하면 오전 7시를 권했다 — 그 시간이 다른 일정에서
-- 가장 멀리 떨어져 있어서 여유 점수가 제일 높았기 때문이다.
--
-- 여유는 '많을수록 좋은 것'이 아니라 '모자라지 않으면 되는 것'이다.
-- 붙여 놓으면 둘 다 망가지지만, 여섯 시간을 비워 둔다고 더 좋은 회의가 되지는 않는다.
-- 그래서 여유는 문턱(15분)으로만 보고, 그다음은 말한 시각에 가까운 순으로 세운다.
--
-- 바뀌는 것은 순서뿐이다. 무엇을 내보내는지는 그대로다
-- (사람별로 언제 바쁜지는 여전히 이 함수 밖으로 나가지 않는다).
--
-- 적용: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run

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
  ),
  scored as (
    select
      sl.ss,
      sl.se,
      (select count(*) from parts p
        where not exists (
          select 1 from busy b
          where b.user_id = p.user_id and b.bs < sl.se and b.be > sl.ss
        ))::int as avail,
      (select count(*) from parts)::int as total,
      coalesce((
        select min(
          case when b.be <= sl.ss then extract(epoch from (sl.ss - b.be)) / 60
               when b.bs >= sl.se then extract(epoch from (b.bs - sl.se)) / 60
               else 0 end
        )::int
        from busy b
      ), 240) as buf,
      case when preferred is null then 0
           else (abs(extract(epoch from (sl.ss - preferred))) / 60)::int end as dist
    from slots sl
  )
  select sc.ss, sc.se, sc.avail, sc.total, sc.buf, sc.dist
  from scored sc
  order by
    sc.avail desc,          -- 1. 모두가 되는가
    (sc.buf >= 15) desc,    -- 2. 앞뒤 일정에 붙어 있지는 않은가 (많을수록이 아니라, 모자라지 않으면 된다)
    sc.dist asc,            -- 3. 말한 시각에 가까운가
    sc.buf desc,            -- 4. 그래도 갈리면 여유 있는 쪽
    sc.ss asc
  limit limit_n;
end $$;
