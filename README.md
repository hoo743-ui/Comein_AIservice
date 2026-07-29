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

## 📁 프로젝트 구조

```
Comein_AIservice/
├── frontend/     # Next.js 웹 클라이언트
├── backend/      # FastAPI 서버
├── ai/           # AI Router · Agents · Prompt · Memory
├── docs/         # 설계 문서 (00~21)
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
