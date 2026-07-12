import pytest
from unittest.mock import AsyncMock, patch
from hive.lm import OpenAICompatProvider
from hive.bundle_review import review_bundle


@pytest.mark.asyncio
async def test_openai_compat_returns_none_on_failure():
    provider = OpenAICompatProvider(
        base_url="http://localhost:9999/v1",
        model="test-model",
    )
    # Port 9999 is not listening — httpx will raise a connection error
    result = await provider.complete("test prompt")
    assert result is None


@pytest.mark.asyncio
async def test_review_bundle_returns_none_when_provider_fails():
    provider = OpenAICompatProvider(
        base_url="http://localhost:9999/v1",
        model="test-model",
    )
    result = await review_bundle("b_001", "community", ["community", "trust"], provider)
    assert result is None


@pytest.mark.asyncio
async def test_review_bundle_parses_valid_json():
    valid_response = '{"recommendation":"ACCEPT","confidence":"HIGH","rationale":"r","preserved_if_consolidated":"p","flattened_if_consolidated":"f","suggested_splits":[],"discussion_questions":["q1"]}'

    class FakeProvider:
        async def complete(self, prompt, **kwargs):
            return valid_response

    result = await review_bundle("b_001", "community", ["community", "trust"], FakeProvider())
    assert result is not None
    assert result["recommendation"] == "ACCEPT"
