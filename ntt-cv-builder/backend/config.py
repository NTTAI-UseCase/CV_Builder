"""Application settings loaded from environment variables."""
from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), env_file_encoding="utf-8")

    # OpenAI
    openai_api_key: str
    openai_model: str = "gpt-4o"
    openai_embedding_model: str = "text-embedding-3-large"
    embedding_model: str = "text-embedding-3-large"

    # RAG
    rag_chunk_size: int = 500
    rag_chunk_overlap: int = 50

    # Storage
    chroma_persist_dir: str = "./chroma_db"
    output_dir: str = "./output_files"

    # Session
    redis_url: Optional[str] = None
    session_ttl_seconds: int = 3600  # 1 hour

    # Upload
    max_upload_size_mb: int = 10

    # App
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:8000"]
    log_level: str = "INFO"
    app_name: str = "NTT Data Smart CV Builder"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024


@lru_cache()
def get_settings() -> Settings:
    return Settings()
