# 10. API — AI ↔ 프론트 계약(JSON Schema)

> "AI ↔ 경계는 API JSON Schema로 고정"(CLAUDE.md §협업). 프론트는 이 계약의 **결과(JSON)를 렌더·조작**만 하고, 파싱/추론은 AI 파트가 담당한다. 현재는 프론트에 **목업 seam**이 있으며(ADR-006), 실제 API가 나오면 seam 내부 호출만 교체한다.

## 현재 상태(목업)

- 위치: `src/lib/store.ts`의 `interpret(text)` — 키워드 기반으로 `schedule/todo/memo/chat` 판별 후 엔티티 생성 + 응답 문구 반환.
- 채팅 흐름: `sendMessage(text)` → 사용자 메시지 push → `interpret()` → 엔티티 생성(일정은 pending) → AI 메시지 + 인라인 카드(`message.card`).

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
