import pandas as pd
from fastapi import APIRouter, Depends, HTTPException

from config import settings
from hive.auth import is_owner_request
from hive.bundle_review import review_bundle
from hive.bundles import compute_bundles
from hive.lm import OpenAICompatProvider
from hive.lm_factory import get_default_llm_provider
from schemas.bundles import (
    BundleRead,
    BundleReviewRequest,
    ComputeRequest,
    TestModelRequest,
)

router = APIRouter()


def _default_llm_config(cfg) -> tuple[str, str, str | None] | None:
    """Endpoint/model/api_key for this deployment's default provider, mirroring
    get_default_llm_provider's DO-then-LM-Studio priority (hive/lm_factory.py) — as plain
    strings, since hive.nlp.get_embeddings takes an OpenAI-compat endpoint directly rather
    than an LLMProvider instance.
    """
    if cfg.do_inference_chat_model:
        return cfg.do_inference_base_url, cfg.do_inference_chat_model, cfg.do_inference_api_key or None
    if cfg.studio_lm_chat_model:
        return cfg.studio_lm_base_url, cfg.studio_lm_chat_model, None
    return None


def _to_read(b) -> BundleRead:
    return BundleRead(
        bundle_id=b.id,
        anchor=b.anchor,
        label=b.label,
        members=b.members,
        decision=b.decision,
        sim_score=b.sim_score,
        struct=b.struct,
        semantic=b.semantic,
        ai_review_json=b.ai_review,
    )


@router.post("/bundles/compute", response_model=list[BundleRead])
async def compute_bundles_route(
    body: ComputeRequest,
    is_owner: bool = Depends(is_owner_request),
) -> list[BundleRead]:
    if not body.edges:
        raise HTTPException(status_code=400, detail="No edges provided.")

    edges_df = pd.DataFrame([
        {"from": e.from_term, "to": e.to_term, "weight": e.weight, "composite_id": e.composite_id}
        for e in body.edges
    ])
    terms_df = pd.DataFrame([
        {"term": t.term, "frequency": t.frequency}
        for t in body.terms
    ])

    embedding_endpoint: str | None = None
    embedding_model: str | None = None
    embedding_api_key: str | None = None
    if is_owner:
        default_config = _default_llm_config(settings)
        if default_config is not None:
            embedding_endpoint, embedding_model, embedding_api_key = default_config
    elif body.llm_config and body.llm_config.endpoint:
        embedding_endpoint = body.llm_config.endpoint
        embedding_model = body.llm_config.model
        embedding_api_key = body.llm_config.api_key or None

    embedding_sim = None
    if embedding_endpoint and embedding_model:
        from hive.nlp import cosine_sim_matrix, get_embeddings
        term_list = terms_df["term"].tolist()
        raw = await get_embeddings(
            term_list,
            endpoint=embedding_endpoint,
            model=embedding_model,
            api_key=embedding_api_key,
        )
        if raw is not None:
            matrix = cosine_sim_matrix(raw)
            keys = list(raw.keys())
            embedding_sim = {
                (min(keys[i], keys[j]), max(keys[i], keys[j])): float(matrix[i, j])
                for i in range(len(keys))
                for j in range(i + 1, len(keys))
            }

    bundles = compute_bundles(
        edges_df, terms_df,
        sem_thresh=body.sem_thresh,
        struct_thresh=body.struct_thresh,
        embedding_sim=embedding_sim,
    )
    return [_to_read(b) for b in bundles]


@router.post("/bundles/review")
async def review_bundle_route(
    body: BundleReviewRequest,
    is_owner: bool = Depends(is_owner_request),
) -> dict:
    mc = body.llm_config
    if is_owner:
        # A valid X-Owner-Token always wins over any per-request llm_config — see
        # docs/specs/byom-relocation-spec.md. Falls back to this deployment's configured
        # default (DO_INFERENCE_CHAT_MODEL / STUDIO_LM_CHAT_MODEL; see hive/lm_factory.py).
        provider = get_default_llm_provider(settings)
        if provider is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No deployment default configured. Ask the operator to set "
                    "DO_INFERENCE_CHAT_MODEL or STUDIO_LM_CHAT_MODEL, or clear the "
                    "access code to use your own model."
                ),
            )
    elif mc and mc.endpoint.strip():
        provider = OpenAICompatProvider(
            base_url=mc.endpoint,
            model=mc.model,
            api_key=mc.api_key or None,
            timeout_seconds=settings.llm_timeout_seconds,
        )
    else:
        raise HTTPException(
            status_code=400,
            detail="No LLM configured. Enter an endpoint and model in Settings.",
        )
    result = await review_bundle(body.bundle_id, body.anchor, body.members, provider)
    return {"ai_review": result}


@router.post("/test-model")
async def test_model_route(body: TestModelRequest) -> dict:
    mc = body.llm_config
    provider = OpenAICompatProvider(
        base_url=mc.endpoint,
        model=mc.model,
        api_key=mc.api_key or None,
    )
    result = await provider.complete("Reply with the single word: ok")
    if result is None:
        return {"ok": False, "error": "No response from model"}
    return {"ok": True}
