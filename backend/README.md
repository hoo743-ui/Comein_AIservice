# Comein Backend

FastAPI 기반 API Gateway + Data Layer 연동. 상세: [`../docs/06_BACKEND.md`](../docs/06_BACKEND.md)

## 구조

```
backend/
├── app/
│   ├── main.py          # FastAPI 진입점
│   ├── api/
│   │   ├── router.py    # 라우터 집약
│   │   └── endpoints/   # 도메인별 엔드포인트 (chat, schedule, todo, memo, meeting)
│   ├── core/            # 설정, 보안(JWT), DB 세션
│   ├── models/          # SQLAlchemy ORM (docs/09_DATABASE.md)
│   ├── schemas/         # Pydantic 요청/응답 (docs/10_API.md 계약)
│   └── services/        # 비즈니스 로직, 외부 연동
└── requirements.txt
```

## 개발

```bash
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
cp .env.example .env         # 값 채우기
uvicorn app.main:app --reload
```

- API 문서: http://localhost:8000/docs
- 헬스체크: http://localhost:8000/health
