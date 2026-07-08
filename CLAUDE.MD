# CLAUDE.md — Comein AI Workspace

이 파일은 Comein 프로젝트의 단일 컨텍스트 문서입니다. Claude Code 및 팀원은 이 문서를 기준으로 작업합니다.

> **Come in. Your workspace is thinking for you.**
> 들어오세요. 당신의 워크스페이스가 대신 생각합니다.

- Repository: https://github.com/hoo743-ui/Comein_AIservice

---

## 0. Product Vision & North Star

> **북극성.** 모든 화면·기능·디자인 결정은 이 문서를 기준으로 판단한다.
> 프로토타입: `frontend/src/app/reimagine/` (워크플로우 중심 · 문턱 인트로 · 슬림 레일 + 단일 캔버스).
> **시각 언어 규격(토큰·타이포·색·여백·모션): `frontend/src/app/reimagine/DESIGN.md`** — "feel expensive, not look expensive".

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
2. **Experience** — Comein이 *어떻게 생각하는지* 보여준다. 또 하나의 챗 UI가 아니라 **변환(transformation)**을 보여줌: `생각 → AI 이해 → 회의 → 캘린더 → Todo → 메모 → 워크스페이스`. "내 생각이 자동으로 정리되는구나"를 즉시 이해. 경험을 판다, 인터페이스가 아니라.
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
- Experience를 보면 → **변환**을 이해한다.
- 워크스페이스를 쓰면 → 소프트웨어를 의식하지 않는다. 그냥 **생각한다.**

---

## 1. 프로젝트 개요

### 한 문장 정의

> **"채팅 한 줄로 일정·메모·할 일·회의가 자동으로 정리되는 대화형 AI 워크스페이스"**

### 브랜드 스토리 — "문을 열고 들어오는 순간"

Comein의 로고는 살짝 열린 문이다.

1. **사용자가 들어오는 문** — 출근하듯 Comein에 "들어오면", 오늘의 일정·할 일·회의가 이미 정리되어 기다리고 있다.
2. **AI가 들어오는 문** — AI가 사용자의 업무 공간 안으로 들어와, 옆자리 동료처럼 대화하며 일을 처리한다.

기존 생산성 앱은 사용자가 직접 입력하고 분류해야 하는 "빈 사무실"이었다. Comein에서는 **말만 하면 된다.** 나머지는 워크스페이스가 생각한다.

### 차별점

**ChatGPT의 입력 경험 + Notion의 저장 구조 + Calendar의 실행력**을 하나로 묶는다.

| | Notion / Todoist | Google Calendar | ChatGPT | **Comein** |
|---|---|---|---|---|
| 입력 방식 | 직접 작성 | 직접 작성 | 자연어 | **자연어** |
| 데이터 관리 | 사용자가 직접 | 사용자가 직접 | 휘발 | **AI가 자동 저장·분류** |
| 기능 연결 | 별도 도구 | 일정만 | 없음 | **일정↔메모↔Todo↔회의 통합** |
| 능동성 | 없음 | 알림만 | 없음 | **충돌 감지, 추천, 리마인드** |

### 대표 시나리오

1. **일정 등록** — "다음 주 화요일 3시에 교수님 미팅 잡아줘" → Intent 분석 → Schedule Agent → 충돌 검사 → 등록 + 자연어 응답
2. **대화가 곧 메모** — 아이디어를 말하면 Memo Agent가 태그 자동 부여 후 저장, 관련 메모 연결 제안
3. **회의 후 자동 정리** — 회의록 붙여넣기 → 요약 + 액션아이템 추출 → Todo 자동 생성 → 후속 일정 제안

### 주요 기능

| 기능 | 설명 | 담당 Agent |
|------|------|-----------|
| 💬 Chat | AI와 대화하며 업무를 처리 (모든 기능의 입구) | Router, Intent, Parser |
| 📅 Calendar | 일정 생성, 조회, 수정, 충돌 관리 | Schedule, Conflict |
| 📝 Memo | 생각과 아이디어를 AI가 정리·태깅 | Memo, Summary |
| ✅ Todo | 할 일 생성 및 우선순위 관리 | Todo, Reminder |
| 🎙 Meeting | 회의 일정, 요약, 참석자 관리 | Meeting, Summary |

---

## 2. 팀 구성 & R&R

| 역할 | 인원 | 담당 영역 | 작업 폴더 |
|------|------|-----------|-----------|
| 기획 (PM) | 1 | 제품 기획, UX 플로우, 와이어프레임, 일정 관리, 테스트 시나리오 | `docs/` |
| AI 엔지니어 A | 1 | AI Router, Intent Classifier, Parser/Schedule/Conflict Agent, 프롬프트 설계 | `ai/` |
| AI 엔지니어 B | 1 | Memory 시스템, Embedding/RAG, Memo/Todo/Meeting/Summary Agent, AI 평가 | `ai/` |
| 풀스택 | 1 | Next.js 프론트, FastAPI 백엔드, DB, 인증, 배포, 외부 API 연동 | `frontend/`, `backend/` |

