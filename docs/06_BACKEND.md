# 06. Backend — FastAPI 구조

> 이 문서는 실제 코드(`backend/app/`) 기준으로 작성한다. 설계 의도가 코드와 어긋나면 코드를 기준으로 갱신한다.
> 관련: `docs/09_DATABASE.md`(엔티티, 현재 비어있음 — 실제 기준은 `CLAUDE.md §7`), `docs/10_API.md`(AI↔백엔드 계약), `docs/24_AI_PIPELINE_STATUS.md`(AI 파이프라인 연동 현황).

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

## 패턴

- **상태 없음**: 라우터에 DB 세션 주입이 없다. 그래서 테스트도 앱에 붙는 클라이언트 하나면 끝난다(`tests/conftest.py`).
- **응답 스키마**: `app/schemas/` 에 둘만 남았다 — `items.py`(`ParsedItem`: AI 가 무엇을 뽑았는지 재는 자)와 `ai_result.py`(`/api/chat` 응답 계약).
- **AI 결과 검증**: `ai.router.route()`의 반환값은 아직 형태가 확정되지 않았으므로, `chat.py`가 `ParsedItem.model_validator`로 방어적으로 검증하고 실패 시 자연스러운 대화형 폴백으로 응답한다(`docs/24_AI_PIPELINE_STATUS.md` §5 참고).
- **LLM Provider 추상화**: `ai/llm/`에 위치(백엔드가 아니라 AI 파트 소유). `backend/requirements.txt`가 `google-genai`, `groq`를 명시적으로 포함해 백엔드 venv에서도 `ai/` import가 가능하도록 한다.

## 저장은 왜 여기 없나

프론트가 Supabase 에 직접 붙기 때문이다(`frontend/src/lib/remote.ts` — RLS + Realtime).
그 편이 실시간 반영과 행 단위 권한을 공짜로 얻는다. 백엔드를 한 번 더 지나면 둘 다 직접 만들어야 한다.

그래서 **백엔드에는 AI 키만 있고 DB 비밀번호가 없다.** 브라우저에 둘 수 없는 것(LLM 키)만
여기에 남고, 사용자별 권한으로 지킬 수 있는 것(데이터)은 Supabase 가 맡는다.

> 이 문서에는 예전에 "절대 건드리지 않는 영역" 으로 `database.py`·`items.py`·`items_service.py`·
> `alembic/*` 가 적혀 있었다. 그 코드들이 통째로 사라졌으므로 함께 걷는다 —
> **안정된 코드와 쓰이지 않는 코드는 다르다.**
