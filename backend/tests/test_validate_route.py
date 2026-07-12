import io
import json
import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.mark.asyncio
async def test_validate_csv():
    csv_content = b"from,to,weight\ncommunity,trust,1\ntrust,safety,2\n"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/validate",
            files={"file": ("test.csv", io.BytesIO(csv_content), "text/csv")},
            data={"contributor_label": "Group A"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in ("VALID", "NO_WEIGHT")
    assert body["n_terms"] == 3
    assert body["n_edges"] == 2
    assert body["contributor_label"] == "Group A"


@pytest.mark.asyncio
async def test_validate_bee():
    bee = {
        "version": "1.0",
        "contributor": {"label": "Hive B"},
        "edges": [
            {"from": "community", "to": "trust", "weight": 1, "effect": 1},
            {"from": "trust", "to": "safety", "weight": 1, "effect": -1},
        ],
    }
    content = json.dumps(bee).encode()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/validate",
            files={"file": ("test.bee", io.BytesIO(content), "application/json")},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["contributor_label"] == "Hive B"
    assert body["contributor_id"] == ""
    assert body["n_negative"] == 1
    assert body["n_positive"] == 1


@pytest.mark.asyncio
async def test_validate_bee_with_contributor_id():
    bee = {
        "version": "1.0",
        "contributor": {"label": "Hive B", "id": "C02"},
        "edges": [{"from": "community", "to": "trust", "weight": 1, "effect": 1}],
    }
    content = json.dumps(bee).encode()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/validate",
            files={"file": ("test.bee", io.BytesIO(content), "application/json")},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["contributor_label"] == "Hive B"
    assert body["contributor_id"] == "C02"


@pytest.mark.asyncio
async def test_validate_bee_form_fields_override_embedded_contributor():
    bee = {
        "contributor": {"label": "Hive B", "id": "C02"},
        "edges": [{"from": "a", "to": "b"}],
    }
    content = json.dumps(bee).encode()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/validate",
            files={"file": ("test.bee", io.BytesIO(content), "application/json")},
            data={"contributor_label": "Manual Label", "contributor_id": "C99"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["contributor_label"] == "Manual Label"
    assert body["contributor_id"] == "C99"


@pytest.mark.asyncio
async def test_validate_schema_mismatch_returns_422():
    csv_content = b"x,y\na,b\n"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/validate",
            files={"file": ("bad.csv", io.BytesIO(csv_content), "text/csv")},
        )
    assert resp.status_code == 422
