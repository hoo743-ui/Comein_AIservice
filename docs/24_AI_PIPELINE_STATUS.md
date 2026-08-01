# 24. AI 파이프라인 현재 상태 (텍스트 입력 → 저장까지)

> 이 문서는 상태가 바뀔 때마다 갱신한다(최초 작성 이후 1차 갱신: backend 쪽 GET 조회 라우터 추가, `chat.py` 검증/보정 로직 구현, `requirements.txt` 의존성 보강 — AI 팀(`ai/agents/*`, `ai/router.py`)은 아직 미변경).
> 관련: `docs/06_BACKEND.md`(이번에 채움), `docs/07_AI_SYSTEM.md`/`docs/08_AI_AGENTS.md`(여전히 비어있음 — AI 팀 작업 범위), `docs/09_DATABASE.md`(비어있음, 대신 `CLAUDE.md §7`이 실제 기준), `docs/10_API.md`(실제 백엔드 계약을 0절에 추가함).

---

## 1. 한눈에 보는 요약

| 영역 | 상태 |
|------|------|
| `backend/app/models/*`, `backend/app/core/database.py` | ✅ 완성 (건드리지 않음) |
| `backend/app/api/endpoints/items.py`, `services/items_service.py` | ✅ 완성 (건드리지 않음) |
| `backend/app/api/endpoints/{schedules,todos,memos,meetings}.py` | ✅ 신규 추가 — `user_id` 기준 목록 조회(GET), `app/api/router.py`에 등록 완료 |
| `backend/app/schemas/{schedules,todos,memos,meetings}.py`, `ai_result.py` | ✅ 신규 추가 |
| `backend/tests/*` | ✅ 16개 통과 — `/api/items`(기존) + GET 라우터 4종 + `/api/chat` 검증/폴백 4종 |
| `backend/app/api/endpoints/chat.py` | ✅ `ai.router.route()` 결과를 `ParsedItem`으로 검증 후 `AiResult`(`intent/reply/items`)로 응답, 검증 실패/예외 폴백 구현. **단, `/api/items` 저장 호출까지는 아직 연결 안 됨**(정책 미결정 — 5절 참고) |
| `ai/llm/*` (base, factory, gemini, groq) | ✅ 완성 |
| `ai/router.py` | 🟡 동작은 하지만 **설계와 다르게** Agent들을 전혀 거치지 않고 LLM을 한 번만 호출하는 임시 구현 (AI 팀 작업 범위 — 이번 갱신에서 미변경) |
| `ai/agents/intent.py`, `parser.py`, `schedule.py`, `todo.py`, `memo.py` | ❌ 전부 `NotImplementedError` 스켈레톤, `router.py`에서 import조차 되지 않음(죽은 코드, AI 팀 작업 범위) |
| `ai/memory/`, `ai/prompts/` (README에 언급된 디렉터리) | ❌ 디렉터리 자체가 없음 |
| `backend/requirements.txt` | ✅ `google-genai>=2.15.0`, `groq>=1.6.0` 추가(실제 설치 버전 기준) |

---

## 2. Backend 상세 (완성 영역 — 참고용, 수정 대상 아님)

- **모델**: `User`, `Schedule`, `Todo`, `Memo`, `Meeting` — `CLAUDE.md §7` ERD와 정확히 일치. SQLite 테스트 호환을 위해 `tags`/`participants`는 `JSON` 컬럼으로 구현(운영 Postgres에서도 동일 동작).
- **저장 계약**: `ParsedItem`(`backend/app/schemas/items.py`) → `create_items_from_parsed()`(`backend/app/services/items_service.py`) → category별 저장 함수(`_save_schedule/_save_todo/_save_memo/_save_meeting`).
  - `meeting`은 `Schedule`(status=`confirmed`) + `Meeting` 1:1 레코드를 함께 생성.
  - `schedule`은 AI 제안 상태이므로 `status="pending"`으로 생성(§7 정책과 일치).
