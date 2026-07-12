import pandas as pd
from fastapi import APIRouter, HTTPException

from hive.bundle_review import review_bundle
from hive.bundles import compute_bundles
from hive.lm import OpenAICompatProvider
from schemas.bundles import (
    BundleRead,
    BundleReviewRequest,
    ComputeRequest,
    TestModelRequest,
)

router = APIRouter()


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
async def compute_bundles_route(body: ComputeRequest) -> list[BundleRead]:
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

    embedding_sim = None
    if body.llm_config and body.llm_config.endpoint:
        from hive.nlp import cosine_sim_matrix, get_embeddings
        term_list = terms_df["term"].tolist()
        raw = await get_embeddings(
            term_list,
            endpoint=body.llm_config.endpoint,
            model=body.llm_config.model,
            api_key=body.llm_config.api_key or None,
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
async def review_bundle_route(body: BundleReviewRequest) -> dict:
    mc = body.llm_config
    provider = OpenAICompatProvider(
        base_url=mc.endpoint,
        model=mc.model,
        api_key=mc.api_key or None,
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