### 협업 규칙

- AI ↔ 백엔드 경계는 **API JSON Schema로 고정** → 병렬 개발 가능
- AI 엔지니어 2명은 Agent 단위 분업 + 프롬프트 상호 크로스 리뷰
- 기획자가 v0.dev 등으로 화면 시안 선(先)프로토타이핑 → 풀스택 병목 방지
- 주 1회 통합 테스트 데이 (전체 시퀀스 기준 E2E 점검)

---

## 3. 프로젝트 구조

```
Comein_AIservice/
├── frontend/        # Next.js (React, TypeScript, Tailwind, shadcn/ui)
├── backend/         # FastAPI (REST API, DB, Auth, 외부 연동)
├── ai/              # AI Router, Agents, Prompt, Memory, 평가
├── docs/            # 프로젝트 설계 문서
├── .gitignore
├── CLAUDE.md        # (본 문서) 프로젝트 컨텍스트
└── README.md        # 레포 소개 + Git 규칙
```

---

## 4. 시스템 아키텍처

```
Client (Web / Mobile)
        │
        ▼
API Gateway (REST API)  ← backend/
        │
        ▼
┌─────────────────────────────────────┐
│      AI Workspace Engine  ← ai/     │
│                                     │
│  AI Router → Intent Classifier      │
│      │                              │
│  ┌────────┬──────┬──────┬─────────┐ │
│  │Schedule│ Memo │ Todo │ Meeting │ │
│  │ Agent  │Agent │Agent │  Agent  │ │
│  └────────┴──────┴──────┴─────────┘ │
│      │                              │
│  Context / Memory                   │
│      │                              │
│  LLM Service (Gemini / Groq / …)    │
└─────────────────────────────────────┘
        │
        ▼
┌──────────────────┐   ┌──────────────────────┐
│    Data Layer    │   │   External Service   │
│ PostgreSQL(Main) │   │ Email (Resend)       │
│ Redis (Cache)    │   │ Calendar (Google)    │
│ Vector DB(Chroma)│   │ Notification         │
│ File Storage     │   │  (FCM / Web Push)    │
└──────────────────┘   └──────────────────────┘
```

### 주요 흐름

1. 사용자가 Chat에서 자연어로 요청
2. AI Router가 의도를 파악하여 적절한 Agent로 라우팅
3. Agent가 정보를 추출/가공하여 DB에 저장 or 조회
4. 결과를 자연어 + 인라인 카드로 응답
5. 필요 시 외부 서비스(캘린더, 알림 등)와 연동

---

## 5. 기술 스택 (무료 티어 기준)

> 원칙: API·인프라 **비용 0원**으로 MVP~데모까지 운영한다.

| 영역 | 선택 | 비고 |
|------|------|------|
| Frontend | Next.js (React, TS, Tailwind CSS) | `frontend/` |
| UI | **shadcn/ui** + FullCalendar + dnd-kit + Recharts + Framer Motion | 아래 6절 참고 |
| Backend | FastAPI (Python) | `backend/` |
| LLM (생성/파싱) | **Gemini API 무료 티어** | JSON 모드 지원 |
| LLM (분류) | **Groq API (Llama)** | 초고속, Intent 분류 전용 |
| LLM (로컬 백업) | Ollama | 개발 시 쿼터 절약 |
| Database | PostgreSQL — Supabase 무료 티어 | Auth·Storage 포함 |
| Cache | Redis — Upstash 무료 티어 | 서버리스 |
| Vector DB | Chroma (셀프호스팅) | 완전 무료 |
| Infra | Vercel(FE) + Render/Railway(BE) | AWS는 Release 이후 |
| Email | Resend 무료 티어 | 일 100건 |
| Notification | FCM / Web Push API | 무료 |
| Auth | Supabase Auth 또는 JWT | Refresh Token 포함 |

**LLM 전략**: 가볍고 잦은 호출(Intent)은 Groq, 품질이 중요한 호출(파싱·요약)은 Gemini로 이원화하여 무료 쿼터 분산. 쿼터 초과 대비 **Provider 교체 가능한 LLM 추상화 레이어**를 `ai/`에 구현한다.

---

## 6. GUI 방향

### 선택: shadcn/ui + Tailwind CSS

- 포스터의 연보라·화이트 미니멀 톤을 디자인 토큰으로 그대로 구현 가능
- 채팅 + 사이드바 + 카드형 위젯 조합 예제가 풍부
- v0.dev / Claude로 화면 생성 → 그대로 사용 가능 (풀스택 1명 체제에 최적)
- 보완: 캘린더 뷰 **FullCalendar**, Todo 보드 DnD **dnd-kit**, 차트 **Recharts**, 온보딩 애니메이션 **Framer Motion**

### 기본 레이아웃 (3분할)

