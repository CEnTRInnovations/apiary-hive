from pydantic import BaseModel


class EdgeInput(BaseModel):
    from_term: str
    to_term: str
    weight: float = 1.0
    effect: int = 1
    composite_id: str = ""


class TermInput(BaseModel):
    term: str
    frequency: int


# ponytail: named LLMConfig to avoid pydantic v2's reserved "model_config" field name
class LLMConfig(BaseModel):
    endpoint: str
    model: str
    api_key: str = ""


class ComputeRequest(BaseModel):
    edges: list[EdgeInput]
    terms: list[TermInput]
    sem_thresh: float = 0.65
    struct_thresh: float = 0.48
    llm_config: LLMConfig | None = None


class BundleRead(BaseModel):
    bundle_id: str
    anchor: str
    label: str | None
    members: list[str]
    decision: str | None
    sim_score: float
    struct: float
    semantic: float
    ai_review_json: dict | None = None


class BundleReviewRequest(BaseModel):
    bundle_id: str
    anchor: str
    members: list[str]
    # Optional — if omitted (or endpoint is blank), the server falls back to whatever
    # default provider this deployment has configured (see hive/lm_factory.py). This is what
    # lets an operator configure one deployment-wide DO/LM Studio endpoint instead of asking
    # every user to bring their own.
    llm_config: LLMConfig | None = None


class TestModelRequest(BaseModel):
    llm_config: LLMConfig
