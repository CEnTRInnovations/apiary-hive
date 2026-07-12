import logging
from typing import TYPE_CHECKING

from hive.lm import LLMProvider, LMStudioProvider, OpenAICompatProvider

if TYPE_CHECKING:
    from config import Settings

logger = logging.getLogger(__name__)


def get_default_llm_provider(settings: "Settings") -> LLMProvider | None:
    """Server-side default provider — used only when a request doesn't supply its own
    llm_config (i.e. no per-user BYO endpoint entered in the Settings panel). Mirrors
    CEnTR*CANON's get_llm_provider priority (canon/lm_factory.py): DigitalOcean Serverless
    Inference first, then local LM Studio for dev.

    Returns None if neither is configured — callers should treat that the same as "no
    default available," same as an unconfigured llm_config behaves today.
    """
    if settings.do_inference_chat_model:
        return OpenAICompatProvider(
            base_url=settings.do_inference_base_url,
            model=settings.do_inference_chat_model,
            api_key=settings.do_inference_api_key or None,
            timeout_seconds=settings.llm_timeout_seconds,
        )

    if settings.studio_lm_chat_model:
        return LMStudioProvider(
            base_url=settings.studio_lm_base_url,
            model=settings.studio_lm_chat_model,
            timeout_seconds=settings.llm_timeout_seconds,
        )

    logger.info(
        "No server-side default LLM configured "
        "(DO_INFERENCE_CHAT_MODEL / STUDIO_LM_CHAT_MODEL unset)"
    )
    return None