```
┌────────┬─────────────────────────┬──────────────┐
│ 사이드바 │      Chat (중앙, 홈)     │  컨텍스트 패널  │
│ · Chat │  대화 스트림 + 인라인 카드   │ 오늘 일정      │
│ · 캘린더 │  (일정/메모/Todo가        │ 임박한 Todo   │
│ · 메모  │   말풍선 안 카드로 생성)    │ 최근 메모      │
│ · Todo │                         │              │
│ · 회의  │  [입력창 ──────────── ➤] │              │
└────────┴─────────────────────────┴──────────────┘
```

- **Chat이 홈** — "대화가 곧 인터페이스"
- AI 생성 결과는 인라인 카드로 렌더 + 확인/수정/취소 버튼 (AI 오답 대비 UX)
- 온보딩: 문이 열리며 워크스페이스로 들어가는 연출 (브랜드 스토리 연결)

---

## 7. 데이터 모델 (주요 엔티티)

> PK = 기본 키(행 고유 ID), FK = 외래 키(다른 테이블 참조). 상세 ERD·인덱스·제약조건은 `docs/09_DATABASE.md`에서 확정한다.

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

**MVP 필수 Agent**: Intent, Parser, Schedule, Todo, Memo
**확장 Agent**: Conflict, Meeting, Summary, Memory, Reminder, Recommendation, Travel, Weather, Notification, Learning, Decision

각 Agent는 다음을 정의한다: 역할 / 입력 / 출력 / Prompt / JSON Schema / Validation / Confidence / Retry / Error / API / Memory

상세 설계는 `docs/08_AI_AGENTS.md` 참고.

---

## 9. 설계 문서 (docs/)

| 파일 | 내용 | 오너 |
|------|------|------|
| 00_VISION.md | 철학, 브랜드 스토리("문" 메타포), 슬로건, 확장 방향 | 기획 |
| 01_PRODUCT.md | PRD — 문제 정의, 시나리오, User Story, MVP 범위 | 기획 |
| 02_SYSTEM.md | 전체 아키텍처, Data Flow, AI Router, 의존성 | 풀스택 |
| 03_DEVELOPMENT_FLOW.md | Phase별 개발 순서, Docker 구성 | 풀스택 |
| 04_GUI_UX.md | 3분할 레이아웃, Wireframe, 인라인 카드, UX 원칙 | 기획 |
| 05_FRONTEND.md | Next.js 구조, shadcn/ui 규칙, Zustand, React Query | 풀스택 |
| 06_BACKEND.md | FastAPI 구조, 패턴, JWT, LLM Provider 추상화 | 풀스택 |
| 07_AI_SYSTEM.md | AI Router, Confidence, Retry, 쿼터 이원화 전략 | AI A |
| 08_AI_AGENTS.md | Agent 15종 상세 설계 | AI A/B |
| 09_DATABASE.md | ERD, Entity 12종, Migration | 풀스택 |
| 10_API.md | Endpoint, **AI↔백엔드 계약 JSON Schema** | 풀스택 |
| 11_MEMORY.md | Short/Long Memory, Embedding(Chroma), RAG | AI B |
| 12_CALENDAR_ENGINE.md | CRUD, 충돌 감지, 반복 일정, Timezone | 풀스택 |
| 13_PROMPT.md | Prompt Rule, Few Shot, JSON Output, Hallucination 방지 | AI A |
| 14_SECURITY.md | JWT, OAuth, Prompt Injection 대응, 개인정보 | 풀스택 |
| 15_DEPLOY.md | 데모: Vercel+Render+Supabase / Release: AWS | 풀스택 |
| 16_TASK.md | 개발 체크리스트 | 기획 |
| 17_ROADMAP.md | 데모 → MVP → Beta → Release | 기획 |
| 18_CODING_STYLE.md | Python/React Style, Naming, Directory Rule | 풀스택 |
| 19_TEST.md | Unit/Integration/API/AI Test(Agent 정답셋) | AI B + 기획 |
| 20_WORKFLOW.md | 기능별 시퀀스 다이어그램 | 풀스택 |
| 21_ARCHITECTURE_DECISION_RECORD.md | 기술 선택 ADR (무료 스택, shadcn/ui 포함) | 전원 |

---

## 10. Git 규칙

### 브랜치 전략

- **main** — 최종 제출 및 안정화 브랜치 (직접 작업 금지)
- **develop** — 개발 통합 브랜치
- **feature/** — 기능 개발 브랜치

```
feature/frontend
feature/backend-api
feature/ai-model
feature/preprocessing
```

### 워크플로우

```bash
# 1. develop 최신화
git switch develop
git pull origin develop

# 2. 기능 브랜치 생성
git switch -c feature/기능명

# 3. 역할별 폴더에서 개발 (frontend/ | backend/ | ai/)

# 4. 커밋 & 푸시
git add .
git commit -m "feat: 기능 설명"
git push origin feature/기능명

# 5. PR: feature/* → develop
# 6. 통합 완료 후 PR: develop → main
```

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
