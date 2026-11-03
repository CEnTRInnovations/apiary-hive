"""Compare the strict synonym question with the looser same-heading question, then cluster
with average-linkage (a bundle forms only if members are similar *on average*, so one weak
chain can't build a blob the way connected_components does).

    uv run python scripts/heading_demo.py --cache pairs.json a.csv b.csv ...

Needs OPENROUTER_API_KEY in backend/.env. One Decisions call per term pair per question
(~1,200 each for 50 terms); pair scores are cached so re-thresholding is free.
"""
import argparse
import asyncio
import csv
import json
import sys
from itertools import combinations
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import settings  # noqa: E402
from hive.nlp import SAME_HEADING_QUESTION, get_decision_sim  # noqa: E402


def average_linkage(terms: list[str], sim: dict[tuple[str, str], float], thresh: float) -> list[list[str]]:
    def pair(a: str, b: str) -> float:
        return sim.get((min(a, b), max(a, b)), 0.0)

    clusters = [[t] for t in terms]
    while len(clusters) > 1:
        best, bi, bj = -1.0, -1, -1
        for i, j in combinations(range(len(clusters)), 2):
            avg = sum(pair(a, b) for a in clusters[i] for b in clusters[j]) / (
                len(clusters[i]) * len(clusters[j])
            )
            if avg > best:
                best, bi, bj = avg, i, j
        if best < thresh:
            break
        clusters[bi] += clusters.pop(bj)
    return clusters


async def scores(terms: list[str], name: str, question, cache: dict) -> dict[tuple[str, str], float]:
    if name not in cache:
        raw = await get_decision_sim(
            terms, settings.openrouter_decision_model, settings.openrouter_api_key, question=question
        )
        if raw is None:
            sys.exit(f"Every Decisions call failed for {name}.")
        cache[name] = {f"{a}|||{b}": p for (a, b), p in raw.items()}
    return {tuple(k.split("|||")): p for k, p in cache[name].items()}


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("csvs", nargs="+")
    ap.add_argument("--cache", required=True)
    ap.add_argument("--thresholds", default="0.5,0.65,0.8")
    args = ap.parse_args()
    if not settings.openrouter_api_key:
        sys.exit("OPENROUTER_API_KEY is not set in backend/.env")

    terms: list[str] = []
    for path in args.csvs:
        with open(path, encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                for t in (row["from"].strip(), row["to"].strip()):
                    if t not in terms:
                        terms.append(t)

    cache_path = Path(args.cache)
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    runs = {
        "same_term (current)": await scores(terms, "same_term", None, cache),
        "same_heading (new)": await scores(terms, "same_heading", SAME_HEADING_QUESTION, cache),
    }
    cache_path.write_text(json.dumps(cache))

    print(f"{len(terms)} unique terms, model={settings.openrouter_decision_model}")
    for name, sim in runs.items():
        for t in (float(x) for x in args.thresholds.split(",")):
            clusters = average_linkage(terms, sim, t)
            multi = sorted((c for c in clusters if len(c) > 1), key=len, reverse=True)
            print(f"\n=== {name} @ {t}: {len(multi)} bundles, {len(clusters) - len(multi)} singletons ===")
            for c in multi:
                print("  " + " | ".join(sorted(c)))


asyncio.run(main())
