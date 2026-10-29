
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mongodb_uri: str
    mongodb_db: str = "agentgov"
    agentgov_demo_mode: bool = False
    gemini_api_key: str
    gemini_model: str = "gemini-3.8-flash"

    frontend_origin: str = "http://localhost:5173"
    jwt_secret: str = "development-only-change-this-secret"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=False,
    )


settings = Settings()
