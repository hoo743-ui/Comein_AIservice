"""Comein Backend — FastAPI 진입점.

이 서버가 하는 일은 **AI 파싱 하나**다. 클라이언트의 자연어를 받아
AI Workspace Engine(`ai/`)에 넘기고 결과를 돌려준다 — 상태를 두지 않는다.

데이터는 여기를 지나지 않는다. 프론트가 Supabase 에 직접 붙는다.
상세 설계: ../docs/06_BACKEND.md, ../docs/10_API.md
"""
from dotenv import load_dotenv

load_dotenv()  # .env 값을 os.environ 으로 — ai/ 쪽이 환경변수를 직접 읽는다

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings

app = FastAPI(
    title="Comein API",
    description="대화형 AI 워크스페이스 백엔드 — 자연어 파싱·요약",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    """Render 헬스체크용.

    예전에는 `/health/db` 가 따로 있었다. DB 를 왕복해 Supabase 를 깨우는
    용도였는데, 그 DB 를 쓰던 라우터들이 사라지면서 아무것도 재우지 않고
    아무것도 지키지 않는 표시등만 남았다 — 게다가 옛 DB 를 가리킨 채
    `down` 을 띄워 고장으로 읽혔다. 함께 걷었다(docs/24 §16).
    """
    return {"status": "ok", "env": settings.ENV}
