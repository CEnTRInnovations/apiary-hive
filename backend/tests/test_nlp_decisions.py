import httpx
import pytest

import hive.nlp as nlp


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


class _FakeAsyncClient:
    def __init__(self, payload=None, exc=None, **kwargs):
        self._payload = payload
        self._exc = exc

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, json=None, headers=None):
        if self._exc:
            raise self._exc
        return _FakeResponse(self._payload)


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


@pytest.mark.asyncio
async def test_choose_anchor_returns_the_chosen_member(monkeypatch):
    payload = {"answers": {"anchor": {"type": "choice", "choice": "airplane", "confidence": 0.8, "probabilities": {}}}}
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(payload=payload))

    result = await nlp.choose_anchor(["plane", "airplane", "aeroplane"], model="x", api_key="k")

    assert result == "airplane"


@pytest.mark.asyncio
async def test_choose_anchor_rejects_out_of_set_answer(monkeypatch):
    payload = {"answers": {"anchor": {"type": "choice", "choice": "hallucinated-term", "confidence": 0.5, "probabilities": {}}}}
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(payload=payload))

    result = await nlp.choose_anchor(["plane", "airplane"], model="x", api_key="k")

    assert result is None


@pytest.mark.asyncio
async def test_choose_anchor_returns_none_on_failure(monkeypatch):
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(exc=RuntimeError("boom")))

    result = await nlp.choose_anchor(["plane", "airplane"], model="x", api_key="k")

    assert result is None
