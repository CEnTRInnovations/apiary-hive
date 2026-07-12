from pydantic import BaseModel


class EdgeRow(BaseModel):
    from_term: str
    to_term: str
    weight: float
    effect: int


class TermRow(BaseModel):
    term: str
    frequency: int


class ValidateResponse(BaseModel):
    status: str          # VALID | NO_WEIGHT | SCHEMA_MISMATCH
    message: str
    contributor_label: str
    contributor_id: str = ""
    terms: list[TermRow]
    edges: list[EdgeRow]
    n_terms: int
    n_edges: int
    n_positive: int
    n_negative: int
