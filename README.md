# Comein — AI Workspace

> **Come in. Your workspace is thinking for you.**

자연어 대화 한 줄로 **일정 · 메모 · 할 일 · 회의**를 관리하는 AI Workspace입니다.

## Why Comein?

기존 생산성 도구에서는 사용자가 직접 정보를 입력하고 분류해야 합니다.

Comein은 자연어를 입력하면 필요한 정보를 파악해 적절한 작업으로 연결하고, 정보가 부족하거나 애매하면 사용자가 직접 확정하도록 설계했습니다.

```text
"내일 3시 교수님 미팅"
        ↓
   AI Parsing
        ↓
meeting / 15:00 / 교수님
        ↓
   사용자 확인
        ↓
      Calendar
```

시간이나 조건이 불명확한 경우 임의의 값을 만들어내지 않습니다.

---

## My Role

### 기획 · PM + Full-stack / AI Integration

- 서비스 컨셉 및 핵심 기능 정의
- 시스템 아키텍처 / 데이터 모델 설계
- GitHub / Git Flow / 문서화 체계 구축
- Next.js 프론트엔드 개발
- FastAPI 백엔드 개발
- Gemini → Groq → Local Rule fallback pipeline
- Supabase DB / Auth / Realtime 연동
- 테스트 및 배포

---

## Key Engineering Decisions

### 1. Stateless Backend

저장·조회·인증은 Supabase가 담당하고 FastAPI는 AI 자연어 파싱에 집중하도록 분리했습니다.

AI 서버가 sleep 또는 일시적인 장애 상태가 되더라도 저장된 일정·메모·사용자 데이터 전체가 함께 영향을 받지 않도록 하기 위한 구조입니다.

### 2. Explicit AI Fallback

```text
Gemini
  ↓ 실패
Groq
  ↓ 실패
Local Rule
```

특정 AI API에 문제가 생겨도 전체 기능이 중단되지 않도록 단계적 fallback을 구성했습니다.

AI 처리에 실패한 경우 성공한 것처럼 데이터를 저장하지 않고 사용자에게 실패 상태를 명시합니다.

### 3. Ambiguity Handling

LLM에게 모든 판단을 맡기지 않았습니다.

예를 들어 `"3시"`처럼 날짜나 시간대가 불명확한 입력은 코드 레벨에서 다시 검증하고, 필요한 정보가 부족하면 사용자에게 질문하도록 구성했습니다.

### 4. Timeout / Retry Separation

일시적인 오류와 timeout을 구분해 같은 요청을 불필요하게 반복하지 않도록 처리했습니다.

---

## Architecture

```text
User
  ↓
Next.js / React
  ├──────────────→ Supabase
  │                 ├─ Auth
  │                 ├─ PostgreSQL
  │                 └─ Realtime
  │
  └──────────────→ FastAPI
                      ↓
                   AI Router
                  ↙    ↓    ↘
             Gemini  Groq  Local Rule
```

---

## Validation

- Backend API tests **16개 통과**
- AI fallback scenarios 검증
- 자연어 파싱 / 모호성 처리 검증
- Frontend / Backend 배포 완료
- 실제 배포 환경에서 핵심 플로우 검증

---

## Team

| Role | Count |
|---|---:|
| PM / Planning | 1 |
| AI | 2 |
| Full-stack | 1 |

저는 **PM / Planning + Full-stack / AI Integration**을 담당했습니다.

---

## Tech Stack

| Area | Stack |
|---|---|
| Frontend | Next.js 15 · React 19 · TypeScript · Zustand |
| Backend | FastAPI · Python |
| AI | Gemini · Groq · LLM Router |
| Database | Supabase · PostgreSQL · RLS |
| Infra | Vercel · Render |

---

## Project Structure

```text
Comein_AIservice/
├── frontend/            # Next.js client
├── backend/             # FastAPI AI parsing server
├── ai/                  # Router / LLM integration
├── supabase/migrations/ # DB schema / RLS
├── docs/                # Architecture / decisions / deployment
└── README.md
```

## Links

- **Live:** https://frontend-pied-one-74.vercel.app/workspace
- **Repository:** https://github.com/hoo743-ui/Comein_AIservice

## What I Learned

AI 서비스를 만들면서 모델의 정확도만큼 **실패했을 때 어떻게 동작할 것인지, 모호한 입력을 어디에서 검증할 것인지, AI 서버와 서비스 데이터를 어떻게 분리할 것인지**가 중요하다는 것을 경험했습니다.
