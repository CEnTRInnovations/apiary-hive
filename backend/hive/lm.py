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


class LMStudioProvider:
    """LM Studio native API — POST /api/v1/chat. Local-dev-only provider, ported from
    CEnTR*CANON's canon/lm.py for the same server-side-default-provider use case.

    Request format: {"model": "...", "input": "<prompt string>"}
    (uses "input" string, not OpenAI "messages" array — see LM Studio API docs)

    Accepts the same base_url as OpenAICompatProvider (e.g. http://127.0.0.1:1234/v1);
    strips the /v1 suffix to derive the server root and posts to /api/v1/chat.
    """

    def __init__(
        self,
        base_url: str,
        model: str,
        api_key: str | None = None,
        timeout_seconds: float = 30.0,
    ) -> None:
        server_root = base_url.rstrip("/").removesuffix("/v1")
        self._chat_url = f"{server_root}/api/v1/chat"
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
            "input": prompt,
        }
        if "temperature" in kwargs:
            payload["temperature"] = kwargs["temperature"]
        logger.info("LM Studio call → %s  model=%s", self._chat_url, self._model)
        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                resp = await client.post(self._chat_url, json=payload, headers=headers)
                resp.raise_for_status()
                return self._extract_message(resp.json())
        except Exception as exc:
            logger.warning("LM Studio native call failed: %s", exc)
            return None

    @staticmethod
    def _extract_message(data: object) -> str | None:
        if not isinstance(data, dict):
            return None
        output = data.get("output")
        if not isinstance(output, list):
            return None
        for item in output:
            if isinstance(item, dict) and item.get("type") == "message":
                content = item.get("content")
                if isinstance(content, str):
                    return content
        return None
