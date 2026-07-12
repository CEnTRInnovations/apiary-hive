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
