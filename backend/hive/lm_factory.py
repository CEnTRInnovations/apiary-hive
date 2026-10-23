import logging
from typing import TYPE_CHECKING

from hive.lm import LLMProvider, OpenAICompatProvider

if TYPE_CHECKING:
    from config import Settings

logger = logging.getLogger(__name__)


def get_default_llm_provider(settings: "Settings") -> LLMProvider | None:
    """Server-side default provider — used only when a request doesn't supply its own
    llm_config (i.e. no per-user BYO endpoint entered in the Settings panel) and carries a
    valid X-Owner-Token. Backed by OpenRouter.

    Returns None if OPENROUTER_API_KEY isn't configured — callers should treat that the same
    as "no default available," same as an unconfigured llm_config behaves today.
    """
    if not settings.openrouter_api_key:
        logger.info("No server-side default LLM configured (OPENROUTER_API_KEY unset)")
        return None
    return OpenAICompatProvider(
        base_url=settings.openrouter_base_url,
        model=settings.openrouter_chat_model,
        api_key=settings.openrouter_api_key,
        timeout_seconds=settings.llm_timeout_seconds,
    )
