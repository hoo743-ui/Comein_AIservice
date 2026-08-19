# 02. System — 전체 구조와 데이터 흐름

> 관련: [`05_FRONTEND.md`](./05_FRONTEND.md) · [`06_BACKEND.md`](./06_BACKEND.md) ·
> [`09_DATABASE.md`](./09_DATABASE.md) · [`10_API.md`](./10_API.md) ·
> 왜 이렇게 골랐는지는 [`21_ARCHITECTURE_DECISION_RECORD.md`](./21_ARCHITECTURE_DECISION_RECORD.md).
> 겪은 일의 기록은 [`24_AI_PIPELINE_STATUS.md`](./24_AI_PIPELINE_STATUS.md).

## 1. 한 문장

> 화면이 **저장·조회·실시간은 Supabase 로 직행**하고, **자연어 파싱만** FastAPI 를 거친다.

그래서 이 시스템에는 서버가 둘 있고, **둘은 서로를 모른다.**

## 2. 길이 둘이다

```
                        Client · Next.js 15 (Vercel)
                        │                          │
        ① 파싱만        │                          │  ② 저장 · 조회 · 인증 · 실시간
   POST /api/chat       │                          │  PostgREST + Realtime + Auth
   POST /api/summary    ▼                          ▼
        ┌────────────────────────┐    ┌──────────────────────────────┐
        │  FastAPI (Render)      │    │  Supabase (Postgres)         │
        │  ── 무상태 ──          │    │  Auth · RLS · Realtime       │
        │  DB 세션 없음          │    │  표 14 · 함수 34 · 정책 31    │
        │  커넥션 풀 없음        │    │  supabase/migrations/0001~15 │
        └───────────┬────────────┘    └──────────────────────────────┘
                    │  LLM 키는 서버에만
                    ▼
        ┌────────────────────────────────┐
        │  ai/ — router.py 프롬프트 1개   │
        │  Gemini ──(흔들리면)──▶ Groq    │
        └────────────────────────────────┘
```

### 왜 이렇게 갈랐나

| | 이유 |
|---|---|
| 데이터가 Supabase 직행인 이유 | 공유 일정·대화는 **RLS(행 단위 권한)와 Realtime** 이 핵심이다. 둘 다 Supabase 가 연결 하나로 해 주는 일이고, 백엔드를 한 번 더 거치면 **실시간이 끊긴다** |
| LLM 이 백엔드를 거치는 이유 | API 키를 브라우저에 둘 수 없다 |

**그 결과 백엔드가 자고 있어도 일정과 대화는 그려진다.** 느려지는 것은 캡처 바의 AI 파싱뿐이다
(Render 무료 티어는 15분 무요청이면 잠든다 → 첫 요청이 콜드스타트).

그리고 **백엔드에는 DB 비밀번호가 없다.** 브라우저에 둘 수 없는 것만 거기 남고,
사용자별 권한으로 지킬 수 있는 것은 Supabase 가 맡는다.

## 3. 흐름 하나 — 캡처 바에 한 줄 적었을 때

```
  "내일 3시 교수님 미팅 잡아줘"
        │
        │  화면이 아는 것을 함께 보낸다: now · tz
        ▼
  POST /api/chat ──▶ ai/router.py
        │              프롬프트 1개가 분류·추출·되묻기를 함께 한다
        │              (Intent / Parser / Schedule Agent 로 나뉘어 있지 않다)
        │              Gemini → 흔들리면 한 번 더 → 그래도 안 되면 Groq
        ▼
  chat.py 가 ParsedItem 으로 한 번 더 검증
        │
        ├─ 시각처럼 **지어내야 하는 값**이 비면 → 항목 대신 `ask` 한 줄 ("몇 시로 할까요?")
        │
        ▼
  AiResult { intent, reply, items[], ask }
        │
        ▼
  화면이 항목을 목적지 뷰로 보내고 **직접 Supabase 에 쓴다**
        │   일정은 기본적으로 status=pending(제안)으로 앉는다 — 확정은 사람이 한다
        ▼
  캡처 결과(receipt) 한 줄 — 무엇이 어디로 갔는지, 그리고 [확정] / [되돌리기]
```

> **AI 는 확정하지 않는다.** 설정의 `자동 확정` 은 기본으로 꺼져 있고, 그 상태에서
> AI 가 읽은 것은 점선으로 구분되어 사람의 확인을 기다린다. 이건 UI 예절이 아니라
> 이 제품의 태도다(`CLAUDE.md §0`).

## 4. 흐름 둘 — 두 사람이 시간을 정할 때

이쪽은 백엔드를 **한 번도 거치지 않는다.** 전부 DB 함수와 Realtime 이다.

```
  A: "금요일 저녁 어때?"                    ── chat_messages INSERT
        │
        │  lib/conversation 이 시각을 읽는다(화면 안에서, 서버 왕복 없이)
        ▼
  suggest_slots(event, 창, 선호시각)         ── DB 함수. 참여자들의 달력을 대조한다
        │                                      나가는 것은 '몇 명이 되는가' 뿐
        ▼
  open_proposal(event, 시각, 근거)           ── "3명 모두 일정 충돌이 없어요"
        │
        │  Realtime: schedule_proposals INSERT
        ▼
  B 의 화면 맨 위에 한 줄이 선다 — "답을 기다리는 것"
        │  (팝업으로 가로막지 않는다. 누르면 그 일정이 열린다)
        ▼
  respond_to_proposal(p, 'accepted')         ── 각자 답한다
        │
        │  마지막 사람이 답하는 순간, **같은 트랜잭션 안에서**
        ▼
  events UPDATE (시각 · status='confirmed')  ── 새 일정을 만들지 않는다.
        │                                      서 있던 일정이 시각을 얻고 앉는다
        │  Realtime: events UPDATE
        ▼
  모두의 캘린더가 함께 바뀐다               ── 일정을 복제하지 않았으므로 한 줄만 고쳤다
```

