# CLAUDE.md — Comein AI Workspace

이 파일은 Comein 프로젝트의 단일 컨텍스트 문서입니다. Claude Code 및 팀원은 이 문서를 기준으로 작업합니다.

> **Come in. Your workspace is thinking for you.**
> 들어오세요. 당신의 워크스페이스가 대신 생각합니다.

- Repository: https://github.com/hoo743-ui/Comein_AIservice

---

## 0. Product Vision & North Star

> **북극성.** 모든 화면·기능·디자인 결정은 이 문서를 기준으로 판단한다.
> **채택된 틀:** 워크플로우 중심 · 문턱 인트로 · 슬림 레일 + 단일 캔버스. 라이브 앱 최상위 라우트(`/` Landing · `/experience` · `/workspace`)로 구현되어 있다.
> **시각 언어 규격(토큰·타이포·색·여백·모션): `docs/22_DESIGN_LANGUAGE.md`**, **화면 여정·IA: `docs/23_USER_JOURNEY.md`** — "feel expensive, not look expensive".

### Core Principle

> **Comein은 일을 *관리*하게 만드는 도구가 아니라, 일이 *스스로 정리되게* 만드는 공간이다.**
> Comein doesn't help people manage work. It helps work organize itself.

> **"생각은 흩어집니다. 질서는 만들어집니다." (Scattered thoughts become structured flow.)**

Comein은 또 하나의 챗봇도, 대시보드도, 노트앱도 아니다. **생각하는 워크스페이스(thinking workspace)** 다 — 흩어진 생각이 자연스럽게 정리된 일이 되는 곳.

### Design North Star

모든 화면은 하나의 질문에 답해야 한다:

> **"이것은 사용자가 *생각하도록* 돕는가, 아니면 *소프트웨어를 조작하게* 만드는가?"**
> 소프트웨어를 조작하게 만든다면 — 잘못된 디자인이다. 다시 만든다.

### Product Philosophy

- 사용자는 소프트웨어를 조작한다고 느끼면 안 된다 → **차분한 공간에 들어와, AI가 주변을 조용히 정리해주는** 느낌.
- **AI는 인터페이스를 지배하지 않는다.** 조용히 돕는다. 인터페이스는 사라지고, 사용자의 사고가 초점이 된다.
- **럭셔리는 절제에서 온다** — 장식·그라디언트·글래스가 아니라 여백·타이포·모션·구성에서. Timeless · Calm · Editorial · Intentional.

### The Product Journey — 세 개의 완전히 다른 순간

1. **Landing** — 철학을 소개한다. 기능 설명 X. "Comein이 무엇인가"만 감정적으로. *갤러리에 들어서는 느낌.* 초점은 정체성.
2. **Experience** — 문을 열고 **들어서는 순간**. 로그인 화면이 아니다: 로고가 떠오르고 → 문이 서고 → 문이 열리며 Co(ntext)·Me(mory)·In(sight) 세 갈래가 펼쳐지고 → 그 빛에서 인증 카드가 태어난다. 여기서 파는 것은 기능이 아니라 **온도**다 — "여기는 조용한 곳이구나". 이미 들어온 사람에게는 카드 대신 문이 열린다.
   그리고 로그인 칸 옆에서 **무엇을 해 주는지**를 세 걸음으로 말한다: `말 한 줄 → AI 가 시각을 읽는다 → 캘린더에 제안으로 앉는다(확정은 사람이)`. 문 앞에서 기다리게 하지 않고, 로그인 칸을 읽는 그 시간에 함께 읽히게 둔다.
   > 한때 이 사슬은 `생각 → AI 이해 → 회의 → 캘린더 → Todo → 메모` 였다. 메모는 걷혔고 할 일은 담을 곳이 없어 **지금 실제로 되는 것**으로 다시 썼다 — 없는 것을 시연하면 이 화면이 곧 첫 번째 거짓말이 된다.
3. **Workspace** — 실제로 일하는 곳(시간을 보내는 곳). *감탄시키는 곳이 아님.* 참신함보다 **명확함**. 즉시 배울 만큼 익숙하되, 틀림없이 Comein다운. 인지 부하 최소, AI가 조용히 정리. 살아있되 산만하지 않게.

### Workspace Principles

- **중심은 대화가 아니라 워크플로우.** 대화는 여러 입력 방식 중 하나일 뿐.
- Calendar · Todo · Meetings · Notes · Files · Projects · People 는 **사용자의 의도(intention)**로 연결된다. AI가 의도를 조용히 실행으로 바꾼다.

### Emotional Goal

