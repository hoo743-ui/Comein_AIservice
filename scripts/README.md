# scripts/ — 손으로 돌려보는 확인용 스크립트

테스트 스위트(`backend/tests/`)가 아니라, **개발 중 눈으로 확인할 때** 쓰는 것들이다.
레포 루트에서 실행한다. 값은 `backend/.env` 에서 읽는다(커밋되지 않는 파일).

| 파일 | 용도 | 실행 |
|------|------|------|
| `check_models.py` | **데모 전 사전 점검** — 코드가 부르는 모델이 두 Provider 에 오늘도 있는가 | `python scripts/check_models.py` |
| `smoke_router.py` | 한 문장을 AI 파이프라인에 넣어 결과 JSON 확인 | `python scripts/smoke_router.py` |

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
