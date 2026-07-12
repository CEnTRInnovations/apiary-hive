from __future__ import annotations

from dataclasses import dataclass, field

import networkx as nx
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


def compute_bundles(
    edges: pd.DataFrame,
    terms: pd.DataFrame,
    sem_thresh: float = SEM_THRESH_DEFAULT,
    struct_thresh: float = STRUCT_THRESH_DEFAULT,
    embedding_sim: dict[tuple[str, str], float] | None = None,
) -> list[Bundle]:
    """Compute bundles from edges and terms using structural + semantic similarity.

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

    g: nx.Graph = nx.Graph()
    g.add_nodes_from(term_list)

    pair_scores: dict[tuple[str, str], tuple[float, float]] = {}

    for i in range(len(term_list)):
        for j in range(i + 1, len(term_list)):
            a, b = term_list[i], term_list[j]
            struct = _jaccard(neighbors.get(a, set()), neighbors.get(b, set()))
            key = (min(a, b), max(a, b))
            if embedding_sim is not None and key in embedding_sim:
                sem = embedding_sim[key]
            else:
                sem = rfd.JaroWinkler.normalized_similarity(a, b)
            if struct >= struct_thresh or sem >= sem_thresh:
                g.add_edge(a, b)
                pair_scores[key] = (struct, sem)

    bundled_terms: set[str] = set()
    bundles: list[Bundle] = []
    for component in nx.connected_components(g):
        members = list(component)
        if len(members) < 2:
            continue

        anchor = max(members, key=lambda t: freq_map.get(t, 0))
        bundled_terms.update(members)

        max_struct = 0.0
        max_sem = 0.0
        for m1 in members:
            for m2 in members:
                if m1 >= m2:
                    continue
                key = (min(m1, m2), max(m1, m2))
                sc = pair_scores.get(key, (0.0, 0.0))
                max_struct = max(max_struct, sc[0])
                max_sem = max(max_sem, sc[1])

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