- 들어올 때: *"내 사고의 공간에 들어왔다."*
- 쓰고 난 뒤: *"나는 아무것도 정리하지 않았는데, 알아서 정리되어 있었다."* — **그 느낌이 곧 제품이다.**

### Decision Framework — 기능 구현 전 자문

1. 이것이 **생각의 수고를 줄이는가?**
2. 일이 **스스로 정리되게** 하는가?
3. **차분한가?**
4. 5년 뒤에도 **프리미엄**으로 느껴질까?
5. **틀림없이 Comein인가?**

하나라도 "아니오"면 다시 디자인한다. 다른 AI 제품이 있다고 해서 기능을 따라 넣지 않는다.

### Visual Keywords

Calm · Flow · Thought · Focus · Space · Editorial · Premium · Invisible AI · Natural Motion · Soft Depth · Timeless

### Never / Always

- ❌ ChatGPT/Copilot/Notion 클론 · 대시보드 · 엔터프라이즈/어드민 패널 · 기능 나열
- ✓ Calm · Human · Emotional · Contextual · Elegant · Understandable · Intelligent · Minimal · Memorable

### Success Metric

- 랜딩을 보면 → **철학**을 기억한다.
- Experience를 지나면 → **온도**를 느끼고("문을 열고 들어왔다"), **변환**을 한 번 본다(말 한 줄 → 자리).
- 워크스페이스를 쓰면 → 소프트웨어를 의식하지 않는다. 그냥 **생각한다.**

---

## 1. 프로젝트 개요

### 한 문장 정의

> **"말 한 줄로 일정이 잡히고, 사람들과 시간이 맞춰지는 대화형 AI 워크스페이스"**

### 브랜드 스토리 — "문을 열고 들어오는 순간"

Comein의 로고는 살짝 열린 문이다.

1. **사용자가 들어오는 문** — 출근하듯 Comein에 "들어오면", 오늘의 일정과 답을 기다리는 것들이 이미 정리되어 기다리고 있다.
2. **AI가 들어오는 문** — AI가 사용자의 업무 공간 안으로 들어와, 옆자리 동료처럼 대화하며 일을 처리한다.

기존 생산성 앱은 사용자가 직접 입력하고 분류해야 하는 "빈 사무실"이었다. Comein에서는 **말만 하면 된다.** 나머지는 워크스페이스가 생각한다.

### 차별점

**ChatGPT의 입력 경험 + Notion의 저장 구조 + Calendar의 실행력**을 하나로 묶는다.

| | Notion / Todoist | Google Calendar | ChatGPT | **Comein** |
|---|---|---|---|---|
| 입력 방식 | 직접 작성 | 직접 작성 | 자연어 | **자연어** |
| 데이터 관리 | 사용자가 직접 | 사용자가 직접 | 휘발 | **AI가 자동 저장·분류** |
| 기능 연결 | 별도 도구 | 일정만 | 없음 | **일정↔사람↔대화 통합** |
| 능동성 | 없음 | 알림만 | 없음 | **충돌 감지, 시간 추천** |

### 대표 시나리오

1. **일정 등록** — "다음 주 화요일 3시에 교수님 미팅 잡아줘" → 한 프롬프트가 분류·추출을 함께 → 제안(pending)으로 캘린더에 → 사람이 확정
2. **모르면 지어내지 않는다** — "교수님 미팅 잡아줘"(시각 없음) → 항목 대신 되묻기 한 줄 → 다음 한 마디가 그 답이 되어 이어진다
3. **둘이서 시간 맞추기** — 대화에 시각이 오가면 서버가 양쪽 달력을 대조해 후보를 권한다 → 전원이 동의해야 일정이 앉는다. 누가 왜 바쁜지는 끝까지 말하지 않는다

### 주요 기능

> **여기 적힌 것만 실제로 돈다.** 한때 이 표에 Memo 와 Todo 가 있었지만 담을 표도 화면도
> 없었고, 그런데도 캡처는 "정리했어요" 라고 말했다. 만들지 않은 것을 표에 두면 다음 사람이
> 그것을 있다고 믿는다 — 걷어냈다(`docs/24` §25). 되살리려면 표(마이그레이션)부터 세운다.

