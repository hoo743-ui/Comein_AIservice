# 09. Database — 실제로 도는 스키마

> **진실은 이 문서가 아니라 [`supabase/migrations/`](../supabase/migrations) 다.**
> 0001~0015 를 순서대로 올리면 지금 도는 DB 가 된다. 이 문서는 그 15개 파일을 처음 읽는 사람이
> **무엇이 어디 있는지** 알 수 있게 짚어 주는 안내지, 별도의 설계도가 아니다.
> 어긋나면 마이그레이션이 맞고 이 문서가 틀렸다.
>
> `CLAUDE.md §7` 의 표는 **설계 어휘**다(Conversation·Message·Memo·Meeting·Reminder…).
> 아래는 실제로 만들어진 것이고, 둘은 다르다 — 그 차이를 마지막 절에 적어 둔다.

DB 는 Supabase(Postgres)다. **프론트가 직접 붙는다** — 백엔드는 이 DB 에 접속하지 않는다
([`06_BACKEND.md`](./06_BACKEND.md)). 그래서 권한은 애플리케이션 코드가 아니라
**RLS(행 단위 보안)** 가 지킨다.

---

## 1. 규칙 하나

> **같은 일정을 여럿이 본다고 해서 일정을 복제하지 않는다.**

canonical `events` 행은 하나이고, 참여자들이 같은 `event_id` 를 함께 바라본다.
그래서 시간이 바뀌면 한 줄만 고치면 모두의 캘린더가 함께 바뀐다.
이 규칙이 아래 모든 표의 모양을 정한다.

```
auth.users ─┬─< profiles (1:1 · handle)
            ├─< connections >─ auth.users        (양방향 · 정렬해 한 줄)
            ├─< connection_requests               (청함 → 상대가 받음)
            └─< event_participants >─ events ─┬─ chat_rooms ─< chat_messages
                                              │       └─< chat_room_members
                                              ├─< schedule_proposals ─< …_participants
                                              ├─< conversation_states  (방 하나의 기억)
                                              ├─< ai_suggestions
                                              └─< event_sources
                                        handle_history (놓아준 이름은 아무도 못 가져간다)
```

## 2. 표 14개 — 어느 마이그레이션에서 왔나

| 표 | 파일 | 무엇 |
|---|---|---|
| `events` | 0001 | 공유 일정. `status`: `pending`(AI 제안) / `confirmed`(사람이 확정) |
| `event_participants` | 0001 | 누가 그 일정에 있는가. `role`(owner/participant) · `status`(invited/accepted/declined) |
| `chat_rooms` | 0001 | 방은 두 종류다 — 일정에 매인 방(`event_id`) 이거나 두 사람만의 방(`dm_key`) |
| `chat_room_members` | 0001 | 그 방의 사람들 |
| `chat_messages` | 0001 | 남긴 말. 지움은 hard delete 가 아니라 `deleted_at`(0008) |
| `schedule_proposals` | 0003 | 제안된 시각과 근거. **한 일정에 살아 있는 제안은 하나뿐**(부분 유니크 인덱스) |
| `schedule_proposal_participants` | 0003 | 각자의 답(pending/accepted/declined/alternative) |
| `profiles` | 0004 | 표시 이름과 `handle` — 남이 나를 찾는 이름이자 초대코드 |
| `connections` | 0004 | 이어진 사이. 두 uid 를 정렬해 한 줄로 둔다(양방향을 두 줄로 두지 않는다) |
| `event_sources` | 0004 | 이 일정이 어디서 왔는가 |
| `conversation_states` | 0010 | 방 하나의 기억 — 어디까지 조율됐는가, 무엇이 거절됐는가. `version` 으로 어긋남을 안다 |
| `ai_suggestions` | 0010 | AI 가 권한 시각과 그 답. 같은 것을 두 번 권하지 않기 위해 |
| `connection_requests` | 0013 | 청함. 상대가 받아야 `connections` 가 된다 |
| `handle_history` | 0014 | 놓아준 이름. 30일에 한 번만 바꿀 수 있고, 놓은 이름은 아무도 가져가지 못한다 |

`dm_key` 는 두 uid 를 정렬해 이은 값이다 — **누가 먼저 말을 걸든 같은 방으로 수렴한다.**

## 3. 관계가 저절로 맞아떨어지게 — 트리거 4개

사람이 잊어도 DB 가 기억하는 것들이다.

| 트리거 | 언제 | 무엇 |
|---|---|---|
| `tg_event_bootstrap` | 일정 INSERT | 만든 사람을 owner·accepted 참여자로 넣고, 그 일정의 방을 만든다 |
| `tg_participant_to_member` | 참여자 INSERT/DELETE | 참여자가 되면 그 방 멤버가 되고, 빠지면 접근이 끊긴다 (**남긴 말은 지우지 않는다** — 대화의 앞뒤가 사라지면 남은 사람이 맥락을 잃는다) |
| `tg_new_user_profile` | 가입 | 프로필과 handle 을 만든다 |
| `tg_lock_handle` | handle UPDATE | 30일 규칙을 지키고 옛 이름을 `handle_history` 로 보낸다 |

