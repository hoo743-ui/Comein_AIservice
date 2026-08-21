# 24. 상태 로그 — 무엇을 왜 그렇게 고쳤나

> **이 문서는 덧붙여 쓰는 로그다.** 절을 고쳐 쓰지 않고 아래에 새 절을 붙인다.
> 그래서 **위쪽 절은 그때의 사실이고, 지금의 사실이 아니다** — §1 의 표에는 이미 사라진
> `ai/agents/*` 가 적혀 있다. 지금 상태를 알고 싶으면 **맨 아래 절부터** 읽으면 된다.
>
> 왜 고쳐 쓰지 않는가. 이 프로젝트에서 가장 비싸게 배운 것들이 "무엇이 고쳐졌나" 가 아니라
> **"왜 그렇게 만들었다가 왜 되돌렸나"** 였다. 결론만 남기면 다음 사람이 같은 길을 다시 간다.
>
> | | |
> |---|---|
> | 지금의 구조 | [`02`](./02_SYSTEM.md) · [`05_FRONTEND.md`](./05_FRONTEND.md) · [`06_BACKEND.md`](./06_BACKEND.md) |
> | 지금의 스키마 | [`09_DATABASE.md`](./09_DATABASE.md) — 진실은 [`supabase/migrations/`](../supabase/migrations) |
> | 지금의 계약 | [`10_API.md`](./10_API.md) |
> | 미뤄 둔 것 | [`16_TASK.md`](./16_TASK.md) |

## 절 찾기

| 절 | 무엇에 대한 기록인가 |
|---|---|
| §1–9 | 처음 상태와 초기 갱신 — **오래된 사실** |
| §10–12 | 캘린더가 시간 지도가 됐다 · 저장이 실제로 되기 시작 · 카카오 로그인 |
| §13–15 | 모바일 웹 · 되묻기(모르면 지어내지 않는다) · 제출 전 전수 점검 |
| §16–17 | 죽은 경로를 걷어냈다 · 방향이 바뀐 자리에 남은 것들 |
| §18–19 | 읽히지 않던 글자들 · 시뮬레이션이 거짓말한 자리 |
| §20–21 | 잠깐만 뜨는 것들 · LLM 폴백이 한 겹뿐이었다 |
| §22 | **실시간이 조용히 죽어 있던 자리** — 두 계정으로 써 보고 나온 네 가지 |
| §23 | 버튼과 통일성 재점검 |
| §24 | 사용 가이드 아홉 걸음 |
| §25 | **저장소에 없는 파일로 빌드가 무너져 있었다** · 갈래를 줄였다 · 폴백이 이미 죽어 있었다 · 낙관적 쓰기가 거짓말하던 자리 |
| §26 | **그룹** · 사라지던 말 하나 · 중요도 · 헷갈리던 화면 넷 |
| §27 | **눈으로 보고 나서야 보인 것 다섯** — 지울 수 없던 일정 · 화면 밖의 입력칸 · 오늘이 아닌 오늘 |
| §28 | **같은 두 사람에게 대화가 둘이었다** — 1:1 에서 자리를 여는 길 |
| §29 | **빗금 · 여기서부터 새로 · 오른쪽 클릭** — 그리고 한 번 눌러 닿는 거리 |
| §30 | **같은 문장이 칸에 따라 다른 AI 를 만났다** · 좋은 소식이 화면을 덮고 있었다 |
| §31 | **제출 문서와 코드가 서로 다른 말을 하고 있었다** — 없는 파일을 인용한 보고서 · 다시 잰 97/100 · 동시 요청에서 무너지는 자리 |
| §32 | **손이 닿아야 보이던 것들** — @ 로 사람을 못 박는다 · 같은 시각이 여섯 줄이었다 · 느림의 진짜 몫 — 지금 상태 |

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
  > **정정 (2026-08-14).** Gemini 에는 `responseSchema` 를 **보내지 않는다** — 중첩 Pydantic
  > 모델의 `$ref` 를 지원하지 않아 코드에서 일부러 뺐다(`gemini.py`). 실제로 주는 것은
  > `responseMimeType: application/json` 뿐이고, 목표 JSON 모양은 **프롬프트 산문**으로만
  > 말한다. "구조화 출력을 보장" 은 Groq 경로에만 반쯤 해당한다(그쪽도 `json_object` 는
  > 문법만 보장하지 스키마 준수를 보장하지 않는다). §20 의 알려진 한계 참고.
- `factory.py`: `Task.CLASSIFY` → Groq 단독, `Task.GENERATE` → `FallbackProvider(Gemini→Groq)`. `CLAUDE.md §5`의 "쿼터 이원화" 전략과 일치.
- **의존성**: `google-genai>=2.15.0`, `groq>=1.6.0`을 `backend/requirements.txt`에 추가함(이전에는 누락 상태 — 로컬 venv에 설치해 실제 동작 버전을 확인한 뒤 반영).

### 3.2 `ai/agents/*` — 스켈레톤, 미연결

> **낡았다 (2026-08-14).** 이 디렉터리는 **지금 존재하지 않는다** — 스켈레톤인 채로 걷혔다.
> `ai/` 에 있는 것은 `router.py` 와 `llm/` 뿐이다. 아래는 그때의 기록으로만 읽는다.
> 이 절이 지적한 "README 와 코드의 어긋남" 은 §20 에서 README 를 고쳐 닫았다.

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

> **낡았다 (2026-08-14).** `ai/agents/intent.py`·`parser.py` 항목은 **없는 파일에 대한 할 일**
> 이다. 그 갈림길("단일 프롬프트로 갈 것인가, Intent → Parser 2단계로 갈 것인가")은
> **단일 프롬프트 쪽으로 정해졌고**, 스키마 이원화도 해소됐다 — `ai/router.py` 가
> `backend/app/schemas/items.py` 의 `ParsedItem` 을 그대로 import 한다.
> 지금 유효한 "다음 할 일" 은 §20 끝의 **알려진 한계** 목록이다.

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
- [x] `context` 파라미터를 실제로 채웠다 — 화면이 `now`(벽시계+오프셋)·`tz`·`pending`(직전 되물음)을 보낸다. **14절**.
      최근 대화 이력은 아직 안 실었다(되묻기 한 번을 잇는 데는 `pending` 으로 충분했다).

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

---

## 8. 2차 갱신 (2026-08-02) — 프론트 연동 · 배포 · UX 결정

> 이번 갱신 범위: `frontend/`, `render.yaml`, `docs/`, 배포 설정. `ai/agents/*` 는 여전히 미구현
> 스켈레톤이고 `ai/router.py` 도 그대로다(3절 유효).

### 8.1 배포가 실제로 붙었다

| | 주소 |
|---|---|
| 백엔드 | `https://comein-aiservice.onrender.com` (Render, 무료) |
| 프론트 | `https://frontend-pied-one-74.vercel.app` (Vercel) |

- `backend/app/core/config.py` — `CORS_ORIGINS` 를 쉼표 구분 문자열로 받고(대시보드 입력 편의),
  `CORS_ORIGIN_REGEX` 를 추가했다. `DATABASE_URL` 은 Supabase 형식(`postgresql://...?sslmode=require`)을
  그대로 붙여넣어도 asyncpg 형태로 자동 보정한다.
- `/health`(빠름) 와 `/health/db`(DB 왕복) 를 분리했다. 무료 티어 콜드스타트·Supabase 휴면 대응은
  `docs/15_DEPLOY.md` §4.
- **함정 기록**: Vercel 은 한 프로젝트에 주소를 여러 개 준다(프로덕션/브랜치/배포별). 하나만 허용해두면
  다른 주소에서 CORS 로 막히는데, 프론트는 그걸 조용히 삼키고 로컬 규칙으로 폴백해서
  "AI 가 갑자기 멍청해진 것"처럼 보인다. 원인 파악에 오래 걸렸다 — 정규식으로 한 번에 여는 게 낫다.

### 8.2 프론트가 `/api/chat` 을 직접 쓴다

- `frontend/src/app/workspace/page.tsx` 의 캡처바 → `POST /api/chat` → `items[]` 를 목적지 뷰
  (캘린더·할 일·메모·회의)로 배정. 주소는 `NEXT_PUBLIC_API_BASE`(`src/lib/api.ts`).
- `items` 를 **전부** 처리한다. 한 문장에서 회의+할 일이 나오면 두 건으로 나뉜다.
- 백엔드 실패 시 로컬 키워드 규칙으로 폴백한다(입력을 삼키지 않기 위함). 다만 폴백이라는 사실이
  화면에 드러나지 않아 오진하기 쉽다 — **표시 추가가 필요하다(미해결).**

### 8.3 UX 결정 — 확인 단계 폐기

- AI 결과를 확인/정제하는 카드(제목·시간·장소 입력 폼)를 **제거**했다. 사용자가 폼을 채우게 만드는 순간
  "일이 스스로 정리된다"는 제품 전제가 깨진다(CLAUDE.md §0). 지금은 즉시 배정하고, 캡처바 위 한 줄이
  6초간 떴다 사라지며 그 줄에서 되돌릴 수 있다.
- 따라서 `docs/10_API.md` §1~§4 의 "일정은 `pending` 으로 만들고 사용자가 확정" 흐름은 **폐기**다.
  5절의 "확인 후 저장 vs 바로 저장" 정책 결정도 이 방향(바로 저장 + 되돌리기)으로 정리됐다.
- 처리 기록을 나열하던 목록도 없앴다. 기록을 진열하면 대시보드가 된다.
- 각 뷰 상단의 AI 제안 배너와 행 액션은 **하드코딩된 가짜**였다(연락처를 보지도 않고 항상 같은 문구).
  진짜 AI 가 붙은 시점에서는 신뢰를 깎기만 해서 제거했다. 다시 넣는다면 실제 데이터 기반이어야 한다.

### 8.4 남은 것 (우선순위 순)

1. **저장** — 여전히 `POST /api/items` 미연결. 새로고침하면 전부 사라진다. Supabase `DATABASE_URL`
   등록 + `alembic upgrade head` + `/api/chat` → 저장 연결이 한 묶음이다. 체감상 가장 큰 구멍.
2. **폴백 가시화** — 백엔드 실패를 사용자가 알 수 있게.
3. **선제적 동작** — 충돌 감지("그 시간엔 이미 수업이 있어요"), 시간 미상 시 되묻기. 지금은 시키는 것만 한다.
4. `ai/agents/*` 스켈레톤 구현 — 3절 그대로.

---

## 9. 3차 갱신 — 갈래를 둘로 줄였다 (프론트 전용)

> 범위: `frontend/src/app/workspace/page.tsx` 만. 백엔드·AI·DB 는 그대로다.

- **레일 6뷰 → 4뷰**: Today · Calendar · Tasks · People. **Notes · Meetings 뷰를 없앴다.**
- **분류 4갈래 → 2갈래**: `Kind = "일정" | "할 일"`. 시간 위의 일과 시간 밖의 일, 그 둘뿐이다.
  갈래가 적을수록 사용자가 분류를 의식하지 않는다(CLAUDE.md §0 — "일이 스스로 정리되게").
- **백엔드 카테고리는 그대로 4종**(`schedule/meeting/todo/memo`)이고, 프론트가 화면 직전에 접는다
  (`toParsed()`): `schedule|meeting → 일정`, `todo|memo → 할 일`. 저장(`/api/items`)은 원본
  카테고리를 그대로 보내므로 **DB 는 여전히 4종을 구분해 저장한다** — 나중에 뷰를 되살려도 데이터 손실은 없다.
- 로컬 폴백 `classify()` 도 같은 2갈래로 축소. 히어로 카운트는 `회의/할 일/메모` → `일정/할 일` 2개.
- **남은 것**: `frontend/src/lib/store.ts` 의 `memos`/`meetings` 슬라이스와 `addMemo`/`addMeeting`
  액션은 이제 어떤 화면도 쓰지 않는다(죽은 코드). DB 에는 계속 쌓이는데 볼 화면이 없다는 뜻이기도 하다 —
  정리할지, 메모를 다시 어딘가에 드러낼지는 미결.

---

## 10. 4차 갱신 — 캘린더가 시간 지도가 됐다 (프론트 전용)

> 범위: `frontend/src/app/workspace/page.tsx`, `frontend/src/app/experience/page.tsx`.
> 백엔드·AI·DB·store 구조는 그대로다. 이번에도 순수 프론트.

### 10.1 탭이 셋으로 줄었다

- **레일 4뷰 → 3뷰**: Today · Calendar · People. **Tasks 뷰를 없앴다.**
- 그래서 `Kind = "할 일"` 의 목적지가 `tasks` → `today` 로 바뀌었다(`DEST`). 캡처한 할 일은 오늘 화면의
  할 일 수에 반영된다. **다만 할 일을 목록으로 보거나 완료 처리할 화면이 사라졌다** — `store.todos` 와
  `moveTodo` 는 살아 있으므로 되살릴 수는 있다. 미결.
- 우측 상단 **알림 벨을 제거**했다(시각만 남음). 알림 목록을 만들던 `notifs` 계산도 함께 걷어냈다.

### 10.2 캘린더 = 달력 ‖ 24시간 원

- **24시간 원(생활계획표)** 을 실제 일정에 연동했다. `spansOf()` 가 그 날짜에 걸치는 일정을
  분(分) 구간으로 잘라 arc 로 그린다. 검증: 렌더된 `path` 좌표를 `atan2` 로 역산해 시각으로 되돌렸을 때
  06:00–07:00 / 10:00–11:00 / 14:00–15:00 / 20:00–21:00 및 seed 의 15:00–16:00 / 17:30–18:00 /
  14:00–15:30 이 **모두 오차 0**.
- 예외 처리: **자정 넘김**은 날짜 경계로 잘라 양쪽 날에 표시(툴팁에 "다음 날"/"전날부터"),
  **종일(24시간 이상)** 은 시간대 arc 대신 바깥을 두르는 띠, **겹침**은 안쪽으로 최대 3겹까지 물림,
  짧은 일정은 최소 6분 폭 보장.
- 상호작용: arc hover → 제목·시간 툴팁, click → 고정(popover). 범례 행과 서로 연동.
- **날짜 클릭은 화면을 바꾸지 않는다.** 선택만 바뀌고 오른쪽 원이 그 날로 갱신된다.
  **같은 날짜를 한 번 더 누르면** 그 날의 타임테이블(표)로 들어간다. "시간표로 보기" 버튼도 함께 둔다.
- 선택 날짜는 워크스페이스가 쥔다(`calDay`) — 좌측 상시 달력·가운데 큰 달력·오른쪽 원이 같은 하루를 본다.
  좌측 상시 달력의 날짜를 누르면 그 날을 고른 채 캘린더 탭으로 건너간다.

### 10.3 레이아웃 — 기준선을 하나로

- 예전엔 본문은 캔버스 중앙, 시계·상단 문구·문 문양·캡처바는 각자 캔버스 가장자리 기준이라 **기준선이 넷**이었다.
  `--measure`(뷰의 본문 폭)와 `--edge`(캔버스 오른쪽 끝 → 본문 오른쪽 끝)를 정의해 전부 한 값을 참조하게 했다.
- 간격·모서리를 토큰화(`--sp-*` 8px 배수, `--r-sm/--r/--r-lg`). 임의값 제거.
- 캘린더 본문 폭은 `min(1440px, 100vw − 레일 − 좌우여백)` 으로 반응형. 달력 : 원 = **1.35 : 1**,
  원 자체는 400px 에서 멈추고 컬럼 가운데에 선다.
- 세로는 `justify-content: safe center` 로 남는 공간을 위아래가 나눠 갖는다(상단 몰림·하단 공백 해소).
  단 **사람 뷰는 목록이므로 상단 정렬**.
- 문 문양은 "본문 바깥 오른쪽 여백의 한가운데" 한 규칙만 쓴다. 여백이 없으면(캘린더 등) 물러난다.

### 10.4 인트로 건너뛰기

- `/experience` 의 건너뛰기 버튼이 **앞 3.8초 동안 숨겨져 있었다**(`phase-logo`/`phase-door` 에서 `opacity:0`).
  인트로가 8.2초인데 정작 넘기고 싶은 순간에 없었다. 0.9초 뒤 등장으로 바꾸고, 테두리·배경을 준 알약 버튼으로
  키웠다(107×42). `aria-label` 과 포커스 링도 추가.

---

## 11. 5차 갱신 (2026-08-11) — 저장이 실제로 되고, 사람이 실재하게 됐다

> 범위: `supabase/migrations/0002~0005`, `frontend/src/lib/*`, `frontend/src/app/workspace/page.tsx`,
> `backend/app/api/endpoints/summary.py`. 8.4절이 "체감상 가장 큰 구멍" 이라 적었던 **저장이 이번에 뚫렸다.**
>
> 다만 저장처는 `POST /api/items`(SQLAlchemy) 가 아니라 **Supabase 직행**이다 — 5절·8.4절이 전제하던
> 경로와 다르다. 프론트가 PostgREST 를 직접 부르고, 권한은 RLS 가 DB 안에서 판정한다.
> `backend/app/models/*` 와 `items_service.py` 는 여전히 살아 있지만 **워크스페이스는 그 길로 저장하지 않는다.**

### 11.1 오늘 뽑은 뿌리 하나 — "아직 없는 줄에 권한이 매여 있었다"

세 번 다른 얼굴로 나타났는데 원인이 같았다.

| 증상 | 실제 원인 |
|---|---|
| 일정을 넣으면 `42501` — "저장이 안 된다" | INSERT 는 통과하고 **RETURNING 이 막혔다.** `events` 의 SELECT 정책이 `is_event_participant(id)` 뿐인데 참여자 줄은 AFTER INSERT 트리거가 만든다 → 돌려받는 순간엔 아직 없다 |
| 1:1 방을 만들면 만든 사람 눈에 안 보임 | 같은 형태. 멤버 줄은 방을 만든 **다음에** 넣는다 |
| 일정 방에 주최자가 말을 못 씀 | `tg_event_bootstrap` 이 참여자를 먼저 넣고 방을 나중에 만들어, 참여자 트리거가 방을 못 찾고 조용히 지나갔다. **방 4개에 멤버 0명이었다** |

원인을 짚은 지점: **`Prefer: return=minimal` 은 201, `return=representation` 만 403.**
읽기는 멀쩡해서 "조용히 저장만 안 되는" 형태였다.

고치는 방향은 하나로 정리됐다 — **권한을 '따라오는 표'에 묻지 않고 그 줄 자신에게 묻는다.**
`0002` 는 방 접근을 `can_access_room()`(일정 방이면 그 일정의 참여자인가 / 1:1 방이면 dm_key 안에 내 uid 가 있는가)
으로 바꿨다. 어느 줄이 먼저 만들어지든 답이 같다.

> **주의(재발 방지).** `chat_rooms` 의 SELECT 정책만은 `can_access_room(id)` 를 쓰지 **않고** 그 줄의 컬럼을
> 직접 본다. `stable` 함수는 같은 명령이 방금 넣은 줄을 못 보기 때문에, 그렇게 적으면 위 함정이 그대로 재발한다.

### 11.2 사람이 실재하게 됐다 (`0004`)

그전까지 사람 탭의 연락처는 지역 데이터였다. 화면에는 있는데 실제로는 없는 사람이라,
참여자로 부르면 `chat_room_members_user_id_fkey` 에서 튕겼다.

- `profiles`(id=auth.uid, handle, display_name) + 가입 트리거 + 기존 계정 백필.
- `search_people(q)` · `connect_with(peer)` · `disconnect_from(peer)` · `my_people()`.
- `my_people()` 은 **이은 사람 + 같은 일정에서 만난 사람**을 함께 준다.

**찾을 수는 있되 훑을 수는 없게.**

| | 정책 |
|---|---|
| `profiles` 직접 SELECT | 나 자신 · 이어진 사람 · 같은 일정의 사람만 (검증: 계정 2개 중 **1건만 보임**) |
| 검색 | `search_people()` 한 곳으로만. 두 글자 미만은 아예 반환 안 함, 결과 20개 상한 |
| 이메일 | **컬럼 자체를 두지 않았다.** 함수 안에서 정확히 일치할 때만 맞춰 보고 이메일은 돌려주지 않음 (검증: `fapp1004@naver.com` → 1건 / `fapp1004@nav` → **0건**) |
| 연결 | `connect_with` 가 양방향 두 줄을 함께 넣는다. 직접 insert 정책은 열지 않음(반쪽짜리 관계 방지) |

### 11.3 대화에서 시간이 정해진다 (`0003`, `0005`)

`대화 → 후보 시각 → 각자의 달력과 대조 → 제안 → 전원 동의 → 확정`.
**새 일정을 만들지 않는다** — 서 있던 일정이 시각을 얻고 앉는다. 그래서 "동시에 여러 명이 동의하면
일정이 여러 개 생기는" 문제는 애초에 생기지 않는다.

프라이버시 경계가 **코드 수준에** 있다:

- `availability_for(e, s, f)` → 사람마다 `available` / `busy` / `unknown` **한 글자만.** 제목·장소·메모는 함수 밖으로 나가지 않는다.
- `suggest_slots(...)` → 시간대를 훑되 **'몇 명이 되는가'만.** 사람별로 언제 바쁜지를 다 내보내면 남의 하루가 그대로 재구성된다.
- `respond_to_proposal(...)` → 답과 확정을 **한 트랜잭션**에 묶고 제안 줄을 잠근다. 마지막 두 사람이 동시에 눌러도 확정은 한 번만.
- `schedule_proposals` 에는 **쓰기 정책을 열지 않았다.** 아무나 `status` 를 `confirmed` 로 적을 수 있으면 '전원 동의' 는 약속이 아니게 된다.

`unknown` 을 `available` 로 접지 않았다. 달력이 비어 있는 것과 그 시간에 시간이 있는 것은 다르다.

**`0005` — 후보 순위를 바로잡았다.** "금요일 7시에 보자" 에 **오전 7시**를 권했다. 여유(buffer)를
'많을수록 좋다' 로 두고 근접도보다 앞에 세워서, 다른 일정에서 가장 멀리 떨어진 새벽이 늘 1등이 됐다.
여유는 많을수록 좋은 게 아니라 **모자라지 않으면 되는 것**이다 → 15분 문턱으로만 보고 그다음은 말한 시각에 가까운 순.

| 19시 선호 · 19시는 본인이 바쁨 | |
|---|---|
| 전 | `07:00` (dist 720) |
| 후 | **`17:30` / `20:30`** (dist 90) |

### 11.4 요약은 `/api/chat` 이 할 수 있는 일이 아니었다

처음엔 `/api/chat` 을 재사용했다. **버튼도 눌리고 로딩도 돌고 요약 칸도 떴는데 내용이
"3건을 정리했어요." 였다.** 그쪽은 범용 대화가 아니라 **파서**다(`chat.py` `_default_reply`) —
한 마디를 항목으로 갈라 담고 영수증을 돌려준다. 대화를 통째로 넣으면 대화가 일정 파싱에 들어간다.

→ **`POST /api/summary` 신설**(`backend/app/api/endpoints/summary.py`). `provider.generate()` 를 직접 쓴다.
요약은 사람이 읽는 글이라 JSON 스키마에 끼울 이유가 없다. 불릿 기호는 서버가 걷어내고 화면이 붙인다.
프롬프트에 *"대화에 없는 내용을 지어내지 않는다"* 를 넣었다 — 요약이 없는 결정을 만들어내면 그 자리에서 거짓말이 된다.

**UI 가 도는 것과 기능이 되는 것은 다른 일이었다.** 이번 세션에서 두 번 같은 형태로 나타났다(11.5 참고).

### 11.5 저장된 대화가 화면에 없던 것