| 기능 | 설명 | 어디서 도는가 |
|------|------|-----------|
| 💬 캡처 | 말 한 줄이 항목이 된다. 모르면 되묻는다 (모든 기능의 입구) | `ai/router.py` 프롬프트 1개 → Gemini(폴백 Groq) |
| 📅 캘린더 | 일정 생성·조회·수정, 24시간 원과 시간표 | 프론트 → Supabase 직행(RLS·Realtime) |
| 🤝 사람 | @핸들로 찾고, 청하고, 상대가 받아야 이어진다 | `0004`·`0013` — `search_people`·`request_connection` |
| ⏱ 시간 맞추기 | 후보 시각 제안 → 전원 동의 → 확정. 충돌 판정은 DB 안에서 | `0003`·`0005`·`0006`·`0012` — `suggest_slots` 외 |
| 💬 일정 대화 | 일정 하나가 곧 하나의 방. 뒤늦게 온 사람을 위한 요약 | `0001`·`0008` + `POST /api/summary` |
| 👥 그룹 | 같은 사람들이 다시 모인다. 자리마다 다시 고르지 않게 | `0017` — `groups`·`group_members` |
| ❗ 중요도 | AI 가 뽑던 값이 앉을 자리를 얻었다. 겹쳤을 때 무엇을 물을지 안다 | `0018` — `events.priority` + `lib/clash.ts` |
| 🏷 부르는 이름 | 핸들도 표시 이름도 내 것이 아니다 — 내가 부르는 이름을 따로 둔다 | `0019` — `person_labels` |
| 🔔 답을 기다리는 것 | 상대가 내민 시각·초대를 화면 맨 위 한 줄로. 팝업으로 가로막지 않는다 | `lib/awaiting.ts` — 새 표 없이 기존 것을 읽어 세운다 |

> AI 가 뽑는 갈래는 셋이다 — `schedule` · `meeting` · `todo`(`backend/app/schemas/items.py`).
> 화면은 그것을 둘로 접는다: 시간 위의 일은 캘린더로, 시간 밖의 일(할 일)은 **아직 갈 곳이 없다**.
> 갈 곳이 없다는 사실을 화면이 그대로 말한다(`nav.ts` 의 `DEST`).

---

## 2. 팀 구성 & R&R

> 팀장 이정우 · 팀원 류서준 · 박시현 · 박수훈 (4인). 아래는 **실제로 나눠 맡은 대로**다 —
> 한때 이 표에는 "AI 엔지니어 A/B" 로 둘을 갈라 두었지만, Memory·Embedding·RAG 를 붙이지
> 않기로 하면서(§5) 나눌 일이 없어졌다. 없는 자리를 표에 남겨 두면 다음 사람이 그 자리를
> 찾는다.

| 역할 | 담당 | 담당 영역 | 작업 폴더 |
|------|------|-----------|-----------|
| 기획 · PM | 박수훈 | 제품 기획, UX 플로우, 와이어프레임, 일정 관리, 테스트 시나리오 | `docs/` |
| 프론트엔드 | 박시현 · 박수훈 | Next.js 화면, 워크스페이스 모듈, Supabase 직접 연동 | `frontend/` |
| 백엔드 | 이정우 | FastAPI(무상태 파싱), DB 스키마·RLS, 배포 | `backend/`, `supabase/` |
| AI | 류서준 | Router 프롬프트, Provider 폴백, 파싱 정확도 검증 | `ai/`, `scripts/` |

### 협업 규칙

- AI ↔ 프론트 경계는 **JSON Schema(`AiResult`)로 고정** → 서로의 내부 구현에 의존하지 않는다
- 이 문서와 `docs/24_AI_PIPELINE_STATUS.md` 를 단일 기준으로 두고 결정 이력을 남긴다
- 교수님 멘토링 2회를 거쳐 우선순위를 재조정했다
- 매 push 마다 GitHub Actions(`ci.yml`)가 clone → install → 타입검사 → 테스트 → 빌드를 돌린다
  — "내 컴퓨터에선 됐는데" 를 저장소가 대신 확인한다(`docs/24` §25)

---

## 3. 프로젝트 구조

```
Comein_AIservice/
├── frontend/             # Next.js — 슬림 레일 + 단일 캔버스. Supabase 에 직접 붙는다
├── backend/              # FastAPI — 자연어 파싱 전용(무상태). 엔드포인트 3개
├── ai/                   # router.py(프롬프트) + llm/(Gemini·Groq Provider 추상화)
├── supabase/migrations/  # 실제로 도는 DB 스키마와 RLS (0001~0019)
├── docs/                 # 설계 문서 — 아래 9절 표에 있는 것만 있다
├── scripts/              # 손으로 돌려보는 확인용 (테스트 스위트가 아니다)
├── render.yaml           # 백엔드 배포 정의 (Render Blueprint)
├── CLAUDE.md             # (본 문서) 프로젝트 컨텍스트
└── README.md             # 레포 소개 + 셋업 + Git 규칙
```

---

## 4. 시스템 아키텍처

