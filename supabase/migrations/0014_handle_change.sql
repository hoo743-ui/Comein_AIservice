-- Comein · 이름은 자기가 정한다
--
-- 0004 는 가입할 때 이메일 앞부분에서 핸들을 뽑아 붙였다. hoo743, fapp1004 —
-- 사람이 고른 이름이 아니라 기계가 남긴 흔적이다. 그런데 0013 에서 이 핸들을
-- 초대코드로 삼았다. 남에게 알려 줄 이름이라면 최소한 자기가 정할 수 있어야 한다.
--
-- 그렇다고 아무 때나 바꾸게 두면 초대코드가 흔들린다. 내가 알던 @hoo743 이
-- 다음 주에 남의 것이 되어 있으면, 그 명함을 받았던 사람은 엉뚱한 사람에게 요청을 보낸다.
--
-- 그래서 셋을 함께 둔다.
--
--   ① 바꿀 수 있다        — 30일에 한 번
--   ② 옛 이름은 놓아주지 않는다 — 버린 핸들을 남이 가져갈 수 없다
--   ③ 바꾸는 길은 하나뿐   — change_handle() 밖에서는 트리거가 막는다
--
-- ③ 이 없으면 나머지는 장식이다. 0004 의 profiles_update 정책은 행 단위라
-- 핸들 컬럼 변경을 전혀 막지 않았다 — 주석은 "함부로 바꾸지 않는다" 라고 적어 뒀는데
-- 실제로는 REST 로 그냥 바꿀 수 있었다. 의도와 시행이 어긋나 있었다.
--
-- 적용: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run

-- ─────────────────────────────────────────────────────────
-- 1. 언제 바꿨는가
-- ─────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists handle_changed_at timestamptz;

-- ─────────────────────────────────────────────────────────
-- 2. 버린 이름 — 아무도 다시 가져갈 수 없다
-- ─────────────────────────────────────────────────────────
-- 사람이 기억하는 것은 이름이지 계정이 아니다. 놓아준 이름이 곧바로 남의 것이 되면
-- '그 이름으로 찾으면 그 사람' 이라는 약속이 깨진다.

create table if not exists public.handle_history (
  handle      text primary key check (handle ~ '^[a-z0-9_]{2,24}$'),
  user_id     uuid not null references auth.users (id) on delete cascade,
  released_at timestamptz not null default now()
);

alter table public.handle_history enable row level security;
-- 남이 버린 이름의 목록은 명부나 마찬가지다. 아무에게도 열지 않는다
-- (중복 검사는 아래 함수가 security definer 로 대신 본다).

-- ─────────────────────────────────────────────────────────
-- 3. 바꾸는 길은 하나뿐
-- ─────────────────────────────────────────────────────────

/* change_handle() 안에서만 참인 표식. 세션이 아니라 트랜잭션 안에서만 산다(is_local = true). */
create or replace function public.tg_lock_handle()
returns trigger language plpgsql as $$
begin
  if new.handle is distinct from old.handle
     and coalesce(current_setting('comein.allow_handle', true), '') <> 'on' then
    raise exception '핸들은 설정에서만 바꿀 수 있습니다' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists profiles_lock_handle on public.profiles;
create trigger profiles_lock_handle
  before update on public.profiles
  for each row execute function public.tg_lock_handle();

/* 이름을 바꾼다. 무엇이 막았는지 사람의 말로 돌려준다 —
   "실패했습니다" 만 있으면 사용자는 자기가 뭘 잘못했는지 모른 채 같은 걸 또 시도한다. */
create or replace function public.change_handle(new_handle text)
returns text language plpgsql security definer set search_path = public as $$
declare
  me   uuid := auth.uid();
  cur  text;
  last timestamptz;
  want text;
  days int;
begin
  if me is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;

  want := lower(btrim(coalesce(new_handle, '')));

  if want !~ '^[a-z0-9_]{2,24}$' then
    raise exception '핸들은 영문 소문자·숫자·밑줄 2~24자입니다';
  end if;

  select p.handle, p.handle_changed_at into cur, last
    from public.profiles p where p.id = me;

  if cur is null then
    raise exception '프로필이 없습니다';
  end if;
  if cur = want then
    return want;   -- 같은 이름으로 바꾸는 건 아무 일도 아니다(멱등)
  end if;

  -- 30일에 한 번. 자주 바뀌는 초대코드는 초대코드가 아니다.
  if last is not null and last > now() - interval '30 days' then
    days := ceil(extract(epoch from (last + interval '30 days' - now())) / 86400);
    raise exception '핸들은 30일에 한 번 바꿀 수 있어요. %일 뒤에 다시 시도해 주세요', days;
  end if;

  if exists (select 1 from public.profiles p where p.handle = want) then
    raise exception '이미 쓰고 있는 핸들이에요';
  end if;
  -- 남이 버린 이름도 막는다. 내가 예전에 쓰던 이름이면 도로 가져올 수 있다.
  if exists (select 1 from public.handle_history h where h.handle = want and h.user_id <> me) then
    raise exception '예전에 다른 사람이 쓰던 핸들이라 쓸 수 없어요';
  end if;

  -- 지금 이름을 놓아준다(자취로 남긴다) → 아무도 주워 갈 수 없다.
  insert into public.handle_history (handle, user_id) values (cur, me)
    on conflict (handle) do update set user_id = excluded.user_id, released_at = now();
  -- 되찾는 경우: 자취에서 뺀다.
  delete from public.handle_history h where h.handle = want and h.user_id = me;

  perform set_config('comein.allow_handle', 'on', true);   -- 이 트랜잭션에서만
  update public.profiles
     set handle = want, handle_changed_at = now()
   where id = me;

  return want;
end $$;

/* 언제 다시 바꿀 수 있는가 — 화면이 미리 말해 줄 수 있게. */
create or replace function public.my_handle_state()
returns table (handle text, changed_at timestamptz, can_change_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.handle,
         p.handle_changed_at,
         case when p.handle_changed_at is null then now()
              else p.handle_changed_at + interval '30 days' end
    from public.profiles p
   where p.id = auth.uid();
$$;
