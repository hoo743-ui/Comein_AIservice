-- Comein · 이메일 없이 들어온 사람에게도 제 이름표를 준다
--
-- 카카오 개인 앱에는 이메일 동의항목이 열리지 않는다(비즈 앱 전용). 그래서 카카오로
-- 들어온 사람에게는 이메일이 없다. 그런데 핸들을 이메일 앞부분에서만 뽑고 있었다.
--
--   base := split_part(coalesce(new.email, ''), '@', 1)   →  ''  →  'comein'
--
-- 결과는 comein, comein1, comein2 … 줄서기. 이름표가 순번이 되면 그건 이름표가 아니다.
-- 게다가 사람을 찾을 때 핸들로 찾으므로, 순번 핸들은 서로를 못 찾게 만든다.
--
-- 세 갈래로 짚어 본다: 이메일 → provider 가 준 아이디(닉네임/username) → 계정 uuid 앞자리.
-- 한글 닉네임은 [a-z0-9_] 만 남기면 비므로, 마지막 갈래가 실제로 자주 쓰인다.
-- uuid 앞 8자리는 사람이 읽을 수 있고(u3f9a2b1), 겹치지 않는다.
--
-- 적용: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run

create or replace function public.tg_new_user_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  base  text;
  cand  text;
  n     int := 0;
begin
  -- ① 이메일 앞부분
  base := lower(regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^a-z0-9_]', '', 'g'));

  -- ② provider 가 준 아이디 — GitHub 의 user_name, 카카오의 라틴 닉네임 등
  if length(base) < 2 then
    base := lower(regexp_replace(
      coalesce(
        nullif(btrim(meta ->> 'user_name'), ''),
        nullif(btrim(meta ->> 'preferred_username'), ''),
        nullif(btrim(meta ->> 'name'), ''),
        ''),
      '[^a-z0-9_]', '', 'g'));
  end if;

  -- ③ 그래도 없으면 계정 자신에게서 — 한글 닉네임만 있는 사람이 여기로 온다.
  if length(base) < 2 then
    base := 'u' || left(replace(new.id::text, '-', ''), 8);
  end if;

  base := left(base, 20);
  cand := base;
  while exists (select 1 from public.profiles p where p.handle = cand) loop
    n := n + 1;
    cand := left(base, 20) || n::text;
  end loop;

  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    cand,
    coalesce(
      nullif(btrim(meta ->> 'name'), ''),
      nullif(btrim(meta ->> 'full_name'), ''),
      nullif(btrim(meta ->> 'nickname'), ''),      -- 카카오는 여기에 이름을 담아 보낸다
      nullif(btrim(meta ->> 'user_name'), ''),
      cand
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