> **길이 둘이다.** 저장·조회·인증은 화면이 Supabase 로 **직행**하고, 자연어 파싱만
> FastAPI 를 거친다. 백엔드는 그래서 **상태가 없다** — DB 세션도 커넥션 풀도 없다.

```
                    Client (Next.js · Vercel)
                     │                    │
     ① 파싱만        │                    │  ② 저장·조회·인증·실시간
                     ▼                    ▼
        ┌────────────────────┐   ┌──────────────────────┐
        │  FastAPI (Render)  │   │  Supabase (Postgres) │
        │  ─ 무상태 ─        │   │  Auth · RLS · Realtime│
        │  POST /api/chat    │   │  supabase/migrations/ │
        │  POST /api/summary │   │    0001~0019          │
        │  GET  /health      │   └──────────────────────┘
        └────────┬───────────┘
                 │  LLM 키는 서버에만 둔다
                 ▼
        ┌────────────────────────────┐
        │  ai/  — router.py 프롬프트 1개 │
        │  Gemini ──(실패 시)──▶ Groq  │
        └────────────────────────────┘
```

**왜 이렇게 갈랐나.** 공유 일정·대화는 RLS(행 단위 권한)와 Realtime 이 핵심인데, 백엔드를
한 번 더 거치면 실시간이 끊긴다. 반대로 LLM 키는 브라우저에 둘 수 없다. 그래서 각자 잘하는
쪽으로 보냈다 — 그 결과 **백엔드가 자고 있어도 일정과 대화는 그려진다.** 느려지는 것은
캡처 바의 AI 파싱뿐이다(Render 무료 티어 콜드스타트).

### 주요 흐름

1. 사용자가 캡처 바에 자연어 한 줄을 넣는다 (화면이 아는 `now`·`tz` 를 함께 보낸다)
2. `POST /api/chat` → `ai/router.py` 가 한 프롬프트로 분류·추출을 함께 한다
3. 시각처럼 **없으면 지어내야 하는 것**이 비면, 항목 대신 `ask` 한 줄을 돌려준다
4. 화면이 항목을 각자의 뷰로 보내고 **직접 Supabase 에 쓴다** — 일정은 기본적으로
   `pending`(제안)으로 앉고, 확정은 사람이 한다
5. 무엇이 어디로 갔는지 캡처 결과(receipt) 한 줄로 조용히 표시한다

> Redis(Upstash) · Chroma · Resend · FCM 은 초기 구상에 있었으나 **쓰지 않는다.**
> 필요해지면 그때 ADR 로 정한다(`docs/21`).

---

## 5. 기술 스택 (무료 티어 기준)

> 원칙: API·인프라 **비용 0원**으로 MVP~데모까지 운영한다.

| 영역 | 선택 | 비고 |
|------|------|------|
> 아래는 **지금 실제로 쓰는 것**만 적는다. 구상만 하고 쓰지 않은 것은 표에 두지 않는다 —
> 쓰지 않는 것보다 나쁜 건 그것이 다음 사람에게 거짓을 말한다는 점이다.

| 영역 | 선택 | 비고 |
|------|------|------|
| Frontend | Next.js 15 (React 19, TS) | `frontend/` |
| UI | **컴포넌트 로컬 `<style>` + CSS 토큰** · lucide-react(아이콘) · next-themes(테마) · zustand(상태) | Tailwind 는 리셋과 `font-sans` 만 쓴다. 아래 6절 참고 |
| Backend | FastAPI (Python) — **무상태**, 파싱 전용 | `backend/` · 엔드포인트 3개뿐 |
| LLM (파싱·요약) | **Gemini `gemini-flash-latest`** 무료 티어 | httpx 로 REST 직접 호출(SDK 미사용) |
| LLM (폴백) | **Groq `openai/gpt-oss-120b`** | Gemini 가 429·오류·파싱실패일 때만. 무료 1,000 req/day · 8,000 TPM |
| DB · Auth · Realtime | **Supabase** 무료 티어 | 프론트가 직접 붙는다(RLS). 스키마는 `supabase/migrations/` |
| Infra | Vercel(FE) + Render(BE) | 둘 다 무료 티어 — Render 는 15분 무요청 시 슬립 |

**LLM 전략**: 원래는 분류=Groq / 생성=Gemini 로 쿼터를 나눌 생각이었다. 실제로는 분류를
따로 부르지 않고(한 프롬프트가 함께 한다) **Gemini 단독 + Groq 폴백**으로 돈다. Provider
교체 가능한 추상화(`ai/llm/base.py`)는 그대로 살아 있어, 바꾸려면 한 곳만 갈면 된다.

