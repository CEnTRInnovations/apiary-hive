import logging
from typing import Protocol, runtime_checkable

logger = logging.getLogger(__name__)


@runtime_checkable
class LLMProvider(Protocol):
    async def complete(self, prompt: str, **kwargs: object) -> str | None: ...


class OpenAICompatProvider:
    def __init__(
        self,
        base_url: str,
        model: str,
        api_key: str | None = None,
        timeout_seconds: float = 30.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._api_key = api_key
        self._timeout_seconds = timeout_seconds

    async def complete(self, prompt: str, **kwargs: object) -> str | None:
        import httpx

        headers: dict[str, str] = {}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        payload: dict[str, object] = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
        }
        payload.update(kwargs)
        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                resp = await client.post(
                    f"{self._base_url}/chat/completions",
                    json=payload,
                    headers=headers,
                )
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
        except Exception as exc:
            logger.warning("OpenAI-compat call failed: %s", exc)
            return None
