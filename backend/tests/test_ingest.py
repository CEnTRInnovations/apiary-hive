import pandas as pd
import pytest
from hive.ingest import fingerprint_term, validate_apiary_csv, parse_bee_file, normalize_effect


def test_fingerprint_lowercases():
    assert fingerprint_term("Community") == "community"


def test_fingerprint_squishes_whitespace():
    assert fingerprint_term("  community  engaged  ") == "community engaged"


def test_validate_csv_valid():
    df = pd.DataFrame({"from": ["a"], "to": ["b"], "weight": [1.0]})
    result = validate_apiary_csv(df)
    assert result["status"] == "VALID"
    assert result["df"] is not None


def test_validate_csv_no_weight_imputed():
    df = pd.DataFrame({"from": ["a"], "to": ["b"]})
    result = validate_apiary_csv(df)
    assert result["status"] == "NO_WEIGHT"
    assert result["df"]["weight"].iloc[0] == 1


def test_validate_csv_schema_mismatch():
    df = pd.DataFrame({"from": ["a"], "x": ["b"]})
    result = validate_apiary_csv(df)
    assert result["status"] == "SCHEMA_MISMATCH"
    assert result["df"] is None


def test_validate_csv_effect_parsed():
    df = pd.DataFrame({"from": ["a"], "to": ["b"], "effect": ["-1"]})
    result = validate_apiary_csv(df)
    assert result["df"]["effect"].iloc[0] == -1


def test_validate_csv_effect_defaults_to_1():
    df = pd.DataFrame({"from": ["a"], "to": ["b"]})
    result = validate_apiary_csv(df)
    assert result["df"]["effect"].iloc[0] == 1


def test_normalize_effect_variants():
    assert normalize_effect("+") == 1
    assert normalize_effect("+1") == 1
    assert normalize_effect("1") == 1
    assert normalize_effect(1) == 1
    assert normalize_effect("-") == -1
    assert normalize_effect("-1") == -1
    assert normalize_effect(-1) == -1
    assert normalize_effect(None) == 1
    assert normalize_effect("") == 1
    assert normalize_effect("garbage") == 1


def test_parse_bee_file_basic():
    data = {
        "version": "1.0",
        "contributor": {"label": "Group A"},
        "edges": [{"from": "community", "to": "trust", "weight": 2, "effect": 1}],
    }
    result = parse_bee_file(data)
    assert result["status"] == "VALID"
    assert result["contributor_label"] == "Group A"
    assert result["contributor_id"] == ""
    df = result["df"]
    assert list(df.columns) >= ["from", "to", "weight", "effect"]
    assert df["effect"].iloc[0] == 1


def test_parse_bee_file_contributor_id():
    data = {
        "contributor": {"label": "Group A", "id": "C07"},
        "edges": [{"from": "a", "to": "b"}],
    }
    result = parse_bee_file(data)
    assert result["contributor_id"] == "C07"


def test_parse_bee_file_missing_contributor_id_defaults_empty():
    data = {"contributor": {"label": "X"}, "edges": [{"from": "a", "to": "b"}]}
    result = parse_bee_file(data)
    assert result["contributor_id"] == ""


def test_parse_bee_file_missing_effect_defaults():
    data = {
        "contributor": {"label": "X"},
        "edges": [{"from": "a", "to": "b"}],
    }
    result = parse_bee_file(data)
    assert result["df"]["effect"].iloc[0] == 1


def test_parse_bee_file_no_edges():
    data = {"contributor": {"label": "X"}, "edges": []}
    result = parse_bee_file(data)
    assert result["status"] == "SCHEMA_MISMATCH"
