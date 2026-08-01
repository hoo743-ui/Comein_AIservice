"""환경 설정 — .env / 플랫폼 환경변수 로드 (docs/14_SECURITY.md 기준으로 비밀값 관리).

배포(Render) 대시보드의 환경변수는 한 줄 텍스트 입력이라 JSON 배열을 넣기 번거롭다.
그래서 목록형 값(CORS_ORIGINS)은 **문자열로 받고 쉼표로 나눈다**. JSON 배열 형태도
그대로 허용해 기존 표기와 호환한다.

DATABASE_URL 도 Supabase/Render 가 주는 형태(`postgresql://...?sslmode=require`)를
그대로 붙여넣을 수 있도록 asyncpg 드라이버 형태로 보정한다.
"""
import json
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic_settings import BaseSettings, SettingsConfigDict

ASYNC_PG_DRIVER = "postgresql+asyncpg"
_SSL_REQUIRED_MODES = {"require", "verify-ca", "verify-full"}
# asyncpg 는 libpq 전용 쿼리 파라미터를 모르므로 URL 에서 걷어낸다.
_LIBPQ_ONLY_PARAMS = {"sslmode", "channel_binding", "target_session_attrs", "options"}


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


def _normalize_db_url(raw: str) -> tuple[str, dict]:
    """DB URL 을 (asyncpg URL, connect_args) 로 보정한다.

    - `postgres://` / `postgresql://` → `postgresql+asyncpg://`
    - `sslmode=require` 같은 libpq 전용 파라미터 → asyncpg 의 `ssl` connect_arg 로 이전
    - postgres 계열이 아니면(예: sqlite) 손대지 않는다.
    """
    parts = urlsplit(raw)
    if not parts.scheme.startswith(("postgres", "postgresql")):
        return raw, {}

    scheme = ASYNC_PG_DRIVER if "+" not in parts.scheme else parts.scheme
    connect_args: dict = {}
    kept: list[tuple[str, str]] = []
    for key, value in parse_qsl(parts.query, keep_blank_values=True):
        if key not in _LIBPQ_ONLY_PARAMS:
            kept.append((key, value))
        elif key == "sslmode" and value in _SSL_REQUIRED_MODES:
            connect_args["ssl"] = True

    url = urlunsplit((scheme, parts.netloc, parts.path, urlencode(kept), parts.fragment))
    return url, connect_args


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    ENV: str = "development"
    # 쉼표 구분. 예) https://comein.vercel.app,http://localhost:3000
    CORS_ORIGINS: str = "http://localhost:3000"
    # Vercel 프리뷰 도메인처럼 매번 바뀌는 주소용. 예) https://.*\.vercel\.app
    CORS_ORIGIN_REGEX: str = ""

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

    @property
    def cors_origins(self) -> list[str]:
        return _split_list(self.CORS_ORIGINS)

    @property
    def database_url(self) -> str:
        """asyncpg 드라이버로 보정된 DB URL (엔진·alembic 공용)."""
        return _normalize_db_url(self.DATABASE_URL)[0]

    @property
    def db_connect_args(self) -> dict:
        """URL 에서 걷어낸 sslmode 등을 드라이버 인자로 되돌린 값."""
        return _normalize_db_url(self.DATABASE_URL)[1]

    @property
    def is_production(self) -> bool:
        return self.ENV.lower() in {"production", "prod"}


settings = Settings()
