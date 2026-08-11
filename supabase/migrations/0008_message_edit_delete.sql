-- Comein · 남긴 말을 고치고 지우기
--
-- 0001 은 말을 못 고치게 두었다("남긴 말은 고치거나 지우지 않는다"). 대화를 기록으로 본
-- 판단이었지만, 사람은 오타를 내고 잘못 보낸다. 고칠 수 없는 대화는 조심스러워지고,
-- 조심스러운 대화는 잘 쓰이지 않는다.
--
-- 다만 규칙은 분명히 한다:
--   · 자기가 쓴 말만 고치고 지운다 (프론트에서 버튼을 숨기는 것으로 끝내지 않는다)
--   · 지우는 건 soft delete — 행은 남는다. 나중에 "삭제된 메시지입니다" 로 자리를 남기든,
--     아예 감추든 화면이 정할 수 있게 구조를 열어 둔다.
--   · 고친 흔적은 남긴다(is_edited). 조용히 바뀌는 대화는 믿을 수 없다.
--
-- 적용: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run (0001 이후, 여러 번 실행해도 안전)

alter table public.chat_messages
  add column if not exists updated_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists is_edited  boolean not null default false;

-- 지워진 말을 걸러 읽는 일이 잦다 — 방 안에서 살아 있는 것만 빠르게.
create index if not exists chat_messages_room_live_idx
  on public.chat_messages (room_id, created_at)
  where deleted_at is null;

/* 고칠 때마다 흔적을 남긴다. 화면이 잊어도 표에는 남는다.
   (내용이 그대로면 '고쳤다' 고 하지 않는다 — 스크롤만 해도 수정됨이 붙으면 거짓말이 된다.) */
create or replace function public.tg_message_touch()
returns trigger language plpgsql as $$
begin
  if new.content is distinct from old.content then
    new.updated_at := now();
    new.is_edited  := true;
  end if;
  return new;
end $$;

drop trigger if exists chat_messages_touch on public.chat_messages;
create trigger chat_messages_touch
  before update on public.chat_messages
  for each row execute function public.tg_message_touch();

-- ─────────────────────────────────────────────────────────
-- RLS — 내 말만
-- ─────────────────────────────────────────────────────────
-- 고치는 것도 지우는 것도 update 다(soft delete). 그래서 정책은 하나면 된다.
-- 방을 옮기거나 남의 이름으로 바꾸는 것은 with check 가 막는다.

drop policy if exists messages_update on public.chat_messages;
create policy messages_update on public.chat_messages for update
  using (sender_id = auth.uid() and public.is_room_member(room_id))
  with check (sender_id = auth.uid() and public.is_room_member(room_id));

-- 진짜 지우기(hard delete)는 열지 않는다. 대화의 앞뒤가 통째로 사라지면
-- 남은 사람들이 맥락을 잃는다 — 지움은 deleted_at 으로만 표시한다.

-- ─────────────────────────────────────────────────────────
-- 지우기 — 내용까지 비운다
-- ─────────────────────────────────────────────────────────
-- deleted_at 만 세우고 content 를 남겨 두면, 화면이 감춰도 서버에는 그 말이 그대로 있다.
-- "지웠다" 고 말한 이상 내용은 비운다(빈 문자열은 CHECK 에 걸리므로 한 글자 표식만 남긴다).

create or replace function public.delete_message(m uuid)
returns void language plpgsql security definer set search_path = public as $$
declare row_sender uuid;
begin
  select sender_id into row_sender from public.chat_messages where id = m;
  if row_sender is null then raise exception '없는 메시지입니다'; end if;
  if row_sender <> auth.uid() then
    raise exception '내가 쓴 말만 지울 수 있습니다' using errcode = '42501';
  end if;

  update public.chat_messages
     set deleted_at = now(), content = '·'
   where id = m;
end $$;

revoke all on function public.delete_message(uuid) from public, anon;
grant execute on function public.delete_message(uuid) to authenticated;
