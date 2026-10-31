import pytest

import hive.nlp as nlp


@pytest.mark.asyncio
async def test_get_decision_sim_builds_canonical_keyed_dict(monkeypatch):
    async def fake_pair_sim(client, model, headers, a, b):
        return {("airport", "pilot"): 0.9, ("airport", "ticket"): 0.1}.get((a, b), 0.0)

    monkeypatch.setattr(nlp, "_decision_pair_sim", fake_pair_sim)

    result = await nlp.get_decision_sim(["ticket", "airport", "pilot"], model="x", api_key="k")

    assert result == {
        ("airport", "pilot"): 0.9,
        ("airport", "ticket"): 0.1,
        ("pilot", "ticket"): 0.0,
    }


@pytest.mark.asyncio
async def test_get_decision_sim_drops_failed_pairs(monkeypatch):
    async def fake_pair_sim(client, model, headers, a, b):
        return None

    monkeypatch.setattr(nlp, "_decision_pair_sim", fake_pair_sim)

    result = await nlp.get_decision_sim(["a", "b"], model="x", api_key="k")

    assert result is None


@pytest.mark.asyncio
async def test_get_decision_sim_empty_terms_returns_empty_dict():
    result = await nlp.get_decision_sim([], model="x", api_key="k")
    assert result == {}
