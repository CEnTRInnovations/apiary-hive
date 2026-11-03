"""Run the partition prototype on one or more Apiary edge CSVs (from,to columns).

    uv run python scripts/partition_demo.py [--granularity coarse|balanced|fine] a.csv b.csv ...

Defaults to a local Ollama server, so term data never leaves the machine. Override with
PARTITION_BASE_URL / PARTITION_MODEL / PARTITION_API_KEY (any OpenAI-compatible endpoint).
"""
import argparse
import asyncio
import csv
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from hive.lm import OpenAICompatProvider  # noqa: E402
from hive.partition import partition_terms  # noqa: E402


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("csvs", nargs="+")
    ap.add_argument("--granularity", default="balanced", choices=["coarse", "balanced", "fine"])
    args = ap.parse_args()

    sources: dict[str, list[str]] = {}
    for path in args.csvs:
        with open(path, encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                for t in (row["from"], row["to"]):
                    sources.setdefault(t.strip(), [])
                    if Path(path).stem not in sources[t.strip()]:
                        sources[t.strip()].append(Path(path).stem)

    provider = OpenAICompatProvider(
        base_url=os.environ.get("PARTITION_BASE_URL", "http://localhost:11434/v1"),
        model=os.environ.get("PARTITION_MODEL", "ministral-3:latest"),
        api_key=os.environ.get("PARTITION_API_KEY"),
        timeout_seconds=300,
    )
    print(f"{len(sources)} unique terms, granularity={args.granularity}\n")
    result = await partition_terms(list(sources), provider, args.granularity)
    if result is None:
        sys.exit("No usable response from the model.")

    for b in sorted(result["bundles"], key=lambda b: -len(b["members"])):
        if len(b["members"]) > 1:
            print(b["label"])
            for m in b["members"]:
                print(f"    - {m}  ({', '.join(sources[m])})")
            print(f"    why: {b['rationale']}\n")
    print("Left alone:", ", ".join(b["members"][0] for b in result["bundles"] if len(b["members"]) == 1))
    print("\nRepairs to model output:", {k: v for k, v in result["repairs"].items() if v} or "none")


asyncio.run(main())
