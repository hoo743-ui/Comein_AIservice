-- Comein · 어긋남을 오류로 던지지 않는다
--
-- 0010 의 save_conversation_state 는 version 이 어긋나면 40001 로 예외를 던졌다.
-- 40001 은 serialization_failure — 즉 "다시 시도하면 될 수도 있다" 는 뜻이고,
-- 커넥션 풀러와 클라이언트 라이브러리는 그 말을 곧이곧대로 듣고 **자동으로 재시도한다.**
-- 그런데 이 경우는 재시도해도 영원히 같은 결과다(version 은 여전히 어긋나 있다).
-- 결과는 재시도 폭풍이었고, 호출은 응답 없이 매달렸다(실제로 그렇게 멈췄다).
--
-- 고침: 어긋남은 오류가 아니라 사실이다. 예외를 던지는 대신 **지금 저장돼 있는 줄을
-- 그대로 돌려준다.** 부른 쪽은 version 이 자기가 보낸 것과 다른 것을 보고 알아챈다 —
-- 그리고 그때 할 일은 재시도가 아니라 '다시 읽고 다시 판단하기' 다.
--
-- 적용: Supabase 대시보드 → SQL Editor. 여러 번 실행해도 안전하다.

create or replace function public.save_conversation_state(
  r uuid,
  p_state text,
  p_constraints jsonb default '[]'::jsonb,
  p_proposed timestamptz[] default '{}',
  p_rejected timestamptz[] default '{}',
  p_confirmed_at timestamptz default null,
  p_last_message_id uuid default null,
  p_version int default null
)
returns public.conversation_states
language plpgsql security definer set search_path = public as $$
declare row public.conversation_states;
begin
  if not public.can_access_room(r) then
    raise exception '이 대화의 참여자가 아닙니다' using errcode = '42501';
  end if;
  if p_state not in ('idle', 'scheduling_detected', 'collecting_preferences',
                     'time_proposed', 'confirmed', 'cancelled') then
    raise exception '알 수 없는 대화 상태: %', p_state;
  end if;

  insert into public.conversation_states as cs
    (room_id, state, constraints, proposed, rejected, confirmed_at, last_message_id, version, updated_at)
  values
    (r, p_state, coalesce(p_constraints, '[]'::jsonb), coalesce(p_proposed, '{}'), coalesce(p_rejected, '{}'),
     p_confirmed_at, p_last_message_id, 1, now())
  on conflict (room_id) do update
    set state           = excluded.state,
        constraints     = excluded.constraints,
        proposed        = excluded.proposed,
        rejected        = excluded.rejected,
        confirmed_at    = excluded.confirmed_at,
        last_message_id = excluded.last_message_id,
        version         = cs.version + 1,
        updated_at      = now()
    where p_version is null or cs.version = p_version
  returning * into row;

  -- 못 썼다 — 그새 다른 화면이 먼저 고쳤다는 뜻이다.
  -- 던지지 않는다. 지금 저장돼 있는 것을 그대로 돌려준다:
  -- 부른 쪽은 version 이 자기 것과 다른 걸 보고 "내 것이 안 들어갔구나" 를 안다.
  if row.room_id is null then
    select * into row from public.conversation_states where room_id = r;
  end if;

  return row;
end $$;

revoke all on function public.save_conversation_state(uuid, text, jsonb, timestamptz[], timestamptz[], timestamptz, uuid, int) from public, anon;
grant execute on function public.save_conversation_state(uuid, text, jsonb, timestamptz[], timestamptz[], timestamptz, uuid, int) to authenticated;
