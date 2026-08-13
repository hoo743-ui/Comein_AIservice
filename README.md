<div align="center">

# 🚪 Comein

### 당신의 AI Workspace

**Come in. Your workspace is thinking for you.**
_들어오세요. 당신의 워크스페이스가 대신 생각합니다._

</div>

---

## 📌 소개

Comein은 **채팅 한 줄로 일정·메모·할 일·회의가 자동으로 정리되는 대화형 AI 워크스페이스**입니다.

기존 생산성 앱은 사용자가 직접 입력하고 분류해야 하는 "빈 사무실"이었습니다. Comein에서는 **말만 하면 됩니다.** 나머지는 워크스페이스가 생각합니다.

> **ChatGPT의 입력 경험 + Notion의 저장 구조 + Calendar의 실행력**을 하나로 묶습니다.

### 예시

```
"다음 주 화요일 3시에 교수님 미팅 잡아줘"
 → AI가 의도 파악 → 일정 충돌 검사 → 캘린더 자동 등록
 → "7/14(화) 15:00 '교수님 미팅' 등록했어요."
```

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 💬 Chat | AI와 대화하며 모든 업무를 처리 (모든 기능의 입구) |
| 📅 Calendar | 일정 생성·조회·수정·충돌 관리 |
| 📝 Memo | 생각과 아이디어를 AI가 정리·태깅 |
| ✅ Todo | 할 일 생성 및 우선순위 관리 |
| 🎙 Meeting | 회의 일정·요약·참석자 관리 |

---

## 🛠 기술 스택

| 영역 | 스택 |
|------|------|
| Frontend | Next.js · TypeScript · Tailwind CSS (슬림 레일 + 단일 캔버스, 커스텀) |
| Backend | FastAPI (Python) |
| AI | Gemini API · Groq API (Multi-Agent Architecture) |
| Database | PostgreSQL (Supabase) |
| Vector DB | Chroma |
| Cache | Redis (Upstash) |
| Infra | Vercel · Render/Railway |

> 모든 API·인프라는 **무료 티어** 기준으로 구성됩니다.

---

## 🚀 실행 중인 환경

| | 주소 | 비고 |
|---|---|---|
| 프론트 (Vercel) | `https://frontend-pied-one-74.vercel.app/workspace` | `main` 푸시 시 자동 배포 |
| 백엔드 (Render) | `https://comein-aiservice.onrender.com/health` | 무료 티어 — 15분 무요청 시 슬립, 첫 요청 30초~1분 |
| API 문서 | `https://comein-aiservice.onrender.com/docs` | Swagger UI |

배포·환경변수·콜드스타트 대응은 [`docs/15_DEPLOY.md`](./docs/15_DEPLOY.md).

### 다른 PC에서 처음 받았을 때

**git 에 없는 것이 있다.** clone 만으로는 앱이 뜨지 않는다 — 빠진 게 아니라 일부러 뺀 것이다.

| 없는 것 | 왜 | 어떻게 채우나 |
|---|---|---|
| `frontend/.env.local` | 키가 들어간다 | `.env.example` 복사 후 Supabase 대시보드에서 값 붙여넣기 |
| `backend/.env` | AI 키가 들어간다 | `.env.example` 복사 후 `GEMINI_API_KEY` · `GROQ_API_KEY` 채우기 |
| `node_modules/` · `backend/.venv/` | 용량·플랫폼 종속 | `npm install` · `python -m venv` |

```bash
# 프론트
cd frontend && npm install
copy .env.example .env.local
npm run dev                     # http://localhost:3000

# 백엔드 — AI 파싱(/api/chat · /api/summary)에만 필요하다
cd backend && python -m venv .venv && .venv\Scripts\activate
pip install -r requirements-dev.txt
copy .env.example .env
uvicorn app.main:app --reload   # http://localhost:8000
```

**프론트 `.env.local` 은 세 줄이 다 필요하다.** `NEXT_PUBLIC_API_BASE` 만 채우고 마는 실수가 잦다 —
Supabase 두 줄이 비면 앱은 **에러 없이** 저장도 로그인도 없는 로컬 전용으로 돈다.
화면은 멀쩡해 보여서 원인을 찾기 어렵다.

```
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co     # 대시보드 → Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>        #  같은 화면
```

**백엔드에는 DB 설정이 없다.** 이 서버가 하는 일은 자연어 파싱뿐이고(`/api/chat`·
`/api/summary`), 상태를 두지 않는다. 저장·조회·인증은 프론트가 Supabase 에 직접 한다.
`.env` 에 채울 것은 AI 키 두 개뿐이다.

> DB 스키마는 `supabase/migrations/` 에 커밋되어 있다(0001~). 새 Supabase 프로젝트라면
> 이걸 순서대로 실행해야 화면이 빈 채로 뜨지 않는다.

---

## 📁 프로젝트 구조

```
Comein_AIservice/
├── frontend/     # Next.js 웹 클라이언트
├── backend/      # FastAPI 서버
├── ai/           # AI Router · Agents · Prompt · Memory
├── docs/         # 설계 문서 (00~24)
├── scripts/      # 손으로 돌려보는 확인용 스크립트
├── render.yaml   # 백엔드 배포 정의 (Render Blueprint)
├── CLAUDE.md     # 프로젝트 전체 컨텍스트 문서 ⭐
└── README.md
```

> 📖 **프로젝트의 상세 설계·아키텍처·데이터 모델·개발 규칙은 [CLAUDE.md](./CLAUDE.md)를 참고하세요.**

---

## 👥 팀 구성

| 역할 | 인원 | 담당 |
|------|------|------|
| 기획 (PM) | 1 | 제품 기획, UX, 일정 관리 |
| AI 엔지니어 | 2 | AI Router, Agents, Memory, 프롬프트 |
| 풀스택 | 1 | Frontend, Backend, DB, 배포 |

---

## 🌿 Git 브랜치 전략

```
main       # 안정화 · 제출 (직접 작업 금지)
develop    # 개발 통합
feature/*  # 기능 개발 (frontend / backend-api / ai-model ...)
```

**Commit Convention**: `feat` · `fix` · `refactor` · `docs` · `style` · `chore`

자세한 워크플로우는 [CLAUDE.md](./CLAUDE.md#10-git-규칙) 참고.
