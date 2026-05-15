from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str

    # faster-whisper model settings
    whisper_model: str = "tiny"          # tiny | base | small | medium | large-v2 | large-v3
    whisper_device: str = "cpu"          # cpu | cuda
    whisper_compute_type: str = "int8"   # int8 (cpu) | float16 (gpu) | float32

    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "llama3"

    class Config:
        env_file = ".env"


settings = Settings()
