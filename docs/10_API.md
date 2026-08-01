# 10. API — AI ↔ 프론트 계약(JSON Schema)

> "AI ↔ 경계는 API JSON Schema로 고정"(CLAUDE.md §협업). 프론트는 이 계약의 **결과(JSON)를 렌더·조작**만 하고, 파싱/추론은 AI 파트가 담당한다. 현재는 프론트에 **목업 seam**이 있으며(ADR-006), 실제 API가 나오면 seam 내부 호출만 교체한다.

## 0. 실제 백엔드 계약 (현재 구현 기준)

> 아래 §1~§4는 프론트 목업(`src/lib/store.ts`) 시절에 정의한 **예정 계약**이며, 실제 FastAPI 백엔드가 구현한 계약과 필드가 다르다. 프론트를 실제 백엔드에 연결할 때는 아래 절을 기준으로 하고, 필요하면 §1~§4를 갱신하거나 이 절로 통합한다. 상세 파이프라인 현황은 `docs/24_AI_PIPELINE_STATUS.md` 참고.

### `POST /api/chat`

요청:

```jsonc
{ "message": "다음 주 화요일 3시에 교수님 미팅", "conversation_id": "user-uuid-or-null" }
```

응답(`AiResult` — `backend/app/schemas/ai_result.py`):

```jsonc
{
  "intent": "schedule",           // "schedule" | "todo" | "memo" | "meeting" | "chat"
  "reply": "일정(으)로 정리했어요.",
  "items": [                       // ParsedItem[] — backend/app/schemas/items.py, POST /api/items와 동일 스키마
    { "category": "schedule", "title": "교수님 미팅", "start": "2026-08-04T15:00:00" }
  ]
}
```

- `ai.router.route()`(AI 파트, 형태 미확정)의 결과를 `chat.py`가 `ParsedItem`으로 검증한 뒤 감싼다. 검증 실패/예외 시 `intent: "chat"`, 정해진 안내 문구, `items: []`로 폴백한다(`docs/24_AI_PIPELINE_STATUS.md` §5).
- **저장은 별도 호출**: `/api/chat`은 저장하지 않는다. 반환된 `items`를 확인 후 `POST /api/items`를 호출해야 DB에 반영된다.

### `POST /api/items`

`backend/app/schemas/items.py`의 `ItemsCreateRequest`/`ItemsCreateResponse` 그대로 — 5절 참고 문서 없이 코드가 단일 기준(주석에 필드 설명 포함).

### `GET /api/schedules|todos|memos|meetings`

`user_id` 쿼리 파라미터 기준 목록 조회(스키마는 `backend/app/schemas/{schedules,todos,memos,meetings}.py`). 상세는 `docs/06_BACKEND.md` "엔드포인트 현황" 표 참고.

---

## 현재 상태(목업, 프론트 §1~§4 — 실제 백엔드와 필드가 다름)

- 위치: `src/lib/store.ts`의 `interpret(text)` — 키워드 기반으로 `schedule/todo/memo/chat` 판별 후 엔티티 생성 + 응답 문구 반환.
- 채팅 흐름: `sendMessage(text)` → 사용자 메시지 push → `interpret()` → 엔티티 생성(일정은 pending) → AI 메시지 + 카드(`message.card`).
  - 계약(`message.card`)은 그대로 유효. 단, 현 워크스페이스(슬림 레일 + 단일 캔버스)는 이를 **캡처 결과(receipt)** 로 렌더한다 — "무엇이 어느 뷰로 정리됐는지". UI 표현만 다를 뿐 AI↔프론트 계약은 동일.

## 목표 seam (권장 리팩터)

```ts
// src/lib/ai-client.ts (예정)
export async function parseMessage(text: string, ctx?: AiContext): Promise<AiResult> {
  // 지금은 목업 반환. 실제 연동 시:
  // const r = await fetch("/api/ai/parse", { method: "POST", body: JSON.stringify({ text, ctx }) });
  // return r.json();
}
```

프론트는 `parseMessage`만 알면 되고, 그 안이 목업이든 실제 API든 무관.

## 계약: `AiResult`

```jsonc
{
  "reply": "교수님 미팅을 제안 일정으로 만들었어요. 겹치는 일정이 없는지 확인했습니다.", // 자연어 응답(필수)
  "intent": "schedule",            // "schedule" | "todo" | "memo" | "meeting" | "chat"
  "confidence": 0.0,               // 0..1 (선택, Confidence 라우팅용)
  "entity": {                       // intent가 chat이 아니면 생성/수정할 엔티티(선택)
    "op": "create",                // "create" | "update"
    "type": "schedule",
    "data": {                       // 부분 필드(누락은 프론트/기본값 보완)
      "title": "교수님 미팅",
      "start": "2026-07-09T15:00:00",   // ISO
      "end": "2026-07-09T16:00:00",
      "location": "공학관 401"
    }
  }
}
```

### intent별 `entity.data`

| intent | type | data 필드 |
|--------|------|-----------|
| schedule | `schedule` | `title, start(ISO), end?, location?` — 프론트에서 status=`pending`으로 생성(자동확정 설정 시 `confirmed`) |
| todo | `todo` | `title, due?(ISO), priority?(high/mid/low)` — status=`todo` |
| memo | `memo` | `title, content, tags?[]` |
| meeting | `meeting` | `title, start(ISO), participants?[], summary?, actionItems?[]` |
| chat | — | 엔티티 없음, `reply`만 |

- 도메인 타입 정의: `src/lib/types.ts` (CLAUDE.md §7과 일치).
- 프론트는 `entity`를 받아 스토어에 반영하고, 채팅 메시지에 `card: { kind, id }`를 붙여 **인라인 카드**로 노출(확인/수정/취소).

## 능동성(선택 계약)

CLAUDE.md의 "충돌 감지·추천·리마인드"는 아래처럼 확장 가능(프론트는 배너/카드로 렌더):

```jsonc
{ "suggestions": [ { "kind": "conflict", "message": "발표 준비가 3시 미팅과 겹쳐요.", "actions": ["reschedule","ignore"] } ] }
```

- 충돌 감지 자체는 프론트에도 `overlaps()/conflictsFor()`가 있어 즉시 표시 가능(캘린더·인라인 카드). 서버측 추천이 오면 그 위에 렌더.

## 인증(예정)

- 현재 로그인/회원가입은 데모(백엔드 없음). 실제 연동 시 `POST /api/auth/login|signup` + JWT/Refresh(§14 SECURITY) → 성공 시 워크스페이스 진입 연출.
