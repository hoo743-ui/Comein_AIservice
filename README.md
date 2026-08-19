# Comein — AI Workspace

> **Come in. Your workspace is thinking for you.**

말 한 줄로 **일정이 잡히고**, 사람들과 **시간이 맞춰지는** AI Workspace입니다.

## Overview

기존 생산성 도구에서 사용자가 직접 정보를 입력하고 분류해야 했던 과정을 줄이고, 자연어를 중심으로 업무를 정리할 수 있도록 설계했습니다.

예:

```text
"내일 3시 교수님 미팅"
→ meeting / 미팅 / 15:00 / 교수님
→ 일정으로 제안하고 최종 확정은 사용자가 결정
```

시간이 없는 표현은 임의로 생성하지 않고 다시 질문하도록 설계했습니다.

## My Role

**기획 · PM + Full-stack / AI Integration**

- 서비스 컨셉 및 핵심 기능 정의
- 시스템 아키텍처 및 데이터 모델 설계
- GitHub / Git Flow / 문서화 체계 구축
- Next.js 프론트엔드 개발
- FastAPI 백엔드 개발
- Gemini → Groq AI fallback pipeline 구현
- Supabase DB / Auth / Realtime 연동
- 테스트 및 배포

## Key Engineering Decisions

### 1. Stateless Backend

저장·조회·인증은 Supabase를 사용하고, 백엔드는 AI 자연어 파싱에만 집중하도록 구성했습니다. 이를 통해 백엔드 장애나 sleep 상태가 일정·대화 화면 전체의 장애로 이어지지 않도록 했습니다.

### 2. Explicit AI Fallback

Gemini 실패 → Groq fallback → 로컬 규칙 처리 순으로 대응하고, AI가 실패한 경우 사용자에게 이를 명시하도록 설계했습니다.

### 3. Ambiguity Handling

"3시"와 같은 상대적·모호한 입력을 프롬프트만으로 처리하지 않고 코드 레벨에서 검증하고 보완했습니다.

### 4. Timeout / Retry Separation

일시적 오류와 timeout을 구분해 불필요하게 같은 요청을 두 번 기다리지 않도록 구성했습니다.

## Architecture

```text
User
  ↓
Next.js / React
  ├── Supabase (Auth / DB / Realtime)
  └── FastAPI
        ↓
      AI Router
        ├── Gemini
        ├── Groq fallback
        └── Local rule fallback
```

## Tech Stack

| Area | Stack |
|---|---|
| Frontend | Next.js 15 · React 19 · TypeScript · Zustand |
| Backend | FastAPI · Python |
| AI | Gemini · Groq · LLM Router |
| Database | Supabase · PostgreSQL · RLS |
| Infra | Vercel · Render |

## Validation

- Backend API tests **16개 통과**
- AI fallback scenarios 검증
- 실제 배포 환경에서 자연어 파싱 검증
- Frontend / Backend 배포 완료

## Team

| Role | Count |
|---|---:|
| PM / Planning | 1 |
| AI | 2 |
| Full-stack | 1 |

## Links

- **Live:** https://frontend-pied-one-74.vercel.app/workspace
- **Repository:** https://github.com/hoo743-ui/Comein_AIservice

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

> 상세한 설계 기록과 ADR은 `docs/` 및 프로젝트 문서를 참고하세요.