**쓰지 않는 것**: Redis(Upstash) · Chroma · Ollama · Resend · FCM · Google Calendar 연동.
초기 구상에는 있었으나 하나도 붙지 않았고, redis 의존성은 걷어냈다.

---

## 6. GUI 방향

> 상세 시각 규격은 `docs/22_DESIGN_LANGUAGE.md`, 화면 여정·전환은 `docs/23_USER_JOURNEY.md`, 워크스페이스 UX 원칙은 `docs/04_GUI_UX.md`. 여기서는 방향만.

### 선택: 절제된 커스텀 + Tailwind CSS

- **무거운 UI 프레임워크(shadcn/FullCalendar/dnd-kit/Recharts)를 쓰지 않는다.** 각 화면은 컴포넌트 로컬 `<style>` + CSS 토큰으로 자체 완결 — "비싸게 보이는" 대신 "힘이 안 드는" 느낌.
- 대부분 모노크롬(차가운 블루-그레이) + 브랜드 퍼플 액센트 한 지점. 카드·글래스·큰 그림자 없이 여백 + 1px 헤어라인으로 구획.
- 아이콘 lucide-react, 테마 next-themes, 상태 zustand. 한글 Pretendard + 라틴 Inter(세리프 없음).

### 기본 레이아웃 (슬림 레일 + 단일 캔버스)

```
┌──┬───────────────────────────────────────┐
│레│   단일 캔버스 (뷰가 크로스페이드로 교체)      │
│일│   그리팅 · 날씨 · 오늘의 흐름             │
│  │   [  캡처 바 ───────────────────  ➤ ]   │
│⚙ │                                        │
└──┴───────────────────────────────────────┘
 슬림 레일(상단): Today · Calendar · People
 슬림 레일(하단): Settings · Exit(프로필)
```

> 뷰는 셋이다. 한때 여섯(Tasks·Notes·Meetings 별도)을 그렸지만, 갈래마다 방을 하나씩 주면
> **사용자가 분류를 의식하게 된다** — 이 문서 §0 이 하지 말라고 한 바로 그것이다.
> 회의는 일정 안에서 살고, 메모는 아예 없앴다. 할 일은 AI 가 읽기는 하지만 아직 담을 곳이
> 없다 — 그리고 **없다는 사실을 화면이 그대로 말한다**(`docs/24` §25).

- **중심은 대화가 아니라 워크플로우.** 캡처 바는 입력 방식 중 하나 — 말 한 줄이 일정과 할 일로 갈리고, 시각이 있는 것만 캘린더에 자리를 얻는다.
- 뷰 전환은 라우트 이동 없이 캔버스만 크로스페이드(이전 뷰 페이드아웃 → 새 뷰 라이즈), 레일·캡처 바 상시 고정 — "페이지 이동"이 아니라 "한 공간의 재구성".
- **레일 구조 통일**: 설정(Settings)은 좌측 상단이 아니라 **레일 하단 · 프로필(Exit) 위**에 위치하며 다른 레일 아이콘과 동일한 스타일·호버. **다크모드 전용 토글은 없앰** — 테마 전환은 Settings 패널 안에서만.
- **상단 바를 두지 않는다**: 별도의 상단 바가 없다. 화면 이름(오늘·캘린더·사람)이 페이지 제목으로 한 번 서고, 그 아래 '답을 기다리는 것' 한 줄이 붙는다 — 둘 이상이면 첫 줄만 세우고 나머지는 `+N개 더` 뒤로 접는다. **알림함도 배지도 없다**: 읽지 않은 것을 없애는 일을 하나 더 만들지 않는다.
- **활성 표식은 morph**: 선택된 레일 항목 사이를 단일 인디케이터가 미끄러지듯 이동. 호버는 살짝 밝아지며 1px 상승, 클릭은 scale(0.97) 미세 반응(리플 X).
- **패널(캘린더·설정·가이드)은 확장 경험**: 좌측에서 transform 슬라이드 + 은은한 blur·shadow 깊이, 내부 콘텐츠는 헤더 → 그리드 → 오늘 일정 순으로 스태거 등장. 이징 `cubic-bezier(0.22,1,0.36,1)`, transform/opacity 중심(60fps).
- 배경은 flat 금지 — 웜 오프화이트/다크 위 대형 확산광 + 코너 그림자로 명암 대비(돔형 깊이감), 중앙은 밝게 유지.
- 라우트 리디렉션은 `template.tsx`의 전역 페이드로 부드럽게 이어짐(입장 문턱 연출은 유지). AI 어시스트(우측 문) 사이드는 제거해 캔버스를 비웠다.
- 입장: 문턱(threshold) 전환 1회 재생 — 문이 열리듯 워크스페이스로 (브랜드 스토리 연결).
- 진입 여정: `/` Landing → `/experience`(시네마틱 + 로그인) → `/workspace`. 재방문은 `/experience?auth=1` 로 인트로를 건너뛴다.

