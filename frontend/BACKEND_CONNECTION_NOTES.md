# 백엔드 연동 정리 노트 (프론트엔드 관점)

> Comein 프론트(Vercel) ↔ 백엔드(Render/FastAPI) 연동 구조·순서 메모.
> 작성 배경: AI 모델 미확정 상태에서 "어디까지 세팅해두고, 무엇을 알아야 하는지" 정리.

---

## 1. 전체 그림 — 코드는 하나, 실행은 둘

```
[GitHub 레포 1개 · 모노레포]
  frontend/  ──▶ Vercel  (Root Directory = frontend)   ← 화면 배달
  backend/   ──▶ Render  (Root Directory = backend)    ← AI·로직·DB
  ai/        (백엔드 안에서 사용)

  git push main  →  Vercel · Render 가 각자 자기 폴더만 보고 자동 배포(병렬)
```

- **"둘로 나뉜다"는 코드가 쪼개지는 게 아니라 실행(런타임)만 둘.** 레포·git·진실의 원천은 하나.
- **분리하는 이유**
  - 프론트 = JS(Next.js) / 백엔드 = Python(FastAPI) → **다른 언어·다른 프로그램**이라 코드 직접 호출 불가 → HTTP로만 대화.
  - **AI 키(GEMINI/GROQ)·DB 비번은 백엔드에만.** 프론트(브라우저 노출)에 두면 털림.
- 이 구조(분리형 / decoupled)는 **업계 표준**. 특히 AI가 Python이라 자연스러움.

---

## 2. 역할 구분

| | Vercel (프론트) | Render (백엔드) |
|---|---|---|
| 하는 일 | Next.js 빌드·호스팅, 화면 배달 | FastAPI 실행, AI 호출, 검증, DB |
| 사용자가 봄? | ✅ `comein.vercel.app` 방문 | ❌ 사용자는 안 봄 |
| URL 용도 | **사람용** 주소 | **프론트 코드용** 내부 주소 |
| AI 키 보관 | ❌ 절대 안 됨 | ✅ 여기 보관 |

- **URL 2개인 이유**: 백엔드가 다른 기계(Render)에서 돌아서, 프론트 코드가 요청 보낼 "주소"가 필요.
- 만약 백엔드를 Next.js(TS)로 통합하면 URL이 같은 도메인 뒤(`/api/...`)로 숨음. 단, 우리는 Python 백엔드라 분리 URL이 정답.

---

## 3. 요청 흐름 (핵심)

```
① 사용자 프롬프트 입력
② POST /api/chat 로 백엔드 전송
③ 백엔드가 AI 호출 → AI가 AiResult 스키마(JSON) 출력
④ 백엔드가 JSON 검증·보정 (필드 없으면 기본값 / 이상하면 chat 폴백)
⑤ 검증된 AiResult 를 프론트로 반환
⑥ 프론트 dispatcher 가 intent 별로 기능에 꽂고 reply 표시
```

- **"AI가 자동으로 딱 맞춰준다"가 아니라**, 프론트가 먹을 모양(AiResult)을 먼저 정하고 **AI를 그 스키마에 가둔다(JSON 모드/구조화 출력).**
- ⑥ dispatcher는 이미 존재 → `src/lib/store.ts`의 `sendMessage()` 안 `interpret()` 분기(schedule/todo/memo). 지금은 목업, 나중에 `parseMessage()`로 교체.

---

## 4. AiResult 계약 (프론트 ↔ AI 경계)

> 원문: `docs/10_API.md`. 도메인 타입: `src/lib/types.ts`.

```jsonc
{
  "reply": "내일 3시 교수님 미팅을 제안 일정으로 만들었어요.", // 자연어 응답(필수)
  "intent": "schedule",   // schedule | todo | memo | meeting | chat (필수)
  "confidence": 0.92,     // 0~1 (선택)
  "entity": {             // 만들/수정할 실제 데이터 (chat이면 없음)
    "op": "create",
    "type": "schedule",
    "data": { "title": "교수님 미팅", "start": "2026-07-28T15:00:00", "end": "..." }
  }
}
```

- 어떤 AI 모델을 쓰든 이 모양은 안 변함 → **계약만 고정하면 프론트는 AI 몰라도 완성 가능.**
- AI가 삐끗해도 대비: 스키마 강제(①) + 서버 검증/기본값(②) + 일정 `pending` 후 사용자 확인(③).

---

## 5. 지금 상태 & AI 미확정이어도 할 수 있는 것

