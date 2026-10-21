import logging

import httpx

logger = logging.getLogger(__name__)

JEV_MODEL = "typesafe/jev-1.14"
JEV_DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions"


async def classify_bundle_recommendation(
    anchor: str,
    members: list[str],
    api_key: str,
    timeout_seconds: float = 10.0,
) -> dict | None:
    """Ask Jev (via OpenRouter's Decisions API) for a fast ACCEPT/SPLIT/REJECT read on a
    bundle, with a calibrated probability per option. Returns None on any failure so callers
    can fall back to the full LLM review.

    Response shape (on success): {"choice": "ACCEPT", "probabilities": {"ACCEPT": 0.92, ...}}
    """
    payload = {
        "model": JEV_MODEL,
        "state": f"Anchor term: {anchor}\nBundle members: {', '.join(members)}",
        "questions": {
            "recommendation": {
                "type": "choice",
                "instructions": (
                    "Should this bundle of terms be accepted as one group, split apart, "
                    "or rejected?"
                ),
                "criteria": {
                    "ACCEPT": "All members represent the same underlying concept.",
                    "SPLIT": (
                        "Some members are related but at least one subgroup is a "
                        "distinct concept."
                    ),
                    "REJECT": "These terms don't belong together at all.",
                },
            },
        },
    }
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            resp = await client.post(
                JEV_DECISIONS_URL,
                json=payload,
                headers={"Authorization": f"Bearer {api_key}"},
            )
            resp.raise_for_status()
            answer = resp.json()["answers"]["recommendation"]
            return {"choice": answer["choice"], "probabilities": answer["probabilities"]}
    except Exception as exc:
        logger.warning("Jev classify call failed: %s", exc)
        return None
