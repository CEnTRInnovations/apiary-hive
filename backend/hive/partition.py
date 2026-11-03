"""Prototype: propose bundles by partitioning ALL terms in one LLM call.

Unlike hive/bundles.py (pairwise "same term?" score -> connected components), this asks for
*categories* — a bundle may hold distinct-but-co-playing terms (Manuscripts + Presentations
-> "Data & Dissemination"). A partition assigns each term to exactly one group, so there is
no single-linkage chaining. Suggestions only: a human still accepts/splits/rejects each one.
"""
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ponytail: granularity is a prompt phrase, not a tuned threshold. Per-user by design —
# different people legitimately bundle the same terms at different levels.
GRANULARITY = {
    "coarse": "Prefer fewer, broader categories; merge terms that play the same role in a causal map.",
    "balanced": "Merge terms that are the same concept or two facets of one idea; keep clearly distinct concepts apart.",
    "fine": "Merge only synonyms and trivial rewordings; keep related-but-distinct concepts separate.",
}

SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "partition",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "bundles": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "label": {"type": "string"},
                            "members": {"type": "array", "items": {"type": "string"}},
                            "rationale": {"type": "string"},
                        },
                        "required": ["label", "members", "rationale"],
                        "additionalProperties": False,
                    },
                }
            },
            "required": ["bundles"],
            "additionalProperties": False,
        },
    },
}


def build_prompt(terms: list[str], granularity: str = "balanced") -> str:
    return (
        "These terms were drawn as nodes in causal concept maps by different contributors "
        "in a community-engaged research workshop. Propose a partition of them into "
        "bundles that a research team could review.\n\n"
        f"Terms: {json.dumps(terms)}\n\n"
        f"Granularity: {GRANULARITY[granularity]}\n\n"
        "Rules:\n"
        "- Every term appears in exactly one bundle, spelled exactly as given.\n"
        "- A term that fits nowhere is its own one-member bundle.\n"
        "- Work across the whole list: before closing a bundle, scan every remaining term "
        "for others that belong in it. Several terms often play the same role, so bundles "
        "of three or more are expected; don't pair terms one-to-one.\n"
        "- label: a short plain name for the bundle (no prefix such as 'category:'). When "
        'members are two facets of one idea, name both, e.g. "Teaching & Learning". For a '
        "one-member bundle, label is the term itself.\n"
        "- rationale: one sentence on why these belong together and what a merge would flatten.\n"
        "Return only JSON."
    )


def validate_partition(terms: list[str], parsed: Any) -> dict:
    """Coerce model output into a true partition of `terms`.

    Unknown members are dropped, repeats keep their first bundle, and unassigned terms become
    singletons. The repairs are reported so a bad model run is visible, not silently fixed.
    """
    known = set(terms)
    seen: set[str] = set()
    bundles: list[dict] = []
    repairs = {"unknown": [], "duplicate": [], "missing": []}
    raw = parsed.get("bundles", []) if isinstance(parsed, dict) else []
    for b in raw:
        members = []
        for m in b.get("members", []):
            if m not in known:
                repairs["unknown"].append(m)
            elif m in seen:
                repairs["duplicate"].append(m)
            else:
                seen.add(m)
                members.append(m)
        if members:
            bundles.append({
                "label": b.get("label") or members[0],
                "members": members,
                "rationale": b.get("rationale", ""),
            })
    for t in terms:
        if t not in seen:
            repairs["missing"].append(t)
            bundles.append({"label": t, "members": [t], "rationale": ""})
    return {"bundles": bundles, "repairs": repairs}


async def partition_terms(
    terms: list[str], provider: Any, granularity: str = "balanced"
) -> dict | None:
    """Returns {"bundles": [...], "repairs": {...}} or None if the provider or JSON fails."""
    terms = list(dict.fromkeys(terms))
    text = await provider.complete(build_prompt(terms, granularity), response_format=SCHEMA)
    if text is None:
        return None
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    try:
        return validate_partition(terms, json.loads(text))
    except json.JSONDecodeError:
        logger.warning("Partition response was not valid JSON")
        return None
