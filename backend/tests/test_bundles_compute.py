import pandas as pd
from hive.bundles import compute_bundles


def test_compute_bundles_returns_list():
    edges = pd.DataFrame({
        "from": ["community", "community", "trust"],
        "to":   ["trust",     "engagement", "safety"],
        "weight": [1.0, 1.0, 1.0],
    })
    terms = pd.DataFrame({
        "term": ["community", "trust", "engagement", "safety"],
        "frequency": [2, 2, 1, 1],
    })
    result = compute_bundles(edges, terms, sem_thresh=0.65, struct_thresh=0.48)
    assert isinstance(result, list)
    all_members = [m for b in result for m in b.members]
    assert set(all_members) == {"community", "trust", "engagement", "safety"}


def test_compute_bundles_empty_returns_singletons():
    edges = pd.DataFrame({"from": ["a"], "to": ["b"], "weight": [1.0]})
    terms = pd.DataFrame({"term": ["a", "b"], "frequency": [1, 1]})
    result = compute_bundles(edges, terms, sem_thresh=0.65, struct_thresh=0.48)
    assert len(result) >= 1
