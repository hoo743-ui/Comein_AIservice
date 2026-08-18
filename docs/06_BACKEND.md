# 06. Backend — FastAPI 구조

> 이 문서는 실제 코드(`backend/app/`) 기준으로 작성한다. 설계 의도가 코드와 어긋나면 코드를 기준으로 갱신한다.
> 관련: [`10_API.md`](./10_API.md)(AI↔프론트 계약), [`24_AI_PIPELINE_STATUS.md`](./24_AI_PIPELINE_STATUS.md)(상태 로그).
> 스키마의 진실은 문서가 아니라 [`supabase/migrations/`](../supabase/migrations) 다 — 이 서버는 그 DB 에 붙지 않는다.

## 실행

```powershell
cd backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload    # http://localhost:8000  · /docs 에 OpenAPI
pytest -q                        # DB 픽스처가 없다 — 앱에 붙는 클라이언트 하나면 끝난다
```

키는 `backend/.env` 에 둔다(`backend/.env.example` 참고). `GEMINI_API_KEY` 가 없으면
`/api/chat` 은 폴백 응답만 돌려준다 — 죽지는 않는다.

## 디렉터리 구조

```
backend/
├── app/
│   ├── main.py                # FastAPI 앱 진입점, CORS, /health
│   ├── core/
│   │   └── config.py          # .env 기반 Settings (CORS/JWT/LLM 키)
│   ├── schemas/               # ParsedItem(AI 결과 검증) · AiResult(응답 계약)
│   └── api/
│       ├── router.py          # 라우터 집약
│       └── endpoints/         # chat.py · summary.py
├── tests/                     # pytest — 상태가 없어 DB 픽스처도 없다
└── requirements.txt / requirements-dev.txt
```

## 엔드포인트 현황

| 메서드/경로 | 파일 | 역할 |
|---|---|---|
| `POST /api/chat` | `api/endpoints/chat.py` | 자연어 메시지를 AI Router(`ai/router.py`)로 전달하고, 결과를 검증/보정해 `AiResult`로 응답 |
| `POST /api/summary` | `api/endpoints/summary.py` | 대화(`transcript`)를 네 갈래(무슨 얘기였나/정해진 것/미정/다음 할 일)로 접어 응답 |
| `GET /health` | `main.py` | Render 헬스체크 |

**이 셋이 전부다.** 저장·조회 엔드포인트(`POST /api/items`, `GET /api/{schedules,todos,memos,meetings}`,
`GET /api/users/demo`)와 그것들이 딛고 있던 `models/`·`services/`·`alembic/`·`core/database.py` 는
2026-08-13 에 걷어냈다. 저장이 Supabase 직행으로 옮겨간 뒤 아무도 부르지 않았기 때문이다
(`docs/24_AI_PIPELINE_STATUS.md` §16). **이 서버는 DB 에 붙지 않는다 — 상태가 없다.**

## 흔들림에 대한 태도

LLM 은 가끔 느리고 가끔 틀린 모양으로 답한다. 그것을 오류로 취급하면 사용자는 아무것도 얻지 못하고,
무시하면 화면에 이상한 것이 앉는다. 그래서 셋으로 나눠 다룬다(자세한 사정은 `24_…` §21).

| 무엇이 | 어떻게 |
|---|---|
| 형태가 어긋난 응답 | `ParsedItem` 검증에서 걸러 낸다. 시각처럼 지어내야 하는 값이 비면 항목 대신 `ask` 한 줄 |
| 흔들림(일시적 실패·429) | **한 번 더 묻는다.** 같은 문 앞에서 두 번 기다리지는 않는다 |
| 그래도 안 되면 | Gemini → **Groq 폴백 한 홉**. 실패에는 이름이 있다(무엇 때문에 넘어갔는지 로그에 남는다) |
| 타임아웃 | 요청 하나가 오래 붙들지 못하게 상한을 둔다 — 30초는 이미 실패한 요청을 붙들고 있는 시간이었다 |

`Retry` 는 이 한 겹이 전부다. 계층을 더 쌓지 않는다 — 재시도가 재시도를 부르면
사용자는 자기가 무엇을 기다리는지 모르게 된다.

## 패턴

- **상태 없음**: 라우터에 DB 세션 주입이 없다. 그래서 테스트도 앱에 붙는 클라이언트 하나면 끝난다(`tests/conftest.py`).
- **시험**: `tests/` 넷 — `/api/chat` 검증·폴백, `/api/summary`, `ai.router` 계약,
  그리고 가짜 Provider 로 도는 폴백 시나리오(`test_llm_fallback.py`). 실제 LLM 을 부르지 않는다.
- **응답 스키마**: `app/schemas/` 에 둘만 남았다 — `items.py`(`ParsedItem`: AI 가 무엇을 뽑았는지 재는 자)와 `ai_result.py`(`/api/chat` 응답 계약).
- **AI 결과 검증**: `ai.router.route()`의 반환값은 아직 형태가 확정되지 않았으므로, `chat.py`가 `ParsedItem.model_validator`로 방어적으로 검증하고 실패 시 자연스러운 대화형 폴백으로 응답한다(`docs/24_AI_PIPELINE_STATUS.md` §5 참고).
- **LLM Provider 추상화**: `ai/llm/` 에 있다(백엔드가 아니라 AI 파트 소유). 백엔드 venv 에서 `ai/` 를
  import 할 수 있어야 하므로 `requirements.txt` 가 그 의존성을 함께 명시한다 — 지금은 `groq` 하나뿐이다.
  Gemini 는 SDK 없이 `httpx` 로 REST 를 직접 부르므로(`ai/llm/gemini.py`) `google-genai` 가 필요 없다.
  설치만 되고 한 번도 import 되지 않은 채 빌드를 무겁게 하고 있었다.

## 저장은 왜 여기 없나

프론트가 Supabase 에 직접 붙기 때문이다(`frontend/src/lib/remote.ts` — RLS + Realtime).
그 편이 실시간 반영과 행 단위 권한을 공짜로 얻는다. 백엔드를 한 번 더 지나면 둘 다 직접 만들어야 한다.

그래서 **백엔드에는 AI 키만 있고 DB 비밀번호가 없다.** 브라우저에 둘 수 없는 것(LLM 키)만
여기에 남고, 사용자별 권한으로 지킬 수 있는 것(데이터)은 Supabase 가 맡는다.

> 이 문서에는 예전에 "절대 건드리지 않는 영역" 으로 `database.py`·`items.py`·`items_service.py`·
> `alembic/*` 가 적혀 있었다. 그 코드들이 통째로 사라졌으므로 함께 걷는다 —
> **안정된 코드와 쓰이지 않는 코드는 다르다.**