`tg_touch_updated_at` · `tg_message_touch` 는 시각 도장이다.

## 4. RLS — id 를 알아도 남의 것은 못 본다

13개 표에 정책 31개. 핵심은 셋이다.

```sql
-- 참여한 일정만 보인다. 고치고 지우는 건 주최자만.
events_select   using (owner_id = auth.uid() or public.is_event_participant(id))
-- 그 방의 멤버만 읽고, 자기 이름으로만 쓴다.
messages_select using (public.is_room_member(room_id))
messages_insert with check (sender_id = auth.uid() and public.is_room_member(room_id))
```

**왜 `security definer` 함수로 감쌌나.** 정책 안에서 `event_participants` 를 다시 조회하면
그 표의 정책이 또 불려 **무한 재귀**가 난다. `is_event_participant` · `is_event_owner` ·
`is_room_member` 가 그 고리를 끊는다.

**쓰기를 정책으로 열지 않은 자리가 있다.** `schedule_proposals` 는 select 만 열려 있고
insert/update 정책이 없다 — 아래 함수들만이 제안을 만들고 바꾼다. 아무나 직접 `status` 를
`confirmed` 로 적을 수 있으면 '전원 동의' 는 약속이 아니게 된다.

## 5. 창구 — 표를 직접 만지지 않고 부르는 함수 34개

권한 판정과 약속이 여기 있다. 화면은 표가 아니라 이 함수들을 부른다.

### 시간이 정해지는 길 (0003 · 0005 · 0006 · 0012)

| 함수 | 무엇을 돌려주나 |
|---|---|
| `availability_for(e, s, f)` | 사람마다 `available` / `busy` / `unknown` **한 글자뿐** |
| `day_availability(e, …)` | 하루를 슬롯으로 — **몇 명이 되는가**(집계만) |
| `suggest_slots(e, …)` | 쓸 만한 시간대. 모두 가능한가 · 앞뒤 여유 · 원래 말한 시각과의 거리로 줄 세운다 |
| `pair_slots(peer, …)` | 두 사람만의 창 |
| `open_proposal(e, …)` | 제안을 연다. 이전 제안은 `superseded` — 답을 기다리는 제안이 둘이면 어디에 답할지 모른다 |
| `respond_to_proposal(p, resp)` | 답하고, **그 답으로 전원이 채워지면 그 자리에서 일정을 앉힌다** |
| `my_conflicts_with(e)` | 확정 뒤 내 개인 일정과 겹쳤는가 — 나에 대해서만 |

> **"저 사람이 그 시간에 되는지는 알되, 그때 무엇을 하는지는 모른다."**
> 그래서 충돌 판정을 클라이언트로 내보내지 않는다. 남의 일정을 읽어야 판정할 수 있고,
> 읽게 해 주면 그 순간 이 약속이 무너진다. 판정은 DB 안에서 끝내고 결론만 내보낸다.
> 나가지 않는 것: 제목 · 장소 · 설명 · 메모 · 그 사람이 정확히 언제 바쁜지.

> `respond_to_proposal` 은 **확정을 별도 호출로 떼어 놓지 않는다.** 마지막 두 사람이 동시에
> 동의하면 "다 모였네" 를 둘 다 보고 둘 다 확정하려 든다. 답과 확정을 한 트랜잭션에 묶고
> 제안 줄을 `for update` 로 잠가, 확정은 어떤 순서로 눌러도 한 번만 일어난다.

### 사람 (0004 · 0013 · 0014)

`search_people` · `my_people` · `is_connected` · `shares_event_with` ·
`request_connection` · `answer_connection_request` · `cancel_connection_request` ·
`my_connection_requests` · `connect_with` · `disconnect_from` ·
`change_handle` · `my_handle_state`

### 대화의 기억 (0008 · 0010)

`delete_message` · `get_conversation_state` · `save_conversation_state` ·
`record_suggestion` · `answer_suggestion`

> `save_conversation_state` 는 어긋남을 **오류로 던지지 않는다.** `version` 이 안 맞으면
> 40001 대신 **지금 저장돼 있는 줄**을 돌려준다 — 40001 로 던지면 풀러가 자동 재시도해
> 영원히 같은 결과를 되풀이한다(실제로 매달렸다). 그때 할 일은 재시도가 아니라
> 다시 읽고 다시 판단하는 것이다.

## 6. Realtime — 새로고침 없이 따라오게

