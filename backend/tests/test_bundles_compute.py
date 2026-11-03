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


def test_compute_bundles_does_not_chain_dissimilar_terms():
    # "trust" and "transparency" are only similar to "accountability", not to each other.
    # Single-linkage used to pull all three into one bundle; average-linkage stops after
    # accountability+trust because the cluster's mean similarity to transparency is 0.5.
    edges = pd.DataFrame({"from": ["trust", "accountability"], "to": ["foo", "bar"], "weight": 1.0})
    terms = pd.DataFrame({
        "term": ["trust", "accountability", "transparency"],
        "frequency": [3, 2, 1],
    })
    embedding_sim = {
        ("accountability", "trust"): 0.9,
        ("accountability", "transparency"): 0.9,
        ("transparency", "trust"): 0.1,
    }
    result = compute_bundles(
        edges, terms, sem_thresh=0.65, struct_thresh=0.48, embedding_sim=embedding_sim,
    )
    members = sorted(sorted(b.members) for b in result)
    assert members == [["accountability", "trust"], ["transparency"]]
    assert all(b.weak_pairs == [] for b in result)


def test_compute_bundles_flags_pair_below_threshold_as_weak():
    # a-b and a-c are strong, b-c is weak (0.4), but {a,b} vs c averages 0.7 >= 0.65, so the
    # bundle forms; the b/c pair is reported as not directly verified.
    edges = pd.DataFrame({"from": ["a"], "to": ["z"], "weight": 1.0})
    terms = pd.DataFrame({"term": ["a", "b", "c"], "frequency": [1, 1, 1]})
    embedding_sim = {("a", "b"): 0.95, ("a", "c"): 1.0, ("b", "c"): 0.4}
    result = compute_bundles(edges, terms, sem_thresh=0.65, struct_thresh=0.48, embedding_sim=embedding_sim)
    assert len(result) == 1
    assert result[0].weak_pairs == [("b", "c")]


def test_compute_bundles_fully_verified_bundle_has_no_weak_pairs():
    # a and b share a structural neighbor (z) so struct also clears threshold, not just sem.
    edges = pd.DataFrame({"from": ["a", "b"], "to": ["z", "z"], "weight": [1.0, 1.0]})
    terms = pd.DataFrame({"term": ["a", "b"], "frequency": [1, 1]})
    embedding_sim = {("a", "b"): 0.9}
    result = compute_bundles(
        edges, terms, sem_thresh=0.65, struct_thresh=0.48, embedding_sim=embedding_sim,
    )
    assert len(result) == 1
    assert result[0].weak_pairs == []
