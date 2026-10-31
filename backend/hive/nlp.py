import logging
from itertools import combinations
from typing import Any

import numpy as np
import pandas as pd
from rapidfuzz import distance as rfd

logger = logging.getLogger(__name__)

# Same alpha Decisions API endpoint hive/jev.py already calls for bundle review.
from hive.jev import JEV_DECISIONS_URL as DECISIONS_URL  # noqa: E402

SAME_TERM_QUESTION = {
    "same_term": {
        "type": "noul",
        "instructions": (
            "Two terms were both drawn as nodes in a causal concept map. Do they refer to "
            "the same underlying concept (a spelling variant, synonym, or trivial "
            "rewording), rather than two distinct — even if closely related or causally "
            "connected — concepts?"
        ),
        "criteria": {
            "true": "Same concept — a spelling variant, synonym, or trivial rewording.",
            "false": "Distinct concepts, even if closely related or causally connected.",
        },
    }
}


def detect_synonyms(
    terms: list[str], method: str = "JW", threshold: float = 0.15
) -> pd.DataFrame:
    """Jaro-Winkler pairwise similarity. Returns DataFrame: term_a, term_b, similarity."""
    unique = list(dict.fromkeys(terms))
    rows = []
    for i in range(len(unique)):
        for j in range(i + 1, len(unique)):
            sim = rfd.JaroWinkler.normalized_similarity(unique[i], unique[j])
            if sim >= threshold:
                rows.append({"term_a": unique[i], "term_b": unique[j], "similarity": sim})
    if not rows:
        return pd.DataFrame(columns=["term_a", "term_b", "similarity"])
    return (
        pd.DataFrame(rows)
        .sort_values("similarity", ascending=False)
        .reset_index(drop=True)
    )


def cosine_sim_matrix(embeddings: dict[str, list[float]]) -> np.ndarray:
    """Returns n×n cosine similarity matrix; diagonal = 0."""
    keys = list(embeddings.keys())
    mat = np.array([embeddings[k] for k in keys], dtype=float)
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    mat = mat / norms
    sim = mat @ mat.T
    np.fill_diagonal(sim, 0.0)
    return sim


async def get_embeddings(
    terms: list[str],
    endpoint: str,
    model: str,
    api_key: str | None,
) -> dict[str, list[float]] | None:
    """Async call to OpenAI-compat embeddings endpoint. Returns None on failure."""
    import httpx

    payload = {"input": terms, "model": model}
    headers: dict[str, str] = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{endpoint}/embeddings", json=payload, headers=headers
            )
            resp.raise_for_status()
            data = resp.json()["data"]
            return {terms[i]: item["embedding"] for i, item in enumerate(data)}
    except Exception as exc:
        logger.warning("Embeddings call failed: %s", exc)
        return None


async def _decision_pair_sim(
    client: Any, model: str, headers: dict[str, str], a: str, b: str
) -> float | None:
    payload = {
        "model": model,
        "questions": SAME_TERM_QUESTION,
        "state": {"term_a": a, "term_b": b},
    }
    try:
        resp = await client.post(DECISIONS_URL, json=payload, headers=headers)
        resp.raise_for_status()
        return float(resp.json()["answers"]["same_term"]["noul"])
    except Exception as exc:
        logger.warning("Decisions call failed for (%r, %r): %s", a, b, exc)
        return None


async def get_decision_sim(
    terms: list[str],
    model: str,
    api_key: str | None,
    max_concurrency: int = 10,
) -> dict[tuple[str, str], float] | None:
    """Pairwise synonym-probability via OpenRouter's alpha Decisions API — one 'noul'
    (yes/no) question per unordered term pair, returning a calibrated probability
    instead of a string/vector-distance proxy. One call per pair (O(n^2)); fine at
    dozens of terms, not meant for hundreds. Returns {(min(a,b), max(a,b)): probability},
    same shape as embedding_sim, or None if every call failed.
    """
    import asyncio

    import httpx

    headers: dict[str, str] = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    pairs = list(combinations(sorted(set(terms)), 2))
    if not pairs:
        return {}

    sem = asyncio.Semaphore(max_concurrency)

    async def bounded(a: str, b: str, client: Any) -> tuple[tuple[str, str], float | None]:
        async with sem:
            return (a, b), await _decision_pair_sim(client, model, headers, a, b)

    async with httpx.AsyncClient(timeout=30.0) as client:
        results = await asyncio.gather(*(bounded(a, b, client) for a, b in pairs))

    out = {key: prob for key, prob in results if prob is not None}
    return out or None


async def choose_anchor(members: list[str], model: str, api_key: str | None) -> str | None:
    """Ask the Decisions API which bundle member best labels the whole group — a 'choice'
    question over the members themselves, same shape as hive/jev.py's ACCEPT/SPLIT/REJECT
    call. Returns the chosen member, or None on failure or an out-of-set answer (caller
    should keep its own fallback, e.g. frequency, in that case).
    """
    import httpx

    headers: dict[str, str] = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {
        "model": model,
        "questions": {
            "anchor": {
                "type": "choice",
                "instructions": (
                    "These terms were grouped as referring to the same underlying concept. "
                    "Which one is the clearest, most canonical label for the group as a "
                    "whole — the term a reader unfamiliar with the others would best "
                    "recognize this concept by?"
                ),
                "criteria": {m: m for m in members},
            }
        },
        "state": {"bundle_members": members},
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(DECISIONS_URL, json=payload, headers=headers)
            resp.raise_for_status()
            choice = resp.json()["answers"]["anchor"]["choice"]
    except Exception as exc:
        logger.warning("Decisions anchor call failed for %r: %s", members, exc)
        return None
    return choice if choice in members else None
