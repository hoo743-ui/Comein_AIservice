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
5. `ai/agents/*` 스켈레톤 — 3절 그대로.
