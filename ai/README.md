# Comein AI Engine

자연어 한 줄을 **항목(items)** 으로 바꾸는 곳. 그것뿐이다.

한때 이 문서는 `agents/` 아래 Agent 15종을 그리고 있었다. **그 디렉터리는 없다** — 만든 적이
없거나, 스켈레톤만 있다가 걷혔다. 실제로 도는 것은 프롬프트 하나와 Provider 두 개다.
그림이 코드보다 커 보이면 다음 사람이 없는 것을 찾아다니게 된다.

## 구조 (실제)

```
ai/
├── router.py            # route() — 프롬프트 1개로 분류·추출·되묻기를 함께 한다
├── llm/
│   ├── base.py          # LLMProvider 인터페이스 + LLMError 계열
│   ├── gemini.py        # 주 경로. httpx 로 REST 직접 호출(SDK 미사용)
│   ├── groq.py          # 폴백. groq SDK
│   └── factory.py       # get_provider(Task) — Gemini → (실패 시) Groq
├── prompts/             # 자리만 있다 (프롬프트는 지금 router.py 안에 있다)
└── memory/              # 자리만 있다 (Short/Long Memory 는 아직 없다)
```

## 흐름

```
POST /api/chat (backend/app/api/endpoints/chat.py)
  → ai.router.route(message, context={now, tz, pending})
      프롬프트: 갈래(schedule·todo·memo·meeting) · 필수 필드 · 참여자 · 되묻기 규칙
      → provider.generate_structured(prompt, ParseResponse)
          Gemini: responseMimeType=application/json → model_validate_json
          (LLMError 면 Groq 으로 한 번 더 — 그쪽은 스키마를 프롬프트에 싣는다)
  → chat.py 가 ParsedItem 으로 한 번 더 검증 → AiResult{intent, reply, items[], ask}
```

## 알아 둘 것

- **계약의 기준자는 하나다.** `backend/app/schemas/items.py` 의 `ParsedItem` 을 `ai/` 가
  그대로 import 한다(`router.py`). 스키마를 두 벌로 관리하지 않는다.
- **모르면 지어내지 않는다.** 일정·회의에 시각이 없으면 항목을 만들지 않고 `ask` 한 줄을
  돌려준다. 뽑았으면 묻지 않고, 물었으면 뽑지 않는다.
- **'지금' 은 화면이 알려 준다.** Render 는 UTC 로 돈다. `context.now` 를 먼저 믿되,
  파싱해 보고 어긋나면 KST 로 떨어진다(`_now_iso`).
- **Gemini 에 `responseSchema` 를 보내지 않는다.** 중첩 `$ref` 를 지원하지 않아서다.
  즉 목표 JSON 모양은 프롬프트 산문으로만 말하고 있다 — 지금 잘 돌지만, 모델을 바꿀 때
  가장 먼저 확인할 자리다.
- **흔들림에는 한 번 더 묻는다.** 실패를 네 갈래로 나누고, 그 이름이 곧 정책이다:

  | 예외 | 무엇을 하는가 |
  |---|---|
  | `LLMTransientError` (503·타임아웃·연결 끊김) | 같은 곳에 한 번 더 (0.6초 쉬고) |
  | `LLMRateLimitError` (429) | 같은 문을 두드려도 소용없다 → 바로 넘긴다 |
  | `LLMModelUnavailableError` (404·은퇴) | 넘기되 `logger.error` 로 크게 남긴다 |
  | `LLMGenerationError` (모양 어긋남) | temperature 0 이라 다시 물어도 같다 → 넘긴다 |

  두 층 모두 실패하면 마지막 예외를 그대로 올린다. 정책은 `backend/tests/test_llm_fallback.py`
  가 가짜 Provider 로 검증한다 — 429·503·모델 은퇴는 실제 API 로는 원할 때 만들 수 없다.
- **Gemini 타임아웃은 15초다**(`GEMINI_TIMEOUT_SECONDS`). 성공한 호출은 2~7초에 끝난다 —
  30초를 기다리는 것은 이미 실패한 요청을 붙들고 폴백을 막는 시간일 뿐이었다.
- **키 두 개.** `GEMINI_API_KEY` · `GROQ_API_KEY` (`backend/.env`). Groq 키가 없어도
  Gemini 단독으로 돈다(`factory._groq()` 가 없으면 None 을 돌려준다).

현재 상태·실측·알려진 한계: [`../docs/24_AI_PIPELINE_STATUS.md`](../docs/24_AI_PIPELINE_STATUS.md) §20
계약(JSON Schema): [`../docs/10_API.md`](../docs/10_API.md)
