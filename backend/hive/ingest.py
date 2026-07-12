import unicodedata
from typing import Any

import pandas as pd


def fingerprint_term(term: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", term).lower().split())


def normalize_effect(value: Any) -> int:
    if value is None or value == "":
        return 1
    s = str(value).strip()
    if s in ("-", "-1"):
        return -1
    return 1


def validate_apiary_csv(df: pd.DataFrame) -> dict:
    required = {"from", "to"}
    if not required.issubset(df.columns):
        missing = required - set(df.columns)
        return {
            "status": "SCHEMA_MISMATCH",
            "message": f"Missing required columns: {', '.join(sorted(missing))}",
            "df": None,
        }

    df = df.assign(**{c: df[c].astype(str) for c in ["from", "to"]})
    empty = df[df["from"].str.strip().eq("") | df["to"].str.strip().eq("")]
    if len(empty):
        return {
            "status": "SCHEMA_MISMATCH",
            "message": f"{len(empty)} row(s) with empty from/to.",
            "df": None,
        }

    status = "VALID"
    if "weight" not in df.columns:
        df = df.assign(weight=1)
        status = "NO_WEIGHT"
    else:
        df["weight"] = pd.to_numeric(df["weight"], errors="coerce").fillna(1)

    if "effect" in df.columns:
        df["effect"] = df["effect"].apply(normalize_effect)
    else:
        df["effect"] = 1

    message = "File validated." if status == "VALID" else "No weight column — imputed as 1."
    return {"status": status, "message": message, "df": df}


def parse_bee_file(data: dict) -> dict:
    edges_raw = data.get("edges", [])
    contributor = data.get("contributor") or {}
    contributor_label = contributor.get("label", "")
    contributor_id = str(contributor.get("id", "") or "")

    if not edges_raw:
        return {
            "status": "SCHEMA_MISMATCH",
            "message": "No edges in .bee file.",
            "contributor_label": contributor_label,
            "contributor_id": contributor_id,
            "df": None,
        }

    rows = []
    for e in edges_raw:
        if not e.get("from") or not e.get("to"):
            continue
        rows.append({
            "from": str(e["from"]).strip(),
            "to": str(e["to"]).strip(),
            "weight": float(e.get("weight", 1) or 1),
            "effect": normalize_effect(e.get("effect")),
        })

    if not rows:
        return {
            "status": "SCHEMA_MISMATCH",
            "message": "All edges had empty from/to.",
            "contributor_label": contributor_label,
            "contributor_id": contributor_id,
            "df": None,
        }

    df = pd.DataFrame(rows)
    return {
        "status": "VALID",
        "message": "File validated.",
        "contributor_label": contributor_label,
        "contributor_id": contributor_id,
        "df": df,
    }