**이 흐름이 이 제품의 핵심이고, 규칙 셋이 그것을 지킨다.**

1. **일정을 복제하지 않는다.** canonical `events` 하나를 여럿이 같은 id 로 본다.
2. **전원이 동의해야 앉는다.** 그리고 그 판정은 DB 안에 있다 — 화면이 아니라.
3. **되는지는 알되 무엇을 하는지는 모른다.** 충돌 판정은 DB 안에서 끝나고 결론만 나간다.

## 5. 실시간 — 무엇을 듣고, 어떻게 살아 있게 하나

```
lib/sync.ts ── 채널 셋 (comein-<tag>-<uid>-<n>)
   core       chat_messages(INSERT·UPDATE) · events(*) · event_participants(*)
   rooms      chat_rooms(*) · chat_room_members(*)
   proposals  schedule_proposals(*) · schedule_proposal_participants(*)
```

- **채널을 셋으로 가른 이유.** 제안(0003)은 나중에 올린 마이그레이션이다. 안 올린 프로젝트에서
  한 채널에 묶으면 그 채널이 통째로 오류가 되어 **대화까지 같이 죽는다.**
  덜 중요한 것이 더 중요한 것을 끌고 내려가지 않게.
- **이름을 매번 다르게 짓는다.** realtime-js 는 같은 이름이면 있던 인스턴스를 그대로 돌려주고,
  이미 join 된 채널의 `subscribe()` 는 조용한 no-op 이다 — 그래서 **화면은 멀쩡한데 실시간만
  죽는다.** 이 버그를 찾는 데 가장 오래 걸렸다(`24_…` §22.1).
- **끊기면 스스로 다시 붙는다**(1s→2s→4s… 최대 30s). 붙는 순간 스냅샷을 한 번 맞춘다 —
  끊겨 있던 동안 온 말은 어떤 소켓으로도 오지 않는다.
- 메시지는 **낱개로** 반영하고(대화는 흐름이라 통째로 갈아끼우면 튄다),
  일정·참여자는 관계가 얽혀 있어 **스냅샷을 다시 받는다.**

## 6. 신원의 경계

화면 코드는 로그인 여부를 신경 쓰지 않는다. `lib/remote.ts` 한 곳에서만 바꿔 준다.

```
로그인 전 '나' = 상수 ME_ID("me")     로그인 후 = 진짜 uuid

  읽을 때   내 uuid → ME_ID
  쓸 때     ME_ID  → 내 uuid
```

덕분에 컴포넌트는 `senderId === ME_ID` 한 줄로 "내 말인가" 를 안다.
그리고 **키가 없으면 앱은 그대로 혼자 돈다** — 저장과 실시간만 꺼지고 화면은 멀쩡하다.
(멀쩡해 보이는 것이 함정이라, 설정의 계정 줄이 "이 브라우저에만 있습니다" 라고 정직하게 말한다.)

## 7. 의존성 — 무엇에 기대고 있나

| 영역 | 무엇 | 없으면 |
|---|---|---|
| 화면 | Next.js 15 · React 19 · zustand · lucide-react · next-themes | — |
| 저장·인증·실시간 | Supabase | 앱이 로컬 전용으로 돈다(조용히) |
| 파싱 | FastAPI + Gemini(→ Groq) | 캡처 바가 폴백 응답만 준다. 나머지는 그대로 |
| 배포 | Vercel(FE) · Render(BE) | — |

**쓰지 않는 것:** Redis(Upstash) · Chroma · Ollama · Resend · FCM · Google Calendar 연동.
초기 구상에는 있었으나 하나도 붙지 않았다. 필요해지면 그때 ADR 로 정한다.

> 무거운 UI 프레임워크도 쓰지 않는다(shadcn·FullCalendar·dnd-kit·Recharts).
> 각 화면은 CSS 토큰과 로컬 `<style>` 로 자체 완결한다 — 절제가 곧 럭셔리(`22_…`).

## 8. 이 구조의 약점 — 알고 두는 것

정직하게 적어 둔다. 지금 규모에서는 이 편이 낫다고 판단했을 뿐, 공짜는 아니다.

| 약점 | 지금의 대처 |
|---|---|
| 비즈니스 규칙이 **DB 함수 안에** 있다 | 그게 규칙을 지키는 유일한 자리라서다(화면을 믿으면 아무나 `confirmed` 를 적을 수 있다). 대가는 SQL 을 읽어야 로직을 안다는 것 — `09_DATABASE.md` 가 그 지도다 |
| 화면이 Supabase 스키마를 **직접 안다** | 백엔드를 한 겹 두면 실시간이 끊긴다. 대신 경계를 `lib/remote.ts` 하나로 좁혀, 스키마가 바뀌면 고칠 곳이 한 파일이다 |
| Realtime RLS 는 **서버에서만 판정된다** | 그래서 클라이언트 시험으로는 증명되지 않는다. `lib/fakeSupabase.ts` 는 소켓 수명만 재고, 권한은 두 계정으로 직접 확인해야 한다 |
| Render 무료 티어 콜드스타트 | 파싱만 느려지고 나머지는 영향 없다. keep-alive 워크플로를 두었다 |
| 할 일은 담을 표가 없다 | 만들지 않기로 정했다. 화면이 "담아 두는 곳은 아직 없어요" 라고 말한다 — 브라우저에만 두고 정리한 척하는 것보다 낫다(`docs/24` §25) |
