-- Comein · 내가 부르는 이름
--
-- 핸들(@fapp1004)은 서로를 **찾기** 위한 이름이고, 표시 이름(display_name)은 그 사람이
-- **스스로 정한** 이름이다. 둘 다 필요하지만 둘 다 내 것이 아니다 — 대화 목록에서
-- "@fapp1004" 를 보고 그게 누구였는지 한 번 더 떠올려야 한다면, 그 목록은 아직 내 것이 아니다.
--
-- 그래서 세 번째 이름을 둔다: **내가 부르는 이름.**
--   · 나만 본다. 상대는 자기에게 무슨 이름이 붙었는지 알 수 없다.
--   · 상대가 자기 이름을 바꿔도 흔들리지 않는다.
--   · 안 붙여도 된다 — 없으면 표시 이름이 그대로 쓰인다.
--
-- 왜 브라우저(localStorage)가 아니라 표인가 —
--   이건 보기 설정이 아니라 **내가 아는 사실**이다. 기기를 바꿨다고 아는 사람이
--   모르는 사람이 되면 안 된다. (반면 '여기서부터 새로'(접기)는 보기 설정이라 기기에 남긴다.)
--
-- 적용: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run (여러 번 실행해도 안전)

create table if not exists public.person_labels (
  owner_id   uuid not null references auth.users (id) on delete cascade,
  person_id  uuid not null references auth.users (id) on delete cascade,
  label      text not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, person_id),
  -- 나 자신에게 별명을 붙이는 자리가 아니다.
  constraint person_labels_not_self check (owner_id <> person_id),
  -- 공백만 남은 이름은 이름이 아니다. 길이는 목록 한 줄에 들어갈 만큼만.
  constraint person_labels_len check (char_length(btrim(label)) between 1 and 40)
);

-- 내 것만 통째로 읽는 일이 대부분이다(사람 목록을 그릴 때 한 번).
create index if not exists person_labels_owner_idx on public.person_labels (owner_id);

alter table public.person_labels enable row level security;

-- ─────────────────────────────────────────────────────────
-- RLS — 내가 붙인 것만, 그리고 나만
-- ─────────────────────────────────────────────────────────
-- 여기서 가장 중요한 것은 select 다. 남이 자기에게 붙은 이름을 읽을 수 있으면
-- 이 기능은 곧 '남을 뭐라고 부르는지 서로 아는' 기능이 된다 — 그건 전혀 다른 물건이다.
-- 그래서 person_id = auth.uid() 는 **읽기 조건에 넣지 않는다.**

drop policy if exists person_labels_select on public.person_labels;
create policy person_labels_select on public.person_labels for select
  using (owner_id = auth.uid());

drop policy if exists person_labels_insert on public.person_labels;
create policy person_labels_insert on public.person_labels for insert
  with check (owner_id = auth.uid());

drop policy if exists person_labels_update on public.person_labels;
create policy person_labels_update on public.person_labels for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists person_labels_delete on public.person_labels;
create policy person_labels_delete on public.person_labels for delete
  using (owner_id = auth.uid());

-- 고친 흔적은 남긴다(0008 의 메시지와 같은 이유는 아니다 — 여기서는 그저 최신값을 알기 위해).
create or replace function public.tg_person_label_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists person_labels_touch on public.person_labels;
create trigger person_labels_touch
  before update on public.person_labels
  for each row execute function public.tg_person_label_touch();

comment on table public.person_labels is
  '내가 그 사람을 부르는 이름. 나만 읽는다 — 상대는 자기에게 붙은 이름을 알 수 없다.';
