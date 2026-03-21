from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import TYPE_CHECKING


class Settings(BaseSettings):
    DATABASE_URL:        str
    ASYNC_DATABASE_URL:  str
    YOLO_MODEL_PATH:     str
    YOLO_MODEL_PATH_2:   str   = "./best_v2.pt"
    YOLO_CONF_THRESHOLD: float = 0.15

    REDIS_URL:           str | None = None
    MAP_API_KEY:         str | None = None
    OPENROUTER_API_KEY:  str | None = None
    OPEN_AI_API_KEY:     str | None = None
    ROBOFLOW_API_KEY:    str | None = None
    GROQ_API_KEY:        str | None = None

    JWT_SECRET_KEY:  str = "dev-secret"
    JWT_ALGORITHM:   str = "HS256"
    LOG_LEVEL:       str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


if TYPE_CHECKING:
    settings = Settings(
        DATABASE_URL="",
        ASYNC_DATABASE_URL="",
        YOLO_MODEL_PATH="",
    )
else:
    settings = Settings()