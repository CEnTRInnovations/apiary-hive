from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    llm_timeout_seconds: float = 30.0

    # Server-side default LLM provider — used only when a request doesn't supply its own
    # llm_config (i.e. the user hasn't entered a BYO endpoint in the Settings panel) and
    # carries a valid X-Owner-Token (see hive/auth.py). Backed by OpenRouter, same key as
    # the Jev pre-filter below.
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_chat_model: str = "mistralai/mistral-small-3.2-24b-instruct"
    openrouter_embed_model: str = "nvidia/nemotron-3-embed-1b:free"
    # Pairwise term-synonym signal for bundling (hive/nlp.get_decision_sim), via the same
    # alpha Decisions API as the Jev pre-filter below — a calibrated yes/no probability per
    # pair instead of embedding cosine distance. Owner-gated default only (see
    # routers/bundles.py); BYOM requests still use get_embeddings since Decisions is
    # OpenRouter-specific, not a generic OpenAI-compat endpoint.
    openrouter_decision_model: str = "liquid/d1.1"

    # Shared OpenRouter key: powers both the owner-gated default provider above and the
    # fast pre-filter for bundle review (hive/jev.py, TypeSafe's Jev model via OpenRouter's
    # Decisions API — a classifier, not a chat-completions call, so it can't reuse
    # OpenAICompatProvider). Empty = both disabled; everyone falls through to BYOM / the
    # full LLM call as before.
    openrouter_api_key: str = ""

    # Gates the server-side default provider (DO/LM Studio) on the *deployed* app.
    # Anonymous visitors to a shared deployment must always BYO — the fallback above is
    # meant for the person operating the deployment, not every visitor. A request is only
    # treated as "the owner" if it sends the matching X-Owner-Token header (see
    # hive/auth.py). Leave blank to disable the gate entirely (e.g. local dev, or a
    # single-operator deployment where everyone hitting it *is* you).
    owner_access_token: str = ""


settings = Settings()