막힌 곳은 **백엔드 가장 안쪽, 실제 LLM 호출 한 지점뿐.** 나머지는 지금 다 세팅 가능.

- ✅ `src/lib/api.ts` (완료) — 백엔드 호출 transport (`health`, `chat`, `parseMessage`)
- ✅ `.env.example` — `NEXT_PUBLIC_API_BASE` 자리 추가
- ⬜ AiResult 계약 확정 (**최우선**)
- ⬜ 백엔드에 **mock 파서**(키워드 규칙) 넣기 → AI 대역, 프론트 전체 기능 테스트 가능
- ⬜ 캡처바에서 `interpret()` → `parseMessage()` 연결
- ⬜ Render 배포 + Vercel 환경변수 + CORS

**AI 확정되면 → 백엔드 mock을 real LLM 호출로 교체하는 것만.** 프론트·계약·배포 안 건드림.

---

## 6. api.ts 사용법

```ts
import { health, parseMessage } from "@/lib/api";

await health();                     // {status:"ok"} → 프론트↔백엔드 연결 OK
const r = await parseMessage("내일 3시 회의");  // AiResult 반환
// r.reply → 채팅 표시,  r.intent/r.entity → dispatcher가 기능에 반영
```

- 베이스 URL은 `NEXT_PUBLIC_API_BASE` 환경변수에서 읽음.
- `/api/ai/parse`(계약 목표)는 백엔드 미구현 → 현재는 살아있는 `/api/chat`을 감싸 반환. 경로 생기면 seam 안쪽만 교체.

---

## 7. 로컬 테스트 순서

```bash
# 터미널 1 — 백엔드
cd backend && uvicorn app.main:app --reload      # http://localhost:8000

# 터미널 2 — 프론트
cd frontend
cp .env.example .env.local                        # NEXT_PUBLIC_API_BASE=http://localhost:8000
npm run dev
```
- `health()` 성공하면 배선 OK (CORS 기본값이 `localhost:3000` 허용이라 로컬은 바로 됨).

---

## 8. 배포 순서 (Render + Vercel)

> 상세 절차·환경변수 표·체크리스트는 **`docs/15_DEPLOY.md`** 로 이관. 아래는 요약.

**Render (백엔드)** — 레포 루트 `render.yaml` 이 설정을 갖고 있다.
1. New → **Blueprint** → 레포 선택 → Apply (Root Directory·Build·Start·헬스체크 자동 적용)
2. 환경변수 입력: `DATABASE_URL`, `CORS_ORIGINS`, (선택) `CORS_ORIGIN_REGEX`, LLM 키
   - `CORS_ORIGINS` 는 **쉼표 구분** 문자열 (`https://a.com,https://b.com`) — JSON 배열도 허용
   - `DATABASE_URL` 은 Supabase URI 그대로 붙여넣으면 됨 (asyncpg 변환 자동)
   - `JWT_SECRET` 은 Render 가 자동 생성
3. `/health` 200 확인, `/health/db` 로 DB 연결 확인

**Vercel (프론트)**
1. Settings → Environment Variables → `NEXT_PUBLIC_API_BASE = https://xxx.onrender.com`
2. 재배포

---

## 9. Render 무료 티어 콜드스타트 대응

- **증상**: 15분 무요청 → 슬립 → 첫 요청 30초~1분. + 첫 DB 커넥션 풀 생성 지연.
- **keep-alive**: UptimeRobot/cron-job.org 로 `/health/db` 를 10분마다 GET → 백엔드+DB 상시 깨움
  (무료 월 750시간 = 서비스 1개 24/7 무료 한도 안). self-ping 불가, 반드시 외부에서.
- **DB 워밍업**: `main.py` startup 이벤트에서 `SELECT 1` 실행해 풀 미리 생성.
  `create_async_engine(..., pool_pre_ping=True)`.
- **함정**: Supabase 무료 DB는 1주 무활동 시 일시정지 → `/health` 가 DB를 실제로 건드리게(SELECT 1) 하면 같이 깸.
- **진짜 해결**: Render Starter $7/월(슬립 없음) 또는 Fly.io/Cloud Run 등.

---

## 10. 한 줄 요약

> 코드는 모노레포 하나, 배포는 Vercel(프론트)·Render(백엔드) 둘, HTTP(URL)로 연결.
> 프론트는 AiResult 계약만 믿고 완성 가능. AI는 백엔드 안쪽 세부사항이라 mock으로 대체하며 진행하고, 확정되면 그 한 곳만 real LLM으로 교체한다.
