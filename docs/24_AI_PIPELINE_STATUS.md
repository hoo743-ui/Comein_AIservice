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
5. `ai/agents/*` 스켈레톤 — 3절 그대로.

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