DB 에는 메시지 5건이 멀쩡히 있는데 화면은 "아직 대화가 없어요" 였다.
`openEventMsgs` 가 `roomId === ` \`room_${eventId}\` 로 걸렀기 때문이다 — 그건 **서버가 없을 때 스토어가
붙이는 임시 이름**이고, 서버 방은 진짜 uuid 라 영영 맞지 않는다. 1:1 방(\`dm_${peerId}\`)도 같았다.

→ 작명 규칙을 화면에서 다시 지어내지 않는다. 방 id 는 `chatRooms` 에서 찾는다(로그인 전 임시 이름은 fallback 으로 남김).

### 11.6 읽지 않은 말

보고 있는 방이면 그냥 화면에 얹힌다(이미 보였다). 다른 방이면 센다. 큰 팝업으로 가로막지 않는다.
**숫자를 매달지 않았다** — 필요한 건 '무언가 와 있다' 하나뿐이고 몇 개인지는 들어가서 알면 된다.
숫자를 붙이면 목록이 알림판이 된다. 이름은 색 대신 무게로 한 단계 올린다.
레일의 점은 다른 화면에 있을 때만(사람 탭을 보고 있으면 목록이 이미 말한다).

### 11.7 함께 정리한 화면

- **설정** — 곁들이는 칸에서 **하나의 화면**으로. 캔버스를 통째로 받고 탭 전환과 같은 크로스페이드로 들어온다.
  (그전엔 레이아웃이 무너져 있었다: 같은 판단이 두 군데에 다르게 적혀 칸은 둘로 줄었는데 레일은 계속 그려졌다 → `showCtxRail` 하나로 묶음)
- **나가기** — 링크였다. 세션이 남은 채 랜딩으로 갈 뿐이었다. 이제 정말 로그아웃하고 **한 번만** 옮긴다(가드와 경합하지 않게 빗장).
- **가이드** — 카드 높이를 230px 로 짐작해 마지막 단계가 잘렸다(실제 274~297px). 재서 쓴다.
  타이포 대비를 올렸다 — **차분함을 투명도로 만들고 있었다.** 옅게 깔아 얻은 고요함은 그냥 안 읽히는 것이다. 위계는 크기와 무게로.
- **문 + 미리보기** — 224px 로 키우고, 버튼 전체에 걸려 있던 `opacity` 를 그림과 글자로 분리했다(문은 조용하고 글자는 읽힌다).
  '가이드 시작 →' 이 손이 닿으면 사라지던 것은 `pointer-events: none` 탓 — 보일 때만 눌리게 했다.
- **오늘 제목** — 인사말(`Good Night.`) → **`오늘`**. 여기만 인사가 서면 다른 규격의 화면처럼 보인다.
- **24시간 다이얼** — 지금바늘이 중심 축에서 뻗어 나간다(떠 있는 막대가 아니라 시곗바늘로). 좌표 대신 회전이라 갱신 사이를 CSS 가 메운다.
  일정 arc 는 둥근 끝만큼 미리 깎아 **칠해진 끝이 실제 시각에 닿게** 했다.
- **로그인 화면** — 이메일·비밀번호를 위로(지금 실제로 열려 있는 길이 위에 오는 게 정직하다). Comein 은 카드 첫 줄에 정렬.

### 11.8 실제 검증 기록

계정 2개(`hoo743` / `fapp1004`)로 끝까지 이어 확인했다.

| 단계 | 결과 |
|---|---|
| 이메일 정확 일치 검색 | 1건, `connected:false` |
| 이메일 부분 일치 | **0건** |
| `connect_with` | 양방향 **2줄** |
| **참여자 추가** | **성공** ← FK 로 튕기던 그 자리 |
| 방 멤버 | **2명** (0002 트리거 순서 수정이 실제로 듣는다) |
| 메시지 전송 | 성공 |
| 제안 → 나만 동의 | `waiting:1`, 일정 `pending` 유지 (§전원 동의 전 미확정) |
| 요약 | 실제 4줄 출력 확인 |

### 11.9 남은 것

1. **`sb_secret_…` 키 폐기** — `NEXT_PUBLIC_SUPABASE_URL` 에 세 번 들어갔던 적이 있어 노출 상태.
   **secret 키는 RLS 를 전부 우회한다** — 11.2·11.3 에서 지은 정책이 이 키 앞에서는 무의미하다.
   Supabase → Settings → API Keys → Revoke. **코드로 해결되지 않는다.**
2. **Vercel 이 옛 빌드다** — Render 는 `/api/summary` 까지 따라왔는데 Vercel 은 `align-items: center`(오늘 바꾼 `start` 가 아님).
   Production Branch 가 `main` 인지 확인 필요.
3. `chat_rooms`·`chat_messages` 에 DELETE 정책이 없다 — *"남긴 말은 고치거나 지우지 않는다"* 는 의도였지만,
   **방 자체도 영영 못 지운다.** 나가기/방 삭제가 필요해지면 정책 설계가 필요하다.
4. 저장 경로 이원화 — 워크스페이스는 Supabase 직행이고 `POST /api/items`(SQLAlchemy) 는 쓰이지 않는다.
   `backend/app/models/*` 를 유지할지 걷을지 미결. **5절·8.4절의 "저장 연결" 항목은 이 경로에 한해 무효다.**
   → **정해졌다: 걷어냈다 (§16).**
5. `ai/agents/*` 스켈레톤 — 3절 그대로. → **없어졌다.** 스켈레톤인 채로 걷혔다(§3.2 주석 참고).

---

## 12. 카카오 로그인 — 어디까지 갔나 (2026-08-11)

문이 안 열렸다. 로그인 버튼은 있는데 눌러도 카카오가 거절했다.
오류를 하나씩 벗겨 보니 **코드 문제가 아니라 전부 카카오·Supabase 설정 문제**였다.

확인 방법은 하나였다 — 실제로 브라우저에서 세션을 비우고 카카오 버튼을 눌러
**밖으로 나가는 authorize URL 과 카카오가 돌려주는 오류 코드를 읽는다.**
(`scratchpad/kakao_try.mjs`. 오류 화면의 '펼치기' 를 열면 카카오가 원인을 이름까지 짚어 준다.)

| 오류 | 원인 | 조치 | 상태 |
|---|---|---|---|
| KOE101 | Client ID 에 REST API 키가 아닌 키가 들어감 | REST API 키로 교체 | ✅ |
| KOE205 | `account_email` 이 비즈 앱 전용 동의항목 | 비즈 앱 전환 후 이메일 '선택 동의' | ✅ |
| KOE205 | `profile_image` 미설정 | 동의항목에서 프로필 사진 켜기 | ✅ |
| KOE006 | Redirect URI 미등록 | 아래 12.1 의 자리에 등록 | ✅ |
| 500 `Unable to exchange external code` | Supabase 의 Client Secret 칸에 카카오 시크릿이 아닌 값 | 카카오 클라이언트 시크릿 코드로 교체 | ✅ |
| 로그인은 됐는데 문 앞으로 되돌아옴 | `/experience` 가 문턱 플래그를 안 세우고 나감 | `experience/page.tsx` `social()` 수정 | ✅ |

**2026-08-11 종료 — 카카오로 실제 입장 확인.** `/experience → Continue with 카카오 → /workspace`,
동의 재요구 없이 한 번에. 세션 `provider: kakao`, `profiles` 에 `handle=tngns743`,
`display_name=수훈` 이 앉았다(0009 의 ① 이메일 앞부분 갈래).

### 12.1 Redirect URI — 칸을 찾는 데 오래 걸렸다

**Redirect URI 는 `제품 설정 → 카카오 로그인` 에 없다.** 지금 콘솔에서는 키 단위로 관리한다:

```
앱 설정 → 플랫폼 키 → [REST API 키] 수정 → 카카오 로그인 리다이렉트 URI
   https://mbamzjivpdzjnvzcbamp.supabase.co/auth/v1/callback
```

입력칸에 치는 것만으로는 등록되지 않는다 — 오른쪽 `+` 로 목록에 올린 뒤 맨 아래 **저장**.
등록되면 플랫폼 키 화면의 그 키 카드에 `로그인 리다이렉트 URI` 태그가 붙는다(등록 여부를 한눈에).

넣는 주소는 우리 도메인이 아니라 **Supabase 도메인**이다 — 카카오가 돌려보내는 곳은
우리 사이트가 아니라 Supabase 이고, Supabase 가 세션을 만든 뒤 `redirect_to` 로 넘긴다.
그래서 로컬(`localhost:3000`)을 위해 따로 등록할 것은 없다. 카카오에 나가는 `redirect_uri` 는
언제나 이 하나뿐이고, 로컬이냐 배포냐는 그 뒤 Supabase 가 `redirect_to` 로 가른다.

확인은 콘솔을 믿지 말고 실제로 나가는 URL 로 한다:

```bash
curl -s -o /dev/null -w "%{redirect_url}\n" \
  "https://<project>.supabase.co/auth/v1/authorize?provider=kakao&redirect_to=<...>"
```

`redirect_uri=` 로 실려 나가는 값이 곧 카카오에 등록돼 있어야 하는 문자열이다.

### 12.2 scope 는 코드로 줄일 수 없다

`signInWithOAuth({ options: { scopes } })` 로 `account_email` 을 빼려 했지만,
Supabase 는 provider 기본 scope 에 **덧붙이기만** 한다. 실제로 나간 값:

```
scope = account_email profile_image profile_nickname profile_nickname profile_image
```

그래서 셋 다 카카오 콘솔에서 켜져 있어야 한다. 되돌렸고 `remote.ts` 에 주석으로 남겼다
(다음 사람이 같은 길로 다시 들어서지 않도록).

### 12.3 이메일이 없어도 사람은 이름을 가져야 한다 — 0009

이메일 동의를 '선택' 으로 두면 사용자가 거부할 수 있다. 그런데 프로필 핸들을
이메일 앞부분에서만 뽑고 있어서, 이메일이 없으면 전부 `comein`, `comein1`, `comein2` 로
줄을 섰다. **핸들로 사람을 찾는 화면에서 순번 핸들은 서로를 못 찾게 만든다.**

`0009_handle_without_email.sql` — 세 갈래로 짚는다:
이메일 → provider 가 준 아이디 → 계정 uuid 앞 8자리(`u3f9a2b1`).
한글 닉네임은 `[a-z0-9_]` 만 남기면 비므로 세 번째 갈래가 실제로 자주 쓰인다. **적용 완료.**

### 12.4 동의는 통과했는데 세션이 없던 자리 — 시크릿

KOE006 을 닫자 동의 화면이 떴고, 동의했는데도 로그인 화면으로 되돌아왔다.
화면에는 아무 말이 없었다. **답은 Supabase 쪽 로그에 있었다:**

```
Dashboard → Logs → Auth
  /callback | 500: Unable to exchange external code
```

카카오는 인가 코드를 정상 발급했고, 그 코드를 토큰으로 바꾸는 단계에서 막힌 것이다.
`Authentication → Sign In / Providers → Kakao` 의 **Client Secret Code** 에
카카오 시크릿(32자)이 아니라 다른 값(11자)이 들어 있었다.

카카오에서 **클라이언트 시크릿이 활성화(ON)** 이면 Supabase 에도 그 코드가 정확히 있어야 한다.
값은 `앱 설정 → 플랫폼 키 → [REST API 키] 수정 → 클라이언트 시크릿 → 코드`.
쓰지 않을 거면 카카오에서 OFF 로 두고 Supabase 칸을 비우는 것도 답이다 — **둘 중 하나로 맞추면 된다.**

> 화면에 오류가 안 뜨면 브라우저를 더 노려보지 말고 Auth 로그를 연다.
> 이 단계의 실패는 서버끼리의 대화라 브라우저에는 흔적이 거의 남지 않는다.

### 12.5 마지막 문턱 — 로그인은 됐는데 문 앞으로 되돌아온 이유

시크릿까지 고치자 세션은 생겼는데(`provider: kakao`) 화면은 여전히 `/experience` 였다.
이건 인증이 아니라 **우리 라우팅**이었다.

`/workspace` 는 `sessionStorage["comein:reimagine"]` 이 없으면 인트로를 거치라고
`/experience` 로 되돌린다. `/enter` 는 소셜로 나가기 전에 이 플래그를 세우는데,
`/experience` 의 소셜 버튼은 세우지 않았다. 사람들이 실제로 쓰는 문이 `/experience` 쪽이라
**소셜 로그인은 항상 제자리로 돌아왔다.** 이메일 로그인은 `cross()` 를 거쳐 플래그를 세우므로 멀쩡했고,
그래서 "카카오만 안 되는" 것처럼 보였다.

`experience/page.tsx` `social()` 이 나가기 전에 플래그를 세우도록 고쳤다(실패하면 되돌린다).

> 외부로 나갔다 돌아오는 로그인은 **떠나기 전에** 돌아올 자리를 준비해야 한다.
> `sessionStorage` 는 같은 탭이면 왕복을 견딘다 — 그래서 이 방식이 성립한다.

### 12.6 이어서 할 것

1. **`backend/.env` 의 `DATABASE_URL`** — 로컬 파일은 지금 `localhost:5432/comein`(플레이스홀더)라
   `/health/db` 는 여전히 실패한다. 배포(Render) 쪽 값도 함께 봐야 한다.
2. Supabase → Redirect URLs 는 확인 완료 — `localhost:3000` 하위 경로와 배포 주소 모두 통과,
   미등록 주소는 Site URL 로 떨어진다.
3. 완료 — `/api/chat` 역질문 + `context` 채우기는 **14절**로. (모바일 웹 점검은 **13절**로.)

---

## 13. 모바일 웹 점검 — 430px 에서 실제로 그려 보기 (2026-08-11 ~ 08-12)

폰 폭에서 **실제로 그려 보기 전에는 드러나지 않는 것들**이 있었다. 세 바퀴를 돌았다.
확인 방법은 창을 줄이는 것 — 창이 최대화라 줄지 않으면 같은 오리진 `<iframe>` 을 430px 로 띄운다
(미디어 쿼리는 iframe 뷰포트를 따르므로 그대로 재현된다).

매 바퀴 두 가지를 기계로 훑었다: **가로로 넘친 요소**(`getBoundingClientRect().right > clientWidth`)와
**손끝보다 작은 조작 요소**. 눈으로만 보면 잘린 자리는 그냥 '없는 것' 처럼 보인다.

### 13.1 세 바퀴에서 나온 것

| 바퀴 | 자리 | 무엇이었나 |
|---|---|---|
| 1 (`5f0456d`) | 오늘의 맥락 · 달력 머리 · 사람 | 6.5em 격자에서 값이 한두 글자씩 끊김 / 낱말 안에서 줄바꿈 / 상세에서 목록으로 **돌아갈 길 없음** |
| 1 (`cbc32e5`) | 설정 | 좁은 폭에서 **통째로 사라짐** — 같은 판단이 두 군데에 다르게 적혀 있었다 |
| 2 (`28fa631`) | 사람 요약 · 일정 방 | 화면 높이에 묶인 틀이 쌓인 배치에 그대로 걸려 대화 칸이 17px 까지 짓눌림 |
| 2 (`efd46fd`) | 캘린더 | 일정을 여는 **유일한 길이 마우스에만** 열려 있었다(`li` + onClick) |
| 3 (`cd10bc6`) | 캡처 바 | 새 자리 만들기 폼 위에서 물러나지 않아 **'만들기' 를 덮고 클릭을 가로챔** |
| 3 (`d7e15fb`) | 사람 | 목록이 380px 를 고집해 오른쪽 61px 이 잘림 — **'새 그룹' 이 화면 밖** |
| 3 (`abb80b1`) | 캡처 바 · 캘린더 · 일정 방 | 키보드 없는 기기에 `⌘K` / 시간 슬롯 15px |

### 13.2 두 번 나온 뿌리 — 같은 판단이 두 군데에 적혀 있다

`cd10bc6` 과 `d7e15fb` 은 증상이 다르지만 뿌리가 같다. 한 화면의 상태를 **두 곳이 각자 판단**한다.

- 캡처 바: 캔버스는 폼이 열린 것을 알아 `data-picked` 로 자리를 내줬는데, 캡처 바(`tuck`)는 몰랐다.
- 사람 목록: 설정을 고치며 위쪽 규칙에 `:not([data-settings])` 을 달자 **명시도가 한 단계 올라갔고**,
  미디어 쿼리는 명시도를 얹어 주지 않으므로 좁은-폭 규칙이 그대로 밀려났다.

> **한 곳을 고친 손이 다른 곳을 조용히 되돌린다.** 특히 CSS 에서는 `:not()` 하나가 저울추다 —
> 좁은-폭 규칙과 기본 규칙의 무게는 항상 같이 봐야 한다.

### 13.3 키캡은 기기가 정하는 말이다

`⌘K` 가 세 자리에 문자열로 박혀 있었다. 손잡이는 처음부터 `metaKey || ctrlKey` 둘 다 받았는데 그림만 한쪽이었다.

- **맥이 아닌 기기** → `Ctrl K`. 서버는 어느 기기인지 모르므로 첫 그림은 `⌘` 로 두고 붙은 뒤에 고친다(hydration).
- **물리 키보드가 없는 기기** → 글자를 바꿀 일이 아니라 감출 일이다. `(hover: none) and (pointer: coarse)` 로 CSS 가 맡는다.
- 단, **접힌 캡처 바**는 감추면 빈 알약이 된다(접히면 문 표식을 걸지 않으므로 남는 글자가 키캡뿐이다).
  그 자리에만 `입력` 이라는 낱말이 대신 선다.
- 빈 날의 안내문은 키가 아니라 **자리**로 가리킨다 — 캡처 바는 펼쳐졌든 접혔든 늘 아래에 있다.

### 13.4 손끝의 크기

상대의 시간을 고르는 슬롯이 **15px** 이었다. 커서 끝으로는 정확하지만 손끝(~40px)으로는 옆 칸이 눌린다.
**30분을 고르려다 30분 뒤가 잡히면 그건 못 고르는 것과 같다.** 손가락 기기에서만 28px 로 연다
(그 칸은 이미 스크롤하므로 하루가 길어지는 것은 문제가 아니다). 날을 넘기는 화살표도 22 → 36px.

### 13.5 레일 — 유일한 길이라 먼저 손댔다

레일 버튼은 39×40 이었다. 레일은 이 화면에서 **다른 데로 가는 유일한 길**이라, 여기서 빗나가면
되돌릴 방법이 없다. 45×44 로 연다(`898afe2`). 높이만 키우면 44×39 짜리 납작한 과녁이 되므로 둘을 같이 움직인다.

- **높이는 JS 가 정한다** — 행 높이(`--nav-row`)와 인디케이터의 이동 거리가 같은 숫자에서 나와야
  표식이 칸과 어긋나지 않는다. `NAV_STEP` 상수를 걷고 기기를 물어본 값에서 둘을 함께 파생시켰다(44 + 4 = 48).
- **폭은 CSS 가 맞춘다** — 레일 자체는 넓히지 않는다(넓히면 캔버스가 좁아지고, 그건 손가락 기기에서
  가장 아까운 것이다). 패딩을 3px 씩 안으로 옮긴다: 패널 12 → 9, 버튼 10 → 13.
  **두 값이 서로를 지우므로** 아이콘과 글자는 제자리에 그대로 있고 닿는 자리만 자란다.

> 손끝을 위해 자리를 늘릴 때, 늘릴 곳은 **여백이 아니라 패딩의 배분**이다. 화면은 그대로 두고 과녁만 키운다.

### 13.6 남은 것

1. 실기기 확인 미실시 — 여기까지는 전부 데스크톱 브라우저의 좁은 폭이다. `(pointer: coarse)` 갈래는
   코드에서 손가락 기기로 고정해 재고 되돌리는 방식으로 확인했다(계측값은 커밋 메시지에 남겼다).
   **손으로 만져 본 적은 아직 없다.**
2. 계측 시 주의 — 백그라운드 탭에서는 트랜지션이 진행되지 않아 인디케이터가 시작 위치에 묶여 보인다.
   위치를 잴 때는 `transition` 을 끄고 잰다. **레이아웃 문제로 착각하기 쉽다.**
3. 개발 서버를 다시 띄울 때 이전 프로세스가 포트를 계속 잡고 있으면(셸만 죽고 node 는 남는다)
   새 서버는 조용히 3001 로 물러나고, 3000 에는 **수화되지 않는 반쯤 죽은 화면**이 남는다.
   클릭이 전부 먹통이면 코드를 의심하기 전에 포트를 먼저 본다.

---

## 14. 되묻기와 맥락 — 모르면 지어내지 않는다 (2026-08-12)

`§5` 에 "미착수" 로 적혀 있던 두 가지(`/api/chat` 역질문, `context` 채우기)를 한 묶음으로 했다.
둘은 사실 하나다 — **묻기만 하고 답을 받을 자리가 없으면 되묻기는 막다른 길이기 때문이다.**

### 14.1 무엇이 문제였나

"회의 잡아줘" 에는 시각이 없다. 그런데 `schedule`·`meeting` 은 `start` 가 필수라 AI 는 둘 중 하나를 했다:

1. **시각을 지어낸다** — 아무도 그 시각에 만나지 않는다. 틀린 줄도 모르고 캘린더에 앉는다.
2. **필수 필드를 비운 채 내보낸다** — `ParsedItem` 검증에서 떨어지고, 화면에는
   *"정확히 파악하지 못했어요. 다시 말씀해주시겠어요?"* 가 뜬다.

두 번째 말은 **무엇을** 고쳐 말해야 하는지 알려 주지 않는다. 그래서 사람들은 같은 말을 다시 한다.

### 14.2 계약에 붙은 것

| 자리 | 필드 | 뜻 |
|---|---|---|
| 요청 `ChatRequest` | `context.now` / `context.tz` | 사용자가 **실제로 서 있는** 시각과 시간대 |
| 요청 `ChatRequest` | `context.pending` | `{message, ask}` — 직전 질문과 그때의 원래 말 |
| 응답 `AiResult` | `ask` | 되물음 한 줄. **`items` 가 비었는데 이게 있으면 실패가 아니라 답을 기다리는 상태다.** |

프롬프트의 규칙은 셋뿐이다: 시각을 정할 수 없으면 항목을 빼고 `ask` 만 담는다 ·
뽑았으면 묻지 않는다 · **할 일과 메모는 시각이 없어도 온전하므로 묻지 않는다**(과하게 묻는 순간 캡처 바는 폼이 된다).

### 14.3 화면 쪽 — 되물었으면 아무것도 세우지 않는다

화면에는 "AI 가 못 알아들으면 지역 규칙으로라도 정리한다" 는 폴백이 있었다(§8.2).
그대로 두면 **방금 묻지 않기로 한 것을 그 자리에서 지어내는 셈**이 된다.
되물음이 오면 아무것도 세우지 않고, 스침도 띄우지 않고, 한 줄만 남긴 채 기다린다.
닫으면 질문도 잊는다 — 남겨 두면 한참 뒤의 엉뚱한 한 줄이 이 질문의 답으로 붙는다.

### 14.4 '지금' 을 보내다 9시간을 잃었다

`toISOString()` 은 언제나 UTC(`…Z`)로 적는다. 같은 순간을 가리키지만 **벽시계가 사라진다.**
그 값을 "지금" 이라고 건네자 "내일 3시" 가 UTC 3시로 잡혔다 — `2026-08-13T15:00:00+00:00`,
서울에서는 다음 날 자정이다. **화면에서는 일정이 그냥 없는 것처럼 보였다**(하루 뒤에 가 있었으니까).

`localIsoNow()` — 날짜·시각은 로컬로 적고 오프셋을 뒤에 붙인다.
시간대 **이름**(`Asia/Seoul`)만 보내는 것으로는 부족하다: 받는 쪽이 그 이름을 풀 수 있어야 하고,
서버 OS 에 따라 그러지 못한다(Windows 에는 tzdata 가 없다). **오프셋은 어디서나 읽힌다.**

서버도 받은 값을 믿기 전에 파싱해 본다 — 오프셋이 없거나 모양이 어긋나면 버리고 서버 시계(KST)로 물러난다.
어긋난 '지금' 이 프롬프트에 실리면 '내일' 이 통째로 밀리는데, **화면에서는 그게 AI 가 틀린 것처럼 보인다.**

### 14.5 실제 확인

실제 모델(Gemini)로, 로컬 백엔드에 붙여서:

| 말 | 결과 |
|---|---|
| "회의 잡아줘" | items 0, `ask` "회의 날짜와 시간을 언제로 할까요?" |
| "내일 3시" (`pending` 동봉) | meeting `2026-08-13T15:00:00+09:00` |
| "내일 3시에 교수님 미팅" | 한 번에 meeting, `ask` 없음 |
| "발표 자료 준비하기" | todo, `ask` 없음 |
| 같은 말을 LA 시간대로 | `2026-08-13T15:00:00-07:00` — 각자의 자리에서 3시 |

브라우저에서 캡처 바로도 끝까지: "회의 잡아줘" → 되묻기 한 줄만 서고 캘린더에는 아무것도 생기지 않음
→ "내일 3시" → **8월 13일 15:00 '회의' 가 캘린더에 앉음.**

### 14.6 남은 것

1. `context` 는 지금 시각·시간대·직전 질문만 나른다. `§5` 가 적어 둔 **최근 대화 이력**은 아직 안 실었다 —
   되묻기 한 번을 잇는 데는 `pending` 으로 충분했고, 그 이상은 무엇이 실제로 필요한지 보고 정하는 게 맞다.
2. 되물음은 **캡처 바에만** 붙었다. 일정 방의 대화(`sendEventMessageAndMaybePropose`)는 여전히
   시각이 없으면 조용히 아무 일도 하지 않는다 — 거기서도 물어야 하는지는 아직 판단하지 않았다.
3. `ask` 는 저장되지 않는다. 새로고침하면 기다리던 질문이 사라진다(그때는 원래 말을 다시 해야 한다).

---

## 15. 제출 전 전수 점검 — 그리고 급한 줄 알았던 것 (2026-08-13)

### 15.1 배포는 손댈 것이 없었다

`docs/16_TASK.md` 에 "Render/Vercel 의 `DATABASE_URL` 을 갈아끼워야 한다" 고 적혀 있었다.
그것부터 하려다 확인해 보니 **할 일이 없었다.**

| | 확인한 것 |
|---|---|
| Vercel | 배포된 번들을 뜯어 보니 이미 새 Supabase 가 구워져 있었다 — URL 과 anon key 의 `ref` 둘 다 `mbamzjivpdzjnvzcbamp` |
| Render | `DATABASE_URL` 은 옛 서울 DB 를 본다. `/health/db` 가 `{"status":"ok","db":"down"}` 이다 |

**그런데도 앱은 멀쩡하다.** 그 이유가 이 절의 핵심이다.

프론트가 백엔드에 부르는 것은 `/api/chat` 과 `/api/summary` 둘뿐이고(`frontend/src/lib/api.ts`),
이 둘은 DB 를 건드리지 않는 순수 파싱이다. DB 를 쓰는 `items`·`users`·`schedules`·`todos`·
`memos`·`meetings` 는 저장이 Supabase 직행으로 옮겨간 뒤(§8.4·§10.4) **아무도 부르지 않는다.**

그래서 `db: down` 은 고장이 아니라 **죽은 경로의 표시등**이다. `§12` 의 남은 일 1번
("`backend/.env` 의 `DATABASE_URL` 이 플레이스홀더라 `/health/db` 가 실패한다")도 이제 낡았다 —
로컬 `.env` 는 새 Supabase 세션 풀러로 맞춰져 있고, 붙는 것을 직접 확인했다.

**남은 것은 값 교체가 아니라 갈림길이다:** 그 라우터 6개와 alembic 5테이블을 걷어낼 것인가,
새 DB 로 살릴 것인가. 살린다면 새 Supabase 에는 `alembic_version` 조차 없으므로
(public 에는 프론트 스키마 14개 테이블뿐) `alembic upgrade head` 를 한 번 돌려야 한다.

> **낡은 문서는 없는 일을 만든다.** 오늘 반나절이 그렇게 쓰였다. 저장 경로가 바뀔 때
> 그 사실이 §8.4 에는 적혔지만 `16_TASK.md` 의 배포 항목까지는 따라가지 못했다.

### 15.2 일정 방의 참여자 — 접힌 줄을 걷었다

참여자가 접힌 한 줄 뒤에 있어서, 누가 왔는지 보려면 한 번 더 눌러야 했고 누르면 목록이
대화를 밀어냈다. 이니셜을 늘 보이게 눕히고, 초대·제외는 눌렀을 때만 연다.

- **겹치지 않는다.** 얼굴 더미(face pile)처럼 원을 겹쳐 봤더니 뭉개진 얼룩이었다. 겹친 원을
  갈라 주는 건 1px 테두리뿐인데 이 팔레트는 `--hair` 가 `--surface` 와 거의 같다
  (다크 `#262019`:`#1B1813`). 대비로 구획하는 관용구라 이 언어(§6 여백으로 구획)와 어긋난다.
- **초대도 주최자만.** `0001` 의 `participants_insert` 가 `is_event_owner(event_id) or
  user_id = auth.uid()` 다. 예전엔 `추가` 를 모두에게 보여 눌러도 조용히 거절당했다.

### 15.3 셋업 — clone 만으로는 뜨지 않는다

다른 PC 에서 받았을 때 안 되는 것이 있었다. 빠뜨린 커밋은 없었다(추적 149개 전부 커밋됨).
없는 것은 일부러 뺀 것들인데, **그 사실이 어디에도 적혀 있지 않았다.**

가장 위험한 자리는 README 의 `copy .env.example .env.local` 한 줄이었다 — Supabase 두 줄
얘기가 없다. 그게 비면 앱은 **에러 없이** 저장도 로그인도 없는 로컬 전용으로 돈다.
화면이 멀쩡해 보여서 원인을 찾기 가장 어려운 실패다.

`.gitignore` 는 꼬리가 깨져 있었다 — UTF-8 파일에 UTF-16 바이트가 덧붙어(`* \0 . \0 d \0 b \0`)
`*.db` 규칙이 실제로는 작동하지 않았다. PowerShell 의 `>>`·`Out-File` 흔적이다.

### 15.4 제출 전 전수 확인

> **이 표는 §16~19 이전의 것이다 (2026-08-13 오전).** 그 뒤로 백엔드 라우터 6개와 Tailwind
> 설정·폰트가 걷혔고, a11y·모바일 수정이 더 들어갔다. **지금 코드의 실측은 §20 이다.**
> (낡은 표가 없는 일을 만든다는 것이 바로 §15.1 의 교훈이라, 지우지 않고 날짜를 박아 둔다.)

| | 결과 |
|---|---|
| `next build` (프로덕션) | ✅ 린트·타입 검증 포함 통과, 5개 라우트 전부 정적 |
| 프론트 테스트 | ✅ 29 passed |
| 백엔드 테스트 | ✅ 27 passed |
| 배포 프론트 `/` · `/workspace` | ✅ 200 |
| 배포 백엔드 `/health` | ✅ `{"status":"ok","env":"production"}` |
| 배포본에 이번 변경 반영 | ✅ 번들에서 `rmg-evwho` 확인 |
| 배포 `/api/chat` | ✅ "meeting with the professor tomorrow 3pm" → meeting `2026-08-14T15:00:00+09:00`, participants `["professor"]` |
| 배포 `/api/chat` 되묻기(§14) | ✅ "lets meet sometime" → items 0, `ask` "When would you like to meet?" |
| 배포 `/api/summary` | ✅ `decided` / `next` 로 갈라 돌아옴 |

`/health/db` 만 `down` 이고, 그 이유는 15.1 에 적었다 — 지금 앱이 쓰는 경로가 아니다.

---

## 16. 죽은 경로를 걷어냈다 (2026-08-13)

`§15.1` 이 남겨 둔 갈림길 — "백엔드의 DB 라우터들을 걷어낼 것인가, 새 DB 로 살릴 것인가" —
에서 **걷어내는 쪽**을 택했다.

### 16.1 왜 살리지 않았나

살리는 쪽은 값 하나(`DATABASE_URL`)와 `alembic upgrade head` 한 번이면 끝나서 더 싸 보인다.
그런데 그렇게 하면 **아무도 부르지 않는 API 6개와 테이블 5개를 계속 유지하게 된다.**
저장은 이미 Supabase 직행이고(§8.4·§10.4) 되돌릴 계획도 없다.

그리고 이 코드는 가만히 있지 않았다. `16_TASK.md` 에 "배포 환경변수를 갈아끼워야 한다" 는
급한 일로 서 있었고(§15.1), `/health/db` 는 멀쩡한 서비스에 `down` 을 띄우고 있었다.
**쓰이지 않는 코드는 조용히 있지 않는다 — 사실이 아닌 그림을 계속 그린다.**

### 16.2 무엇을 지웠나

| | |
|---|---|
| 엔드포인트 | `items` · `users` · `schedules` · `todos` · `memos` · `meetings` |
| 그 아래 | `app/models/*`(ORM 5종) · `app/services/items_service.py` · `app/core/database.py` · `alembic/*` · `alembic.ini` |
| 스키마 | `schemas/{schedules,todos,memos,meetings,users}.py`, 그리고 `items.py` 의 저장 계약 3종 |
| 표시등 | `/health/db` — 지킬 것이 없어졌고, 옛 DB 를 가리켜 `down` 을 띄워 고장으로 읽혔다 |
| 설정 | `DATABASE_URL` · `REDIS_URL` 과 asyncpg URL 보정 코드(`_normalize_db_url`) |
| 의존성 | `sqlalchemy` · `asyncpg` · `alembic` · `redis` · `aiosqlite`, 그리고 쓰인 적 없는 `python-jose` · `passlib` |
| 테스트 | `test_{items,schedules,todos,memos,meetings}.py` 와 `conftest.py` 의 SQLite 픽스처 |

**남긴 것:** `schemas/items.py` 의 `ParsedItem`. 저장 계약이 아니라 **AI 가 무엇을 뽑았는지
재는 자**라서, `/api/chat` 과 `ai/router.py` 가 지금도 쓴다.

### 16.3 남은 백엔드

```
POST /api/chat      자연어 → 항목 (또는 되묻기, §14)
POST /api/summary   대화 → 네 갈래 요약
GET  /health        Render 헬스체크
```

**상태가 없다.** DB 세션도, 커넥션 풀도, 기동 시 워밍업(`lifespan`)도 없다.
그래서 백엔드가 자고 있어도 일정·대화는 그려진다 — 그건 Supabase 가 그리기 때문이다.
느려지는 것은 캡처 바의 파싱뿐이다.

경계가 선명해진 자리가 하나 더 있다: **백엔드에 DB 비밀번호가 없다.** 브라우저에 둘 수 없는
것(LLM 키)만 서버에 남고, 사용자별 권한으로 지킬 수 있는 것(데이터)은 Supabase 의 RLS 가 맡는다.

### 16.4 확인

로컬 `.venv` 에는 지운 패키지가 아직 남아 있어 여기서만 통과할 수 있다. 그래서 **빈 venv 에
새 `requirements.txt` 만 설치해** Render 가 하는 일을 그대로 재현했다.

| | 결과 |
|---|---|
| 깨끗한 venv 설치 → 앱 로드 | ✅ 38개 패키지(전 58개), `ai.router` import 까지 정상 |
| OpenAPI 경로 | ✅ `/api/chat` · `/api/summary` · `/health` — 셋뿐 |
| `/health/db` · `/api/items` | ✅ 404 (사라진 것 확인) |
| `/api/chat` 실호출 | ✅ "meeting with the professor tomorrow 3pm" → meeting `2026-08-14T15:00:00+09:00`, participants `["professor"]` |
| pytest | ✅ 15 passed (27 → 15, 지운 경로의 12개가 함께 사라짐) |

### 16.5 남은 것

- **Render 대시보드의 옛 `DATABASE_URL` · `REDIS_URL`** — 코드가 읽지 않으므로 무해하다.
  지우는 것은 사람 손이 필요한 일이라 남겨 둔다.
- **`google-genai` 의존성** — `ai/llm/gemini.py` 는 REST(`httpx`)로 직접 부르고 이 SDK 를
  import 하지 않는다. 지울 수 있어 보이지만 **살아 있는 AI 경로**를 건드리는 일이라
  이번에 함께 손대지 않았다. 확인하고 지우면 빌드가 더 가벼워진다.
- **`JWT_SECRET` 등 인증 설정** — 아직 아무도 읽지 않는다. 인증은 Supabase Auth 가
  프론트에서 맡고 있다. 백엔드 인증을 언젠가 붙일 것인지 정하면 함께 정리된다.

---

## 17. 방향이 바뀐 자리에 남은 것들 (2026-08-13)

`§16` 이 죽은 **경로**를 걷었다면, 여기는 죽은 **잔재**다. 전체 디렉터리를 기계적으로
훑어 "정의는 있는데 아무도 읽지 않는 것" 만 골라냈다.

### 17.1 화면에 한 글자도 그리지 않던 폰트

`layout.tsx` 가 세리프 **Fraunces** 를 `--font-display` 로 싣고 있었다. `style: ["normal",
"italic"]` 이라 두 벌이다. 그런데 그 변수를 읽는 곳이 **한 군데도 없다.** 화면에 한 글자도
그리지 않는 폰트를 매번 내려받고 있었다. 디자인 언어도 세리프를 쓰지 않는다(CLAUDE.md §6).

### 17.2 shadcn 시절의 설정과 글래스 시절의 유틸리티

`tailwind.config.ts` 에는 radix accordion 키프레임(**radix 는 설치조차 되어 있지 않다**),
`card`·`popover`·`sidebar` 색, `shadow-soft`/`glow`, `kenburns`/`sheen` 애니메이션이 남아
있었다. `globals.css` 에는 `.glass` · `.glass-panel` · `.elevated` · `.orb-3d` · `.bg-app` ·
`.grain-overlay` · `.brand-gradient` 가 있었다.

**전부 사용처 0이다.** 코드에서 실제로 쓰는 Tailwind 유틸리티는 `font-sans` 하나와
`globals.css` 의 `@apply` 세 줄뿐이다 — 화면의 시각 언어는 각 페이지가 컴포넌트 로컬
`<style>` 과 자체 토큰(`--paper`·`--ink`·`--hair`)으로 갖기 때문이다(§6).

쓰이지 않는 것보다 나쁜 건, 그것이 **다음에 여는 사람에게 거짓을 말한다**는 점이다.
이 설정 파일은 "이 프로젝트는 shadcn 을 쓴다" 고 말하고 있었다. §6 은 정반대를 말한다.

### 17.3 그 밖에

- `mode.ts` 의 `isUserMode` · `useModeConfig` · `availableModes` — 정의만 있고 호출 0.
- `mode.ts` 의 `classifyPerson` · `relationLabel` — 사람 분류 규칙. 만들어 두고 화면에
  붙인 적이 없다. `Contact.relation` 도 읽는 곳이 없다.
  → **`MODE_CONFIG.peopleCategories` 데이터와 `PersonRelation` 타입은 남겼다.**
  타입은 `Contact` 가 여전히 쓰고, 분류표는 코드가 아니라 **제품 설계**라서 —
  지우면 나중에 사람 화면을 붙일 때 이름 체계를 다시 정해야 한다.
- `availability.ts` 의 `describeConflicts` — `export *` 로 재수출만 되고 호출 0.
- `backend/requirements.txt` 의 `google-genai` — `ai/llm/gemini.py` 는 SDK 없이 `httpx` 로
  REST 를 직접 부른다. 한 번도 import 되지 않은 채 빌드를 무겁게 하고 있었다.

### 17.4 실제로 줄어든 것

빌드 산출물을 정리 전/후로 각각 클린 빌드해 쟀다(추정이 아니라 실측).

| | 전 | 후 | |
|---|---|---|---|
| CSS | 13,798 B | 10,017 B | **−27%** |
| 폰트 파일 | 13개 · 399,764 B | 7개 · 218,888 B | **−45%** |
| 백엔드 패키지 | 27개 | 27개 | (§16 의 58→38 에 이어 38→27) |

첫 방문자가 받는 것이 **약 185KB** 줄었다. JS 번들은 그대로다 — 죽은 export 는 이미
트리셰이킹으로 빠지고 있었기 때문이다. 실제로 실리던 것은 **CSS 와 폰트**였다.

### 17.5 확인

프론트 tsc 통과 · 29 passed · 프로덕션 빌드 통과.
백엔드는 빈 venv 에 새 `requirements.txt` 만 설치해 **Gemini 실호출까지** 확인했다 —
SDK 없이 REST 로 도는 것이 맞았다(`/api/chat` participants·KST 정상, `/api/summary` 정상).

### 17.6 남긴 것

- **`ai/` 의 빈 자리표** — `ai/memory/README.md` · `ai/prompts/README.md` 는 아직 코드가
  없는 디렉터리다. 죽은 코드가 아니라 **아직 안 쓴 코드**라 그대로 둔다.
- **`JWT_SECRET` 등 인증 설정** — §16.5 와 같다. 인증은 Supabase Auth 가 프론트에서 맡는다.

---

## 18. 사용자 눈으로 다시 보기 — 읽히지 않던 글자들 (2026-08-13)

브라우저에서 실제로 띄워 놓고, 눈대중이 아니라 **대비율을 계산해** 훑었다
(WCAG AA: 본문 4.5:1, 큰 글자 3:1).

### 18.1 `--faint` 는 '조용한' 을 넘어 '안 읽히는' 이었다

라이트에서 `--faint`(#A9A294)는 종이(#F7F6F3) 위에서 **2.35:1** 이다. 기준의 절반이다.
문제는 이 토큰이 장식이 아니라 **뜻을 지닌 글자**에 쓰이고 있었다는 것이다.

| 자리 | 무엇을 못 읽었나 |
|---|---|
| 요일 머리글 `일 월 화…` | 달력을 읽는 기준선 |
| 레일 라벨 `오늘·캘린더·사람·설정` | **앱을 돌아다니는 주 수단** — 호버해야 겨우 보였다 |
| 숫자 밑 `일정` · `할 일` | 그 숫자가 무엇의 수인지 말하는 한 마디 |
| `다가오는 순간` · `오늘의 맥락` | 줄의 이름표 |
| `새 그룹` · `복사` · `개인 채팅1` | 누르는 손잡이 |
| `사람을 선택해 대화를 시작하세요.` | 빈 화면의 **유일한** 안내문 |
| `100%` (글자 크기) | 지금 값 |

전부 `--muted` 로 한 단계 올렸다. **토큰 자체는 건드리지 않았다** — `--faint` 를 AA 까지
끌어올리면 `--muted`(5.16:1)와 거의 같은 값이 되어 3단 위계가 무너진다. 그래서 토큰이 아니라
**쓰임**을 고쳤다: `--faint` 는 장식용으로 두고, 읽어야 하는 글자는 `--muted` 로 옮긴다.

다크에서는 달 넘김 화살표(`‹ ›`)가 3.34:1 이었다. `--muted` 였는데도 그렇다 — 그 패널이
`--paper` 보다 밝아 대비가 깎인다. 글리프 하나뿐이라 놓치면 길이 막히므로 `--ink` 로 두고,
손이 닿았다는 신호는 배경으로 준다.

### 18.2 랜딩의 '바로 입장' — 링크인 줄 몰랐다

재방문자가 인트로를 건너뛰는 **유일한 길**인데 2.27:1 이었고 밑줄도 없어 그냥 글자로 보였다.
`--muted` + 옅은 밑줄로 고쳤다(4.72:1).

### 18.3 `/enter` 를 걷었다

`/experience` 는 소셜·이메일 로그인·회원가입을 다 갖고 있고, `/enter` 는 소셜만 있으면서
"이메일로 계속하기" 를 누르면 `/experience` 로 되돌려보냈다. **부분집합이면서 한 번 더
거치게 하는 길**이다. 게다가 그 화면의 `약관`·`개인정보처리방침` 은 밑줄과 `cursor: pointer`
까지 달고 있었지만 `href` 도 `onClick` 도 없었다 — **누르라고 해 놓고 아무 일도 일어나지 않는다.**
동의를 요구하면서 정작 읽을 수 없는 자리였다.

빠른 로그인은 라우트가 아니라 **상태**로 남긴다: `/experience?auth=1`(이미 있던 길)이
8.2초 인트로를 건너뛴다. Landing 의 "바로 입장", 워크스페이스의 '나가기', 로그아웃 상태의
`/workspace` 접근이 모두 이 하나를 쓴다.

### 18.4 확인

4개 뷰(오늘·캘린더·사람·설정) × 2 테마(라이트·다크) = **8가지 조합 전부 통과**.
랜딩도 통과. 남는 한 건(`13`)은 자동 검사의 한계다 — 선택된 날짜의 검은 칩이 `::after`
배경이라 스크립트가 못 본다(흰 글자/검은 칩이므로 실제로는 최고 대비).

> **왜 자동 검사만 믿지 않았나.** 처음 돌린 결과에는 "Ctrl K 1.01:1" 같은 것이 섞여 있었다.
> 툴팁처럼 안 보이는 요소와 의사요소 배경 때문이다. 가시성 판정을 엄격히 하고(`checkVisibility`),
> 의심스러운 건 하나씩 DOM 으로 확인한 뒤에야 고쳤다. **고칠 목록보다 고치지 않을 목록을
> 가려내는 데 시간이 더 들었다.**

---

## 19. 모바일 폭 — 그리고 시뮬레이션이 거짓말한 자리 (2026-08-13)

창 리사이즈가 페이지 뷰포트에 먹히지 않아(최대화된 창), **같은 오리진 iframe 을 390×844 ·
360×780 으로 세워** 그 안에서 쟀다. 미디어쿼리·컨테이너쿼리는 iframe 뷰포트를 따르므로
레이아웃은 그대로 재현된다.

### 19.1 iframe 이 재현하지 못하는 것

첫 측정에서 "레일 버튼 39×40 — 손끝(44)에 미달" 이 나왔다. **틀린 결과였다.**

손끝 크기 규칙은 `@media (hover: none) and (pointer: coarse)` 안에 있고, 행 높이는
`useCoarsePointer()` 훅이 `NAV_ROW(40) → NAV_ROW_TOUCH(44)` 로 올린다. 그런데 **pointer 는
기기 속성이라 뷰포트를 좁혀도 바뀌지 않는다** — 마우스가 달린 데스크톱의 iframe 에서는
영원히 `fine` 이다. 같은 이유로 `Ctrl K` 키캡도 감춰지지 않아 안내문이 잘려 보였다.

그래서 그 블록을 iframe 안에 **직접 주입해** 실제 폰 상태를 재현한 뒤 다시 쟀다.
결과: 레일 **45×44** — 어제 커밋(`레일 버튼을 손끝 크기로`)이 의도한 값 그대로. 정상이었다.

> 좁은 화면 = 터치 기기가 아니다. 폭만 줄여 놓고 "모바일을 봤다" 고 하면,
> 고쳐져 있는 것을 고장 났다고 적고 진짜 고장은 놓친다.

### 19.2 진짜로 나온 것 — 캡처 바의 죽은 띠

캡처 바(`form.rmg-ask`)는 62px 인데 안쪽 `<input>` 은 **32px** 이다. 위아래 14px 은
form 의 padding 이라 **눌러도 아무 일도 일어나지 않았다** — `document.activeElement` 가
BODY 에 머물렀다. 커서로는 가운데를 정확히 겨누지만, 손끝에게 그 띠는 넓다.

접힌 알약(`tuck`)에는 이미 `onClick` 으로 여는 길이 있었다. **펼쳐진 상태에는 없었다** —
그런데 그쪽이 더 자주 눌린다. 그리고 이 바는 제품의 주 입력구다(§모든 기능의 입구).

`onPointerDown` 으로 바 어디를 눌러도 열리게 했다(보내기 버튼·입력 자신은 비켜선다).
padding 을 input 으로 옮기는 방법도 있었지만, 그러면 접힌 알약의 높이가 남은 자식에
끌려 함께 무너진다 — 손이 닿은 곳만 옮겨 주는 편이 안전하다.

**확인:** 위쪽 띠 · 가운데 · 아래쪽 띠 세 지점 모두 `열림`.

### 19.3 보내기 버튼 32×32

알약 안에서 이것만 44 로 키우면 바 높이가 함께 자라 균형이 깨진다.
보이는 크기는 그대로 두고 `::after { inset: -6px }` 로 **닿는 과녁만** 44×44 로 넓혔다.
임시로 배경을 입혀 눈으로 확인했다(32px 버튼을 감싼 44px 사각형).

> `elementFromPoint` 로 검증하려 했을 때는 실패로 나왔다 — 그 API 는 의사요소를
> 보고하지 않고 원본 요소의 경계 상자만 본다. **검증 도구의 한계를 결과로 착각할 뻔했다.**

### 19.4 결과

| | 390×844 | 360×780 |
|---|---|---|
| 가로 스크롤 | 없음 | 없음 |
| 넘치는 요소 | 없음 | 없음 |
| 잘린 텍스트 | 없음 | 없음 |
| 레일 버튼(터치 재현) | 45×44 | 45×44 |
| 캡처 바 탭 영역 | 62px 전체 | 62px 전체 |
| 보내기 과녁 | 44×44 | 44×44 |

---

## 20. 제출 전 재검증 — 그리고 잠깐만 뜨는 것들 (2026-08-14)

§15.4 의 전수 확인표는 **§16~19 이전**의 것이었다. 그 뒤로 백엔드 라우터 6개와 Tailwind
설정·폰트가 걷혔고 a11y·모바일 수정이 더 들어갔는데, **그 상태의 실측은 어디에도 없었다.**
숫자가 낡으면 문서는 없는 안전을 말한다. 다시 쟀다.

### 20.1 실측

> 아래 표는 **고치기 전** HEAD 기준이다. 이 절의 고침들은 그 뒤 `main` 에 올라가
> Render·Vercel 로 배포됐고, 반영도 확인했다(§20.8-0). 배포 후 수치는 §20.3-2.

| | 결과 |
|---|---|
| `next build` (프로덕션) | ✅ 통과 · 라우트 4개 전부 정적 (`/` · `/experience` · `/workspace` · `/_not-found`) |
| 프론트 테스트 | ✅ **29 passed** |
| 백엔드 테스트 | ✅ **15 passed** (§16 에서 죽은 경로 테스트 12개를 지운 뒤의 수) → 이 절의 작업으로 **24** |
| `tsc --noEmit` | ✅ 통과 |
| 배포 프론트 `/` · `/workspace` | ✅ 200 (0.4~0.5s) |
| 배포 백엔드 `/health` | ✅ 200 — 단 **콜드스타트 22.5초** |
| **배포본 = HEAD 인가** | ✅ 백엔드 openapi 경로가 `/api/chat`·`/api/summary`·`/health` 셋뿐이고 `/health/db` 는 404. 프론트 번들에 최신 커밋의 `rmg-ask` `onPointerDown` 포함 |
| 배포 번들의 Supabase 키 | ✅ `role: "anon"` · ref `mbamzjivpdzjnvzcbamp`. 번들에 보이는 `sb_secret_` 문자열은 supabase-js 라이브러리의 접두사 검사 코드다 |
| git 이력 키 유출 | ✅ 없음 — `sb_secret_` 는 이 문서의 서술로만 등장하고 실제 값이 커밋된 적은 없다 |
| 코드 내 TODO/FIXME/mock 잔재 | ✅ 0건 |
| 죽은 `/enter` 참조 | ✅ 0건 |

### 20.2 AI 파싱 — 배포본에 직접 넣어 봤다

`context.now = 2026-08-14T00:52:06+09:00`, `tz = Asia/Seoul`.

| 넣은 말 | 돌아온 것 |
|---|---|
| "내일 3시 교수님 미팅" | `meeting` · `start 2026-08-15T15:00:00+09:00` · `participants ["교수님"]` · title "미팅" — **KST 오프셋 유지, 이름은 제목에서 갈라짐** |
| "언제 한번 보자" | `items: []` · `ask: "언제로 일정을 잡을까요?"` — **지어내지 않았다** |
| "내일 3시 지원이랑 회의 잡고 발표자료도 준비해야 해" | `meeting` + `todo` **2건** |

응답 시간: 첫 요청 20.2초(콜드스타트 포함), 이후 1.8~3.3초.
**단, 5번 중 1번은 30초 뒤 오류로 끝났다** — 원인과 대응은 §20.3-2.

**한 가지 어긋남.** 세 번째 응답의 제목이 `"지원이랑 회의"` 였다 — 프롬프트는 이름을 제목에서
빼라고 말한다(첫 번째는 지켰다). 참여자 추출 자체는 맞았으므로 화면은 정상이지만, 프롬프트
준수가 100% 는 아니라는 기록으로 남긴다.

### 20.3 파싱 경로에서 고친 것

셋 다 **폴백이 주 경로를 죽이거나, 열려야 할 때 열리지 않던** 자리다.

1. **`GROQ_API_KEY` 가 없으면 Gemini 경로까지 죽었다.** `get_provider()` 가 두 Provider 를
   먼저 세워 두고 골랐는데, `AsyncGroq()` 는 키가 없으면 **생성자에서** 던진다(직접 확인:
   `GroqError`). Gemini 키가 멀쩡해도 모든 요청이 "일시적인 오류가 발생했어요" 로 끝난다.
   `if not self.api_key: pass` 는 방어처럼 보이는 죽은 코드였다.
   → Groq 을 **필요할 때만** 만들고, 없으면 `None` 을 돌려 Gemini 단독으로 간다.
   확인: `GROQ_API_KEY` 를 지우고 `get_provider()` → `gemini` (예전엔 예외).

2. **Gemini 타임아웃이 Groq 으로 넘어가지 않았다.** `FallbackProvider` 는 `LLMError` 만 잡는데
   `httpx.ReadTimeout`·`ConnectError` 는 그 타입이 아니다. **광고한 failover 가 가장 흔한
   실패에서 열리지 않았다** — 덮고 있던 것은 429·비200·파싱실패뿐이다.
   → `gemini.py` 의 두 호출을 `except httpx.HTTPError → LLMGenerationError` 로 감쌌다.

   **이건 이론이 아니었다.** 같은 프롬프트를 로컬에서 세 번 넣어 봤다:

   | | 결과 |
   |---|---|
   | 1회 | `ReadTimeout` — 고친 뒤라 `LLMGenerationError` 로 감싸여 **Groq 으로 넘어갔다** |
   | 2회 | Gemini 정상 (meeting + todo 2건) |
   | 3회 | `503 UNAVAILABLE — "This model is currently experiencing high demand"` → 폴백 |

   즉 **지금 `gemini-flash-latest` 는 흔들리고 있고, 데모를 실제로 떠받치는 것은 Groq 폴백이다.**
   그리고 그 폴백 경로가 여기서 처음으로 끝까지 실행됐다 — 스키마에 맞는 JSON 을 돌려줬다.

   **배포본은 아직 이 고침이 없다.** 같은 문장을 배포 백엔드에 다섯 번 넣었더니:

   | | |
   |---|---|
   | 1회 | 정상 (23.6초 — 콜드스타트) |
   | 2·3·4회 | 정상 (2.0~2.3초) |
   | **5회** | **`"일시적인 오류가 발생했어요."` — 30.5초** |

   30초는 `gemini.py` 의 타임아웃 값 그대로다. Groq 이 대신 받아 줬어야 할 자리인데
   열리지 않았다. **5번에 1번.** 심사 중에 걸리면 화면은 로컬 폴백으로 넘어가
   "AI 없이 정리했어요" 를 띄운다.

   **배포 후 다시 쟀다 — 8번 중 실패 0.**

   | | 응답 시간 |
   |---|---|
   | 1·2·6회 | **31.1s · 27.5s · 31.4s** — Gemini 가 30초에 걸린 뒤 **Groq 이 받아 성공** |
   | 3~5·7·8회 | 2.5~7.2s — Gemini 정상 |

   30초대 세 번은 고치기 전이었다면 그대로 오류였다. 폴백이 실제로 열려 받아 냈다.

3. **`raw.get("reply")` 는 늘 `None` 이었다.** `ParseResponse` 에 `reply` 필드가 없다.
   즉 사용자가 본 말은 언제나 `_default_reply()` 이거나 `ask` 였는데, 코드는 "AI 가 자연어로
   답한다" 고 읽혔다. 죽은 줄을 걷고 README 의 예시도 실제 동작대로 고쳤다.

4. **"3시" 를 새벽 세 시로 읽는 일이 있었다.** 배포 직후 여덟 번 확인하다 나왔다 —
   여덟 중 하나가 `2026-08-15T03:00`. 캘린더에 새벽 세 시짜리 교수님 미팅이 앉는다.
   프롬프트는 "내일 = +1일" 까지만 말했고 **맨 시각의 오전/오후는 한 마디도 없었다.**

   그리고 이건 2번과 이어져 있다. 폴백을 열어 준 뒤 Groq 이 받는 일이 잦아졌는데,
   맨 시각 해석은 Groq 이 Gemini 보다 흔들렸다. **고침이 가려져 있던 자리를 드러냈다.**

   → 맨 시각은 깨어 있는 쪽으로 읽는다. `00:00~05:59` 는 "새벽 3시"·"3am"·"오전 3시"
   처럼 말했을 때만 만든다. 확인(각 3회, 두 provider):

   | 넣은 말 | 나온 것 |
   |---|---|
   | 내일 3시 교수님 미팅 | 15:00 |
   | 내일 **새벽** 3시 배포 | 03:00 (말했으므로 그대로) |
   | 내일 9시 스탠드업 | 09:00 |
   | meeting tomorrow at 3 | 15:00 |

   Groq 12회 전부 일치. Gemini 도 응답한 회차는 전부 일치(나머지는 503·타임아웃 —
   그건 이 고침과 무관하고, 그래서 폴백이 필요한 것이다).

   **그런데 끝나지 않았다.** 배포하고 다시 재 봤더니 낮 기준으로는 4/4 정확했는데,
   `now` 를 새벽으로 준 어려운 쪽에서 **여섯 번에 한 번이 다시 03:00** 이었다.

   > 프롬프트는 부탁이지 보장이 아니다. 부탁한 것을 부탁으로 한 번 더 말해 봐야
   > 확률만 조금 움직인다.

   → 받는 쪽에서 확인한다(`_fix_small_hours`). `00:00~05:59` 로 온 시각은 사용자가
   그렇게 말하지 않았다면 +12h. "말했다" 는 새벽·오전·아침·밤·자정·0시·심야·`am`·
   `midnight`·`dawn`·`overnight` 로 본다(밤 3시도 한국어에서는 새벽 세 시다).
   화면이 `toParsed` 로 모르는 필드를 버리는 것과 같은 태도다.

   **끝 시각은 시작이 움직였을 때만, 같은 만큼 움직인다.** 따로 판단하면 밤을 넘기는
   일정(23:00~01:00)의 끝만 낮으로 튀어 앞뒤가 뒤집힌다.

   확인 — 로컬 `route()` 5회씩: "내일 3시"(now 00:52) → 15:00 × 5 ·
   "내일 새벽 3시" → 03:00 × 5. 테스트 9개를 붙였다(**15 → 24 passed**).
   **배포본 8/8 정확**, 명시적 "새벽 3시" 는 03:00 으로 보존.

덤으로 `"일정(으)로 정리했어요"` 의 괄호를 없앴다. 받침을 보고 고른다 — 일정**으로** ·
할 일**로** · 메모**로** · 회의**로**. 한 줄 넣을 때마다 뜨는, **가장 자주 보는 한 마디**에
괄호가 서 있으면 완성되지 않은 자리로 읽힌다.

**고치지 않은 것(알려진 한계):** 여러 건 중 하나가 규격을 어기면 전부 버린다(`chat.py` 의
리스트 컴프리헨션이 통째로 `try` 안) · 재시도 없음(폴백 1홉이 전부) · 프론트 `fetch` 에
`AbortController` 없음 · **Gemini 에 `responseSchema` 를 보내지 않는다**(중첩 `$ref` 미지원) —
목표 JSON 모양이 프롬프트 산문으로만 서 있어, 모델을 바꿀 때 가장 먼저 볼 자리다.

### 20.4 잠깐만 뜨는 것들 — 정적 대비 검사의 사각지대

§18 은 "4개 뷰 × 2 테마 = 8가지 조합 전부 통과" 로 끝났다. 그 말은 맞다. 다만 **그때 화면에
떠 있던 것만** 잰 것이다. 캡처 직후 6초만 뜨는 줄, 터치 기기에서만 그려지는 낱말, 로그인
화면 — 전부 스캔의 시야 밖이었다.

하필 그중 하나가 **AI 영수증의 '열기'·'확정'** 이다. "무엇이 어디로 갔는지" 를 말하는,
데모에서 카메라에 가장 오래 잡히는 한 줄. 그게 `--faint` 였다(라이트 **2.35:1**, 실측).

| 자리 | 무엇인가 |
|---|---|
| `.rmg-flash-act` | 영수증의 '열기'·'확정' — **누를 수 있는 글자** |
| `.rmg-working-t` | "정리하는 중" — AI 가 일하고 있다는 유일한 표시 |
| `.rmg-ask-tap` | "탭하여 입력" — **터치 기기에서만** 그려진다 |
| `.rmg-evback` | "‹ 돌아가기" — 되돌아가는 유일한 길 |
| `.opn-div span` | "or continue with" — **로그인 화면**. §18 은 이 페이지를 보지 않았다 |
| `.lnd-theme` | 랜딩 테마 아이콘 — 아이콘은 3:1 기준(WCAG 1.4.11)인데 2.4:1 이었다 |

전부 `--muted` 로 옮겼다. 실측: `--faint`/`--paper` **2.35:1** → `--muted`/`--paper` **5.17:1**.
§18 과 같은 방식이다 — **토큰이 아니라 쓰임**을 옮긴다(토큰을 올리면 3단 위계가 무너진다).

### 20.5 좁은 폭에서 설정을 열면 캔버스가 무너졌다

`.rail-open` 은 `railOpen || panel` 로 붙는다. 그래서 **패널(설정·캘린더)을 열면 화면 폭과
무관하게 216px 이 강제됐다.** 넓히려고 연 것이 화면을 좁힌 셈이다.

같은 화면에서 새 규칙만 껐다 켜며 쟀다(360×780):

| | `grid-template-columns` | 캔버스 |
|---|---|---|
| 고치기 전 | `216px 144px` | **144px** |
| 고친 뒤 | `64px 296px` | **296px** |

`max-width: 700px` 에서 레일을 접힌 채로 둔다. 라벨 노출 규칙도 함께 눌렀다 — 폭만 되돌리면
64px 안에서 글자가 넘친다. 터치에서 잃는 것은 없다(레일 라벨은 어차피 마우스 호버로만 열린다).

### 20.6 손끝 — 색은 올렸는데 크기는 안 올렸던 것들

§19 가 캡처 바에서 쓴 방법을 그대로 썼다: **보이는 크기는 그대로 두고 `::after` 로 닿는
과녁만 넓힌다.** 실제로 키우면 그 줄의 높이가 함께 자라 화면이 어그러진다.

측정은 CDP 로 `pointer: coarse` · `hover: none` 을 **실제로 켜고** 했다(§19.1 —
좁은 화면은 터치 기기가 아니다). 조건부로만 뜨는 손잡이는 같은 클래스의 프로브를 심어 쟀다.

| | 보이는 크기 | 닿는 과녁 |
|---|---|---|
| `.rmg-mc-arrow` (달 넘김 — 캘린더의 유일한 손잡이) | 26×26 | **44×44** |
| `.rmg-flash-act` ('열기') | 42×28 | **50×46** |
| `.rmg-phead-morebtn` | 26×26 | **44×44** |
| `.rmg-note-x` | 24×24 | **44×44** |
| `.rmg-evtl-fold` | 21×22 | **45×46** |
| `.rmg-mg-more` (⋯) | 25×18 | **49×44** |
| `.rmg-ppl-searchx` · `.rmg-pctx-x` · `.rmg-drawer-px` | 20×20 | **44×44** |
| `.rmg-tl-nav` | — | **44×44** (§19 의 36 에서 마저) |
| `.rmg-drawer-compose .rmg-ask-send` | 30×30 | **44×44** (기본 과녁으로는 42 였다) |

> `.rmg-mc-arrow` 는 어제 커밋이 **색만** `--ink` 로 올리고 크기는 두었던 자리다.
> 달을 넘기는 손잡이가 하나뿐이라, 폰 시연에서 첫 오조작이 나기 딱 좋았다.

**호버로만 나타나던 것 하나도 열었다.** `.rmg-mg-act`(메시지 수정·삭제 '⋯')는
`opacity: 0` 에서 행 호버로만 드러났다 — **폰에서는 보낸 말을 고치거나 지울 길이 아예
없었다.** 사람 목록은 이미 같은 방식으로 열어 두었기에(`.rmg-ppl-rowact`) 같은 규칙을 붙였다.
확인: 터치에서 `opacity: 1`.

**공통:** 390×844 · 360×780 둘 다 가로 스크롤 없음. 레일 버튼 45×44(§19 그대로).

**데스크톱은 한 줄도 바뀌지 않았다** — 1440×900, 마우스(`pointer: fine`)로 다시 쟀다.
과녁 확장은 `position: relative` 까지 전부 손끝 블록 안에 두었기 때문이다.

| | 데스크톱 |
|---|---|
| `(pointer: coarse)` · `(hover: none)` | 둘 다 `false` |
| `.rmg-railbtn` | 39×40 (그대로) |
| `.rmg-mc-arrow` | 26×26 · `::after` **content: none** — 과녁 확장 없음 |
| 설정 패널 열었을 때 | `216px 1224px` · 라벨 보임 — 레일은 데스크톱에서 그대로 펴진다 |
| `.rmg-mg-act` | `opacity: 0` — 호버로만 나타나는 성질 유지 |

**건드리지 않은 것:** 방 타임라인 슬롯 28px(`SLOT_H_TOUCH`). 높이를 올리면 24시간 지도의
세로 비례가 바뀌어 레이아웃 전체가 흔들린다.

### 20.7 문서 — 없는 것을 있다고 말하던 자리들

**`docs/` 25개 중 15개가 0바이트였다.** 그런데 `CLAUDE.md` §9 는 그 25개를 **오너까지 지정해**
표로 광고하고 있었다. 심사자든 팀원이든 열면 빈 껍데기 15개를 본다.

빈 파일과 그 줄을 함께 걷고, 그 문서들이 다루려던 내용이 **실제로 어디에 있는지**를 대신
적었다(프롬프트 → `ai/router.py`, 스키마 → `supabase/migrations/`, 테스트 → 이 문서).
번호는 다시 쓰지 않는다.

같이 고친 것들 — 전부 **코드가 먼저 바뀌고 문서가 따라오지 못한** 자리다:

| 어디 | 무엇이 틀렸나 |
|---|---|
| `README.md` · `CLAUDE.md` §5 | 기술 스택에 Chroma · Redis(Upstash) — 붙은 적 없고 redis 의존성은 §16 에서 삭제 |
| `CLAUDE.md` §4 | 다이어그램이 DB 를 백엔드 뒤에 그림 — 실제로는 프론트→Supabase 직행 |
| `CLAUDE.md` §6 · `docs/04` | 레일 6뷰 — 실제 3뷰(`type View = "today" \| "calendar" \| "people"`) |
| `CLAUDE.md` §8 | Agent 15종 설계 — 실제로는 프롬프트 1개. `ai/agents/` 는 없다 |
| `README.md` 예시 | "일정 충돌 검사 → 등록했어요" — 캡처 경로에 충돌 검사가 없고, 그 문장은 AI 가 아니라 템플릿 |
| `ai/README.md` | 없는 `agents/` 트리 6개 파일 — `ai/` 를 여는 사람이 가장 먼저 보는 화면 |
| `docs/10_API.md` | 목업 시절 계약(`entity`·`confidence`·`parseMessage`)이 현행 계약과 나란히 서 있었다 |
| `docs/05_FRONTEND.md` | `/lab` · `enter/page.tsx` · `lib/{auth,utils,google,geo}.ts` — 전부 없음 |
| `docs/15_DEPLOY.md` | lifespan 워밍업 · `pool_pre_ping` 을 "적용됨" 으로 표기 — 둘 다 §16 에서 삭제 |
| `frontend/BACKEND_CONNECTION_NOTES.md` | `api.ts` 에 `health`/`chat`/`parseMessage` 가 있다고 서술 — 지금은 `API_BASE` 한 줄 |

### 20.8 코드로 답이 안 나오는 것 — 사람이 확인해야 한다

0. ~~이번 고침을 배포할 것~~ → **했다.** 백엔드·프론트 둘 다 반영을 확인했다
   (백엔드는 응답이 `"회의(으)로"` → `"회의로"` 로 바뀐 것으로, 프론트는 번들 해시와
   `rmg-mc-arrow::after` · `max-width: 700px` · `.opn-div span { color: var(--muted) }`
   가 실제로 들어 있는 것으로). Render 에 `GROQ_API_KEY` 가 들어 있다는 것도 이때
   드러났다 — 30초대 응답 세 번이 **Groq 이 받아서** 성공한 것이기 때문이다.
1. **제출 요강 자체** — 영상·발표자료·폼·마감일. 레포 어디에도 없다.
2. **데모 계정이 프로덕션에 실제로 심어졌는지** — `frontend/scripts/seed_demo_people.mjs` 는
   있으나 실행 기록이 없다. 실행에 `SUPABASE_SERVICE_ROLE_KEY` 필요.
3. **`sb_secret_…` 키 revoke** (§11.9-1) — git 에 값이 커밋된 적은 없음을 확인했다.
   Vercel env 에 들어갔던 이력이라 **대시보드에서만** 닫을 수 있다.
4. **keep-alive cron** — `docs/15_DEPLOY.md` 체크리스트의 유일한 미체크. 콜드스타트 22.5초를
   직접 쟀다. 심사자의 첫 한 줄이 거기 걸린다.
5. **`render.yaml` 을 Blueprint 로 재적용하지 말 것** — 서비스명이 `comein-api` 인데 실제
   배포는 `comein-aiservice` 다. 재적용하면 URL 이 바뀌어 README·Vercel `NEXT_PUBLIC_API_BASE`·
   Render `CORS_ORIGIN_REGEX` 가 전부 깨진다.
6. **프로덕션의 옛 시험 데이터** — `claudetest` 계정, `실시간 확인 92902` 등. '사람' 탭에 보인다.
7. **2계정 데모** — 방 이름 제안·전원 동의 확정은 계정 하나로 시연할 수 없다.

> **이번에도 같은 교훈이었다.** §15 는 "낡은 문서가 없는 일을 만든다" 였고, §19 는 "시뮬레이션이
> 거짓말한다" 였다. 이번엔 둘이다.
>
> **"정적인 검사는 정적인 것만 본다."** 8가지 조합을 전부 통과한 대비 검사가, 정작 제품의
> 클라이맥스인 6초짜리 한 줄을 한 번도 보지 않았다.
>
> 그리고 **"프롬프트는 부탁이지 보장이 아니다."** 새벽 세 시 건은 프롬프트로 한 번,
> 코드로 한 번 — 두 번 고치고서야 닫혔다. 모델에게 부탁할 것과 우리가 확인할 것을
> 처음부터 갈라 놓았어야 했다.
>
> 셋 다 같은 모양이다. **재 보지 않은 것은 고쳐져 있지 않다.** 그리고 재는 방법 자체가
> 무엇을 볼 수 있는지를 정한다.

---

## 21. 폴백이 한 겹뿐이었다 (2026-08-14)

§20 이 폴백을 **열었다**면, 이건 그 폴백이 **한 겹뿐이라는** 이야기다.

Gemini 는 지금 자주 흔들린다 — 오늘 하루에만 503 `"This model is currently experiencing
high demand"` 와 ReadTimeout 을 여러 번 봤다. 그때마다 Groq 이 받아 냈다. 그런데
Groq 마저 429 를 뱉으면 그 아래에는 아무것도 없었고, **한 번도 다시 물어보지 않았다.**

### 21.1 실패에 이름이 없었다

가장 큰 문제는 층의 개수가 아니라 **분간할 수 없다는 것**이었다. 503 도, 타임아웃도,
스키마 검증 실패도 전부 `LLMGenerationError` 하나였다. 그래서 재시도할 가치가 있는
실패와 없는 실패를 코드가 구별할 방법이 없었다 — 구별할 수 없으니 아무것도 안 했다.

이름을 넷으로 나눴다. **이 이름이 곧 정책이다.**

| 예외 | 무엇인가 | 무엇을 하는가 |
|---|---|---|
| `LLMTransientError` | 503·5xx·타임아웃·연결 끊김 | 같은 곳에 **한 번 더** (0.6초 쉬고) |
| `LLMRateLimitError` | 429 | 같은 문을 두드려도 소용없다 → 바로 넘긴다 |
| `LLMModelUnavailableError` | 404 · `decommissioned` | 넘기되 `logger.error` 로 크게 남긴다 |
| `LLMGenerationError` | 답은 왔는데 모양이 아니다 | temperature 0 이라 다시 물어도 같다 → 넘긴다 |

두 층 모두 실패하면 **마지막 예외를 그대로 올린다** — 삼키면 어디서 무너졌는지 모른다.

### 21.2 30초는 이미 실패한 요청을 붙들고 있는 시간이었다

Gemini 타임아웃이 30초였다. 성공한 호출은 2~7초에 끝난다(실측). 즉 30초를 기다리는
동안 **폴백은 시작조차 못 하고**, 화면에서 그건 그냥 멈춘 것으로 보인다.
15초로 끊는다(`GEMINI_TIMEOUT_SECONDS`). 가장 느렸던 성공(7.2초)의 두 배다.

효과는 최악의 경우에 나온다: 예전엔 30초 뒤 **오류**, 지금은 15초 뒤 **Groq 이 답**한다.

### 21.3 확인 — 가짜 Provider 로

이 자리에는 테스트가 **하나도 없었다**(`FallbackProvider` 를 건드리는 테스트 0건).
가짜를 쓰는 이유는 속도가 아니라 **재현**이다 — 429·503·모델 은퇴는 실제 API 로는
원할 때 만들 수 없고, 그래서 지금까지 한 번도 확인되지 않았다.

`backend/tests/test_llm_fallback.py` 10개: 주 Provider 가 답하면 아무도 안 부른다 ·
흔들림은 같은 곳에 다시 묻는다 · 두 번 흔들리면 넘어간다 · 429 는 다시 두드리지 않는다 ·
모양 어긋남은 넘어간다 · 폴백도 제 재시도를 갖는다 · 주 모델이 은퇴해도 서비스는 돈다 ·
둘 다 사라지면 그렇게 말한다 · 마지막 예외를 삼키지 않는다 · `generate`·`classify` 도 같은 길.

**34 passed** (15 → 24 → 34).

실제 `route()` 5회: 15.4s · 16.8s · 3.5s · 3.5s · 10.7s — **전부 성공**. 로그에
`primary(gemini) 흔들림 — 한 번 더 묻는다: Gemini 503 ...` 이 실제로 찍혔다.

### 21.4 모델이 은퇴하는 것을 아무도 안 보고 있었다

`llama-3.3-70b-versatile` 이 내려가면 폴백이 통째로 사라지는데, 그걸 감시하는 것이
없었다. Gemini 쪽은 `-latest` 별칭이라 구글이 뒤에서 갈아 끼우고, Groq 은 낡은 모델을
실제로 내린다. 둘 다 **우리가 모르는 사이에** 일어난다.

`scripts/check_models.py` 를 목록 출력에서 **사전 점검**으로 바꿨다. 코드가 실제로 쓰는
이름(`ai/llm/*.py` 의 `DEFAULT_MODEL` — 한 곳에만 적는다)을 두 Provider 에서 확인하고,
하나라도 없으면 0이 아닌 값으로 끝난다. 어느 파일을 고쳐야 하는지까지 적어 준다.

```
=== 데모 전 모델 점검 ===
[ok]   gemini — 'gemini-flash-latest' 있음 (generateContent 가능 모델 37개)
[ok]   groq   — 'llama-3.3-70b-versatile' 있음 (모델 15개)
둘 다 살아 있다. 흔들려도 받을 곳이 있다.
```

은퇴한 이름을 넣어 실패 경로도 확인했다 — 비슷한 이름 목록과 고칠 파일을 함께 띄운다.

> Groq 은 `urllib` 로 직접 부르면 Cloudflare 가 403(1010)으로 막는다. SDK 로 묻는다 —
> 어차피 실제 호출도 SDK 를 지나므로, **같은 길로 확인하는 편이 맞다.**

### 21.5 아직 남은 것

- **Groq 이 429 면 갈 곳이 없다.** 세 번째 무료 Provider 가 없다. 지금 할 수 있는
  대비는 데모 직전에 `check_models.py` 를 돌려 두 문이 다 열려 있는지 보는 것뿐이다.
- `/api/chat` 은 **무인증·무제한**이고 레포는 public 이다. URL 이 README 에 있으니
  누구나 쿼터를 태울 수 있다 — 심사 기간이 짧아 확률은 낮지만, 터지면 전면 중단이다.

### 21.6 고친 것이 스스로를 되돌리고 있었다 (같은 날 이어서)

§21 을 배포하고 재 봤더니 25초 넘는 응답이 반복해서 나왔다. 계산해 보면 당연했다:

```
15초 기다림(타임아웃) → 0.6초 쉬고 → 또 15초 기다림 → 그제서야 Groq
```

폴백을 빨리 열려고 타임아웃을 30 → 15초로 줄여 놓고, **그 15초를 두 번 쓰게** 만들어
놓은 셈이다. 503 과 타임아웃을 같은 `LLMTransientError` 로 묶은 대가다.

**기다림의 값이 다르면 정책도 달라야 한다.** 503 은 곧바로 돌아오므로 한 번 더 물어도
잃는 것이 없다. 타임아웃은 이미 제한 시간을 통째로 썼다. `LLMTimeoutError` 를 따로 두고,
이것만은 재시도하지 않고 곧바로 다음 Provider 에 넘긴다.

| | 최악 | 평균 |
|---|---|---|
| 전 | 33초 (15 + 15 + Groq) | — |
| 후 | **15.4초** | **6.4초** |

**37 passed** (34 → 37).

### 21.7 그리고 쿼터가 생각보다 얇다 — 실물로 확인됐다

위 실측 8회 중 **2회가 `LLMRateLimitError` 로 끝났다.** Groq 이 막은 것이다 — 오늘 검증하며
쏟아부은 요청 때문이다. Gemini 가 흔들려 폴백으로 몰리는 상황에서 분당 한도에 닿으면
**두 층이 동시에 닫힌다.**

§21.5 에 "Groq 마저 429 면 갈 곳이 없다" 고 적어 둔 것이 가정이 아니라 **관측**이 됐다.

- 사람이 손으로 쓰는 데모에서는 잘 일어나지 않는다(분당 한도지 일일 소진이 아니다).
- 그러나 **버스트에는 약하다.** 심사자 여럿이 동시에 만지거나, 누가 `/api/chat` 을
  스크립트로 두드리면 같은 자리에 닿는다. 그 엔드포인트는 **무인증·무제한**이고
  레포는 public 이며 URL 은 README 에 있다.
- 검증조차 부하다 — 이 문서의 숫자를 얻느라 쓴 요청이 그 한도를 건드렸다.

> **재는 일도 공짜가 아니다.** 무료 티어에서는 확인하는 행위 자체가 확인하려던 것을
> 망가뜨릴 수 있다. 다음에 이 자리를 잴 때는 간격을 두고 적게 친다.
## 22. 실시간이 조용히 죽어 있던 자리 — 두 계정으로 써 보고 (2026-08-18)

두 아이디로 동시에 써 보고 나온 보고는 셋이었다.
① 상대가 말을 보내면 **새로고침해야** 보인다 ② 상대가 일정을 만들어도 **동의 화면이 안 뜬다**
③ 새로고침하면 **처음 화면으로** 돌아간다. (그리고 ④ 동의를 눌러도 아무 반응이 없다.)

넷 다 원인이 다르다.

### 22.1 채널을 두 번 여는 경합 — ①의 진짜 원인

`useRemoteSync` 는 `sb.auth.onAuthStateChange` 가 울릴 때마다 `load()` 를 다시 걸었다.
그런데 supabase-js 는 **구독을 거는 순간 `INITIAL_SESSION` 으로 한 번 반드시 운다.**
그래서 첫 `load()` 가 아직 네트워크를 기다리는 사이 두 번째 `load()` 가 함께 달렸고,
둘 다 `sb.channel("comein-workspace")` 라는 **같은 이름**으로 채널을 열었다.

realtime-js(2.112)의 실제 동작을 확인했다:

- `RealtimeClient.channel(topic)` — 같은 topic 이 이미 있으면 **그 인스턴스를 그대로 돌려준다.**
- `RealtimeChannel.subscribe()` — 이미 join 된 채널이면 **조용한 no-op** 이다(던지지도 않는다).

그래서 두 번째 `load()` 는 "구독했다" 고 믿었지만, 실제로 쥔 것은 첫 `load()` 가
정리하며 떠나보내는 중이던 채널이었다. 결과는 **화면은 멀쩡한데 실시간만 죽은** 상태 —
스냅샷(첫 로딩·새로고침)은 잘 되니 데이터는 보이고, 그 뒤로 아무것도 도착하지 않는다.

고침은 셋이다.

1. **한 번에 하나만** — 세대 번호(`gen`)로 겹쳐 들어온 `load` 를 버리고,
   같은 신원이면 소켓을 다시 열지 않는다(토큰 갱신마다 대화가 끊기지 않게).
2. **채널 이름을 매번 다르게** (`comein-core-<uid>-<n>`) — 같은 이름이 아니면 위 두 동작이
   서로를 덮을 수 없다.
3. **`subscribe()` 에 상태 콜백을 단다** — `CHANNEL_ERROR/TIMED_OUT/CLOSED` 면 1s→2s→4s…
   최대 30s 로 다시 붙고, 붙는 순간 스냅샷을 한 번 맞춘다(끊긴 동안 놓친 것은 소켓으로 오지 않는다).
   설정 화면의 계정 줄이 "실시간 연결을 다시 잇는 중" 을 그대로 말한다.

덧붙여 화면이 돌아오거나(`visibilitychange`·`focus`) 네트워크가 살아나면(`online`)
한 번 맞춘다 — 15초 안의 재확인은 흘려보낸다.

### 22.2 처음 말을 거는 방 — ①의 두 번째 원인

첫 1:1 대화는 **방이 먼저 생기고 말이 뒤따른다.** 그런데 publication 에는 `chat_messages`
만 있었다. 말은 실시간으로 도착하는데 받는 쪽은 그 방을 모르고, 방을 모르면 그 말은
어느 화면에도 걸리지 못한 채 스토어에만 남는다.

- 서버: `0015_realtime_rooms.sql` — `chat_rooms` · `chat_room_members` 를 publication 에 올린다.
  (1:1 방은 방이 먼저 생기므로 그 시점엔 아직 멤버가 아니다 → RLS 에 걸린다.
   **`chat_room_members` 의 내 줄이 도착하는 순간**이 진짜 신호다. 둘 다 올려 둔다.)
- 화면: 마이그레이션 없이도 동작하게 — **모르는 방에서 온 말**을 보면 목록부터 다시 받는다.

### 22.3 물음이 서랍 안에서만 기다렸다 — ②

`loadProposal` 은 **그 일정을 열었을 때만** 불렸고, `schedule_proposals` 는 구독 대상이
아니었다(0003 §5 가 publication 에 올려 뒀는데도). 그래서 상대가 시간을 제안해도
받은 쪽 화면에는 아무 일도 일어나지 않았다.

- `schedule_proposals` · `schedule_proposal_participants` 를 구독한다.
- 스냅샷을 받을 때 **열려 있는 제안을 모두** 받아 둔다(`loadOpenProposals`).
- 화면 위쪽에 **답을 기다리는 것** 한 줄이 선다 — 아직 답하지 않은 제안과 초대.
  팝업으로 가로막지 않고, 누르면 그 일정이 열린다.

> 제안 구독은 **별도 채널**로 갈랐다. 0003 을 아직 올리지 않은 프로젝트에서 한 채널에
> 묶으면 그 채널이 통째로 오류가 되어 **대화까지 같이 죽는다.**

### 22.4 눌렀는데 아무 일도 — ④

`respondToProposal` 은 실패를 `console.error` 로만 적고 `null` 을 돌려줬다.
사용자에게 그것은 "아무 반응이 없음" 과 구별되지 않는다.

이제 이유를 그대로 돌려주고 제안 카드 아래에 한 줄로 적는다. 서버 말이 `ambiguous` 면
**"0007 을 적용해 주세요"** 로 바꿔 적는다 — 0007 이 고친 것이 바로 이 증상이었다
(전원 동의로 확정되는 순간에만 지나가는 줄이라 제안도 응답도 멀쩡해 보였다).

**마이그레이션이 어디까지 올라가 있는지 먼저 확인할 것.** 0007 이 없으면 마지막 한 사람의
'동의' 는 지금도 조용히 실패한다.

### 22.5 들어온 사람을 문 앞에 다시 세웠다 — ③

워크스페이스는 마운트 직후 `sessionStorage("comein:reimagine")` 하나만 보고
없으면 곧바로 `/experience` 로 되돌렸다. 그건 **탭 하나의 기억**이라 새 탭·북마크·
복구된 세션에서는 늘 비어 있다. 게다가 `/experience` 는 **이미 로그인한 사람에게도**
인트로를 처음부터 재생하고 로그인 칸을 다시 내밀었다 — 그 사람은 이미 로그인해 있는데.

- 기억을 `localStorage("comein:entered")` 로 옮긴다(문턱 *연출* 은 세션 기억 그대로).
- 문턱 판정을 **`remote.ready` 까지 미룬다** — 세션이 있으면 그 사람은 이미 들어온 사람이다.
- `/experience` 는 세션이 있으면 인트로를 건너뛰고 워크스페이스로 건넨다
  (`?auth=1` 로 온 사람은 예외 — 계정을 바꾸러 온 사람에게서 로그인 칸을 뺏지 않는다).

### 22.6 곁가지로 함께 고친 것

스냅샷을 자주 다시 받게 되면서 드러난 것들이다.

- `hydrateRemote` 가 스냅샷마다 `todos: []` 로 비웠다 — 일정 하나만 바뀌어도(그때 스냅샷을
  다시 받는다) 사용자가 적어 둔 할 일이 통째로 사라졌다. 시드는 **처음 한 번만** 물러난다.
- 스냅샷이 **보내는 중인 내 말**까지 쓸어 갔다 — 방금 친 문장이 눈앞에서 사라진다. 남긴다.
- 서버 id 를 받는 순간 같은 말이 이미 실려 와 있으면 임시 줄을 **걷어낸다**(`settleSent`).
  고쳐 달기만 하면 같은 id 가 둘이 되고, 그때부터 지워도 하나만 지워진다.

### 22.7 검증 — 무엇을 어떻게 확인했나

고친 자리는 전부 **React 이펙트 안에** 있었다. 그 안에 있는 동안에는 아무도 시험할 수 없다.
그래서 먼저 판단을 화면 밖으로 꺼냈다 — 옮기기만 했고, 동작은 그대로다.

| 옮긴 것 | 어디로 | 왜 |
|---|---|---|
| 실시간 고리의 순서 | `lib/sync.ts` | 버그가 살던 자리. 훅은 켜고 끄기만 한다 |
| 답을 기다리는 것 | `lib/awaiting.ts` | 화면이 판단하지 않는다(§39) |
| 문턱 판정 | `lib/entry.ts` | 눈으로 좇을 표가 아니다 |

**가짜 Supabase (`lib/fakeSupabase.ts`)** — 이 시험의 값어치는 여기 달려 있다.
편한 대로 만들면 통과는 아무것도 증명하지 못하므로, 설치된 realtime-js 2.112 소스를 열어
세 가지를 그대로 옮겼다: ① `channel(topic)` 은 같은 이름이면 있던 인스턴스를 돌려준다
② 이미 join 된 채널의 `subscribe()` 는 조용한 no-op 이다(던지지 않는다)
③ `removeChannel` 은 비동기라 떠나는 채널이 목록에 잠깐 남는다.

**시험 64개 통과** (`npm test` — 기존 29 + 새 35). 그중 하나는 **진단 자체를 시험한다**:
옛 방식(고정 이름 + 상태 콜백 없음)을 그대로 재현해 놓고, 겹쳐 걸면 살아 있는 채널이
0개가 되고 상대의 말이 도착하지 않음을 확인한다. 그게 이 보고의 출발점이었다.

**헛돌지 않는지 확인 — 고친 곳을 하나씩 되돌려 보았다.**

| 되돌린 것 | 떨어진 시험 |
|---|---|
| 채널 이름을 다시 고정 | 겹쳐 걸어도 서로를 덮지 않는다 |
| 세션 확인 전에 단정 | 로그인 여부를 알기 전에는 밀지 않는다 |
| 스냅샷마다 할 일 비움 | 사용자가 적어 둔 할 일을 건드리지 않는다 |
| 세대 번호 제거 | 토큰이 갱신돼도 소켓을 다시 열지 않는다 |
| 모르는 방 무시 | 첫 1:1 대화가 새로고침 없이 뜬다 |

다섯 모두 잡혔다. `tsc --noEmit` 0건, 프로덕션 빌드 통과, `next start` 로 세 라우트
(`/` · `/experience` · `/workspace`) 200 응답 · 서버 오류 로그 없음.

**아직 확인하지 못한 것 — 솔직히 적어 둔다.**

- **두 계정 실제 접속.** `.env.local` 이 없어 진짜 Supabase 에 붙여 보지 못했다.
  특히 **Realtime RLS** 는 서버에서만 판정된다 — 받는 쪽이 그 행을 SELECT 할 수 있어야
  이벤트가 간다. 시험은 클라이언트 쪽 수명만 증명한다.
- **마이그레이션 적용 여부.** `0007`(동의 무반응) · `0015`(첫 1:1 대화)가 올라가 있어야 한다.
- **React 이펙트 배선.** 렌더러가 없어 컴포넌트 안의 이펙트 순서는 시험하지 못했다.
  판단 자체(`entryVerdict` · `pendingAnswers`)는 시험이 지키지만, 그것을 부르는 자리는 눈으로 봤다.

---

## 23. 버튼과 통일성 재점검 (2026-08-19)

버튼 107개, 클래스 55개를 한 번에 훑었다(정규식으로 뽑아 표로 놓고 봤다 — 6,800줄을
눈으로 좇으면 반드시 놓친다). 나온 것은 여덟이고, 성격은 셋으로 갈린다.

### 23.1 조용한 실패 — §22.4 와 같은 병이 한 곳 더 있었다

**연결 요청 수락/거절.** `answerRequest` 는 답한 줄을 화면에서 먼저 걷는다(두 번 눌리지
않게 — 옳은 판단이다). 그런데 **서버가 받지 않아도 걷은 채로 끝이었다.** 이어지지도
않았는데 요청만 사라지고, 화면은 아무 말도 하지 않는다. 누른 사람은 이어진 줄 안다.

→ 막히면 줄을 **되돌리고** 이유를 그 자리에 적는다. 되돌릴 때 같은 줄을 두 벌 만들지
않는 것까지 시험으로 못 박았다(빠르게 두 번 누르면 실제로 그럴 수 있었다).

### 23.2 잠금이 제각각 — 같은 패널 안에서도

사람 화면에서 `요청` 은 `disabled={joining===id}` 로 잠그고 "…" 를 보여 주는데,
바로 옆의 `수락` · `거절` · `요청함·취소` 는 아무 잠금이 없었다. 두 번 누르면 RPC 가
두 번 나간다. 한 화면 안에서 조심하는 버튼과 조심하지 않는 버튼이 섞여 있으면,
그건 규칙이 아니라 우연이다.

→ 넷 다 같은 규칙(`answering`)으로 묶었다.

**보내기 화살표**도 마찬가지였다. 캡처 바는 입력이 비면 보내기를 **감추는데**, 대화창의
같은 화살표는 비어 있어도 눌리는 얼굴로 서 있었다(눌러도 아무 일도 안 한다).
→ 비면 잠근다. 같은 화살표는 어디서나 같은 말을 해야 한다.

### 23.3 통일성 — 규칙을 55번 적는 대신 한 번 적는다

| | 전 | 후 |
|---|---|---|
| 키보드 초점 표시 없는 버튼 클래스 | **36개** | 0 |
| 누름 반응(`:active`) 없는 클래스 | **49개** | 0 |
| 잠긴 얼굴(`:disabled`) 규칙 | 2개 클래스만 | 전부 |
| `type="button"` 누락 | 1곳 | 0 |

가장 아픈 것은 **`.rmg-ppl-act`** 였다 — 동의·수락·거절·참석·요청·만들기·로그인/로그아웃
26곳에 쓰이는 이 앱의 주 액션 버튼에 `:focus-visible` 이 없었다. 사실상 **마우스로만 쓸 수
있는 버튼**이었다. 반면 곁말 버튼(`.rmg-flash-act` · `.rmg-note-act`)에는 있었다.
중요한 것에는 없고 덜 중요한 것에는 있었다.

클래스마다 서른여섯 번 적는 대신 `.rmg button`(그리고 `[role=button|menuitem|tab]`)에
한 번 적었다. 규격은 CLAUDE.md §6 이 정한 그대로 — 초점은 액센트 1겹, 누름은
`scale(0.97)`, `prefers-reduced-motion` 이면 없음. 목록의 한 줄·달력 칸처럼 넓은 표면은
줄어들면 어색하므로 비켜선다.

### 23.4 이름 — 같은 일에 다른 이름, 없는 것에 있는 이름

**같은 함수를 부르는 두 버튼이 다른 이름을 쓰고 있었다.** 사람 패널 안에서
`캘린더에 추가(Add to calendar)` 와 `일정 제안(Propose it)` 은 **완전히 같은**
`onCreateEvent(...)` 를 부른다. 게다가 '제안' 은 이 제품에 **이미 있는 다른 기제**의
이름이다(`schedule_proposals` → 전원이 동의해야 일정이 앉는다, §22.3). 사용자가
"제안 = 상대의 동의를 기다린다" 로 배운 말이, 여기서는 그냥 달력에 앉힌다.
→ 둘 다 `캘린더에 추가`.

**`새 그룹(New group)`** 이 여는 패널은 스스로를 `새 자리` (aria-label) ·
`만들기` (제목) · `New event` (영문)라고 불렀다. 그리고 이 제품에 group 이라는 것은
없다 — 만들어지는 것은 일정이다. 이름이 셋이면 누른 사람은 자기가 무엇을 만들었는지
모른다. → 여는 버튼과 열리는 패널을 `새 자리 / New event` 로 맞췄다.

### 23.5 확인

시험 **67개 통과**(§22.7 의 64 + 요청 되돌리기 3). 새 시험도 되돌려 확인했다 —
"실패해도 되돌리지 않음" 으로 바꾸자 2개가 떨어졌다.
`tsc --noEmit` 0건, 프로덕션 빌드 통과, 세 라우트 200 · 서버 오류 없음.

**손대지 않은 것:** 클립보드 복사 버튼은 잠그지 않았다(두 번 눌러도 같은 값이 복사될 뿐이고,
`copied` 표시가 이미 답한다). `그러기 / 그대로`(이름 바꾸기)는 그대로 뒀다 —
"이 자리를 X 라고 부를까요?" 에 대한 답이라 문장이 이어진다. 버튼처럼 생긴 낱말을
넣는 순간 그 대화가 끊긴다.

---

## 24. 사용 가이드 업데이트 (2026-08-19)

가이드는 일곱 걸음이었고(주석은 "여섯 걸음" 이라고 적혀 있었다 — 그만큼 아무도 세지 않았다),
**§22~21 에서 고친 것들이 하나도 들어 있지 않았다.** 특히 두 사람이 각자 써 봐야 비로소
드러나는 자리들이 그랬다. 초대를 받은 쪽은 화면 위에 뜬 그 한 줄이 무엇인지 배울 데가 없었다.

### 24.1 세 막으로 — 남은 개수가 아니라 무엇을 배우는 중인지

아홉 걸음을 평평하게 늘어놓으면 세 번째쯤에서 "몇 개나 더 남았지" 가 된다.
막 이름을 앞에 두면 그 자리에 **무엇을 배우는 중인지**가 먼저 온다.

| 막 | 걸음 |
|---|---|
| **둘러보기** | 오늘 · 캘린더 · 24시간 시간 지도 |
| **함께** | 사람 · 사람 하나 한 화면 · 일정 안에서 대화 · **답을 기다리는 것** |
| **맡기기** | 말하면 됩니다 · **맡기는 정도는 당신이** |

### 24.2 새로 든 두 걸음

**답을 기다리는 것** — §22.3 에서 세운 그 한 줄이다. 가이드에 없으면 초대를 받은 쪽은
화면 위의 이것이 무엇인지 모른다. 여기서 세 가지를 말한다: 팝업으로 가로막지 않는다는 것,
누르면 그 일정이 열리고 거기에 '동의 · 다른 시간' 이 있다는 것, 그리고
**시간은 전원이 동의해야 비로소 앉는다**는 것.

**맡기는 정도는 당신이** — 마지막 걸음이 설정인 이유가 있다. 앞의 여덟이
"이렇게 움직입니다" 였다면 여기는 "그 움직임을 당신이 바꿉니다" 다.
`자동 확정` 이 기본으로 꺼져 있다는 것과, **로그인해야 이 워크스페이스가 이 브라우저 밖으로
나간다**는 것 — 둘 다 중요한데 지금까지 어디서도 말하지 않았다.

기존 걸음들도 한 겹씩 채웠다. '오늘' 은 인사말 아래 한 줄이 AI 가 오늘을 실제로 읽고 하는
말이라는 것을, '사람' 은 상대의 승낙 없이 목록에 누가 들어오는 일은 없다는 것을,
'일정 안에서 대화' 는 **누가 무엇을 하는지는 말하지 않고 되는지 안 되는지까지만** 이라는 것을
(§11 의 약속이 화면에서도 지켜진다는 뜻이다).

### 24.3 없는 것을 있는 척하지 않는다

혼자 막 시작한 사람에게는 '사람 하나, 한 화면' 도 '일정 안에서 대화' 도 가리킬 실물이 없다.
전에는 그럴 때 조용히 레일 버튼을 가리켰다 — 카드는 화면을 설명하는데 눈앞에는 그 화면이 없었다.

이제 걸음이 **자기 실물이 지금 있는지를 안다**(`available`). 없으면 그리로 가는 길을
가리키면서, 카드가 함께 말한다: *"아직 이어진 사람이 없어요. 사람 화면에서 누군가와
이어지면 이 자리가 이렇게 됩니다."*

> `rect` 가 없는지로 판단하지 않는다 — 대체 대상(레일 버튼)은 늘 화면에 있어서 rect 가 잡히고,
> 그러면 그 말을 할 기회가 영영 오지 않는다. 반대로 '답을 기다리는 것' 줄은 정말로 없을 때
> 사라지므로 rect 만으로 충분하다. 두 조건을 함께 본다.

### 24.4 걸음 사이를 오가는 손잡이

- **점이 손잡이가 됐다.** 전에는 `<span>` 표식이라, 아홉 걸음을 되짚으려면 '이전' 을 여덟 번
  눌러야 했다. 이제 누르면 그 걸음으로 바로 간다(`role="tablist"`, 각 점에 걸음 이름).
  점은 6px 이지만 닿는 자리는 16×18 이다 — 테두리로 넓히면 세로가 6px 그대로라 손끝이 빗나간다.
- **지나온 걸음은 조금 진하다.** 어디까지 왔는지가 색으로도 읽힌다.
- **`← → · Esc`** 를 카드 밑에 한 줄 적었다. 되던 일인데 아무도 몰랐다.
- **길이를 먼저 말한다.** 문 앞 미리보기와 설정의 '다시 보기' 둘 다
  *"진짜 화면 위에서 아홉 걸음 · 2분 남짓 · Esc 로 언제든"*. 얼마나 걸리는지 모르는 안내는
  시작 자체가 결심이 된다.

### 24.5 확인

`data-tour` 대상 9개와 걸음 9개를 대조했다 — 전부 맞고, 조건부인 둘은 `whenMissing` 을 갖는다.
GuideTour 가 쓰는 클래스 16개 모두 CSS 정의 있음. 발치(foot)는 아홉 점 + 버튼이 부딪치면
줄을 바꾸도록 `flex-wrap` 을 뒀다.
시험 67개 통과 · `tsc` 0건 · 빌드 통과 · 세 라우트 200 · 서버 오류 없음.

**시험을 붙이지 않은 이유:** 이 걸음들은 로직이 아니라 문안이다. 시험으로 지킬 만한 불변은
"걸음의 target 이 실제 `data-tour` 로 존재하는가" 하나인데, 그건 위 대조 스크립트로 확인했고
어긋나도 카드가 가운데 서며 `whenMissing` 으로 물러난다(조용히 깨지지 않는다).
문안을 시험으로 감싸면 문장을 다듬을 때마다 시험을 고치게 되고, 그건 지키는 게 아니라 묶는 것이다.


---

## 25. 저장소에 없는 파일 — 그리고 뽑아 놓고 버리던 갈래 (2026-08-19)

> 전수 점검에서 나왔다. 앞의 절들과 성격이 다르다: 여기 적힌 첫 번째 것은 **코드의 버그가
> 아니라 저장소의 버그**였고, 그래서 어느 화면을 눌러 봐도 찾을 수 없었다.

### 25.1 `.gitignore` 한 줄이 컴포넌트 아홉 개를 삼켰다

`c72ecd8` 은 7,202줄짜리 `page.tsx` 를 성격대로 갈랐다고 적었다. 실제로 그렇게 했다 —
다만 그중 `parts/` 아홉 파일(3,057줄)은 **저장소에 들어간 적이 없다.**

```
.gitignore:22   parts/
```

파이썬 `.gitignore` 템플릿의 buildout 산물 규칙이다. 바로 위에 `lib/` 도 같은 이유로 있고,
그건 예외를 달아 두었다(`!frontend/src/lib/`). `parts/` 에는 아무도 예외를 달지 않았다.

그래서 이런 상태가 됐다:

- 만든 사람의 로컬 — 파일이 있으므로 `tsc` 0건, 빌드 통과. 커밋 메시지에 그대로 적었다.
- `origin/main` — `TS2307 Cannot find module './parts/Environment'` 외 28건. 빌드 불가.
- 다른 PC 에서 clone 하면 워크스페이스가 통째로 서지 않는다.

**아무도 몰랐던 이유가 더 중요하다.** push 마다 도는 워크플로가 둘 있었지만
(`keepalive-supabase`·`warm-render`) 둘 다 바깥을 두드리는 일이고, **코드가 서는지 보는 눈은
하나도 없었다.** 로컬에서만 초록이면 그건 초록이 아니다.

고친 것:

- `parts/` → `/parts/` — 루트로 못 박는다. buildout 산물은 루트에만 있다.
- `parts/` 아홉 파일을 `1d2e614` 의 monolith 에서 되살렸다. 리팩터링은 옮기기만 했으므로
  컴포넌트 스물여덟이 그 안에 그대로 남아 있었다 — 잃은 것은 없었다.
- `.github/workflows/ci.yml` — `npm ci → tsc → test → build` 와 `pytest`.
  핵심은 시험이 아니라 `npm ci` 다. **저장소에 들어간 것만으로 세워 보므로**,
  "내 로컬에는 있는데 저장소에는 없는 파일" 이 그 자리에서 걸린다.

> 교훈을 한 줄로: 커밋 메시지의 "빌드 통과" 는 **어디서** 통과했는지를 말하지 않으면
> 아무 말도 아니다. 그걸 말해 주는 것은 사람이 아니라 CI 다.

### 25.2 §9 의 안전망이 §11 에서 조용히 사라졌다

캡처 바에 "자료 준비해야 해" 를 넣으면 "할 일로 정리했어요" 가 떴다. 그 할 일은
**어디에도 남지 않았다.** 새로고침하면 사라지고, 로그인하면 개수마저 0 이 됐다.

경위를 시간순으로 이으면 이렇다.

| 언제 | 무슨 일 | 그때 남긴 말 |
|---|---|---|
| §9 | Notes·Meetings 뷰 제거, 갈래 4→2 | "저장은 원본 카테고리를 그대로 보내므로 **DB 는 여전히 4종을 구분해 저장한다** — 뷰를 되살려도 데이터 손실은 없다" · 스토어 슬라이스 정리는 **미결** |
| §10.1 | Tasks 뷰 제거 | "할 일을 목록으로 보거나 완료 처리할 화면이 사라졌다 — `store.todos` 는 살아 있으므로 되살릴 수는 있다" · **미결** |
| §11 | 저장이 Supabase 직행으로 | (이 전환이 위 전제를 깼다는 말은 어디에도 없다) |
| §16 | 백엔드 라우터 6개 걷어냄 | 옳은 결정이고 완료됐다. 무상태 파서에 저장이 있을 이유가 없다 |

§9 는 "DB 가 계속 저장하니 되살리면 된다" 를 근거로 미결을 남겼다. 저장처가 Supabase 로
옮겨가면서 거기에는 `events` 계열만 세워졌고, `todos`·`memos` 표는 **아무도 만들지 않았다.**
그 순간 §9 의 전제가 사실이 아니게 됐는데, §11 도 §16 도 그걸 적지 않았다.
그래서 미결이 미결인 채로 굳었고, 그 사이 화면은 계속 "정리했어요" 라고 말했다.

정했다 — **살리지 않는다. 아래로 맞춘다.** (갈래는 §9(4→2)·§10.1(뷰 3) 을 거쳐 계속
줄어 왔고, 이번이 그 다음 걸음이다.)

- **계약** `Category` 4 → 3. `memo` 를 걷었다 — 화면이 그것을 '할 일' 로 접어 담았고
  그 할 일이 사라졌으니, 뽑아 놓고 버리는 갈래였다. `Intent` 와 프롬프트에서도 걷었다.
- **화면** `DEST["할 일"] = null`. 갈 곳이 없으면 없다고 적는다. 스침 줄이 "· 오늘" 대신
  **"· 담아 두는 곳은 아직 없어요"** 라고 말한다. 하지 않은 일을 했다고 말하지 않는 것이
  이 변경의 전부다.
- **스토어** `todos` 슬라이스와 액션 넷을 걷었다. 부르는 화면이 하나도 없었는데
  시드 다섯 줄이 남아 기능이 있는 것처럼 보이게 하고 있었다.
- **히어로** 숫자 둘 → 하나. 세지 못하는 것을 세지 않는다.

되살리려면 순서가 있다: **표(마이그레이션)부터** 세우고, 그 다음 화면, 그 다음 계약.
반대로 하면 이번과 같은 자리에 다시 선다.

### 25.3 함께 나온 것들

- **끝 시각이 버려지고 있었다.** `toParsed` 가 `end` 를 읽지 않아 모든 일정이 무조건
  +1시간으로 앉았다 — "2시부터 5시까지 회의" 가 2~3시가 됐다. AI 는 옳게 뽑아 보냈는데
  화면에서 조용히 버려진 것이라, **화면에서는 AI 가 못 읽은 것처럼 보였다.** 프롬프트에도
  `end` 를 명시하고(`DURATION`), 화면이 그것을 쓴다. 없으면 그때만 한 시간으로 둔다.
- **전원 동의 뒤의 충돌이 침묵했다.** `proposalConflict` 는 스토어가 오래전부터 쥐고
  있었지만 읽는 화면이 없었다. 그래서 그 사이 누가 그 시간에 다른 일정을 잡으면,
  사용자에게는 '동의를 눌렀는데 아무 일도 안 일어남' 으로만 보였다. 일정 패널의 오류 자리에
  이었다 — 겹친 사람 **수** 까지만 말한다(§11 의 선은 그대로).
- **가입 폼의 이름이 어디에도 가지 않았다.** `signUpWithPassword(email, pw)` 가 이름을
  받지 않아, `0004` 의 트리거가 읽는 `raw_user_meta_data->>'name'` 이 늘 비었다.
  모든 사람의 표시 이름이 이메일 앞부분(= 핸들)이 됐다. 사용자는 분명히 적었는데.
  `options.data` 로 실어 보낸다.
- **`page.tsx` 의 죽은 import 47개.** 분할하면서 남은 잔해다. `tsc` 는 잡지 않고
  (`noUnusedLocals` 가 꺼져 있다) ESLint 설정도 없어서, 아무도 말해 주지 않았다.
- **주석이 거짓말을 하고 있었다.** `store.ts` 말미의 "함께 걷어낸 것들" 목록이
  `removeSchedule`·`confirmSchedule` 을 걷었다고 적어 두었지만 둘 다 살아서 화면이 부르고
  있었다. 걷은 것을 적는 자리라, 적힌 것이 틀리면 다음 사람은 있는 것을 없다고 믿고 다시
  만든다. 코드를 보고 다시 적었다. 정말로 안 쓰이던 `overlaps`·`aiOffline` 은 걷었다.
- 빈 `backend/alembic/`(`__pycache__` 만 남아 있었다)을 걷었다.

### 25.4 폴백이 이미 죽어 있었다 — §21.4 가 걱정하던 그대로

버튼 점검을 하느라 백엔드를 띄우고 실제로 몇 마디 넣어 봤다. **"교수님 미팅 잡아줘"**
(시각이 없으니 되묻기가 나와야 하는 자리)가 이렇게 답했다:

```
{"intent":"chat","reply":"일시적인 오류가 발생했어요.","items":[],"ask":null}
```

로그를 따라가면 경위가 그대로 있다:

1. Gemini → **503** `This model is currently experiencing high demand`
2. 흔들림이므로 0.6초 뒤 한 번 더(§21) → 또 503
3. Groq 으로 넘김 → **404** `The model llama-3.3-70b-versatile does not exist`
4. 갈 곳이 없어 `_FALLBACK_ERROR`

**코드는 제 할 일을 다 했다.** 실패에 `LLMModelUnavailableError` 라는 이름이 붙었고
(§21.2 에서 그러라고 만든 것이다) `폴백 모델도 사라졌다 — 이제 갈 곳이 없다` 가 error 로
찍혔다. 다만 그걸 **읽는 사람이 없었다.**

§21.4 는 정확히 이 일을 걱정하며 `scripts/check_models.py` 를 만들었다. 그런데 그 도구가
한국어 Windows 에서 `UnicodeEncodeError: cp949` 로 죽는다. 안내문의 `—` 한 글자 때문이다.
**감시하라고 만든 것이 팀 PC 에서 한 번도 끝까지 돈 적이 없었다.** 지키는 장치를 만드는 것과
그 장치가 도는지 보는 것은 다른 일이라는 걸, 두 번째로 배운다(첫 번째는 §25.1 의 CI).

#### 무엇으로 갈았나

계정에 남은 대화 모델은 여섯이었다(llama 계열은 전부 사라졌다). 실제 `router.py` 프롬프트로
재 봤다 — 축약한 프롬프트로 재면 프롬프트가 이미 답을 주는 항목까지 모델 실력으로 오해한다.

| 재 본 것 (2026-08-19 수요일 기준) | `gpt-oss-120b` | `qwen3.6-27b` |
|---|---|---|
| "2시부터 5시까지" → `end` | ✅ 14:00~17:00 | ✅ |
| "교수님 미팅 잡아줘" → 되묻기 | ✅ "언제로 잡을까요?" | ✅ |
| 이름을 `participants` 로 분리 | ✅ title="회의" | ✅ |
| "다음 주 화요일" | ✅ **8/25** | ❌ 8/26 |

`openai/gpt-oss-120b` 로 갈았다. 무료 티어 한도는 **1,000 req/day · 8,000 TPM** 이고,
폴백은 주 경로가 흔들릴 때만 부르므로 이 한도로 충분하다(프롬프트가 ~1.5k 토큰이라
분당 다섯 번쯤 된다).

#### 거절에 되묻지 않는다

갈아 끼운 뒤 한 가지가 남았다. gpt-oss-120b 는 "나 그때 다른 일정 있어서 안 될 것 같아"
에도 `ask: "언제 일정이 있나요?"` 를 붙였다. **거절인데 되묻는다.**

되묻기 규칙이 "시각을 못 정하면 물어라" 까지만 말하고 있었기 때문이다. 그 말은 **요청이
있었다는 전제** 위에 서 있는데, 거절은 요청이 아니다. 사람이 안 된다고 말했는데 언제
되냐고 되물으면, 못 알아들은 것보다 나쁘다 — 못 알아들은 척하는 것이 된다.

프롬프트에 `NOTHING TO FILE` 을 더했다. 요점은 규칙 하나가 아니라 **침묵도 정답이라는
것을 명시**하는 데 있다(`lib/conversation/suggestion.ts` 가 화면 쪽에서 오래전부터
지켜 온 것과 같은 태도다 — "이 파일의 기본값은 아무것도 하지 않는다 이다").

실제 경로(Gemini → 폴백 Groq)로 일곱 가지를 재서 **7/7**:

| 넣은 말 | 기대 | 결과 |
|---|---|---|
| "나 그때 다른 일정 있어서 안 될 것 같아" | 조용 | items 0 · ask 없음 |
| "그때는 안 돼" · "고마워!" · "오늘은 못 볼 것 같아" | 조용 | 셋 다 items 0 · ask 없음 |
| "교수님 미팅 잡아줘" | 되묻기 | "언제 잡을까요?" |
| "회의 하나 잡아줘" | 되묻기 | "회의 일정을 언제로 잡을까요?" |
| "내일 오후 2시부터 5시까지 캡스톤 리뷰" | 항목 | meeting 1건 · ask 없음 |

> 이 시험이 도는 동안 Gemini 가 **실제로 두 번 무너졌다**(503 → 재시도 → 타임아웃).
> 로그에 `주 Provider(gemini) 실패 … → groq 로 넘긴다` 가 찍혔고, 그런데도 위 표는
> 전부 맞았다. 폴백이 살아 있다는 것이 무슨 뜻인지 이보다 잘 보여 주기 어렵다 —
> 일주일 전이었다면 이 일곱 줄 중 셋이 "일시적인 오류가 발생했어요" 였을 것이다.

**시험으로 감싸지 않는다.** 이건 로직이 아니라 문안이고, §24.5 에서 정한 것과 같은
이유다 — 문안을 시험으로 묶으면 문장을 다듬을 때마다 시험을 고치게 된다. 모델이 바뀌면
`scripts/check_models.py` 가 알려 주고, 그때 위 일곱 줄을 손으로 한 번 다시 돌린다.

### 25.5 화면이 서버보다 앞서 가 놓고 아무 말도 하지 않던 자리들

버튼 113개를 핸들러까지 따라갔다. **핸들러가 없는 버튼은 0건**이었다. 문제는 전부
'눌린 다음' 에 있었다.

이 앱의 쓰기는 전부 낙관적이다 — 먼저 그리고 뒤에 보낸다. 빠른 대신 값이 하나 붙는데,
그 값을 아무도 치르지 않고 있었다. 특히 **RLS 는 오류를 주지 않는다**: 정책이 행을
안 보이게 하므로 "조건에 맞는 행이 없다" 와 같아지고, PostgREST 는 200 + 빈 응답으로
답한다. 그래서 남의 일정 이름을 고치면 내 화면에서만 바뀌었다가 다음 스냅샷에 슬며시
되돌아갔다 — 사용자는 자기가 무엇을 잘못했는지 끝내 알 수 없었다.

- `touchedRows()` — `return=representation` 으로 **실제로 손댄 행 수**를 본다. 0행이면 못 한 것이다.
- `writeError` 하나를 두고 여섯 자리에서 되돌린다: 일정 확정·이름·삭제 / 참여자 초대·제외·참석여부.
  삭제는 일정만이 아니라 **참여자·방·말까지** 되살린다(일정만 되살리면 그 대화를 잃는다).
- 되돌렸다는 사실과 이유를 화면에 세운다. 스스로 사라지지 않는다 — 저장이 안 됐다는 말은
  스쳐 지나가면 안 되는 말이다.

**요약 버튼**은 실패했을 때 `summary` 가 없는 채 `sumOpen` 만 켜져, 아무것도 열리지 않은
상태로 버튼만 '요약 닫기' 가 됐다(닫을 것도 없이). 라벨은 정말로 열렸을 때만 '닫기' 라 하고,
못 했으면 왜 못 했는지 네 갈래로 나눠 말한다.

**요청 취소**는 결과를 버리고 있었다. 못 물렀는데 화면만 '취소됨' 이 되어, 상대에게는
요청이 그대로 남았다.

### 25.6 두 계정으로 실제로 눌러 봤다 — 그리고 이름이 조용히 덮이고 있었다

계정 둘(`@hoo743` · `@fapp1004`)이 이어진 실제 프로젝트에서 브라우저로 눌러 확인했다.

#### 확인된 것

- **캡처 → 일정**: "내일 오후 2시부터 5시까지 캡스톤 리뷰 회의" → 일정 패널에
  `8월 20일 (목) · 14:00 – 17:00`. §25.3 의 `end` 수정이 실제 화면까지 닿았다
  (수정 전이라면 14:00–15:00).
- **되묻기 왕복**: "교수님 미팅 잡아줘" → "언제 잡을까요?" → "내일 3시" → 8/20 15:00 이 앉았다.
- **되돌리기**: 캘린더에서도 실제로 사라진다.
- **요약**: 백엔드를 끈 채 누르면 **"AI 에 닿지 못했어요"** 한 줄이 서고, 켜고 누르면
  네 갈래(최근 대화·결정·미정·다음)가 채워진다. §25.5 의 수정이 양쪽 다 확인됐다.
- **전원 동의 → 확정**: 제안 카드가 걷히고 일정이 제안된 시각으로 앉는다.
  상단의 '답을 기다리는 것' 줄도 함께 사라진다.
- **`0016`**: 세 가지 우회를 전부 막는다 —
  세 사람짜리 `dm_key`(check constraint) · 남들끼리의 방(rooms_insert) ·
  1:1 방에 제3자 넣기(members_insert).
- 콘솔에 하이드레이션 경고도 React 오류도 없다.

#### 되돌림 여섯은 화면으로 도달할 수 없다 — 그걸 몰랐다

§25.5 에서 고친 되돌림을 "두 계정으로 확인하면 된다" 고 적었는데 **틀렸다.**
`EventPanel.tsx` 는 `me?.role !== "owner"` 면 이름 바꾸기 UI 를 아예 렌더하지 않는다.
삭제·초대·제외도 같다. **UI 가 이미 막고 있어서 정상 사용으로는 그 경로에 닿지 않는다.**

그래서 대신 **그 방어가 딛고 선 전제**를 쟀다. 페이지의 supabase 클라이언트로 직접:

| 시도 | error | 손댄 행 |
|---|---|---|
| 남의 일정 이름 바꾸기 | **null** | **0** |
| 내 일정 이름 바꾸기(대조군) | null | 1 |
| 남의 일정 지우기 | **null** | **0** |

**RLS 는 오류를 주지 않는다. 0행으로 조용히 지나간다.** 수정 전 코드
(`await rest(...); return true`)는 그 자리에서 무조건 "됐다" 고 말했다. 단위 시험 7개가
"0행이면 되돌린다" 를 재고, 이 실측이 "실제 서버에서 0행이 온다" 를 보인다 — 둘이
맞물려야 완결이다. 어느 한쪽만으로는 아무것도 증명하지 못한다.

#### 그러다 나온 것 — 대화 한 마디가 일정 이름을 덮었다

"제육먹방" 방에서 [동의] 를 눌렀더니 일정 이름이 **"20시"** 가 됐다.

서버는 확정할 때 제안의 이름을 일정에 반영한다(`respond_to_proposal` —
`title = coalesce(pr.title, ev.title)`). 그 자체는 합리적이다. 문제는 **화면이 아무 이름이나
넣고 있었다**는 것이다:

```ts
await proposeTime(eventId, p.date, 60, p.title);   // p.title = AI 가 "그럼 20시 ㄱㄱ" 에서 뽑은 말
```

`p.title` 은 **그 한 마디**의 요약이지 이 자리의 이름이 아니다. 그래서 친구와 시간을
정하고 동의를 누르면, 공들여 지은 이름(`lib/roomName.ts` — "자리의 이름은 다른 것과
어떻게 다른가로 짓는다")이 대화 한 조각으로 덮였다. 사용자는 이름을 바꾼 적이 없고
누가 바꿨는지도 모른다.

이름을 넘기지 않는 것으로 고쳤다. 이름을 고치는 **정식 길은 이미 있다** — 요약이 뽑은
이름을 사람에게 물어보는 제안이다(`이 자리를 … 라고 부를까요? [그러기] [그대로]`,
실제로 동작하는 것을 확인했다). 두 길이 있으면 그중 하나는 반드시 몰래 바꾸는 길이 된다.

> §0 이 "AI는 인터페이스를 지배하지 않는다. 조용히 돕는다" 고 적어 둔 자리에서,
> AI 가 조용히 이름을 바꾸고 있었다. 조용한 것과 몰래 하는 것은 다르다.

### 25.7 확인

`tsc` 0건 · 프론트 시험 **83개** · `next build` 통과(환경변수 없이도) · `pytest` 37개 ·
`scripts/check_models.py` 통과 · **두 계정이 이어진 실제 프로젝트에서 브라우저로 확인**(§25.6).

시험이 78 → 76 으로 줄었다가 83 이 됐다. 줄어든 둘은 없어진 슬라이스를 재던 것이라
함께 걷었고(없는 것을 재는 시험은 통과해도 아무것도 지키지 않는다), 늘어난 일곱은
`writeback.test.ts` 다 — **되돌림은 눈으로 볼 수 없기 때문에** 시험으로만 지킬 수 있다.


---

## 26. 그룹, 그리고 사라지던 말 하나 (2026-08-19)

> §25 가 "만들지 않은 것을 있다고 말하던 자리" 를 걷어낸 절이라면, 여기는 **처음으로 새로
> 만든 것**이 있는 절이다. 그래서 스스로에게 물었다 — 이건 §25 에서 걷어낸 것들과 무엇이
> 다른가. 답: 그룹은 **화면이 이미 필요로 하고 있었다**. '새 자리' 를 만들 때마다 같은
> 사람들을 다시 골랐고, `roomName.ts` 는 "같은 사람들이 다시 모인다" 를 전제로 이름을
> 짓고 있었다. 없던 필요를 만든 것이 아니라, 이미 있던 필요에 자리를 준 것이다.

### 26.1 그룹 — 사람의 묶음은 일정보다 오래 산다 (`0017`)

```
groups ─< group_members >─ auth.users
   └─< events (group_id)
```

- 그룹 일정을 만들면 **멤버 전원이 참여자가 된다**(`event_group_fanout`). 사람을 다시
  고르는 일이 없어지는 것 — 그게 이 표가 존재하는 이유다.
- 트리거 이름을 `event_group_fanout` 으로 둔 것은 우연이 아니다. 같은 시점의 트리거는
  **이름 순서로** 돈다. `event_bootstrap`(b)이 먼저 방을 만들어야 여기서 넣는 참여자들이
  그 방의 멤버가 된다. b < f 라 순서가 보장된다 — 우연에 기대지 않으려고 적어 뒀다.

정한 것 둘, 그리고 그 이유:

| 정한 것 | 왜 |
|---|---|
| **동기화는 자동이 아니다** | 이미 지나간 자리에 사람을 소급해 앉히는 것은 조용히 할 일이 아니다. `sync_group_calendar` 는 멱등하고, 손잡이는 화면에 있다 |
| **멤버에서 빠져도 이미 참여 중인 일정에서는 걷지 않는다** | 그룹으로 들어온 참여자와 개별 초대를 서버가 구별할 수 없다. 추측으로 남의 약속을 지우는 것보다 남겨 두는 편이 낫다 |

#### 새 표를 만들다 같은 구멍을 낼 뻔했다

`0001` 의 `events_insert` 는 `owner_id = auth.uid()` 만 본다. 그대로 두면 **남의 그룹 id 를
적어 넣을 수 있고**, 그러면 fanout 트리거가 그 그룹 사람들 전원을 내 일정의 참여자로
앉힌다 — 초대한 적 없는 사람들의 달력에 자리가 서고 그 방의 대화까지 열린다.

**§25.x 에서 `dm_key` 를 두고 고친 것과 정확히 같은 종류다**: 클라이언트가 지키는 약속을
서버가 모르는 자리. 새 칸을 만들 때마다 물어야 할 질문이 하나 있다는 뜻이다 —
*"이 칸에 아무 값이나 넣으면 무슨 일이 생기는가."*

### 26.2 사라지던 말 하나

되묻기를 깊게 재다 나왔다.

```
"내일 3시 회의 잡고 교수님 면담도 잡아줘"
  → items: [meeting 회의]      ask: null
     교수님 면담은 items 에도 ask 에도 없다.        (3/3 재현)
```

원인이 **세 겹**이었고, 셋 다 같은 규칙의 서로 다른 표현이었다 — *"뽑았으면 묻지 않는다"*.

| 어디 | 무엇 |
|---|---|
| 프롬프트 | `Never do both for the same thing` 을 모델이 **메시지 단위**로 읽었다 |
| `chat.py` | `ask = None if items else ...` — 항목이 있으면 물음을 통째로 덮었다 |
| `page.tsx` | 항목이 있으면 `setAsk(null)` — 화면에서 또 한 번 덮었다 |

규칙 자체는 옳다. 같은 것을 두고 항목과 질문이 함께 서면 안 된다. 다만 그 규칙은
**항목 단위**여야 했다. 세 곳에 흩어져 있었기 때문에 한 곳을 고쳐도 다른 두 곳이 덮었다.

> 같은 것을 두 번 묻는 것보다 나쁘다. **두 번 물으면 귀찮을 뿐이지만, 사라지면 없어진
> 줄도 모른다.**

고친 뒤: `items: [회의 8/20 15:00]` · `ask: "교수님 면담은 언제로 잡을까요?"` (3/3)

### 26.3 중요도 — 이미 뽑고 있었다, 앉을 자리가 없었을 뿐 (`0018`)

`priority`(high/mid/low)는 처음부터 `ParsedItem` 에 있었고 화면도 영수증까지 들고 왔다.
그런데 `events` 에 칸이 없어 저장되지 않았다 — **뽑아 놓고 버리는 값**이었다.

왜 이제 필요해졌나: 시간이 겹칠 때 사람이 알고 싶은 것은 "겹쳤다" 가 아니라
**"무엇을 포기해야 하나"** 다. 그 판단에는 두 일정의 무게가 있어야 한다.

**`null` 과 `'mid'` 는 다르다.** 비었으면 아무도 말하지 않은 것이고, `mid` 는 보통이라고
말한 것이다. 기본값을 두지 않는 이유가 그것이다 — 말하지 않은 것을 말한 것으로 바꾸면
겹쳤을 때 "둘 다 보통이니 아무거나" 라는 **틀린 근거**가 생긴다.

#### 어려운 쪽은 언제 묻는가가 아니라 언제 묻지 않는가

사람은 겹치는 자리를 일부러 잡는다(대기 시간, 온라인 참석, "가면 좋고"). 매번 물으면
비서가 아니라 알림이고, 알림은 곧 꺼진다. `lib/clash` 가 그 선을 쥔다:

| 무게 | 한다 |
|---|---|
| 새것이 덜 중요 | 중요한 자리를 건드린다 — 물을 값이 가장 크다 |
| 새것이 더 중요 | 밀어낼 것이 있다 — 알려 줄 값이 있다 |
| 같다 / 아무도 말 안 함 | 저울질할 근거가 없다 — **조용히 둔다** |

마지막 갈래가 이 파일의 핵심이다. 근거 없이 묻는 것은 묻지 않는 것보다 나쁘다 —
답할 수 없는 질문을 받으면 그 다음 질문도 믿지 않게 된다.

**아무것도 옮기지 않는다.** 낮은 것을 밀어내지도, 높은 것을 대신 확정하지도 않는다.

### 26.4 헷갈리던 화면 넷

| 자리 | 무엇이 문제였나 | 어떻게 |
|---|---|---|
| 함께하는 일정 | 칩이 제목만 들어 어느 것이 지났는지 손을 올려야 알았다 | 칩이 날짜를 든다(오늘·내일·어제·M/D). 지난 것은 물러난다. 다가오는 것이 앞 |
| 날짜 구분 | 낱말 하나만 떠 있어 경계로 안 읽혔다 | `──── 어제 ────`. **점선이 아니라 직선** — 점선은 이 화면에서 '아직 정해지지 않은 것' 이다(제안·초대 대기) |
| 내 말 / 남의 말 | 이름 색 하나뿐이었고, 이어 말하면 이름조차 다시 안 적어 그 단서마저 사라졌다 | 왼쪽에 1px 세로 선. **보라를 쓰지 않는다** — 그건 AI 의 언어다(§0) |
| 제안 카드 | 사람 수만큼 세로로 자라 대화를 밀어냈다 | 사람 줄을 접었다('누가?'). 합친 말은 이미 바로 아래 한 줄에 있었다 |

그리고 타임테이블 셋:

- **`00:00` 이 잘려 보이던 이유** — 시각 글자는 선 위에 반쯤 걸터앉는다(`translateY(-0.5em)`).
  맨 위 눈금에는 걸터앉을 위가 없어 절반이 상자 밖으로 나갔다. 스크롤 상자에 그만큼
  여백을 줬다. 첫 줄만 특별 취급하지 않은 이유: 다음에 좌표계를 손대는 사람이 그걸 모른다.
- **막대 대신 흐름** — 하루는 이어지는 것인데 스크롤 막대가 '여기서 끝' 이라고 말했다.
  막대를 지우고 위아래를 옅게 흐린다.
- **하루의 끝에서 실제로 이어진다** — 끝에 닿은 뒤 **한 번 더** 굴리면 다음 날로.
  닿자마자 넘기지 않는 이유: 스크롤이 미끄러질 때마다 날이 바뀐다.

### 26.5 확인

`tsc` 0건 · 프론트 시험 **93개** · `next build` 통과 · `pytest` 37개.

실제 API 로 돌린 것:

| 무엇 | 결과 |
|---|---|
| 캡처 바 프롬프트 10건 | 10/10 (끝 시각 · 다중 추출 · 새벽 방지와 명시적 새벽 · 상대 날짜) |
| 되묻기 10건 | 10/10 (결함 수정 후). 날짜만 있으면 "내일 몇 시로?" 로 **빠진 것만** 묻는다 |
| 중요도 6건 | 6/6. **"중간고사"·"점심" 에는 등급을 지어내지 않았다**(null) |

마지막 줄이 가장 중요하다. 지어낸 중요도는 나중에 사람을 방해할 이유가 되고, 그 이유는
틀린 것이다.

> **눈으로 못 본 것**: 26.4 의 시각 변경들은 브라우저 확장이 먹통이라 화면으로 확인하지
> 못했다. 워크스페이스는 CSS 를 인라인으로 싣기 때문에 **여덟 규칙이 실제 응답에 실려
> 나가는 것까지는** 확인했지만, 그건 '있다' 이지 '보기 좋다' 가 아니다. 다음에 여는 사람이
> 먼저 볼 일이다.


---

## 27. 눈으로 보고 나서야 보인 것 (2026-08-19)

> §26.5 의 마지막 줄에 "눈으로 못 본 것" 을 적어 두었다. 확장이 돌아와 그 확인을 했고,
> 적어 둔 시각 변경들은 **다섯 개 다 의도대로 서 있었다**. 정작 나온 것은 다른 것들이다 —
> 화면을 눌러 보지 않으면 나올 수 없는 종류. 그래서 이 절은 §26 의 부록이 아니라 별개다.

### 27.1 만들 수는 있는데 지울 수가 없었다

시험 흔적을 지우려다 알았다. `deleteEvent`(remote) 도 `removeSchedule`(store, 되돌리기까지)
도 다 있는데, **화면에서 거기 닿는 길이 캡처 직후 영수증의 '되돌리기' 하나뿐**이었다.
그 한 줄이 사라지고 나면 일정은 영영 지워지지 않았다.

배선이 다 되어 있어서 코드를 읽는 쪽에서는 '있는 기능' 으로 보였다는 게 이 결함의 성질이다.
**닿는 길이 없는 기능은 없는 기능이다.**

붙이면서 정한 것:

| 정한 것 | 왜 |
|---|---|
| 닫기(×) 옆이 아니라 **패널 맨 아래** | 파괴적인 손잡이가 매일 누르는 손잡이 옆에 서면 언젠가 잘못 눌린다 |
| **한 번 더 묻는다** (그룹 없애기는 안 묻는다) | 그룹은 없애도 일정이 남지만, 일정은 방과 그 안의 말까지 함께 지운다(cascade). 되돌릴 수 없는 것만 묻는다 |
| 경고창을 띄우지 않는다 | 그 자리에서 한 번 — 말 지우기(`Chat.tsx`)와 같은 몸짓 |
| 빨간 버튼을 두지 않는다 | 위험은 색이 아니라 **되묻는 것**으로 말한다. 색으로 말하면 이 화면에서 가장 눈에 띄는 것이 '삭제' 가 된다 |

주최자에게만 보인다 — 서버도 주최자만 받는다(`0001 events_delete`). 안 되는 것을 눌리게
두면 누른 사람은 자기가 뭘 잘못했는지 묻게 된다.

### 27.2 일정 대화의 입력칸이 화면 밖에 있었다

말을 걸어 보려다 알았다. 패널은 `max-height` 로 잘려 있는데 안에 든 것이 그보다 114px
컸고, `overflow` 가 `visible` 이라 **넘친 만큼이 아래에서 조용히 사라졌다.** 그 사라진
자리에 있던 것이 메시지 입력칸이다. 창 높이가 약 950px 이하면 **일정 대화에서 말을 칠 수
없었다** — 대화가 이 제품의 중심인데.

범인은 한 줄이었다:

```css
.rmg-evsplit[data-split="true"] { display: grid; grid-template-columns: … }
                                              /* ↑ 행이 없다 = auto = max-content */
