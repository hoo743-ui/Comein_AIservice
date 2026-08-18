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

- **"AI가 자동으로 딱 맞춰준다"가 아니라**, 프론트가 먹을 모양(AiResult)을 먼저 정하고 **AI를 그 스키마에 가둔다.**
  다만 가두는 방식은 반쪽이다 — Gemini 에는 `responseMimeType: application/json` 만 주고
  **스키마 자체는 보내지 않는다**(중첩 `$ref` 미지원). 모양은 프롬프트 산문으로 말하고,
  받은 뒤 `ParsedItem` 으로 두 번 검증한다(`ai/router.py` → `backend/.../chat.py`).
- ⑥ 분배는 `workspace/page.tsx` 의 `capture()` 안에서 한다 — `toParsed()` 로 모르는 필드를
  버리고 각 항목을 제 뷰로 보낸다. 예전 `store.ts` 의 `interpret()`(정규식으로 갈래를 나누고
  "우선순위를 추천해 뒀습니다" 라고 말하던 **가짜 AI**)은 걷어냈다.

---

## 4. AiResult 계약 (프론트 ↔ AI 경계)

> 원문: `docs/10_API.md`. 도메인 타입: `src/lib/types.ts`.

```jsonc
{
  "intent": "meeting",              // schedule | todo | memo | meeting | chat
  "reply": "회의로 정리했어요.",      // 화면에 뜨는 한 줄
  "items": [                        // 한 문장에서 여러 건이 나올 수 있다
    { "category": "meeting", "title": "미팅",
      "start": "2026-08-15T15:00:00+09:00", "participants": ["교수님"] }
  ],
  "ask": null                       // 시각이 없으면 items 대신 이 한 줄이 온다
}
```

- 계약이 `entity` 하나에서 **`items[]` 배열**로 바뀌었다 — "내일 3시 회의 잡고 자료도
  준비해야 해" 한 줄이 회의와 할 일 둘을 만든다. `intent` 는 첫 항목의 갈래일 뿐이라
  화면은 실제로 쓰지 않는다(각 항목이 제 `category` 를 갖는다).
- **`reply` 는 AI 가 쓴 문장이 아니다.** 항목 수·갈래로 서버가 만든 한 줄이거나, `ask` 다.
- **뽑았으면 묻지 않고, 물었으면 뽑지 않는다** — `items` 와 `ask` 는 동시에 서지 않는다.
- AI가 삐끗해도 대비: 두 번의 Pydantic 검증 + 일정을 `pending`(제안)으로 앉히고 사람이 확정.
  백엔드에 닿지 못하면 화면이 로컬 규칙으로 정리하되 **"AI 없이 정리했어요" 라고 밝힌다.**

---

## 5. 지금 상태 — 다 됐다 (2026-08-14)

이 문서는 "AI 모델 미확정" 시절에 쓰였다. 그 사이에 전부 끝났고, **간 길은 여기 적힌 것과
조금 다르다.** 낡은 계획을 지우기보다 무엇이 달라졌는지 남긴다.

- ✅ AiResult 계약 확정 — 다만 `entity` 하나가 아니라 **`items[]` 배열**이 됐다.
      한 문장에 여러 갈래가 들어오기 때문이다("회의 잡고 자료도 준비해야 해" → meeting + todo)
- ✅ 실제 LLM 연결 — Gemini(폴백 Groq). **mock 파서는 만들지 않았다.** 계약이 먼저 굳어서
      화면을 목업 없이 붙일 수 있었다
- ✅ 캡처바 → `/api/chat` 직접 연결. `interpret()`(정규식 가짜 AI)은 걷어냈다
- ✅ Render 배포 + Vercel 환경변수 + CORS
- ➕ 계획에 없던 것: **되묻기(`ask`)** — 시각이 없으면 지어내지 않고 한 줄 물어본다

---

## 6. api.ts — 지금은 주소 한 줄이다

```ts
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");
```

한때 `health` · `chat` · `parseMessage` 를 감싼 클라이언트였다. 저장이 Supabase 직행으로
옮겨가며 `/api/items` 경유 저장이 할 일을 잃었고, 남은 두 호출은 **요청 본문이 화면마다 달라**
얇은 래퍼를 한 겹 두는 편이 오히려 읽기 어려웠다. 그래서 화면이 `fetch` 로 직접 부른다:

```ts
const res = await fetch(`${API_BASE}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message, context: { now, tz, pending } }),
});
```

목표 계약이던 `/api/ai/parse` 는 끝내 만들지 않았다 — `/api/chat` 이 그 일을 한다.
다시 클라이언트 층이 필요해지면 그때 세운다. 쓰지 않는 층을 미리 두지 않는다.

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
2. 환경변수 입력: `CORS_ORIGINS`, (선택) `CORS_ORIGIN_REGEX`, LLM 키
   - `CORS_ORIGINS` 는 **쉼표 구분** 문자열 (`https://a.com,https://b.com`) — JSON 배열도 허용
   - **DB 값은 없다.** 백엔드는 DB 에 붙지 않는다(2026-08-13 정리, `docs/24` §16)
3. `/health` 200 확인

**Vercel (프론트)**
1. Settings → Environment Variables
   - `NEXT_PUBLIC_API_BASE = https://xxx.onrender.com`
   - `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` — **여기가 진짜 데이터 경로다**
2. 재배포 (`NEXT_PUBLIC_*` 은 빌드 타임에 번들에 구워지므로 값만 바꾸면 반영되지 않는다)

---

## 9. Render 무료 티어 콜드스타트 대응

- **증상**: 15분 무요청 → 슬립 → 첫 요청 30초~1분.
- **keep-alive**: UptimeRobot/cron-job.org 로 `/health` 를 10분마다 GET
  (무료 월 750시간 = 서비스 1개 24/7 무료 한도 안). self-ping 불가, 반드시 외부에서.
- **콜드스타트가 화면을 멈추지는 않는다.** 일정·대화는 Supabase 직행이라 백엔드가 자고 있어도
  그려진다. 느려지는 것은 캡처 바의 AI 파싱뿐이다.
- 예전에는 DB 커넥션 풀 워밍업과 `/health/db` keep-alive 가 여기 있었다. 백엔드가 DB 에
  붙지 않게 되면서 둘 다 사라졌다 — Supabase 를 깨우는 것은 이제 **사람이 쓰는 것** 뿐이다.
- **진짜 해결**: Render Starter $7/월(슬립 없음) 또는 Fly.io/Cloud Run 등.

---

## 10. 한 줄 요약

> 코드는 모노레포 하나, 배포는 Vercel(프론트)·Render(백엔드) 둘, HTTP(URL)로 연결.
> 프론트는 AiResult 계약만 믿고 완성 가능. AI는 백엔드 안쪽 세부사항이라 mock으로 대체하며 진행하고, 확정되면 그 한 곳만 real LLM으로 교체한다.
