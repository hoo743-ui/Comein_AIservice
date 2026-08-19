# 10. API — AI ↔ 프론트 계약(JSON Schema)

> 백엔드 계약은 셋뿐이다: **`POST /api/chat` · `POST /api/summary` · `GET /health`.**
> 저장·조회·인증은 HTTP 가 아니라 **Supabase 스키마**가 계약이다(아래 §2).

---

## 1. `POST /api/chat` — 자연어 한 줄 → 항목

### 요청

```jsonc
{
  "message": "내일 3시 교수님 미팅",
  "conversation_id": null,          // 선택
  "context": {                      // 화면만 아는 것들
    "now": "2026-08-14T00:52:06+09:00",   // 사용자가 실제로 서 있는 시각
    "tz":  "Asia/Seoul",
    "pending": {                    // 직전에 되물었다면, 이번 메시지는 그 답이다
      "message": "언제 한번 보자",
      "ask": "언제로 일정을 잡을까요?"
    }
  }
}
```

**`context.now` 를 반드시 보낸다.** 서버(Render)는 UTC 로 돌고 사용자는 제 시간대로 말한다.
이걸 빼면 한국 시간 오전 9시 이전에는 "내일" 이 통째로 하루 어긋난다.

### 응답 — `AiResult` (`backend/app/schemas/ai_result.py`)

```jsonc
{
  "intent": "meeting",              // "schedule" | "todo" | "meeting" | "chat"
  "reply":  "회의로 정리했어요.",
  "items": [                        // ParsedItem[] — backend/app/schemas/items.py
    { "category": "meeting", "title": "미팅",
      "start": "2026-08-15T15:00:00+09:00", "participants": ["교수님"] }
  ],
  "ask": null
}
```

- **`items` 는 복수다.** 한 문장에서 여러 건이 나오면 각자의 `category` 로 온다
  ("회의 잡고 자료도 준비해야 해" → `meeting` + `todo`). 다만 **갈 곳이 있는 갈래는 하나뿐이다** —
  시각이 있는 것만 캘린더에 앉고, `todo` 는 담을 표가 없어 화면이 "담아 두는 곳은 아직
  없어요" 라고 말한다(`nav.ts` 의 `DEST`).
- **`intent` 는 첫 항목의 갈래일 뿐이다.** 여러 건이면 뜻이 흐려지므로 화면은 쓰지 않는다 —
  각 항목의 `category` 를 본다.
- **`reply` 는 AI 가 쓴 문장이 아니다.** 항목 수·갈래로 서버가 만든 한 줄이거나 `ask` 다.
  `ai/router.py` 의 `ParseResponse` 에는 `reply` 필드가 없다.
- **`ask` 는 되묻기다.** 일정·회의에 시각이 없으면 지어내는 대신 한 줄 물어본다. 이때
  `items` 는 빈 배열이다 — **뽑았으면 묻지 않고, 물었으면 뽑지 않는다.**
- 검증 실패·예외는 HTTP 200 으로 온다: `intent:"chat"` + 안내 문구 + `items:[]`.
  화면을 오류로 멈추게 하지 않기 위해서다.

### `ParsedItem` — 갈래별 필수/선택

| category | 필수 | 선택 |
|---|---|---|
| `schedule` | `title`, `start`(ISO) | `end`, `location` |
| `meeting`  | `title`, `start`(ISO) | `end`, `participants[]`, `summary`, `notes` |
| `todo`     | `title` | `due`(ISO), `priority`(high/mid/low) |

> 갈래는 셋이다. `memo` 가 있었지만 화면이 그것을 '할 일' 로 접어 담았고 그 할 일은 담을
> 곳이 없어 사라졌다 — 뽑아 놓고 버리는 갈래였다(`docs/24` §25).
>
> `end` 는 사용자가 말했을 때만 온다. 화면은 없을 때만 한 시간으로 둔다 — 한동안 이 칸을
> 아예 읽지 않아 "2시부터 5시까지" 가 2~3시로 앉았다.

필수가 비면 Pydantic 이 `model_validator` 에서 튕긴다(`backend/app/schemas/items.py`).
**이 클래스를 `ai/router.py` 가 그대로 import 한다** — 스키마를 두 벌로 관리하지 않는다.

### 저장은 이 응답을 지나지 않는다

`/api/chat` 은 아무것도 저장하지 않는다. 화면이 `items` 를 받아 **Supabase 에 직접 쓴다**
(`frontend/src/lib/store.ts` → `remote.ts`). 시각이 있는 항목은 일정으로 서고, 설정이
자동 확정이 아니면 `pending`(제안)으로 앉아 사람이 확정한다.

---

## 2. 저장·조회 — 계약은 Supabase 스키마다

~~`POST /api/items`~~ · ~~`GET /api/schedules|todos|memos|meetings`~~ · ~~`GET /api/users/demo`~~
는 **없어졌다 (2026-08-13)**. 저장이 Supabase 직행으로 옮겨간 뒤 아무도 부르지 않았고,
남아 있으면서 "저장은 백엔드를 지난다" 는 잘못된 그림만 계속 그렸다(`docs/24` §16).

실제 계약은 `supabase/migrations/*.sql`(테이블·RLS·RPC)와 그것을 부르는
`frontend/src/lib/remote.ts` 다. **권한은 엔드포인트가 아니라 RLS 정책이 정한다** —
예컨대 참여자 추가는 `participants_insert` 가 `is_event_owner(event_id) or user_id = auth.uid()`
로 잠그므로, 초대는 주최자만 된다. 화면의 손잡이도 거기에 맞춰야 한다(아니면 눌러도 조용히 거절당한다).

---

## 3. `POST /api/summary` — 대화 → 네 갈래

`backend/app/api/endpoints/summary.py` 의 `SummaryRequest`/`SummaryResponse`.

- 요청: `transcript`("이름: 말" 을 줄바꿈으로 이은 것) · `title?` · `lang`
- 응답: `recap`(무슨 얘기였나) · `decided`(정해진 것) · `pending`(아직 안 정해진 것) ·
  `next`(다음에 할 일). **근거 없는 갈래는 빈 채로 둔다** — 채우려고 지어내지 않는다.
- `lines` 는 예전 화면과의 호환을 위해 넷을 이어 붙인 것이다.

> `/api/chat` 에 대화를 통째로 넣으면 안 된다. 그쪽은 한 마디를 항목으로 가르는 파서라
> 요약 대신 "N건을 정리했어요" 가 돌아온다(실제로 그랬다).

---

## 4. 이 문서의 뒷부분을 걷은 이유

여기에는 원래 §1~§4 로 **목업 시절의 계약**이 더 있었다 — `entity: { op, type, data }` 하나를
돌려주는 모양, `confidence` 필드, `parseMessage()` seam, `POST /api/auth/login` 예정 계약.

그중 실제로 그렇게 된 것은 하나도 없다. `entity` 는 `items[]` 가 됐고(한 문장에 여러 건이
들어오니까), `confidence` 는 되묻기(`ask`)가 대신하며, 인증은 백엔드가 아니라 Supabase Auth 가
맡는다. 두 벌의 계약이 한 문서에 나란히 서 있으면 **다음 사람은 둘 다 유효한 줄 안다.**

지금 유효한 것만 남긴다.
