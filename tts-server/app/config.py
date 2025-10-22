from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    API_KEY: str
    VOICES_DIR: str = str(Path.home() / "verisum-tts-server" / "voices")
    MODEL_CACHE_DIR: str = str(Path.home() / "verisum-tts-server" / "models")
    CACHE_DIR: str = str(Path.home() / "verisum-tts-server" / "cache")
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    class Config:
        env_file = ".env"

settings = Settings()
