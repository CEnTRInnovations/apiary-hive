import hive.bundle_review as bundle_review


class StubProvider:
    def __init__(self, response):
        self._response = response
        self.called = False

    async def complete(self, prompt, **kwargs):
        self.called = True
        return self._response


async def test_jev_confident_skips_llm_call(monkeypatch):
    async def fake_classify(anchor, members, api_key):
        return {"choice": "ACCEPT", "probabilities": {"ACCEPT": 0.93, "SPLIT": 0.05, "REJECT": 0.02}}

    monkeypatch.setattr(bundle_review, "classify_bundle_recommendation", fake_classify)
    provider = StubProvider("should not be used")

    result = await bundle_review.review_bundle(
        "b_001", "community", ["community", "trust"], provider, jev_api_key="fake-key",
    )

    assert result["recommendation"] == "ACCEPT"
    assert result["jev_confidence"] == 0.93
    assert result["suggested_label"] is None
    assert provider.called is False


async def test_llm_review_passes_through_suggested_label(monkeypatch):
    provider = StubProvider(
        '{"recommendation": "ACCEPT", "confidence": "HIGH", "rationale": "r", '
        '"preserved_if_consolidated": "p", "flattened_if_consolidated": "f", '
        '"suggested_splits": [], "discussion_questions": [], '
        '"suggested_label": "Institutional trust"}'
    )

    result = await bundle_review.review_bundle(
        "b_001", "community", ["community", "trust"], provider, jev_api_key=None,
    )

    assert result["suggested_label"] == "Institutional trust"


async def test_jev_unconfident_falls_through_to_llm(monkeypatch):
    async def fake_classify(anchor, members, api_key):
        return {"choice": "ACCEPT", "probabilities": {"ACCEPT": 0.5, "SPLIT": 0.3, "REJECT": 0.2}}

    monkeypatch.setattr(bundle_review, "classify_bundle_recommendation", fake_classify)
    provider = StubProvider(
        '{"recommendation": "ACCEPT", "confidence": "MEDIUM", "rationale": "r", '
        '"preserved_if_consolidated": "p", "flattened_if_consolidated": "f", '
        '"suggested_splits": [], "discussion_questions": []}'
    )

    result = await bundle_review.review_bundle(
        "b_001", "community", ["community", "trust"], provider, jev_api_key="fake-key",
    )

    assert provider.called is True
    assert result["confidence"] == "MEDIUM"


async def test_no_jev_key_falls_through_to_llm(monkeypatch):
    def fail_if_called(*args, **kwargs):
        raise AssertionError("Jev must not be called when no key is configured")

    monkeypatch.setattr(bundle_review, "classify_bundle_recommendation", fail_if_called)
    provider = StubProvider(
        '{"recommendation": "REJECT", "confidence": "LOW", "rationale": "r", '
        '"preserved_if_consolidated": "p", "flattened_if_consolidated": "f", '
        '"suggested_splits": [], "discussion_questions": []}'
    )

    result = await bundle_review.review_bundle(
        "b_001", "community", ["community", "trust"], provider, jev_api_key=None,
    )

    assert provider.called is True
    assert result["recommendation"] == "REJECT"