표 11개가 `supabase_realtime` publication 에 올라가 있고 `replica identity full` 이다.

```
events · event_participants · chat_messages · chat_rooms · chat_room_members
schedule_proposals · schedule_proposal_participants
connections · connection_requests · conversation_states · ai_suggestions
```

**`chat_rooms` · `chat_room_members` 는 0015 에서 뒤늦게 올렸다.** 첫 1:1 대화는
**방이 먼저 생기고 말이 뒤따른다.** 말은 실시간으로 도착하는데 받는 쪽은 그 방을 몰라서,
그 말이 어느 화면에도 걸리지 못했다 — 새로고침해야 나타났다(`24_…` §22.2).

> Realtime 의 `postgres_changes` 는 **RLS 를 다시 판정한다.** 받는 쪽이 그 행을 SELECT 할 수
> 없으면 이벤트가 아예 가지 않는다. 1:1 방의 `chat_rooms` INSERT 가 받는 쪽에 오지 않는 이유가
> 그것이다(그 시점엔 아직 멤버가 아니다) — 그래서 `chat_room_members` 의 내 줄이 진짜 신호다.

## 7. 마이그레이션 순서와, 각각이 고친 것

| 파일 | 무엇 |
|---|---|
| 0001 | 공유 일정 · 참여자 · 대화 · RLS · Realtime |
| 0002 | 방 접근을 순서 의존 없이 |
| 0003 | 일정 제안 — 대화에서 시간이 정해지는 길 |
| 0004 | 프로필 · handle · 연결 · 사람 검색 |
| 0005 | 슬롯 줄 세우기 개선 |
| 0006 | 하루 단위 가용시간(집계만) |
| **0007** | **`respond_to_proposal` 의 `event_id` 모호성** — 전원 동의로 확정되는 순간에만 지나가는 줄이라, 제안도 응답도 멀쩡해 보였다. **이게 없으면 마지막 한 사람의 '동의' 가 조용히 실패한다** |
| 0008 | 말 고치기·지우기(soft delete) |
| 0009 | 이메일 없이도 handle |
| 0010 | 대화의 기억 · AI 제안 기록 |
| 0011 | 상태 어긋남을 재시도 폭풍 없이 |
| 0012 | 두 사람만의 창 |
| 0013 | 연결 요청 — 즉시 잇지 않는다 |
| 0014 | handle 변경(30일) |
| **0015** | **`chat_rooms` · `chat_room_members` Realtime** — 첫 1:1 대화가 제때 뜨게 |

적용: Supabase 대시보드 → SQL Editor 에 순서대로 붙여넣고 Run. **여러 번 실행해도 안전하다**
(`if not exists` · `create or replace` · `exception when duplicate_object`).

```sql
-- 올라가 있는지 확인
select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;
select pg_get_functiondef(oid) like '%ep2%' as has_0007 from pg_proc where proname = 'respond_to_proposal';
```

## 8. 설계 어휘와 실제의 차이

`CLAUDE.md §7` 이 그린 12개 엔티티 중 실제로 만들어진 것은 절반이고, 대신 그 표에 없는 것들이
생겼다. 없는 것을 있다고 말하지 않기 위해 적어 둔다.

| 설계에 있고 DB 에 없다 | 왜 |
|---|---|
| `Conversation` · `Message` | 대화는 **일정에 매인 방**이 됐다(`chat_rooms`). 별도의 대화방 개념을 두지 않는다 |
| `Memo` | 메모 탭을 걷었다 — 갈래마다 방을 주면 사용자가 분류를 의식하게 된다(§0) |
| `Meeting` | 회의는 일정의 한 종류다. 표를 따로 두지 않고 `events` 에 산다 |
| `Todo` | **이 브라우저에만 산다.** 서버 표가 없다 — 공유할 이유가 아직 없었다 |
| `Reminder` · `Notification` | 알림을 붙이지 않았다(FCM·Web Push 미사용) |
| `Memory` · `Preference` · `Feedback` · `AgentLog` | Embedding·RAG 를 쓰지 않는다. 대화의 기억은 `conversation_states` 한 표로 족했다 |

| DB 에 있고 설계에 없다 | 왜 생겼나 |
|---|---|
| `event_participants` | "일정을 복제하지 않는다" 는 규칙이 요구했다 |
| `schedule_proposals` (+참여자) | "확정은 사람이 한다" 를 DB 가 지키게 하려고 |
| `profiles` · `handle_history` | 남이 나를 찾을 이름이 필요했다. 그 이름은 초대코드이므로 함부로 바뀌면 안 된다 |
| `connections` · `connection_requests` | 상대의 승낙 없이 목록에 들어오는 일이 없게 |
| `conversation_states` · `ai_suggestions` | 같은 것을 두 번 권하지 않으려면 무엇을 권했는지 기억해야 했다 |