- **엔드포인트**: `POST /api/items` — `user_id` 존재 확인(404) 후 저장, 결과 리스트 반환. `GET /api/users/demo` — 인증 붙기 전 임시 데모 유저 get-or-create.
- **조회 엔드포인트(신규)**: `GET /api/schedules`(`user_id` + `from`/`to` 기간 필터), `GET /api/todos`(`user_id` + `status` 필터), `GET /api/memos`(`user_id`), `GET /api/meetings`(`user_id`, `Schedule`과 join해 제목/시각/장소 포함). 전부 목록 조회만 제공 — 단건 조회·수정(PATCH)은 아직 없음. 상세는 `docs/06_BACKEND.md` 참고.
- **테스트**: `backend/tests/test_items.py`가 4개 카테고리 저장 + 미존재 유저 404를 SQLite 인메모리 DB로 검증(`conftest.py`가 `get_db` 의존성을 오버라이드). `test_schedules.py`/`test_todos.py`/`test_memos.py`/`test_meetings.py`가 신규 조회 라우터를, `test_chat.py`가 `chat.py`의 검증/폴백 로직을 `ai_route` 목업으로 검증한다(총 16개 테스트 통과).
- **주의**: 위 파일들(`database.py`, `items.py`, `items_service.py`, `alembic/*`)은 이번 작업 범위에서 제외 — 이미 안정 상태.

---

## 3. AI 영역 상세

### 3.1 `ai/llm/*` — 완성

- `base.py`: `LLMProvider` 추상 인터페이스(`generate`, `generate_structured`, `classify`) + 예외 계층(`LLMError`/`LLMRateLimitError`/`LLMGenerationError`).
- `gemini.py` / `groq.py`: 위 인터페이스의 실제 구현. `generate_structured`는 Pydantic 모델을 받아 구조화 출력을 보장(Gemini는 `response_schema`, Groq는 JSON 스키마를 시스템 프롬프트에 주입).
- `factory.py`: `Task.CLASSIFY` → Groq 단독, `Task.GENERATE` → `FallbackProvider(Gemini→Groq)`. `CLAUDE.md §5`의 "쿼터 이원화" 전략과 일치.
- **의존성**: `google-genai>=2.15.0`, `groq>=1.6.0`을 `backend/requirements.txt`에 추가함(이전에는 누락 상태 — 로컬 venv에 설치해 실제 동작 버전을 확인한 뒤 반영).

### 3.2 `ai/agents/*` — 스켈레톤, 미연결

- `base.py`: `BaseAgent`(abstract `run(message, context) -> AgentResult`), `AgentResult`(`data`, `confidence`, `reply`, `cards`) 정의는 되어 있음.
- `intent.py`, `parser.py`, `schedule.py`, `todo.py`, `memo.py`: 전부 `run()`이 `raise NotImplementedError`만 하는 빈 스켈레톤.
- **중요**: 이 5개 파일은 현재 **어디서도 import되지 않는다** (`ai/router.py`가 이들을 전혀 참조하지 않음). `ai/README.md`가 그리는 구조(`Router → Intent Classifier → Agent 라우팅`)와 실제 코드가 이미 어긋나 있다 — 3.3절 참고.
- `ai/memory/`, `ai/prompts/` 디렉터리는 README에 언급만 있고 실제로 생성돼 있지 않음(`docs/11_MEMORY.md`, `docs/13_PROMPT.md`도 빈 문서).

### 3.3 `ai/router.py` — "임시 단일 호출" 구현 (설계와 불일치)

현재 `route()`는:

1. `get_provider(Task.GENERATE)`로 Gemini(우선)/Groq(폴백) 프로바이더를 가져온다.
2. 사용자 메시지 + 현재 시각을 하나의 프롬프트에 욱여넣고, `ParseResponse`(자체 정의: `user_id`, `items: list[ParsedItem]`) 스키마로 **한 번에** 구조화 출력을 요청한다.
3. `model_dump(exclude_none=True)`로 dict를 반환한다.

즉 **Intent 분류 → Parser → (Schedule/Todo/Memo) Agent**라는 멀티에이전트 흐름 없이, LLM 한 번 호출로 "분류 + 추출"을 동시에 끝내는 구조다. 동작은 하지만:

- Agent별 confidence/retry/validation(`docs/08_AI_AGENTS.md`가 원래 정의하려던 것)이 전혀 없다 — LLM이 스키마에 맞는 JSON을 뱉으면 그대로 신뢰.
- `ai/router.py`가 `ParsedItem`/`Category`/`Priority`를 **자체적으로 다시 정의**하고 있다 — `backend/app/schemas/items.py`의 동명 스키마와 필드는 우연히 같지만 완전히 별개의 클래스다. 한쪽만 고치면 조용히 어긋난다(스키마 이중관리 리스크).

---

## 4. 전체 파이프라인 흐름도

### 4-A. 지금 실제로 연결된 것 (as-is)

