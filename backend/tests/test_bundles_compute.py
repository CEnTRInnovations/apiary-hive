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


def test_compute_bundles_flags_chained_pair_as_weak():
    # "trust" and "transparency" are never found similar to each other directly — they
    # only end up in the same bundle because "accountability" is similar to both. That's
    # single-linkage chaining; weak_pairs should flag the trust/transparency pair as
    # never pairwise-verified.
    # accountability shares a structural neighbor with each of trust/transparency (but
    # trust and transparency share no structural neighbor), and embeddings agree — so
    # both struct and sem clear threshold for the two "real" pairs (edges now require
    # both, not either).
    edges = pd.DataFrame({
        "from": ["trust", "accountability", "accountability"],
        "to":   ["foo",   "foo",            "bar"],
    })
    edges = pd.concat([edges, pd.DataFrame({"from": ["transparency"], "to": ["bar"]})])
    edges["weight"] = 1.0
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
    assert len(result) == 1
    bundle = result[0]
    assert set(bundle.members) == {"trust", "accountability", "transparency"}
    assert bundle.weak_pairs == [("transparency", "trust")]


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
