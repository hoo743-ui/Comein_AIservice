"""환경 설정 — .env 로드 (docs/14_SECURITY.md 기준으로 비밀값 관리)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    ENV: str = "development"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Data Layer
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/comein"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Auth (JWT)
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # LLM Providers (docs/07_AI_SYSTEM.md — 쿼터 이원화)
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""


settings = Settings()
