# Comein Backend

**자연어 파싱 전용 서버.** 상세: [`../docs/06_BACKEND.md`](../docs/06_BACKEND.md)

이 서버가 하는 일은 둘뿐이다 — 한 마디를 항목으로 가르고(`/api/chat`),
대화를 요약으로 접는다(`/api/summary`). **상태를 두지 않는다.**

저장·조회·인증은 여기를 지나지 않는다. 프론트가 Supabase 에 직접 붙는다
(`frontend/src/lib/remote.ts`, RLS + Realtime). 예전에는 `/api/items` 로 저장하는
SQLAlchemy 경로(models · alembic · items_service)가 함께 있었지만, 저장처가 옮겨간 뒤
아무도 부르지 않아 걷어냈다 — 사정은 [`../docs/24_AI_PIPELINE_STATUS.md`](../docs/24_AI_PIPELINE_STATUS.md) §16.

## 구조

```
backend/
├── app/
│   ├── main.py          # FastAPI 진입점 (/health)
│   ├── api/
│   │   ├── router.py    # 라우터 집약
│   │   └── endpoints/   # chat.py · summary.py — 이 둘이 전부다
│   ├── core/            # config.py (설정) — DB 세션은 없다
│   └── schemas/         # ParsedItem(AI 결과 검증) · AiResult(응답 계약)
└── requirements.txt
```

## 개발

```bash
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
cp .env.example .env         # GEMINI_API_KEY · GROQ_API_KEY 만 채우면 된다
uvicorn app.main:app --reload
```

- API 문서: http://localhost:8000/docs
- 헬스체크: http://localhost:8000/health

> `/health/db` 는 없다. DB 를 쓰는 경로가 사라지면서, 아무것도 지키지 않으면서
> 옛 DB 를 가리켜 `down` 을 띄우는 표시등만 남아 함께 걷었다.

## 배포

Render(무료 티어)에 배포한다. 서비스 정의는 레포 루트 [`render.yaml`](../render.yaml),
절차·환경변수·콜드스타트 대응은 [`../docs/15_DEPLOY.md`](../docs/15_DEPLOY.md).
