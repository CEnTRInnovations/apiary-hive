import json

from hive.partition import partition_terms, validate_partition


class StubProvider:
    def __init__(self, response):
        self._response = response

    async def complete(self, prompt, **kwargs):
        return self._response


def test_validate_repairs_into_a_true_partition():
    terms = ["a", "b", "c", "d"]
    parsed = {"bundles": [
        {"label": "A & B", "members": ["a", "b", "zzz"], "rationale": "x"},
        {"label": "dup", "members": ["b", "c"], "rationale": "y"},
    ]}
    out = validate_partition(terms, parsed)
    flat = [m for b in out["bundles"] for m in b["members"]]
    assert sorted(flat) == terms  # each term exactly once
    assert out["repairs"] == {"unknown": ["zzz"], "duplicate": ["b"], "missing": ["d"]}


async def test_partition_terms_parses_fenced_json_and_dedupes_input():
    body = json.dumps({"bundles": [
        {"label": "Funding & Resources", "members": ["Funding", "Grant Funding"],
         "rationale": "same"},
    ]})
    out = await partition_terms(["Funding", "Grant Funding", "Funding"], StubProvider(f"```json\n{body}\n```"))
    assert [b["members"] for b in out["bundles"]] == [["Funding", "Grant Funding"]]
    assert out["repairs"] == {"unknown": [], "duplicate": [], "missing": []}


async def test_partition_terms_returns_none_on_provider_failure_or_bad_json():
    assert await partition_terms(["a"], StubProvider(None)) is None
    assert await partition_terms(["a"], StubProvider("not json")) is None
