"""환경 설정 — .env / 플랫폼 환경변수 로드 (docs/14_SECURITY.md 기준으로 비밀값 관리).

배포(Render) 대시보드의 환경변수는 한 줄 텍스트 입력이라 JSON 배열을 넣기 번거롭다.
그래서 목록형 값(CORS_ORIGINS)은 **문자열로 받고 쉼표로 나눈다**. JSON 배열 형태도
그대로 허용해 기존 표기와 호환한다.

DB 설정은 없다. 이 서버는 DB 에 붙지 않는다 — 저장은 프론트가 Supabase 로
직행하고, 여기는 AI 파싱만 한다(docs/24 §16). `DATABASE_URL` 을 asyncpg 형태로
보정하던 코드도 함께 걷었다.
"""
import json

from pydantic_settings import BaseSettings, SettingsConfigDict


def _split_list(raw: str) -> list[str]:
    """`a,b` 또는 `["a","b"]` 둘 다 리스트로 만든다."""
    value = raw.strip()
    if not value:
        return []
    if value.startswith("["):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    ENV: str = "development"
    # 쉼표 구분. 예) https://comein.vercel.app,http://localhost:3000
    CORS_ORIGINS: str = "http://localhost:3000"
    # Vercel 프리뷰 도메인처럼 매번 바뀌는 주소용. 예) https://.*\.vercel\.app
    CORS_ORIGIN_REGEX: str = ""

    # Auth (JWT) — 아직 쓰이는 곳이 없다. 인증은 지금 Supabase Auth 가 프론트에서 맡는다.
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # LLM Providers (docs/07_AI_SYSTEM.md — 쿼터 이원화)
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""

    @property
    def cors_origins(self) -> list[str]:
        return _split_list(self.CORS_ORIGINS)

    @property
    def is_production(self) -> bool:
        return self.ENV.lower() in {"production", "prod"}


settings = Settings()
