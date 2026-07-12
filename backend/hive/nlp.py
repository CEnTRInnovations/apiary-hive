import logging
from typing import Any

import numpy as np
import pandas as pd
from rapidfuzz import distance as rfd

logger = logging.getLogger(__name__)


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