---

## 7. 데이터 모델 (주요 엔티티)

> **아래는 설계 어휘이지 지금의 스키마가 아니다.** 실제로 도는 테이블·제약·RLS 정책은
> `supabase/migrations/0001~0019` 에 있다 — 거기가 유일한 진실이다. 화면이 쓰는 공유 일정·
> 참여자·대화방·연결 요청·핸들 같은 것들은 아래 표에 없고, 마이그레이션에는 있다.
>
> 특히 아래의 **Todo·Memo·Meeting 표는 세워진 적이 없다.** 되살릴 생각으로 남겨 둔 것이
> 아니라, 이 절이 처음부터 '설계 어휘' 였기 때문에 그대로 있는 것이다. 지금 실제로 도는
> 갈래는 셋이고(`schedule`·`meeting`·`todo`) 그중 표를 가진 것은 일정 하나뿐이다.
>
> PK = 기본 키(행 고유 ID), FK = 외래 키(다른 테이블 참조).

### 엔티티 관계 요약

```
User ─┬─< Conversation ─< Message
      ├─< Schedule ─── Meeting (1:1)
      ├─< Todo
      ├─< Memo
      ├─< Reminder / Notification
      └─< Memory / Preference / Feedback / AgentLog
```
(`─<` : 1:N 관계)

### User — 사용자

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | UUID | PK | 사용자 고유 ID |
| email | VARCHAR | UNIQUE, NOT NULL | 로그인 이메일 |
| name | VARCHAR | NOT NULL | 표시 이름 |
| created_at | TIMESTAMPTZ | DEFAULT now() | 가입 시각 |

### Conversation — 대화방

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | UUID | PK | 대화방 ID |
| user_id | UUID | FK → User.id | 소유 사용자 |
| title | VARCHAR | | 대화방 제목 (AI 자동 생성) |
| created_at | TIMESTAMPTZ | DEFAULT now() | 생성 시각 |

### Message — 대화 메시지

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | UUID | PK | 메시지 ID |
| conversation_id | UUID | FK → Conversation.id | 소속 대화방 |
| role | VARCHAR | CHECK (user/ai) | 발화 주체 |
| content | TEXT | NOT NULL | 메시지 본문 |
| created_at | TIMESTAMPTZ | DEFAULT now() | 발화 시각 |

### Schedule — 일정

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | UUID | PK | 일정 ID |
| user_id | UUID | FK → User.id | 소유 사용자 |
| title | VARCHAR | NOT NULL | 일정 제목 |
| start_time | TIMESTAMPTZ | NOT NULL | 시작 시각 |
| end_time | TIMESTAMPTZ | | 종료 시각 |
| location | VARCHAR | | 장소 |
| status | VARCHAR | CHECK (pending/confirmed) | AI 제안(pending) → 사용자 확정(confirmed) |

### Todo — 할 일

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | UUID | PK | Todo ID |
| user_id | UUID | FK → User.id | 소유 사용자 |
| title | VARCHAR | NOT NULL | 할 일 내용 |
| due_date | TIMESTAMPTZ | | 마감 기한 |
| priority | VARCHAR | CHECK (high/mid/low) | 우선순위 (AI 추천) |
| status | VARCHAR | CHECK (todo/doing/done) | 진행 상태 |

### Memo — 메모

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | UUID | PK | 메모 ID |
| user_id | UUID | FK → User.id | 소유 사용자 |
| title | VARCHAR | | 제목 (AI 자동 생성) |
| content | TEXT | NOT NULL | 메모 본문 |
| tags | VARCHAR[] | | 태그 배열 (AI 자동 부여) |

### Meeting — 회의

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | UUID | PK | 회의 ID |
| schedule_id | UUID | FK → Schedule.id | 연결된 일정 (1:1) |
| participants | VARCHAR[] | | 참석자 목록 |
| summary | TEXT | | AI 생성 요약 |
| notes | TEXT | | 회의록 원문 |

### 확장 엔티티 (MVP 이후)

| 엔티티 | 역할 | 핵심 필드 |
|--------|------|-----------|
| Reminder | 일정/Todo 알림 예약 | target_type, target_id, remind_at |
| Notification | 발송된 알림 기록 | user_id, type, content, is_read |
| Memory | AI 장기 기억 | user_id, content, embedding |
| Preference | 사용자 성향/설정 | user_id, key, value |
| Feedback | AI 응답 평가 | message_id, rating, comment |
| AgentLog | Agent 호출 로그 (디버깅/평가용) | agent_name, input, output, confidence, latency |

