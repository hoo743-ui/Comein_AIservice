-- Comein · 전원이 동의해도 일정이 앉지 않던 것
--
-- 증상: 마지막 사람이 '동의' 를 눌러도 아무 일도 일어나지 않았다.
--       (화면에는 그대로 '1명 대기 중', 일정 시각도 그대로)
-- 원인: respond_to_proposal 의 반환 컬럼 이름이 `event_id` 인데,
--       확정 단계의 이 줄이 컬럼을 한정하지 않았다 —
--           update public.event_participants set status='accepted' where event_id = pr.event_id;
--       Postgres 는 이 `event_id` 가 표의 컬럼인지 함수의 출력 이름인지 가릴 수 없어
--       `column reference "event_id" is ambiguous` 로 거절한다.
--       하필 **전원 동의로 확정되는 순간에만** 지나가는 줄이라, 제안도 응답도 멀쩡해 보였다.
-- 고침: 표에 별칭을 주어 어느 쪽인지 분명히 한다. 로직은 그대로다.
--
-- 적용: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run (0003 이후 언제든, 여러 번 실행해도 안전)

create or replace function public.respond_to_proposal(
  p uuid,
  resp text,
  alt timestamptz default null
)
returns table (status text, event_id uuid, waiting int)
language plpgsql security definer set search_path = public as $$
declare
  pr public.schedule_proposals;
  left_n int;
begin
  select * into pr from public.schedule_proposals where id = p;
  if pr.id is null then raise exception '없는 제안입니다'; end if;
  if not public.is_event_participant(pr.event_id) then
    raise exception '이 일정의 참여자가 아닙니다' using errcode = '42501';
  end if;
  if resp not in ('accepted', 'declined', 'alternative') then
    raise exception '알 수 없는 응답: %', resp;
  end if;

  insert into public.schedule_proposal_participants (proposal_id, user_id, response, alt_start_at, responded_at)
  values (p, auth.uid(), resp, alt, now())
  on conflict (proposal_id, user_id) do update
    set response = excluded.response, alt_start_at = excluded.alt_start_at, responded_at = now();

  -- 여기서부터 한 번에 한 사람만 지나간다.
  select * into pr from public.schedule_proposals where id = p for update;

  if pr.status = 'confirmed' then
    return query select pr.status, pr.event_id, 0; return;
  end if;

  -- 한 명이라도 거절하면 자동으로 확정하지 않는다(§8). 일정은 서 있는 채로 둔다.
  if resp in ('declined', 'alternative') then
    update public.schedule_proposals sp2 set status = 'pending' where sp2.id = p;
    return query select 'pending'::text, pr.event_id, -1; return;
  end if;

  select count(*) into left_n
  from public.event_participants ep
  left join public.schedule_proposal_participants sp
         on sp.proposal_id = p and sp.user_id = ep.user_id
  where ep.event_id = pr.event_id
    and coalesce(sp.response, 'pending') <> 'accepted';

  if left_n = 0 then
    -- 새 일정을 만들지 않는다. 서 있던 일정이 시각을 얻고 앉는다.
    update public.events ev
       set start_at = pr.proposed_start_at,
           end_at   = pr.proposed_end_at,
           title    = coalesce(pr.title, ev.title),
           status   = 'confirmed'
     where ev.id = pr.event_id;

    update public.schedule_proposals sp2 set status = 'confirmed' where sp2.id = p;
    -- ★ 여기가 문제였던 줄 — 표에 별칭을 주어 함수의 출력 이름과 갈라 놓는다.
    update public.event_participants ep2 set status = 'accepted' where ep2.event_id = pr.event_id;

    return query select 'confirmed'::text, pr.event_id, 0;
  else
    update public.schedule_proposals sp2 set status = 'pending' where sp2.id = p;
    return query select 'pending'::text, pr.event_id, left_n;
  end if;
end $$;

revoke all on function public.respond_to_proposal(uuid, text, timestamptz) from public, anon;
grant execute on function public.respond_to_proposal(uuid, text, timestamptz) to authenticated;
