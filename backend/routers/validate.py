import io
import json

import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from hive.ingest import fingerprint_term, parse_bee_file, validate_apiary_csv
from schemas.validate import EdgeRow, TermRow, ValidateResponse

router = APIRouter()


def _build_response(
    df: pd.DataFrame,
    contributor_label: str,
    contributor_id: str,
    status: str,
    message: str,
) -> ValidateResponse:
    all_terms = pd.concat([df["from"], df["to"]]).map(fingerprint_term)
    term_freq = all_terms.value_counts().reset_index()
    term_freq.columns = ["term", "frequency"]

    terms = [TermRow(term=row["term"], frequency=int(row["frequency"])) for _, row in term_freq.iterrows()]
    edges = [
        EdgeRow(
            from_term=fingerprint_term(str(row["from"])),
            to_term=fingerprint_term(str(row["to"])),
            weight=float(row["weight"]),
            effect=int(row["effect"]),
        )
        for _, row in df.iterrows()
    ]

    n_positive = sum(1 for e in edges if e.effect == 1)
    n_negative = sum(1 for e in edges if e.effect == -1)

    return ValidateResponse(
        status=status,
        message=message,
        contributor_label=contributor_label,
        contributor_id=contributor_id,
        terms=terms,
        edges=edges,
        n_terms=len(terms),
        n_edges=len(edges),
        n_positive=n_positive,
        n_negative=n_negative,
    )


@router.post("/validate", response_model=ValidateResponse)
async def validate_file(
    file: UploadFile = File(...),
    contributor_label: str = Form(""),
    contributor_id: str = Form(""),
) -> ValidateResponse:
    content = await file.read()
    filename = file.filename or ""

    if filename.endswith(".bee"):
        try:
            data = json.loads(content.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise HTTPException(status_code=422, detail=f"Invalid .bee JSON: {exc}") from exc

        result = parse_bee_file(data)
        label = contributor_label or result.get("contributor_label", "")
        cid = contributor_id or result.get("contributor_id", "")
    else:
        try:
            df_raw = pd.read_csv(io.StringIO(content.decode("utf-8", errors="replace")))
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Could not parse CSV: {exc}") from exc

        result = validate_apiary_csv(df_raw)
        label = contributor_label
        cid = contributor_id

    if result["status"] == "SCHEMA_MISMATCH":
        raise HTTPException(status_code=422, detail=result["message"])

    return _build_response(result["df"], label, cid, result["status"], result["message"])
