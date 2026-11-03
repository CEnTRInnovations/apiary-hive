from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations

import pandas as pd
from rapidfuzz import distance as rfd

SEM_THRESH_DEFAULT: float = 0.65
STRUCT_THRESH_DEFAULT: float = 0.48
STRUCT_EQUIV_THRESH: float = 0.85
K_MAX: int = 8


@dataclass
class Bundle:
    id: str
    anchor: str
    label: str | None
    members: list[str]
    decision: str | None
    sim_score: float
    struct: float
    semantic: float
    ai_review: dict | None = field(default=None)
    # Member pairs that individually fall below sem_thresh — present because the bundle's
    # members are similar on average (average-linkage), not pairwise. Non-empty means some
    # members were not directly verified against each other. Detection only.
    weak_pairs: list[tuple[str, str]] = field(default_factory=list)


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 0.0
    return len(a & b) / len(a | b)


def _neighbor_sets(edges: pd.DataFrame) -> dict[str, set[str]]:
    neighbors: dict[str, set[str]] = {}
    for _, row in edges.iterrows():
        f, t = str(row["from"]), str(row["to"])
        neighbors.setdefault(f, set()).add(t)
        neighbors.setdefault(t, set()).add(f)
    return neighbors


def _average_linkage(
    terms: list[str], pair_scores: dict[tuple[str, str], tuple[float, float]], thresh: float
) -> list[list[str]]:
    """Merge the two closest clusters while their mean pairwise semantic score is >= thresh.

    Unlike connected_components (single-linkage), one strong link can't pull in a term that
    is dissimilar to the rest — a cluster must be similar on average.
    # ponytail: O(n^3) naive merge loop; fine at dozens of terms, same scale as the O(n^2)
    # pairwise scoring that feeds it. Use scipy.cluster.hierarchy if term counts grow.
    """
    clusters = [[t] for t in terms]
    while len(clusters) > 1:
        best, bi, bj = -1.0, 0, 1
        for i, j in combinations(range(len(clusters)), 2):
            total = sum(
                pair_scores[(min(a, b), max(a, b))][1] for a in clusters[i] for b in clusters[j]
            )
            avg = total / (len(clusters[i]) * len(clusters[j]))
            if avg > best:
                best, bi, bj = avg, i, j
        if best < thresh:
            break
        clusters[bi] += clusters.pop(bj)
    return clusters


def compute_bundles(
    edges: pd.DataFrame,
    terms: pd.DataFrame,
    sem_thresh: float = SEM_THRESH_DEFAULT,
    struct_thresh: float = STRUCT_THRESH_DEFAULT,
    embedding_sim: dict[tuple[str, str], float] | None = None,
) -> list[Bundle]:
    """Compute bundles from edges and terms, gated on semantic similarity.

    struct_thresh is accepted for API compatibility and struct is still computed/returned
    on each Bundle for display, but it no longer gates bundling (see ponytail note at the
    edge-formation site) — only sem_thresh does.

    Returns a list of Bundle objects sorted by sim_score descending.
    Terms that do not cluster with any other term appear as singleton bundles
    (sim_score=0.0, members=[term]) appended after multi-term bundles.

    embedding_sim: pre-computed cosine similarity for term pairs (canonical key:
    (min(a,b), max(a,b))). When provided, replaces Jaro-Winkler for the semantic
    score. Missing pairs fall back to Jaro-Winkler.
    """
    if edges.empty or terms.empty:
        return []

    term_list = terms["term"].tolist()
    freq_map: dict[str, int] = dict(zip(terms["term"], terms["frequency"]))
    neighbors = _neighbor_sets(edges)

    pair_scores: dict[tuple[str, str], tuple[float, float]] = {}
    for a, b in combinations(term_list, 2):
        struct = _jaccard(neighbors.get(a, set()), neighbors.get(b, set()))
        key = (min(a, b), max(a, b))
        if embedding_sim is not None and key in embedding_sim:
            sem = embedding_sim[key]
        else:
            sem = rfd.JaroWinkler.normalized_similarity(a, b)
        pair_scores[key] = (struct, sem)
    # ponytail: semantic-only gate. struct (causal-graph neighbor overlap) never produced a
    # correct positive in testing — only false positives (airport/pilot, driver/road) — so it
    # is computed for display but doesn't gate. Caveat: when no embedding_sim entry exists
    # for a pair (no decision/embedding call configured or it failed), sem falls back to raw
    # Jaro-Winkler, which reintroduces false-positive risk — see routers/bundles.py.

    bundled_terms: set[str] = set()
    bundles: list[Bundle] = []
    for members in _average_linkage(term_list, pair_scores, sem_thresh):
        if len(members) < 2:
            continue

        anchor = max(members, key=lambda t: freq_map.get(t, 0))
        bundled_terms.update(members)

        max_struct = 0.0
        max_sem = 0.0
        weak_pairs: list[tuple[str, str]] = []
        for m1 in members:
            for m2 in members:
                if m1 >= m2:
                    continue
                key = (min(m1, m2), max(m1, m2))
                sc = pair_scores[key]
                max_struct = max(max_struct, sc[0])
                max_sem = max(max_sem, sc[1])
                if sc[1] < sem_thresh:
                    weak_pairs.append(key)

        sim_score = max(max_struct, max_sem)
        bundles.append(
            Bundle(
                id="",
                anchor=anchor,
                label=None,
                members=sorted(members),
                decision=None,
                sim_score=sim_score,
                struct=max_struct,
                semantic=max_sem,
                ai_review=None,
                weak_pairs=sorted(weak_pairs),
            )
        )

    for term in term_list:
        if term not in bundled_terms:
            bundles.append(
                Bundle(
                    id="",
                    anchor=term,
                    label=None,
                    members=[term],
                    decision=None,
                    sim_score=0.0,
                    struct=0.0,
                    semantic=0.0,
                    ai_review=None,
                )
            )

    bundles.sort(key=lambda b: b.sim_score, reverse=True)
    for i, b in enumerate(bundles, start=1):
        b.id = f"b_{i:03d}"

    return bundles
