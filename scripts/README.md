# scripts/ — 손으로 돌려보는 확인용 스크립트

테스트 스위트(`backend/tests/`)가 아니라, **개발 중 눈으로 확인할 때** 쓰는 것들이다.
레포 루트에서 실행한다. 값은 `backend/.env` 에서 읽는다(커밋되지 않는 파일).

| 파일 | 용도 | 실행 |
|------|------|------|
| `check_models.py` | **데모 전 사전 점검** — 코드가 부르는 모델이 두 Provider 에 오늘도 있는가 | `python scripts/check_models.py` |
| `check_schema.sql` | **이 프로젝트에 어느 마이그레이션까지 올라가 있는가** — 읽기만 한다 | Supabase SQL Editor 에 붙여넣고 Run |
| `smoke_router.py` | 한 문장을 AI 파이프라인에 넣어 결과 JSON 확인 | `python scripts/smoke_router.py` |
| `run_verification.py` | **자연어 파싱 정확도 계측** — 배포 서버에 100문장을 보내 고정 정답지와 자동 대조 | `python scripts/run_verification.py` |
| `verification_cases.json` | 그 정답지(100건 · 기준 시각 고정) | — |
| `verification_result.json` | 마지막 실측 기록(2026-08-21 · 97/100). 원본 응답까지 들어 있다 | — |

> **`run_verification.py` 는 테스트가 아니라 계측기다.** `backend/tests/` 는 LLM 을 목업으로
> 갈아 끼우고 "우리 코드가 계약을 지키는가" 를 묻는다. 이쪽은 그 앞의 질문 — **"모델이
> 한국어를 제대로 읽는가"** — 이고, 진짜 모델을 불러야만 답이 나온다. 그래서 CI 에 넣지
> 않는다(쿼터를 쓰고 네트워크에 매인다).
>
> 정답지에 **기준 시각(anchor)** 을 못 박아 매 요청의 `context.now` 로 함께 보낸다.
> '내일'·'다음 주 화요일' 의 정답은 오늘이 언제냐에 따라 달라지므로, 이게 없으면 다음 달에
> 돌렸을 때 같은 응답이 갑자기 오답이 된다 — 재현되지 않는 수치는 보고서에 적을 수 없다.
>
> **동시 요청은 1로 둔다(기본값).** `--workers 4` 로 돌리면 무료 티어가 버티지 못해
> 100건 중 5건 안팎이 `일시적인 오류가 발생했어요` 로 돌아온다(실측). 파싱 실패가 아니라
> 쓰로틀링이므로, 정확도를 잴 때 섞이면 숫자가 억울해진다.

> **`check_schema.sql` 은 새 DB 를 만나면 먼저 돌린다.** 파일이 저장소에 있다는 것과
> 그 DB 에 올라가 있다는 것은 전혀 다른 일인데, 지금까지 구별할 방법이 없어 앱을 써 보다
> 터져야 알았다(0016 을 엉뚱한 프로젝트에 올리다 `relation "public.chat_rooms" does not
> exist` 를 만난 적이 있다). 이 쿼리는 0001~0019 를 한 줄씩 OK/MISSING 으로 답한다.
>
> 다만 **어느 프로젝트인지는 답해 주지 못한다** — Supabase 의 project ref 를 DB 안에서
> 읽는 표준 자리가 없다. 브라우저 주소의 `/project/<ref>/` 를 눈으로 대조해야 한다.

> **데모 전에는 `check_models.py` 를 먼저 돌린다.** 없으면 0이 아닌 값으로 끝나고,
> 어느 파일의 어느 줄을 고쳐야 하는지까지 알려 준다. Gemini 의 `-latest` 별칭은 구글이
> 뒤에서 갈아 끼우고, Groq 은 낡은 모델을 실제로 내린다 — 폴백이 조용히 죽어 있는 것을
> 데모 중에 알게 되는 것이 최악이다.

배포된 백엔드를 확인하려면 스크립트 대신 HTTP 로 직접 부르는 게 빠르다:

```bash
curl https://comein-aiservice.onrender.com/health
curl -X POST https://comein-aiservice.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"내일 3시 교수님 미팅"}'
```