```
[사용자 텍스트]
      │
      ▼
POST /api/chat  (backend/app/api/endpoints/chat.py)
      │  req.message, req.conversation_id → ai_route(message, user_id)
      ▼
ai.router.route()  (ai/router.py)
      │  프롬프트 1개 조립 → get_provider(Task.GENERATE)
      ▼
FallbackProvider (Gemini → 실패 시 Groq)  (ai/llm/factory.py)
      │  generate_structured(prompt, ParseResponse)
      ▼
ParseResponse { user_id, items: ParsedItem[] }  (ai/router.py 자체 정의 스키마)
      │  model_dump(exclude_none=True)
      ▼
chat.py: raw["items"]를 backend ParsedItem으로 검증
      │  ✅ 성공 → intent=첫 item.category(없으면 "chat"), reply 보정
      │  ✅ ValidationError → intent="chat" + 안내 문구 폴백
      │  ✅ 그 외 예외(ai_route 호출 실패 포함) → intent="chat" + 오류 문구 폴백
      ▼
AiResult { intent, reply, items } 반환   (backend/app/schemas/ai_result.py)
      │
      ✗  (POST /api/items 호출은 아직 없음 — 저장은 별도 단계, 5절 참고)
```

### 4-B. 목표 흐름 (사용자가 요청한 완성 형태)

```
[사용자 텍스트]
      │
      ▼
POST /api/chat
      │
      ▼
ai.router.route()
      ├─▶ IntentAgent.run()   → schedule/todo/memo/meeting/chat 분류 + confidence
      │
      ├─▶ ParserAgent.run()  → 분류된 category에 맞는 필드 추출(title/start/due/tags…)
      │        (필요 시 ScheduleAgent/TodoAgent/MemoAgent에 위임 — MVP 범위는 협의 필요)
      │
      ▼
ParsedItem[] (ai/router.py)
      │
      ▼
chat.py: 검증·보정
      │   - backend/app/schemas/items.py의 ParsedItem으로 재검증(모델 다르므로 변환 필요)
      │   - confidence 낮으면 사용자 확인 유도(바로 저장 X) 등 정책 결정 필요
      ▼
POST /api/items 로직 호출 (create_items_from_parsed) — 기존 완성 코드 그대로 재사용
      │
      ▼
DB 저장 (Schedule/Todo/Memo/Meeting) — ✅ 이미 완성·안정
      │
      ▼
자연어 응답 + 카드(receipt) → 프론트 반환
```

---

## 5. 파일별 다음 작업 목록 (구현은 다음 단계, 지금은 목록만)

### `ai/agents/intent.py`
- [ ] LLM 호출로 메시지를 `schedule/todo/memo/meeting/chat` 중 하나로 분류 (`Task.CLASSIFY` → Groq 사용이 `CLAUDE.md §5` 전략과 일치).
- [ ] confidence 산출 방식 결정(모델이 점수를 안 주면 대체 지표 필요 — 예: 재질문/재시도 횟수 기반).
- [ ] 분류 실패/모호 시 재시도(Retry) 및 폴백 정책.
- [ ] `docs/08_AI_AGENTS.md`가 비어있으므로, Intent 출력 JSON Schema를 이 작업의 일부로 확정해서 문서화할지 결정 필요.

### `ai/agents/parser.py`
- [ ] IntentAgent가 판별한 category를 받아 해당 필드만 추출하는 구조화 프롬프트 설계.
- [ ] `generate_structured(prompt, ParsedItem)` 형태로 Gemini 호출(품질 우선 — `Task.GENERATE`).
- [ ] `backend/app/schemas/items.py.ParsedItem`의 `model_validator`(필수 필드 체크)와 **동일한 검증 규칙**을 어디서 적용할지 결정(AI 쪽에서 선검증 후 백엔드가 재검증하는 이중 구조가 될 가능성 — 3.3절 스키마 중복 문제와 연결).

### `ai/router.py`
- [ ] 현재의 "단일 프롬프트 통짜 호출" 방식을 유지할지, `IntentAgent → ParserAgent` 2단계로 교체할지 결정 (성능/비용 vs 정확도/구조 트레이드오프 — 사용자와 협의 필요할 수 있음).
- [ ] 자체 정의 `ParsedItem`/`Category`/`Priority`를 `backend/app/schemas/items.py`와 어떻게 단일화할지 결정(공유 모듈 분리 또는 backend 스키마를 import).
- [ ] `context` 파라미터(현재 `dict[str, Any] | None`, 항상 빈 dict로 호출됨)를 실제로 채울 계획 수립 — 예: 최근 대화 이력, 사용자 타임존.

