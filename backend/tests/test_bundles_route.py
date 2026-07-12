import pytest
from httpx import AsyncClient, ASGITransport
from main import app


EDGES = [
    {"from_term": "community", "to_term": "trust", "weight": 1.0, "effect": 1, "composite_id": "C01"},
    {"from_term": "trust", "to_term": "safety", "weight": 1.0, "effect": 1, "composite_id": "C01"},
]
TERMS = [
    {"term": "community", "frequency": 1},
    {"term": "trust", "frequency": 2},
    {"term": "safety", "frequency": 1},
]


@pytest.mark.asyncio
async def test_compute_bundles():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/bundles/compute",
            json={"edges": EDGES, "terms": TERMS, "sem_thresh": 0.65, "struct_thresh": 0.48},
        )
    assert resp.status_code == 200
    bundles = resp.json()
    assert isinstance(bundles, list)
    assert len(bundles) >= 1
    all_members = [m for b in bundles for m in b["members"]]
    assert set(all_members) == {"community", "trust", "safety"}


@pytest.mark.asyncio
async def test_compute_bundles_no_edges_returns_400():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/bundles/compute",
            json={"edges": [], "terms": TERMS, "sem_thresh": 0.65, "struct_thresh": 0.48},
        )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_test_model_bad_endpoint_returns_not_ok():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/test-model",
            json={"llm_config": {"endpoint": "http://localhost:9999/v1", "model": "x", "api_key": ""}},
        )
    assert resp.status_code == 200
    assert resp.json()["ok"] is False


@pytest.mark.asyncio
async def test_review_bundle_owner_token_takes_precedence_over_byom(monkeypatch):
    from config import settings
    import routers.bundles as bundles_route

    monkeypatch.setattr(settings, "owner_access_token", "secret-token")

    class StubProvider:
        async def complete(self, prompt, **kwargs):
            return (
                '{"recommendation": "ACCEPT", "confidence": "HIGH", "rationale": "r", '
                '"preserved_if_consolidated": "p", "flattened_if_consolidated": "f", '
                '"suggested_splits": [], "discussion_questions": []}'
            )

    monkeypatch.setattr(bundles_route, "get_default_llm_provider", lambda cfg: StubProvider())

    def _fail_if_byom_used(*args, **kwargs):
        raise AssertionError("BYOM provider must not be constructed when owner token is valid")

    monkeypatch.setattr(bundles_route, "OpenAICompatProvider", _fail_if_byom_used)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/bundles/review",
            headers={"X-Owner-Token": "secret-token"},
            json={
                "bundle_id": "b_001",
                "anchor": "community",
                "members": ["community", "trust"],
                "llm_config": {"endpoint": "http://localhost:9999/v1", "model": "x", "api_key": ""},
            },
        )
    assert resp.status_code == 200
    assert resp.json()["ai_review"]["recommendation"] == "ACCEPT"


@pytest.mark.asyncio
async def test_compute_bundles_owner_token_uses_default_llm_config(monkeypatch):
    from config import settings
    import hive.nlp as nlp_module

    monkeypatch.setattr(settings, "owner_access_token", "secret-token")
    monkeypatch.setattr(settings, "do_inference_chat_model", "default-embed-model")
    monkeypatch.setattr(settings, "do_inference_base_url", "http://default-endpoint/v1")
    monkeypatch.setattr(settings, "do_inference_api_key", "")

    seen_kwargs = {}

    async def fake_get_embeddings(terms, endpoint, model, api_key):
        seen_kwargs.update(endpoint=endpoint, model=model, api_key=api_key)
        return {t: [0.1, 0.2] for t in terms}

    monkeypatch.setattr(nlp_module, "get_embeddings", fake_get_embeddings)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/bundles/compute",
            headers={"X-Owner-Token": "secret-token"},
            json={
                "edges": EDGES,
                "terms": TERMS,
                "sem_thresh": 0.65,
                "struct_thresh": 0.48,
                "llm_config": {
                    "endpoint": "http://should-not-be-used/v1",
                    "model": "wrong-model",
                    "api_key": "wrong-key",
                },
            },
        )
    assert resp.status_code == 200
    assert seen_kwargs == {
        "endpoint": "http://default-endpoint/v1",
        "model": "default-embed-model",
        "api_key": None,
    }
