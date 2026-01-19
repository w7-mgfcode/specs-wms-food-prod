"""Application configuration using pydantic-settings."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql+asyncpg://admin:password@localhost:5432/flowviz"

    # Authentication
    # WARNING: Insecure dev default - MUST be overridden via environment variable in production
    secret_key: str = "INSECURE-DEV-ONLY-CHANGE-ME"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30

    # Cache (Valkey/Redis)
    redis_url: str = "redis://localhost:6379/0"

    # Celery
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/0"

    # Environment
    environment: str = "development"
    debug: bool = True

    # CORS - comma-separated list of allowed origins
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        """Parse allowed_origins string to list."""
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment.lower() == "production"

    def validate_production_settings(self) -> None:
        """
        Validate that production-critical settings are properly configured.

        Raises:
            ValueError: If production settings are insecure.
        """
        if self.is_production:
            # Fail fast if using insecure default secret key in production
            if "INSECURE" in self.secret_key or len(self.secret_key) < 32:
                raise ValueError(
                    "SECRET_KEY must be set to a secure value (min 32 chars) "
                    "in production. Set the SECRET_KEY environment variable."
                )
            # Ensure debug is disabled in production
            if self.debug:
                raise ValueError(
                    "DEBUG must be False in production. "
                    "Set DEBUG=false in environment."
                )


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    instance = Settings()
    instance.validate_production_settings()
    return instance


settings = get_settings()