---

## 8. AI Agent 설계

> **지금 도는 것부터 적는다.** 아래 설계는 여러 Agent 를 상정했지만, 실제로 구현된 것은
> **한 번의 호출**이다. `ai/agents/` 디렉터리는 존재하지 않는다.

### 지금 실제로 도는 것

```
POST /api/chat  →  ai/router.py:route()
                     프롬프트 1개 (분류 + 추출 + 되묻기를 한 번에)
                     → Gemini (실패 시 Groq) → ParseResponse 검증
                   backend/app/api/endpoints/chat.py 가 한 번 더 ParsedItem 으로 재검증
                   → AiResult{intent, reply, items[], ask}
```

- **분리된 Intent/Parser/Schedule Agent 는 없다.** 한 프롬프트가 `items[]` 에 여러 갈래를
  한꺼번에 담아 돌려준다("내일 3시 회의 잡고 자료도 준비해야 해" → meeting + todo).
- **되묻기가 곧 Confidence 다.** 시각이 없으면 지어내지 않고 `ask` 한 줄을 돌려준다
  (프롬프트의 `ASK BACK INSTEAD OF GUESSING`).
- **Retry 는 없다.** Gemini → Groq 폴백 한 홉이 전부다(`ai/llm/factory.py`).
- 계약의 기준자는 `backend/app/schemas/items.py` 의 `ParsedItem` 하나다 — AI 쪽과 백엔드가
  같은 클래스를 쓴다(스키마를 두 벌 관리하지 않는다).

여러 Agent 로 가르는 것은 이 한 프롬프트가 감당하지 못하게 될 때 한다. 지금은 아니다.
현재 상태와 알려진 한계는 `docs/24_AI_PIPELINE_STATUS.md` — 맨 아래 절부터 읽는다.

---

## 9. 설계 문서 (docs/)

| 파일 | 내용 | 오너 |
|------|------|------|
| 02_SYSTEM.md | **전체 구조 · 데이터 흐름 두 갈래** — 캡처→저장, 두 사람이 시간을 정하는 길, 실시간, 이 구조의 약점 | 풀스택 |
| 04_GUI_UX.md | 슬림 레일 + 단일 캔버스, 뷰 구성, 캡처 바, UX 원칙 | 기획 |
| 05_FRONTEND.md | Next.js 구조(workspace 모듈 20개), 스타일 규칙, Zustand, 서버와 맞추기 | 풀스택 |
| 06_BACKEND.md | FastAPI 구조, 무상태 패턴, 흔들림에 대한 태도(재시도·폴백·타임아웃) | 풀스택 |
| 09_DATABASE.md | **실제로 도는 스키마** — 표 17 · 함수 41 · RLS 36 · Realtime 13, 그리고 설계 어휘와의 차이 | 풀스택 |
| 10_API.md | Endpoint, **AI↔프론트 계약 JSON Schema** | 풀스택 |
| 15_DEPLOY.md | Vercel(프론트) + Render(백엔드) + Supabase(DB) · 환경변수 · 콜드스타트 | 풀스택 |
| 16_TASK.md | 미뤄 둔 것과 **왜 미뤘는지** | 기획 |
| 21_ARCHITECTURE_DECISION_RECORD.md | 기술 선택 ADR (무료 스택 등) | 전원 |
| 22_DESIGN_LANGUAGE.md | **시각 언어 규격** — 토큰·타이포·색·여백·모션 ("feel expensive") | 풀스택 |
| 23_USER_JOURNEY.md | **화면 여정·IA** — Landing→Experience→Workspace, 전환 | 기획 |
| 24_AI_PIPELINE_STATUS.md | **상태 로그** — 무엇을 왜 그렇게 고쳤나. 덧붙여 쓴다(§25까지). 지금 상태는 맨 아래부터 | 전원 |

### 여기 없는 문서에 대해

한때 이 표에는 25개가 있었다. 그중 15개는 **파일만 있고 안은 비어 있었다**(0바이트).
(그 뒤 `02_SYSTEM` 과 `09_DATABASE` 는 실제로 채워 되살렸다 — 껍데기가 아니라 코드에서 읽어 적었다.)
오너까지 적힌 표가 없는 문서를 있다고 말하고 있었던 셈이라, 빈 파일과 그 줄을 함께 걷었다.
그 문서들이 다루려던 내용은 대부분 **다른 곳에 실제로 있다** — 계획서가 아니라 코드와 로그에.

