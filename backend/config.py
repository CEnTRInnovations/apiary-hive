from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    llm_timeout_seconds: float = 30.0

    # Server-side default LLM provider — used only when a request doesn't supply its own
    # llm_config (i.e. the user hasn't entered a BYO endpoint in the Settings panel). Priority
    # mirrors CEnTR*CANON's convention (apps/api/config.py + canon/lm_factory.py in
    # centrcanonapp-next): DigitalOcean Serverless Inference first, then local LM Studio for
    # dev. Unlike CANON, there is no Bedrock tier here — Apiary Hive has no AWS/boto3
    # dependency today, and adding one is a real scope decision (new cloud dependency + AWS
    # credential surface), not something to add silently. If you want that third fallback
    # tier, mirror BedrockProvider from centrcanonapp-next's canon/lm.py into hive/lm.py.
    do_inference_base_url: str = "https://inference.do-ai.run/v1"
    do_inference_api_key: str = ""
    do_inference_chat_model: str = ""  # empty = not configured

    studio_lm_base_url: str = "http://127.0.0.1:1234/v1"
    studio_lm_chat_model: str = ""  # empty = not configured; local dev only


settings = Settings()
