-- Comein · 방이 생기는 순간도 알려 준다
--
-- 증상: 처음 말을 거는 1:1 대화가 받는 쪽 화면에 뜨지 않았다. 새로고침해야 나타났다.
-- 원인: 첫 대화는 **방이 먼저 생기고 말이 뒤따른다.** 그런데 publication 에는
--       chat_messages 만 있었다. 말은 실시간으로 도착하지만 받는 쪽은 그 방을 모르고,
--       방을 모르면 그 말은 어느 화면에도 걸리지 못한 채 스토어에만 남는다.
-- 고침: 방과 방 멤버도 publication 에 올린다.
--       · chat_rooms         — 일정 방이 생기는 순간(트리거)
--       · chat_room_members  — 내가 그 방의 사람이 되는 순간
--         ↳ 1:1 방은 만든 사람이 방을 먼저 넣고 멤버를 그 다음에 넣는다. 그래서 받는 쪽에는
--           chat_rooms INSERT 가 RLS(그 시점엔 아직 멤버가 아니다)에 걸려 오지 않고,
--           chat_room_members 의 내 줄이 도착하는 순간이 진짜 신호다. 둘 다 올려 둔다.
--
-- 이 마이그레이션 없이도 앱은 동작한다(프론트가 '모르는 방의 말' 을 보면 목록을 다시 받는다).
-- 다만 그건 뒤늦은 보정이고, 이건 제때 오는 신호다.
--
-- 적용: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run (여러 번 실행해도 안전)

alter table public.chat_rooms        replica identity full;
alter table public.chat_room_members replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.chat_rooms;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.chat_room_members;
exception when duplicate_object then null; end $$;