```

칸(column)만 정하고 행(row)을 정하지 않으면 암묵적 행은 `auto`, 곧 **내용만큼 자란다.**
안쪽의 `.rmg-drawer-msgs` 는 `overflow-y: auto` 로 스크롤될 준비가 되어 있었지만,
조상 중 하나가 내용만큼 자라 버리면 그 스크롤은 영원히 발동하지 않는다.

> 말 칸이 스크롤되려면 그 **조상 어디에도** '내용만큼 자라는 칸'이 없어야 한다.
> `min-height: 0` 을 세 겹이나 챙겨 놓고도 그리드 한 곳에서 새어 나갔다.

`grid-template-rows: minmax(0, 1fr)` 한 줄로 닫혔다.

### 27.3 '오늘' 을 눌러도 오늘로 돌아오지 않았다

캘린더에서 며칠 돌아다니다 레일의 **오늘**을 눌렀는데 그 날짜가 그대로 남았다. 그리고 그
위에 대고 화면은 "오늘의 맥락"·"오늘은 비어 있어요" 라고 말한다 — **이름이 오늘인 자리가
오늘이 아닌 하루를 오늘이라고 부르고 있었다.**

날짜는 뷰끼리 나눠 쓰는 상태 하나(`calDay`)인데, 레일은 뷰만 바꾸고 그 상태는 두었다.
돌아오는 곳(`today`)에서만 오늘로 되돌린다 — 다른 뷰의 날짜 이동은 그대로 살려 둔다.

### 27.4 전날로 넘어가면 23시가 아니라 00시에 서 있었다

§26.4 에 "다음 날은 위에서부터, 전날은 아래에서부터 — 읽던 방향이 이어진다" 고 적어 두었다.
날은 넘어갔지만(8/19 → 8/18 확인) **자리는 늘 위였다.**

`onWheel` 안의 `requestAnimationFrame` 이 React 의 리렌더보다 먼저 돌아 **옛 화면 위에**
자리를 잡았고, 뒤늦게 `useEffect([day])` 가 그것을 덮었다. 자리를 잡는 코드가 두 곳에 있으면
그 둘은 경쟁한다. 한 곳(`useEffect`)으로 모으고, 굴려서 넘어왔다는 사실만 ref 로 건넸다.

확인: 8/18 → 위로 → 8/17 이고 `scrollTop = 842 = max`(23시). 아래로 → 8/18 이고 `0`.
곧바로 한 번 더 굴려도 하루만 넘어간다(320ms 잠금).

### 27.5 알약이 띠가 되어 있었다

그룹 화면의 손잡이 셋(`사람 부르기`·`지금 맞추기`·`그룹 없애기`)이 패널 폭을 꽉 채운 띠로
서 있었다. `.rmg-ppl-act` 는 알약인데, 세로로 쌓이는 flex 칸에 놓이면 기본값 `stretch` 가
칸 폭만큼 늘린다. 결과적으로 **이 화면에서 가장 크고 눈에 띄는 것이 '그룹 없애기'** 였다.

설명 한 줄도 가운데로 몰려 왼쪽에 선 버튼과 축이 어긋나 있었다 — 둘이 서로 다른 것에 대해
말하는 것처럼 읽힌다. 손잡이 옆에 붙는 주석은 손잡이와 같은 선에서 시작한다.

### 27.6 확인

`tsc` 0건 · 프론트 시험 **93개** · `pytest` 37개.

눈으로 본 것 — §26.4 의 다섯은 모두 의도대로였다:

| 본 것 | 결과 |
|---|---|
| 날짜 구분 `──── 오늘 ────` | 양쪽 직선 1px(`--hair`), 낱말은 배경을 깔고 그 위에 붙어 있다(sticky) |
| 내 말 표식 | 왼쪽 1px 세로선 + 이름이 짙어짐. **보라를 쓰지 않았다** |
| 타임테이블 `00:00` | 잘리지 않는다. 막대 없이 위아래가 옅게 흐린다 |
| 하루의 끝에서 이어짐 | 넘어간다 (다만 27.4) |
| 그룹 화면 | 선다 (다만 27.5) |

**시험 흔적은 지웠다** — 일정 `권한 시험 준비`(방·말 4줄 포함)와 그룹 `캡스톤 팀`.
새로 붙인 27.1 의 손잡이로 지웠으니, 그 손잡이도 함께 확인된 셈이다.

> 이번에 배운 것 한 줄. **§26.5 에서 "확인했다" 고 적은 것은 "응답에 CSS 규칙이 실려
> 나갔다" 였지 "화면이 그렇게 선다" 가 아니었다.** 27.1~27.5 중 어느 것도 코드를 읽어
> 나오지 않았고, 다섯 다 화면을 눌러 보는 순간 나왔다.


---

## 28. 같은 두 사람에게 대화가 둘이었다 (2026-08-19)

### 28.1 무엇이 흩어져 보였나

1:1 대화에서 '함께하는 일정' 칩 하나를 누르면 **화면 전체가 그 자리의 방으로 갈렸다.**
읽고 있던 말은 사라지고, 같은 사람과의 **다른** 대화가 그 자리에 섰다.

일정 자체는 흩어져 있지 않았다 — 어디서 눌러도 열리는 곳은 하나(`EventPanel`)다.
흩어져 **보인** 것이다. 이유:

| | |
|---|---|
| 같은 두 사람에게 대화가 둘이다 | 둘만의 방과 그 자리의 방. 데이터 구조상 맞지만, 사람에게는 "얘랑 얘기하는 곳"이 하나여야 자연스럽다 |
| 하나를 열면 다른 하나가 **말없이** 사라진다 | 바뀐 것이 아니라 잃어버린 것으로 읽힌다 |
| 되돌아가는 길이 한 방향뿐이었다 | 사람 → 자리 는 있는데, 자리 → 사람 이 없었다. 캘린더에서 자리를 열면 그 사람과의 대화로 갈 길이 아예 없다 |

세 번째가 특히 그렇다. **길이 한 방향으로만 나 있으면 그 공간은 미로처럼 느껴진다.**

### 28.2 자리는 대화 위에 얹힌다

칩을 누르는 것은 이제 '건너가기' 가 아니라 **'펼치기'** 다. 대화는 그대로 아래에 남고,
칩 바로 아래에 자리 한 칸이 열린다.

거기 두는 것 셋: **언제 · 누구 · 내가 가는가.** 자리 하나를 두고 사람이 대개 알고 싶은
것이 그 셋이고, 그 셋이면 대개 끝난다. 참석 여부(RSVP)를 여기 둔 것이 핵심이다 —
답하려고 방을 옮길 이유가 사라진다.

**여기 두지 않은 것**도 정해 두었다: 시간 후보(제안)와 하루 겹쳐 보기는 그 방에 남긴다.
여럿이 시간을 맞추는 일은 넓은 자리가 필요하고, 끌고 오면 이 칸이 또 하나의 방이 된다 —
방을 없애려다 방을 하나 더 만드는 셈이다.

그 방으로 건너가는 것은 이제 **한 줄이고, 선택이다.** 말이 쌓여 있으면 그 수를 대고
(`이 자리의 대화 3`), 비어 있으면 갈 이유 쪽을 말한다(`시간 맞추러 가기`) — '대화 0' 은
갈 이유가 없어 보이는데 실제로는 시간을 맞추는 자리다.

펼친 자리는 **`page` 가 쥔다.** 패널 안에 두면 방에 다녀오는 동안 언마운트되어 접힌 채로
돌아온다. 돌아왔을 때 보던 자리가 그대로 펼쳐져 있어야 '다녀온 것'이지 '튕겨 나온 것'이
아니다.

### 28.3 그리고 반대 방향

둘만의 자리를 방에서 열었을 때, `이 일정의 대화` 옆에 한 줄을 둔다 — **`○○ 와 둘만의 대화 ›`**.
이제 두 대화가 서로를 가리킨다.

셋 이상이면 그리지 않는다. 그 방에는 여기 없는 사람이 있어서 '둘만의 대화' 라는 말이
성립하지 않고, 누구와의 대화인지도 하나로 정해지지 않는다.

사람 쪽에서 들어왔으면 그리지 않는다 — 위의 `‹ 이름` 이 이미 같은 길이다. **같은 곳으로
가는 길이 한 화면에 둘 있으면 그 둘이 다른 곳으로 갈 것처럼 보인다.**

### 28.4 확인

`tsc` 0건 · 프론트 시험 93개 · `pytest` 37개 · `next build` 통과.

화면으로 밟은 길:

| 밟은 것 | 결과 |
|---|---|
| 사람 → 칩 | 그 자리에서 펼쳐지고, **1:1 대화는 그대로 남는다** |
| 다른 칩 | 칸이 제자리에서 갈린다(칩 표식도 따라온다). 지난 자리도 고르면 또렷해진다 |
| `이 자리의 대화 3 ›` → `‹ 이름` | 다녀와도 **같은 자리가 펼쳐진 채**다 |
| 캘린더 → 자리 → `fapp1004 와 둘만의 대화 ›` | 그 사람의 1:1 로 가고, **그 자리가 펼쳐진 채로** 선다 |
| 사람에서 들어온 자리 | 되돌아가는 줄을 그리지 않는다(`‹ fapp1004` 와 겹치므로) |

**보지 못한 것**: 주최자가 아닌 쪽의 참석 여부(RSVP) 줄은 두 계정을 함께 띄우지 못해
화면으로 확인하지 못했다. 표시 조건과 마크업은 `EventPanel` 의 것을 그대로 옮겼다.

**따로 본 것**: 1:1 말 칸에는 스크롤 막대가 그대로 서 있다. 시간표는 §26.4 에서 막대를
지우고 흐름으로 바꿨는데 여기는 아니다 — 다만 대화에서는 '얼마나 거슬러 올라가는가' 가
쓸모 있는 정보라 일부러 두었다. 바꾸려면 그 값과 함께 판단할 일이다.


---

## 29. `/clear` 를 그대로 옮길 수 없었던 이유 (2026-08-19)

### 29.1 방을 비운다는 것이 여기서는 다른 뜻이다

`/clear` 를 넣어 달라는 말은 쉬웠는데, 옮겨 오는 순간 갈라졌다.

쓰던 도구들에서 `/clear` 는 **새로 시작한다**는 뜻이다. 거기서는 상대가 없어서 '새로
시작' 과 '지우기' 가 같아 보였을 뿐이다. 여기 방에는 사람이 하나 더 있다.

서버는 이미 그 선을 그어 두었다(`0008`): 남의 말은 지울 수 없고, 내 말조차 soft delete 다.
*"대화의 앞뒤가 통째로 사라지면 남은 사람들이 맥락을 잃는다."* 그러니 `/clear` 를 '비우기'
로 만들면 **상대의 기록을 지우는 기능**이 되고, 그건 요청받은 것이 아니다.

그래서 **접기**로 만들었다. 지우지 않고, 내 화면에서만, 언제든 되돌릴 수 있게.

| 정한 것 | 왜 |
|---|---|
| 표시는 이 기기에만 (localStorage) | 서버에 두면 "이 사람이 여기서 대화를 접었다" 가 값이 된다. 접는 것은 읽는 방식이지 관계에 대한 사실이 아니다 |
| 경계는 **그 시각까지** 접는다 | '이상' 으로 두면 방금 접은 마지막 말이 남아, 접기가 안 먹은 것처럼 보인다(시험으로 못 박음) |
| 접힌 자리에 한 줄을 남긴다 | `이전 대화 3개 · 다시 보기`. 지운 것이 아니므로 되돌리는 길이 곧 그 증거다 |
| 접어도 **AI 는 다 읽는다** | 아래 29.2 |
| 빈 칸의 말이 바뀐다 | 접고 나서 "아직 대화가 없어요" 는 거짓말이다. "여기서부터 새로 시작해요" |

### 29.2 접기는 AI 의 기억이 아니다

`personMsgs` 를 그대로 접었다면 AI 가 읽는 것도 함께 줄었다. 그러면 이렇게 된다:

> 같은 방에 있는 두 사람 중 한쪽에는 시간 후보가 뜨고 한쪽에는 안 뜬다. 왜 그런지는
> 아무도 모른다 — 한쪽이 자기 화면을 정리했기 때문이다.

방은 함께 쓰는 것이고, **내 쪽 보기 설정이 공유된 판단을 바꾸면 안 된다.** 그래서 화면에
내려보내는 목록과 분석에 넣는 목록을 갈랐다(`personMsgs` / `personAllMsgs`).

### 29.3 빗금은 지름길이지 유일한 문이 아니다

- `/clear` — 여기까지 접기 · `/summary` — 정리(일정 방에서만, 이미 버튼이 있는 것)
- 목록은 **입력칸 위에 한 칸**으로 뜬다. 팝업으로 덮으면 무엇에 대고 명령하는지가 흐려진다.
- 빗금은 **맨 앞에서만** 뜻을 갖는다("3/4 쯤" 을 쓰다가 목록이 열리면 그게 방해다).
- 아는 말이 아니면 그냥 말로 보낸다. 사람이 `/` 를 쓸 자유를 뺏지 않는다.

여기 있는 것은 모두 다른 곳에도 손잡이가 있다. 외워야만 닿는 기능은 그것을 아는 사람에게만
있는 기능이다 — §0 이 하지 말라고 한 '소프트웨어를 조작하게 만드는' 쪽이다.

### 29.4 오른쪽 클릭 — 그리고 세 번째 이름 (`0019`)

핸들(@fapp1004)은 **찾기 위한** 이름이고, 표시 이름은 그 사람이 **스스로 정한** 이름이다.
둘 다 필요하지만 둘 다 내 것이 아니라, 목록에서 "@fapp1004" 를 보고 그게 누구였는지 한 번
더 떠올려야 한다. 그래서 세 번째 이름을 둔다 — **내가 부르는 이름.**

- **나만 읽는다.** RLS 의 select 가 `owner_id = auth.uid()` 뿐인 것이 이 기능의 전부다.
  `person_id = auth.uid()` 를 넣는 순간 '남이 나를 뭐라고 부르는지 아는' 전혀 다른 물건이 된다.
- 화면에도 그렇게 적는다("나만 보여요"). 그 한 줄이 없으면 아무도 안 쓴다 — 상대에게
  보일까 봐.
- 상대가 자기 이름을 바꿔도 흔들리지 않는다. 원래 이름은 `realName` 으로 물러난다.
- **표에 둔 이유**: 이건 보기 설정이 아니라 내가 아는 사실이다. 기기를 바꿨다고 아는 사람이
  모르는 사람이 되면 안 된다. (반대로 29.1 의 접기는 보기 설정이라 기기에 남긴다.)

메뉴에 넣지 않은 것: '대화 열기'. 줄을 그냥 누르면 되는 일을 메뉴에 또 적으면 읽는 사람은
둘이 다른 일인 줄 안다.

오른쪽 클릭은 숨은 몸짓이라, `···` 안에도 같은 곳으로 가는 길을 하나 두었다.

**곁들여 고친 것** — 복사가 조용히 실패하던 자리. `navigator.clipboard?.writeText(x).then(…)`
은 클립보드가 없을 때 물음표가 사슬 전체를 끊어 **아무 일도 일어나지 않고 아무 말도 하지
않았다.** 누른 사람은 자기가 잘못 눌렀다고 생각한다. 옛 방법으로 한 번 더 시도하고, 그래도
안 되면 안 됐다고 말한다(`lib/clipboard.ts`).

### 29.5 한 번 눌러 닿는 거리

'오늘' 화면 왼쪽의 그날 일정 목록은 **읽을 수만 있었다.** 보고 나서 레일의 캘린더를 누르고,
그 날을 다시 찾아 들어가야 했다 — 이미 눈앞에 있는 것을 찾으러 가는 걸음이다.

이제 한 번 누르면 캘린더로 가면서 그 일정이 열린다. 다만 그 길에 함정이 하나 있었다:

> 화면을 옮기면 오른쪽 칸을 비우는 효과가 있다(캘린더에서 연 일정이 '오늘'·'사람' 까지
> 따라다니지 않게). 그 효과가 **일부러 데리고 간 일정까지** 지웠다.

규칙은 옳다. 다만 '화면을 옮기는 것 자체가 그것을 보러 가는 일' 인 경우를 몰랐다. 뜻을 ref
하나로 건네고, 그 효과가 한 번만 받아 쓰게 했다. §26.2 와 같은 종류다 — **규칙이 아니라
그 규칙의 단위가 틀렸던 것.**

### 29.6 확인

`tsc` 0건 · 프론트 시험 **99개**(접히는 경계 6개 추가) · `next build` 통과 · `pytest` 37개.

화면으로 밟은 것:

| 밟은 것 | 결과 |
|---|---|
| 오늘의 일정 한 줄 | 한 번에 캘린더 + 그 일정이 열린다 |
| 일정 방에서 `/` | `/clear`·`/summary` 두 줄이 입력칸 위에 뜬다 |
| `/clear` → Enter | `이전 대화 3개 · 다시 보기` + "여기서부터 새로 시작해요". 아무것도 지워지지 않았다 |
| 다시 보기 | 그대로 돌아온다 |
| 사람 줄 오른쪽 클릭 | 부르는 이름 · @핸들 복사 · 연결 끊기 |
| 이름 붙이기 (0019 **올리기 전**) | 낙관적으로 붙었다가 서버가 거절 → 되돌리고 "저장하지 못했어요". **조용히 거짓말하지 않는다** |

> 마지막 줄이 이번 확인의 값이다. 0019 를 올리기 전이라 실패 경로를 **의도치 않게**
> 밟았는데, 그게 정확히 §25 에서 세운 규율대로 돌았다.

**해야 할 것**: `supabase/migrations/0019_person_labels.sql` 을 올려야 '부르는 이름'이 앉는다.
안 올려도 나머지는 그대로 돈다(표가 없으면 이름이 없을 뿐이다).


---

## 30. 자리마다 다른 AI, 그리고 좋은 소식이 덮은 화면 (2026-08-19)

### 30.1 사용 유형별로 AI 가 무엇을 보고 있었나

먼저 지도를 그렸다. 우리 AI 가 부르는 자리는 셋이고, 셋이 서로 다른 것을 들고 갔다.

| 자리 | 어디로 | 함께 보내던 것 | 못 보던 것 |
|---|---|---|---|
| 캡처 바 | `/api/chat` | `now` · `tz` · `pending`(직전 되묻기+그 말) | 내 일정 · 지금 어느 화면인지 |
| 1:1 · 일정 방 | 규칙(`lib/conversation`) → 걸리면 `/api/chat` | **`{message}` 뿐** | `now` 조차 · 앞뒤 말 · 상대가 누구인지 |
| 요약 | `/api/summary` | `transcript` · `title` · `lang` | **`now` 없음** |

여기서 나온 결함 넷:

**① 방에서는 시각을 안 보냈다.** 서버 시계는 UTC 로 돈다(Render). `now` 가 없으면 라우터가
KST 로 떨어진다 — 한국에서는 대개 맞지만, **같은 문장이 어느 칸에 들어가느냐에 따라
다른 AI 를 만난다**는 사실 자체가 결함이다. 사용자는 그 차이를 설명할 길이 없다.

**② 방에서는 앞말을 안 보냈다.** 두 자리는 말의 성질이 다르다:

```
캡처 바 : "다음 주 화요일 3시에 교수님 미팅"   — 혼자 서는 완결된 부탁
대화    : "그럼 4시"                          — 앞말이 없으면 아무것도 아닌 말
```

앞말 없이 "그럼 4시" 를 받으면 모델은 오늘 4시로 읽는다. 대화에서는 그게 대개 틀리다.
그래서 최근 여덟 마디를 함께 보내고, 프롬프트에 **대화용 규칙**을 따로 두었다:
거절·제약·질문·잡담은 항목이 아니다(제약을 항목으로 만들면 사람이 방금 물리친 그
시간을 다시 들이미는 셈이다), 그리고 **여기서는 되묻지 않는다**(두 사람 사이에 우리가
끼어들어 묻는 것이 방해다).

**③ 요약이 '내일'을 옮기지 못했다.** 요약은 **뒤늦게 온 사람**이 읽는 글인데, 그 안의
"내일 3시" 는 말한 그 순간에만 뜻이 있다. 기준 시각을 보내고, 없으면 없는 대로 —
**상대적인 말은 아예 옮기지 말라**고 이른다(지어낸 날짜 하나가 요약 전체를 못 믿게 만든다).

**④ 규칙이 '모르겠다'고 말한 자리에서 모델을 부르지 않았다.** `analyzeMessage` 는
`needsModel` 을 계산해 왔지만 **아무도 그 값을 읽지 않았다**(§26.3 의 `priority` 와 같은
종류 — 뽑아 놓고 버리는 신호). 그리고 그 갈래는 `intent: "chatter"` 로 떨어져 방에서
AI 를 부르지 않는 조건에 걸렸다. **규칙이 모른다고 한 바로 그 자리에서만 묻지 않고 있었다.**
이제 부른다 — 안전해진 이유는 ②다. 맥락과 함께 물으면 "3시에 수업 있어" 를 제안으로
바꾸지 않는다.

### 30.2 차별성 — 표가 없는 것을 있다고 말하고 있었다

`CLAUDE.md` §1 의 비교표는 우리의 능동성을 **"충돌 감지, 추천, 리마인드"** 라고 적어 두었다.
셋 중 둘은 있다:

| 적힌 것 | 실제 |
|---|---|
| 충돌 감지 | 있다 — `lib/clash`(§26.3) + DB `suggest_slots`·`day_availability` |
| 추천 | 있다 — `decideSuggestion`, 그리고 이번에 붙인 '다 되는 시각' |
| 리마인드 | **없다.** 코드·마이그레이션 어디에도 없다 |

§25 가 세운 규율 그대로다 — *"만들지 않은 것을 표에 두면 다음 사람이 그것을 있다고 믿는다."*
그것도 하필 **제품의 차별점을 말하는 표**였다. 걷었다.

### 30.3 좋은 소식이 화면을 덮고 있었다

방의 하루(RoomTimeline)에서 "색과 글자가 안 보인다" 는 말을 듣고 열어 보니, 원인이 다섯 겹이었다.

**① 칠하는 것이 뒤집혀 있었다.** 30분 칸을 **가능한 사람 수**만큼 진하게 칠했다. 그런데
가장 흔한 경우가 '모두 가능' 이라 — 하루 전체가 균일한 회색이 됐다. 좋은 소식이 가장
시끄럽게 그려진 것이고, 덮인 화면에서는 시각 눈금도 내 일정도 읽히지 않았다. 무엇보다
그 회색이 **'막혀 있다'** 로 읽힌다. 뜻과 정반대다.

> 이제 **모자란 쪽**을 칠한다. 다 되는 시간은 비어 있고, 사람이 찾는 것이 바로 그 빈 자리다.
> 드러나는 정보는 같다(못 오는 n 명 = 전체 − 가능한 n 명) — 남의 일정 내용은 여전히 안 온다.

**② 이 방의 일정이 어두운 면에 어두운 글자였다**(`ink 32%` 바탕에 `ink` 글자, 대비 ~2:1).
'내 다른 일정' 과 구별하려다 안 읽히면 아무 소용이 없다. 면을 비우고 테두리로 말한다.

**③ 시각 눈금이 `--faint`** 였고 첫 눈금(07)은 잘려 있었다 — §26.4 에서 큰 시간표에 한
것과 **같은 고침을 이 컴포넌트에는 안 했었다**(글자가 선 위에 반쯤 걸터앉는데 맨 위에는
걸터앉을 위가 없다).

**④ 고른 칸이 15px 짜리에 1px 안쪽 테두리 하나**였다. 아무도 못 본다. 면으로 칠하고
왼쪽에 굵은 표식을 세우고, `z-index` 로 일정 블록 위에 올렸다.

**⑤ 그리고 범례가 화면 밖에 있었다.** 이 칸이 제 칸보다 385px 커져서 넘친 만큼이 패널
밖으로 흘렀는데, 거기 있던 것이 범례와 안내였다 — **화면을 읽는 열쇠가 화면 밖에 있었다.**
§27.2 와 같은 종류(자식이 제 부모를 넘어 자란다). flex 로 제 칸을 채우게 하고, 격자에
바닥(150px)을 주고, 그래도 모자라면 칸이 통째로 스크롤한다.

### 30.4 '다른 시간' 은 거절만 하고 언제가 되는지는 말하지 않았다

제안 카드의 **다른 시간**은 `declined` 를 보낼 뿐이었다. 누르고 나면 사람은 다시 처음부터
시간을 찾아야 했다 — 그런데 **그 답은 이미 이 화면 안에 있었다**(`avail`).

이제 격자 아래에 늘 서 있다: **다 되는 시각 · 10:00 · 11:00 · 14:00.** 누르면 그 자리가
후보가 되고, 바로 위에 `14:00 · 2/2명 가능`과 `이 시간으로 제안`이 열린다. **한 번 눌러
상대에게 다시 간다.**

고르는 방식도 정했다. 처음에는 빈 구간의 **시작**을 내놓았는데, 하루가 통째로 비면 그게
늘 "07:00" 이었다 — 맞는 말이지만 아무도 7시에 만나지 않는다. 사람이 실제로 약속을 잡는
시각(10·11·14·15·16·17·19)부터 보고, 그것들이 다 막혀 있을 때만 빈 구간의 시작을 내놓는다.

### 30.5 제안 카드는 시간 옆에 선다

카드는 대화·하루 두 칸 **위에** 서 있었다. 그래서 제안이 오면 패널 높이를 먼저 가져갔고,
짧은 창에서는 하루가 **45px** 까지 짓눌렸다 — 그것이 "캘린더가 안 보인다" 의 마지막 뿌리다.

카드를 하루 칸 안으로 옮겼다. 이유는 자리가 아니라 뜻이다: **제안은 시간에 대한 말이라
그 시간이 그려진 자리 옆에 서는 것이 맞다.** 카드가 말하는 "8월 18일 15시" 가 아래
격자에서 어디인지 눈으로 이어진다. 그리고 대화는 이제 제안이 와도 밀려나지 않는다
(§25 무렵부터 남아 있던 숙제였다).

곁들여, 하루 칸의 머리(`함께하는 일정 · 제목 · 시각 · 참여자`)는 나란히 설 때 접었다 —
바로 위 패널 머리가 이미 하는 말을 90px 써서 반복하고 있었다.

### 30.6 확인

`tsc` 0건 · 프론트 시험 99개 · `pytest` 37개 · `next build` 통과.

DOM 으로 잰 것:

| 잰 것 | 결과 |
|---|---|
| 모두 가능한 날 | 칠해진 칸 **0** — 격자가 비어 있고 눈금이 읽힌다 |
| 8/19 10:00 (둘 다 당구) | 그 두 칸만 `--busy: 1`, 일정 블록 둘이 함께 선다 |
| 다 되는 시각 | 미래 날: `10:00 · 11:00 · 14:00` · 오늘: `19:00`(지난 시각은 안 권한다) · 지난 날: 없음 |
| 칩을 누름 | `.on` 서고 `14:00 · 2/2명 가능` + `이 시간으로 제안` |
| 범례·안내 | 패널 **안**에 있다(예전엔 아래로 385px 밖) |
| 제안 카드 이동 | 하루 칸 45px → **268px**, 대화는 제자리 |

> **못 본 것**: 30.1 의 프롬프트 변경은 실제 대화로 왕복시켜 보지 못했다(방에서 앞말을
> 얹은 뒤 모델이 정말로 "그럼 4시" 를 그 날짜로 읽는지). 코드 경로와 페이로드까지는
> 확인했지만 그건 '보낸다' 이지 '읽는다' 가 아니다 — §26.5 에서 배운 그 구분이다.

---

## 31. 제출 문서와 코드가 서로 다른 말을 하고 있었다 (2026-08-21)

발표 자료(`Comein_학술제_발표.pptx`)와 구현 트랙 보고서(`구현트랙보고서.docx`)를 코드와
한 줄씩 맞춰 봤다. 대부분은 맞았다. 틀린 것들은 **한때 사실이었다가 코드만 앞서 간 자리**
였고, 하나는 **처음부터 없던 것**이었다.

### 31.1 없는 파일을 인용하고 있었다

보고서 Ⅷ장이 이렇게 적고 있었다:

> 재현 가능한 스크립트(`scripts/run_verification.py`)로 자연어 테스트 케이스 100개를
> 자동 전송해 정답지와 비교했으며 …

그 파일은 저장소에 없었다. `git log --all` 에도 없었다. 수치(18/18 · 16/16 · 39/40 ·
12/14 · 3/12)는 누군가 실제로 재서 적은 것이 분명한데, **재는 도구가 남아 있지 않았다.**
제출물에 코드가 함께 들어가므로, 심사위원이 그 경로를 열어 보면 그대로 드러난다.

그래서 문장을 지우는 대신 **도구를 실제로 세웠다** — `scripts/run_verification.py` 와
`scripts/verification_cases.json`(100건).

핵심은 **기준 시각(anchor)을 정답지에 못 박은 것**이다. '내일'·'다음 주 화요일' 의 정답은
오늘이 언제냐에 따라 달라진다. 화면이 늘 `context.now` 를 함께 보내므로(`lib/api.ts`),
검증도 정답지에 적힌 시각을 그대로 보낸다. 그래서 **다음 달에 돌려도 같은 정답지로
채점된다** — 재현되지 않는 수치는 보고서에 적을 자격이 없다.

### 31.2 다시 재 보니 — 97/100

`anchor = 2026-08-24(월) 09:00 KST` 로 배포 서버(`/api/chat`)에 100문장:

| 갈래 | n | 통과 | 정확도 | 보고서에 적혀 있던 값 |
|---|---:|---:|---:|---|
| 단일 일정 (문어체) | 18 | 18 | **100%** | 100% (18/18) ✓ |
| 회의 · 참여자 추출 | 16 | 16 | **100%** | 100% (16/16) ✓ |
| 구어체 · 오타 | 40 | 39 | **97.5%** | 97.5% (39/40) ✓ |
| 정보 부족 (되묻기) | 14 | 13 | **92.9%** | 85.7% (12/14) |
| 지원 범위 밖 | 12 | 11 | **91.7%** | 25.0% (3/12) |
| **전체** | **100** | **97** | **97.0%** | — |

케이스가 다른데 앞의 셋이 소수점까지 같다. 우연이라기엔 어렵고, 원래 수치가 **실제로 잰
값**이었다는 방증으로 읽었다.

마지막 갈래가 25% → 91.7% 로 뛴 것은 성능이 좋아져서가 아니라 **묻는 질문이 다르기
때문**이다. 예전 기준은 "수정·취소를 해내는가"(→ 미구현이니 0에 가깝다), 지금 기준은
**"없는 일정을 지어내지 않는가"** 다. 뒤쪽이 지금 이 제품이 실제로 약속한 것이라
그쪽으로 잡았고, 슬라이드에도 기준을 함께 적었다 — 기준 없는 퍼센트는 숫자가 아니다.

### 31.3 남은 실패 3건

| id | 문장 | 무슨 일 |
|---|---|---|
| C17 | "모레 저녁 7시 부모님이랑 저녁" | 일정으로 기대했으나 참여자가 있어 **회의**로 분류 — 정답지가 엄격한 쪽 |
| D07 | "병원 예약해야 하는데" | 되묻기로 기대했으나 시각 없는 **할 일**로 생성 — 계약상 틀린 건 아니다 |
| E09 | "매주 월요일 10시 정기 회의 반복으로 등록해줘" | **반복을 단일 일정 하나로** 만들었다 — 이건 진짜 한계다 |

정답지를 느슨하게 고쳐 100%를 만들 수도 있었지만 하지 않았다. **결과를 보고 기준을
옮기면 그건 더 이상 측정이 아니다.** 세 건 모두 사유와 함께 남겼다.

### 31.4 덤으로 나온 것 — 동시 요청에서 무너진다

처음엔 `--workers 4` 로 돌렸고 9건이 실패했다. 그런데 그중 **5건이
`일시적인 오류가 발생했어요`** 였다 — `chat.py` 의 `except Exception` 폴백이다.
파싱 품질이 아니라 **쓰로틀링**이다. 같은 문장들을 순차로 다시 보내니 전부 통과했다.

무료 티어의 동시성 한계이고, **데모·심사처럼 여러 명이 동시에 누르는 상황이 정확히 그
조건**이다. 보고서 Ⅷ장에 적어 두었다. 검증 기본값은 `--workers 1` 로 두었다 —
쓰로틀링을 정확도에 섞으면 숫자가 억울해진다.

### 31.5 코드만 앞서 가 있던 자리들

| 어디 | 적혀 있던 것 | 실제 |
|---|---|---|
| 보고서 Ⅳ | `Enter(/enter)` 를 포함한 **4단계** 진입 | 그 라우트는 없다. `/` · `/experience` · `/workspace` **3단계** |
| 보고서 Ⅴ | 타임테이블 **06~24시** | `spans.ts` 의 `TT_FROM=0, TT_TO=24` — **00~24시** |
| 보고서 Ⅷ | `main · develop · feature/*` | `develop` 은 2026-08-20 에 걷었다 |
| 보고서 Ⅷ | docs **00~24번** | 실제 **12건**. 빈 껍데기는 §9 에서 걷어냈다 |
| 보고서 Ⅰ | 일정·할 일·회의로 자동 분류·**등록** | 할 일은 담을 표가 없다(`nav.ts` 의 `DEST`) |
| 발표 31쪽 | 향후 과제: "데모 user_id → Supabase Auth" | **이미 됐다.** 코드에 `demo_user` 가 없고 GitHub·카카오·이메일·매직링크가 다 붙어 있다. 보고서 Ⅸ장은 "해소됨" 이라 적고 있어 **두 문서가 정면으로 달랐다** |
| 발표 19쪽 | 개인 일정은 "확정 절차 없이 즉시 반영" | `autoConfirm` 기본값이 **꺼짐**이라 제안(pending)으로 앉는다 |
| 발표 18쪽 | `participants` · `messages` · `proposals` | 실제 표 이름은 `event_participants` · `chat_messages` · `schedule_proposals` |

발표 31쪽의 그 항목은 **없어진 문제를 향후 과제로 세워 둔 것**이라, 검증에서 새로 확인된
반복 일정 미지원으로 갈아 끼웠다.

### 31.6 24쪽 막대는 그림이 아니라 차트였다

숫자만 고치고 넘어갈 뻔했다. `slide24` 의 막대는 도형이 아니라 진짜 차트
(`ppt/charts/chart1.xml` + 임베디드 워크시트)였고, 값은 `25 · 85.7 · 97.5 · 100 · 100`
이 그대로 박혀 있었다. 글자만 고쳤으면 **본문은 91.7% 인데 막대는 25% 자리에 서 있는**
슬라이드가 됐다. 차트 XML 과 임베디드 `.xlsx` 를 함께 고쳤다.

### 31.7 확인

`pytest` 37개 · 프론트 `node:test` 104개 · 검증 97/100 · 두 파일 모두 무결성 검사 통과
(`[Content_Types].xml` 이 맨 앞·무압축인지까지). 원본은 `docs/_backup/` 에 타임스탬프를
붙여 남겼다.

---

## 32. 손이 닿아야 보이던 것들 (2026-08-21)

앱을 실제로 띄워 놓고 하나씩 눌러 봤다. 나온 것 대부분은 "기능이 없다" 가 아니라
**있는데 닿지 않는다** 쪽이었다 — 화면이 조작을 배우게 만들고 있었다(CLAUDE.md §0).

### 32.1 사람을 알아내는 일이 추측이었다 — `@`

AI 가 `participants: ["수훈"]` 을 뽑아 주면 화면이 그 글자를 연락처와 맞춰 봤다. 그
맞춤은 양방향 `includes` 라서 넓다 — "박" 한 글자가 "박시현" 에 걸리고, 사람 이름과 같은
지명이 사람으로 읽힌다. 그리고 **틀렸다는 것을 아무도 모른다**: 일정은 조용히 서고,
엉뚱한 사람이 참여자가 되어 방에 초대된다.

`@` 는 그 추측을 없앤다(`lib/mention.ts`). 고르는 것은 사람이고, 결과는 핸들이라는
유일한 이름이다. 흐린 일치는 **못 박히지 않은 이름에만** 남긴다 — 추측이 답을 덮지 않는다.

부른 사람이 있으면 그 자리의 방에 시각을 내민다. 방은 `addParticipant` 가 이미
세우고 있었다(`ensureRoom`). **보내는 사람은 나다** — `chat_messages` 에는 사람
발신자밖에 없고, 무엇보다 상대에게 가는 것은 내 제안이고 AI 는 그 말을 골라 준 것뿐이다.

여기서 오래된 함정을 하나 더 밟았다. 일정은 화면에 먼저 서고(지역 id) 저장은 뒤따르는데,
**초대에는 그 사이를 기다리는 큐가 있었지만 말에는 없었다.** 지역 id 로는 그 방을 찾을 수
없고 지역 방 id 는 uuid 가 아니라 거절당한다 — 화면에 잠깐 보였다가 다음 동기화에서
사라졌다. 보낸 사람만 보낸 줄 아는 말이 된다. 초대와 같은 자리에서 같이 기다리게 했다.

실측(로컬 FastAPI + 실제 Supabase):
`"다음주 목요일 오전 11시에 @fapp1004 이랑 배포 점검"`
→ `events`: 배포 점검 · `2026-08-27T02:00Z` · 참여자 2
→ `chat_messages`: "배포 점검 — 8월 27일 (목) 11:00 어떠세요?"

### 32.2 같은 시각이 여섯 줄이었다

DB 에 제목·시각이 완전히 같은 행이 여섯 개 있었다(id 는 전부 다르다 — 중복 생성된 실제
데이터다). 화면은 그것을 여섯 줄로 늘어놓았다. 여섯 줄은 여섯 개의 다른 정보가 아니라
'이 시각이 붐빈다' 는 한 가지 사실이다.

시간표 · 그날 목록 · 24시간 원의 목록 **셋 다** 같은 기준(`TT_FOLD_FROM = 3`)으로 접는다.
화면마다 다른 수에서 접으면 사용자는 규칙이 아니라 화면마다의 버릇을 외워야 한다.

> 그 여섯 개를 지우려 했으나 **RLS 가 막았다** — 주인이 팀원이고 나는 참여자다.
> 삭제 요청은 200 을 받았지만 지워진 행은 0이었다(정상 동작이다). 화면이 한 줄로 접으므로
> 데모에는 지장이 없다. 지우려면 만든 사람이 지워야 한다.

### 32.3 손잡이가 하는 일이 보이지 않으면 없는 손잡이다

대화 목록에 휴지통을 달았는데 **눌러도 아무 일도 일어나지 않았다.** 접기(clearmark)는
원래 *방 안*에서 지난 말을 접는 장치였고, 목록은 그 표시를 읽지 않아 줄이 그대로 남았다.
목록도 같은 표시를 읽게 했다 — 지운 것이 아니므로 **새 말이 오면 다시 올라온다.**

스침 줄("회의로 정리했어요")도 같은 종류였다. 확정을 기다리는 제안은 스스로 사라지지
않게 두었는데(그래야 확정이라는 절차가 뜻을 갖는다), 그 줄이 화면 아래에 고정돼 있어
**다른 탭으로 옮겨도 따라왔다.** 닫기(×)를 달고, 화면을 옮기면 걷는다. 걷어도 잃는 것은
없다 — 그 제안은 '답을 기다리는 것' 줄과 캘린더의 점선에 그대로 서 있다.

### 32.4 고른 것이 남지 않으면 고르게 하는 것이 거짓말이 된다

사용 유형(학생·직장인·개인)은 실제로 도는 기능이었다 — Today 문구 · 다이얼 색 · 이벤트
칩 세 곳이 그 값을 읽는다. 그런데 **저장되지 않아 새로고침하면 '학생' 으로 돌아갔다.**
`lib/prefs.ts` 로 이 기기에 남긴다. 계정이 아니라 기기다: 설정을 담을 표를 세우지 않았고,
세우지 않은 것을 있는 것처럼 말하지 않는다.

함께 걷은 것 — Settings 의 "기본 장소·라벨 프리셋에 반영" 은 절반이 사실이 아니었다
(장소 프리셋은 구현되지 않았다).

### 32.5 느림의 진짜 몫은 provider 가 아니었다

"AI 를 더 빨리 깨울 수 없나" 에서 시작했다. 처음 잰 값은 Gemini 를 가리켰다:

| | 작은 프롬프트 |
|---|---|
| groq | 0.67 · 0.75 · 0.76초 (3/3 성공) |
| gemini | 4.75 · 4.93 · 6.51초 (1/3 은 503) |

그런데 **진짜 프롬프트**로 Groq 를 앞세워 재니 `2.1 → 2.6 → 10.4 → 11.9 → 18.2초` 로
**올라갔다.** 폴백은 한 번도 일어나지 않았다(로그 확인). 올라간다는 것이 답이었다 —
검증 100건을 돌린 직후라 무료 티어 쿼터를 다 쓴 상태였다. **provider 를 바꿔서 사라지는
종류의 느림이 아니다.** 그래서 주 Provider 의 기본값은 바꾸지 않았다. 바꿀 근거가 없는데
바꾸는 것은 측정이 아니라 희망이다.

대신 확실한 것 둘을 했다:

- **노크를 랜딩·Experience 에서부터.** 예전에는 워크스페이스에 *도착해서야* 두드렸다.
  랜딩과 문턱을 지나오는 시간이 이미 수십 초다 — 기다림을 없앨 수는 없지만 사람이 화면을
  읽는 동안으로 옮길 수는 있다.
- **`warm-render` 스케줄을 켰다**(학술제 기간 한정, 09~22시 KST). 월 ~420시간으로 무료
  한도(750h) 안이다. **기간이 끝나면 다시 주석 처리한다** — 상시로 켜면 계정 전체를
  저당 잡는다.
- `LLM_PRIMARY` 로 주 Provider 를 고를 수 있게 했다(기본값 `gemini` 그대로). 데모 당일
  한쪽이 아플 때 코드를 고쳐야만 바뀌는 값이면 손댈 수 없다.

> **데모 직전에 `run_verification.py`(100건)를 돌리지 않는다.** 쿼터를 태워서 그 직후
> 시연이 느려진다 — 위 수치가 정확히 그렇게 나온 값이다.

### 32.6 확인

프론트 `node:test` 104개 통과 · `tsc --noEmit` 무오류 · `next build` 성공.
@ 흐름은 실제 Supabase 까지 왕복해 확인했다(32.1의 실측).
