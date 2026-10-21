import json
import logging
from typing import Any

from hive.jev import classify_bundle_recommendation

logger = logging.getLogger(__name__)

# ponytail: single threshold, tune against real bundle data once this is live
JEV_CONFIDENT = 0.85


async def review_bundle(
    bundle_id: str,
    anchor: str,
    members: list[str],
    provider: Any,
    jev_api_key: str | None = None,
) -> dict | None:
    """Ask the LLM provider to review a bundle and return structured JSON.

    Returns a dict with keys: recommendation, confidence, rationale,
    preserved_if_consolidated, flattened_if_consolidated, suggested_splits,
    discussion_questions.
    Returns None if the provider fails, or {'raw': ...} if JSON parsing fails.

    jev_api_key: optional OpenRouter key. When set, a fast Jev pre-filter runs first — if
    it comes back confident, that verdict is returned without the full LLM call. Jev has
    no rationale/suggested_splits/discussion_questions (it never generates text), so those
    come back empty on the fast path.
    """
    if jev_api_key:
        fast = await classify_bundle_recommendation(anchor, members, jev_api_key)
        if fast is not None:
            confidence = fast["probabilities"][fast["choice"]]
            if confidence >= JEV_CONFIDENT:
                return {
                    "recommendation": fast["choice"],
                    "confidence": "HIGH",
                    "rationale": None,
                    "preserved_if_consolidated": None,
                    "flattened_if_consolidated": None,
                    "suggested_splits": [],
                    "discussion_questions": [],
                    "jev_confidence": confidence,
                }

    prompt = (
        f"You are reviewing a bundle of terms from a community-engaged research dataset "
        f"to help a research team decide whether to accept, split, or reject it.\n\n"
        f"Anchor term: {anchor}\n"
        f"Bundle members: {', '.join(members)}\n\n"
        'Respond with a JSON object containing exactly these keys:\n'
        '- "recommendation": one of "ACCEPT", "SPLIT", or "REJECT"\n'
        '- "confidence": one of "LOW", "MEDIUM", or "HIGH"\n'
        '- "rationale": a 1-2 sentence explanation of the recommendation\n'
        '- "preserved_if_consolidated": what conceptual value would be kept if these terms '
        'were merged (1 sentence)\n'
        '- "flattened_if_consolidated": what distinct meaning might be lost if these terms '
        'were merged (1 sentence)\n'
        '- "suggested_splits": if recommending SPLIT, an array of objects with "label" (string) '
        'and "members" (string array) keys showing how to group the terms; otherwise an empty array\n'
        '- "discussion_questions": an array of 2-3 questions to help the research team discuss '
        'this bundle\n\n'
        "Return only valid JSON with no markdown, no code fences, no extra text."
    )
    # LM Studio and OpenAI-compatible servers support response_format for constrained
    # JSON decoding — this guarantees parseable output from local models. Bedrock
    # ignores unknown kwargs so no regression on that path.
    response_format = {
        "type": "json_schema",
        "json_schema": {
            "name": "bundle_review",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "recommendation": {"type": "string", "enum": ["ACCEPT", "SPLIT", "REJECT"]},
                    "confidence": {"type": "string", "enum": ["LOW", "MEDIUM", "HIGH"]},
                    "rationale": {"type": "string"},
                    "preserved_if_consolidated": {"type": "string"},
                    "flattened_if_consolidated": {"type": "string"},
                    "suggested_splits": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string"},
                                "members": {"type": "array", "items": {"type": "string"}},
                            },
                            "required": ["label", "members"],
                            "additionalProperties": False,
                        },
                    },
                    "discussion_questions": {"type": "array", "items": {"type": "string"}},
                },
                "required": [
                    "recommendation", "confidence", "rationale",
                    "preserved_if_consolidated", "flattened_if_consolidated",
                    "suggested_splits", "discussion_questions",
                ],
                "additionalProperties": False,
            },
        },
    }
    result = await provider.complete(prompt, response_format=response_format)
    if result is None:
        return None
    # Strip markdown code fences if the model wraps its output
    text = result.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Bundle review response was not valid JSON for bundle %s", bundle_id)
        return {"raw": result}
