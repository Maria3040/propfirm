from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    http_port: int = 6080
    database_url: str = "postgresql+psycopg://propfirm:propfirm_dev@127.0.0.1:15433/propfirm"
    redis_url: str = "redis://127.0.0.1:6380/0"
    jwt_key: str = "propfirm-dev-signing-key-32chars!!"
    jwt_issuer: str = "propfirm"
    jwt_audience: str = "propfirm-clients"
    auth_cookie_name: str = "propfirm_access"
    cors_origin: str = "http://localhost:3100,http://127.0.0.1:3100"
    smtp_host: str = "127.0.0.1"
    smtp_port: int = 2525
    smtp_from: str = "noreply@propfirm.local"
    env: str = "development"
    catalog_cache_ttl_seconds: int = 60
    login_rate_limit_max: int = 30
    login_rate_limit_window_seconds: int = 60

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origin.split(",") if o.strip()]

    @property
    def production(self) -> bool:
        return self.env.lower() in {"production", "prod"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