| 없어진 문서 | 실제로 그 내용이 있는 곳 |
|---|---|
| 07_AI_SYSTEM · 08_AI_AGENTS | `ai/router.py`, `ai/llm/factory.py` (Provider 폴백) · `docs/24` §16·§20 |
| 13_PROMPT | `ai/router.py` 의 프롬프트 본문 (되묻기 규칙 포함) |
| 19_TEST | `frontend/src/lib/conversation/conversation.test.ts`, `backend/tests/` · 실측 기록은 `docs/24` §15·§20 |
| 14_SECURITY | `docs/15_DEPLOY.md`(키 보관 위치) + 마이그레이션의 RLS 정책 |
| 00_VISION · 01_PRODUCT | 이 문서 §0·§1 |
| 03_DEVELOPMENT_FLOW · 20_WORKFLOW | `docs/02_SYSTEM.md` §3·§4 (흐름 두 갈래) + `docs/24` |
| 11_MEMORY | 쓰지 않는다. Embedding·RAG 를 붙이지 않았고, 대화의 기억은 `conversation_states` 한 표로 족했다(`docs/09` §5). `ai/memory/` 자리표는 걷었다 |
| 12_CALENDAR_ENGINE | `supabase/migrations/0003·0005·0006·0012` 의 `suggest_slots` · `availability_for` · `day_availability` — 충돌 판정이 DB 안에 있다(`docs/09` §5) |
| 17_ROADMAP · 18_CODING_STYLE | 아직 없다 |

> 번호는 다시 쓰지 않는다. 빈 껍데기를 되살리는 것보다, 없는 것을 없다고 말해 두는 편이
> 다음에 여는 사람에게 정직하다.

---

## 10. Git 규칙

### 브랜치 전략 — 줄기는 하나다

- **main** — 유일한 통합 브랜치. 여기가 언제나 도는 상태다
- **feature/** · **fix/** — 작업 브랜치. 하나를 끝내면 PR 로 main 에 올리고 지운다

> **develop 을 쓰지 않기로 했다(2026-08-20).** 한동안 표에는 `feature/* → develop → main`
> 이 적혀 있었지만 실제로는 아무도 그렇게 하지 않았다 — `develop` 은 main 보다 한참 뒤에
> 서 있었고 main 에 없는 커밋이 **하나도** 없었다. 지나가지 않는 중간역을 표에 두면
> 다음 사람은 그 역에서 기다린다. 통합은 main 한 곳에서 한다.
>
> 원격의 `develop` · `feature/*` · `seojun` 은 **지우지 않고 그대로 둔다.** 지운다고 얻는
> 것이 없고, `seojun` 에는 main 에 없는 커밋이 둘 있다(2026-07-29, ryuseojoon). 다만
> 앞으로 그 브랜치들로 일하지는 않는다 — 살아 있는 줄기는 main 하나다.

### 워크플로우

```bash
# 1. main 최신화
git switch main
git pull origin main

# 2. 작업 브랜치 (feat 이면 feature/, 고침이면 fix/)
git switch -c fix/무엇을-고치는가

# 3. 역할별 폴더에서 개발 (frontend/ | backend/ | ai/)

# 4. 커밋 & 푸시
git add .
git commit -m "fix: 무엇을 왜 고쳤는가"
git push -u origin fix/무엇을-고치는가

# 5. PR: 작업 브랜치 → main
```

> main 에 직접 커밋하지 않는다. 브랜치가 하나로 줄었다고 해서 문턱까지 없앤 것은 아니다 —
> 리뷰가 붙을 자리는 PR 하나로 족하다.

### Commit Convention

| Type | Description |
|------|-------------|
| feat | 새로운 기능 |
| fix | 버그 수정 |
| refactor | 코드 리팩토링 |
| docs | 문서 수정 |
| style | 코드 스타일 수정 |
| chore | 기타 작업 |

---

## 11. 개발 원칙

1. 모든 문서와 코드는 **실제 서비스 수준**을 목표로 한다.
2. AI가 이해하기 쉬운 구조와 사람이 유지보수하기 쉬운 구조를 **동시에 만족**한다.
3. 각 문서는 **독립적으로 이해 가능**하고 서로 **일관성**을 유지한다.
4. 모든 설계는 **확장성과 유지보수성**을 최우선으로 한다.
5. 모든 기능은 **AI 중심(Multi-Agent Architecture)**으로 설계한다.
6. **비용 0원 제약** 안에서 설계한다 — 유료 전환은 Release 이후 ADR로 결정.
7. 최종 목표는 일정 관리 앱이 아니라 **AI Workspace 플랫폼**이다.