### `backend/app/api/endpoints/chat.py`
- [x] `ai_route()` 반환값을 `backend/app/schemas/items.py.ParsedItem`으로 검증/변환, `AiResult`(`intent/reply/items`)로 응답. 검증 실패(`ValidationError`)/그 외 예외 각각 다른 문구로 폴백 — `tests/test_chat.py`로 확인(`ai_route`는 몽키패치 목업 사용, 실제 AI 팀 구현 완료 전까지 유효).
- [ ] 검증 통과 항목을 `items_service.create_items_from_parsed()`(기존 완성 함수, **재사용만** — 수정 금지)로 저장까지 연결 — 아직 미구현. 지금은 `/api/chat`이 `items`만 반환하고, 저장은 호출자가 별도로 `/api/items`를 호출해야 한다.
- [ ] 검증 실패 또는 confidence 낮은 항목의 처리 정책(사용자 확인 후 저장 vs 바로 저장) 결정 — `ai.router.route()`가 현재 confidence를 반환하지 않으므로 AI 팀 작업과 함께 결정 필요.
- [ ] 현재 `conversation_id`를 그대로 `user_id`로 넘기고 있음(`req.conversation_id or "default"`) — 실제 `user_id`(UUID, `/api/users/demo` 또는 인증)와의 관계 정리 필요.
- [ ] `sys.path` 조작으로 `ai` 패키지를 import하는 현재 방식이 임시방편인지, 정식 패키지 설치/PYTHONPATH 설정으로 대체할지 결정.

---

## 6. 설계 문서 vs 실제 코드 — 차이점

- **`docs/06_BACKEND.md`는 이번에 채웠다** — 실제 엔드포인트/패턴 기준으로 작성. `docs/07_AI_SYSTEM.md`, `docs/08_AI_AGENTS.md`는 여전히 빈 파일(0바이트, AI 팀 작업 범위) — 따라서 `ai/` 쪽은 여전히 `CLAUDE.md`와 `ai/README.md`, 코드 주석이 실질적 기준이다.
- **`ai/README.md`가 그리는 구조와 `ai/router.py`의 실제 동작이 다르다**: README/CLAUDE.md는 `Router → Intent Classifier → Agent(Schedule/Todo/Memo) → Memory → LLM`을 그리지만, 실제 `router.py`는 Agent와 Memory를 완전히 건너뛰고 LLM 1회 호출로 끝낸다(3.3절, 이번 작업에서 미변경).
- **`docs/10_API.md`를 갱신해 0절에 실제 백엔드 계약을 추가했다.** 기존 §1~§4(프론트 목업 시절 `AiResult`: `reply/intent/confidence/entity`)는 그대로 남겨뒀지만, 실제 백엔드가 구현한 `AiResult`(`backend/app/schemas/ai_result.py`: `intent/reply/items`)는 **필드 구성이 다른 별개의 스키마**다 — 이름이 같다고 혼동하지 않도록 0절에서 명시했다. 프론트를 실제 백엔드에 연결할 때 두 계약 중 하나로 통일할 필요가 있다(§1~§4를 폐기하거나 갱신).
- **`docs/09_DATABASE.md`는 여전히 비어있다** — 모델 구조 자체는 이번 작업에서 변경하지 않았으므로(기존 모델 재사용, join만 추가) 채우지 않았다. 실제 기준은 `CLAUDE.md §7`.

---

## 7. 기타 관찰 사항 (참고용)

- 인증이 아직 없어 `POST /api/items`, `POST /api/chat`, 신규 `GET /api/schedules|todos|memos|meetings` 모두 `user_id`를 요청자가 직접 넘긴다(데모 단계에서는 의도된 설계 — `backend/app/api/endpoints/users.py` docstring에 명시).
- `frontend/src/lib/api.ts`가 새로 추가된 상태(git status상 untracked)이나, 이번 작업 범위(`backend/`, `ai/`, `docs/`)에는 포함하지 않았다. 프론트-백엔드 연동 조사가 필요하면 별도로 진행 필요.
- 이번 작업에서 `ai/agents/*`, `ai/router.py`는 의도적으로 건드리지 않았다(AI 팀 작업 중) — 3절의 내용은 여전히 유효하다.
