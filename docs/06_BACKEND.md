# 06. Backend — FastAPI 구조

> 이 문서는 실제 코드(`backend/app/`) 기준으로 작성한다. 설계 의도가 코드와 어긋나면 코드를 기준으로 갱신한다.
> 관련: `docs/09_DATABASE.md`(엔티티, 현재 비어있음 — 실제 기준은 `CLAUDE.md §7`), `docs/10_API.md`(AI↔백엔드 계약), `docs/24_AI_PIPELINE_STATUS.md`(AI 파이프라인 연동 현황).

## 디렉터리 구조

```
backend/
├── app/
│   ├── main.py                # FastAPI 앱 진입점, CORS, /health
│   ├── core/
│   │   ├── config.py          # .env 기반 Settings (DB/Redis/JWT/LLM 키)
│   │   └── database.py        # 비동기 SQLAlchemy 엔진/세션, Base, get_db
│   ├── models/                # SQLAlchemy ORM (User/Schedule/Todo/Memo/Meeting)
│   ├── schemas/                # Pydantic 요청/응답 스키마 (도메인별 파일 분리)
│   ├── services/               # DB 저장/조회 로직 (엔드포인트에서 분리)
│   └── api/
│       ├── router.py           # 도메인별 라우터 집약
│       └── endpoints/          # 실제 라우트 정의
├── alembic/                     # DB 마이그레이션
├── tests/                       # pytest, SQLite 인메모리 기반 E2E
└── requirements.txt / requirements-dev.txt
```

## 엔드포인트 현황

| 메서드/경로 | 파일 | 역할 |
|---|---|---|
| `POST /api/chat` | `api/endpoints/chat.py` | 자연어 메시지를 AI Router(`ai/router.py`)로 전달하고, 결과를 검증/보정해 `AiResult`로 응답 |
| `POST /api/items` | `api/endpoints/items.py` | AI 파싱 결과(`ParsedItem[]`)를 카테고리별 테이블에 저장 |
| `GET /api/schedules` | `api/endpoints/schedules.py` | `user_id` 필수, `from`/`to`(ISO datetime) 선택 — 기간으로 일정 조회 |
| `GET /api/todos` | `api/endpoints/todos.py` | `user_id` 필수, `status` 선택 필터 |
| `GET /api/memos` | `api/endpoints/memos.py` | `user_id` 필수 — 메모 조회 |
| `GET /api/meetings` | `api/endpoints/meetings.py` | `user_id` 필수 — `Schedule`과 join해 제목/시각/장소 포함 반환 |
| `GET /api/users/demo` | `api/endpoints/users.py` | 인증 붙기 전 임시 데모 사용자 get-or-create |

인증이 아직 없어 조회/저장 엔드포인트 모두 `user_id`를 쿼리 파라미터/요청 바디로 직접 받는다. 각 카테고리의 단건 조회·수정(PATCH)은 아직 없음 — 목록 조회만 구현됨.

## 패턴

- **DB 세션**: 모든 라우터는 `Depends(get_db)`로 `AsyncSession`을 주입받는다(`app/core/database.py`). 테스트는 `tests/conftest.py`에서 `get_db`를 SQLite 인메모리로 오버라이드한다.
- **응답 스키마**: `app/schemas/`에 도메인별로 분리(`items.py`, `schedules.py`, `todos.py`, `memos.py`, `meetings.py`, `ai_result.py`, `users.py`). 모델→스키마 변환은 `model_validate(orm_instance)`(`from_attributes=True`)를 사용하되, join이 필요한 경우(`meetings.py`)는 스키마를 직접 구성한다.
- **AI 결과 검증**: `ai.router.route()`의 반환값은 아직 형태가 확정되지 않았으므로, `chat.py`가 `ParsedItem.model_validator`로 방어적으로 검증하고 실패 시 자연스러운 대화형 폴백으로 응답한다(`docs/24_AI_PIPELINE_STATUS.md` §5 참고).
- **LLM Provider 추상화**: `ai/llm/`에 위치(백엔드가 아니라 AI 파트 소유). `backend/requirements.txt`가 `google-genai`, `groq`를 명시적으로 포함해 백엔드 venv에서도 `ai/` import가 가능하도록 한다.

## 절대 건드리지 않는 영역

`app/core/database.py`, `app/api/endpoints/items.py`, `app/services/items_service.py`, `alembic/*`는 이미 완성·안정 상태로 취급한다. 구조 변경 시 반드시 사전 협의.
