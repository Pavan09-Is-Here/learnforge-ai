#!/usr/bin/env python3
"""Run the LearnForge retrieval eval.

    python evals/run_eval.py                    # report every strategy
    python evals/run_eval.py --scope document   # production scope only
    python evals/run_eval.py --gate             # compare to baseline, exit 1 on regression
    python evals/run_eval.py --update-baseline  # commit the current numbers as the baseline

Everything here is deterministic and offline: no API key, no database, no
network. That is deliberate, so the gate can run on every pull request.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

from corpus_index import Case, Chunk, load_cases, load_chunks, summary
from metrics import auroc, mean, percentile, precision_at_k, recall_at_k, reciprocal_rank
from strategies import NEVER_REFUSES, STRATEGIES

HERE = os.path.dirname(__file__)
BASELINE_PATH = os.path.join(HERE, "baseline.json")
RESULTS_DIR = os.path.join(HERE, "results")

# A quality metric may not fall further than this against the baseline.
REGRESSION_BUDGET = 0.02

GATED_METRICS = ("recall@1", "recall@3", "recall@5", "mrr", "gate_auroc")
SHAPES = ("literal", "paraphrase", "multi")


def candidates_for(case: Case, chunks: list[Chunk], scope: str) -> list[dict]:
    """Production retrieves inside one document; corpus scope searches all of them."""
    pool = chunks if scope == "corpus" else [c for c in chunks if c.doc == case.doc]
    return [{"id": c.id, "text": c.text} for c in pool]


def evaluate(name: str, scope: str, chunks: list[Chunk], cases: list[Case]) -> dict:
    rank = STRATEGIES[name]

    recalls: dict[int, list[float]] = {1: [], 3: [], 5: []}
    precisions: list[float] = []
    rrs: list[float] = []
    latencies: list[float] = []
    per_shape: dict[str, list[float]] = {s: [] for s in SHAPES}
    answerable_top: list[float] = []
    unanswerable_top: list[float] = []
    misses: list[dict] = []

    for case in cases:
        pool = candidates_for(case, chunks, scope)

        started = time.perf_counter()
        ranked = rank(case.question, pool)
        latencies.append((time.perf_counter() - started) * 1000.0)

        ids = [cid for cid, _ in ranked]
        top_score = ranked[0][1] if ranked else 0.0

        if not case.answerable:
            unanswerable_top.append(top_score)
            continue

        answerable_top.append(top_score)

        for k in recalls:
            recalls[k].append(recall_at_k(ids, case.gold_chunks, k))

        precisions.append(precision_at_k(ids, case.gold_chunks, 3))
        rr = reciprocal_rank(ids, case.gold_chunks)
        rrs.append(rr)

        if case.shape in per_shape:
            per_shape[case.shape].append(recall_at_k(ids, case.gold_chunks, 3))

        if rr == 0.0 or recall_at_k(ids, case.gold_chunks, 3) == 0.0:
            misses.append({
                "id": case.id,
                "shape": case.shape,
                "question": case.question,
                "gold_chunks": sorted(case.gold_chunks),
                "top3": ids[:3],
            })

    return {
        "strategy": name,
        "scope": scope,
        "recall@1": mean(recalls[1]),
        "recall@3": mean(recalls[3]),
        "recall@5": mean(recalls[5]),
        "precision@3": mean(precisions),
        "mrr": mean(rrs),
        "gate_auroc": auroc(answerable_top, unanswerable_top),
        "can_refuse": name not in NEVER_REFUSES,
        "latency_p50_ms": percentile(latencies, 0.5),
        "latency_p95_ms": percentile(latencies, 0.95),
        "recall@3_by_shape": {s: mean(v) for s, v in per_shape.items()},
        "misses": misses,
    }


def reading_notes(rows: list[dict], meta: dict, scope: str) -> list[str]:
    """Flag metrics this corpus is too small to discriminate, and anything odd.

    Derived from the numbers in the run rather than written by hand, so the
    caveats cannot drift out of date.
    """
    notes: list[str] = []

    per_doc = meta["chunks"] / max(meta["documents"], 1)
    for metric, k in (("recall@5", 5), ("recall@3", 3)):
        values = [r[metric] for r in rows if r[metric] == r[metric]]
        pool = per_doc if scope == "document" else meta["chunks"]
        if values and min(values) >= 0.99 and k >= pool * 0.6:
            notes.append(
                f"{metric} is saturated: k={k} covers most of a {pool:.0f}-chunk pool,"
                " so it cannot separate these strategies. Read recall@1, mrr and gate."
            )

    gates = {r["strategy"]: r["gate_auroc"] for r in rows if r["gate_auroc"] == r["gate_auroc"]}
    if "hybrid_rrf" in gates:
        components = [v for k, v in gates.items() if k in ("bm25", "tfidf_cosine")]
        if components and gates["hybrid_rrf"] < min(components) - 0.05:
            notes.append(
                "hybrid_rrf ranks as well as its components but gates worse:"
                " rank fusion discards the score scale, so fused scores carry little"
                " answerability signal. Fuse for ordering, threshold on a calibrated score."
            )

    for r in rows:
        if not r["can_refuse"]:
            notes.append(
                f"{r['strategy']} cannot refuse at all: when nothing scores it still"
                " returns the first few chunks, so every question gets context."
            )

    return notes


def fmt(value: float) -> str:
    if value != value:  # NaN
        return "   — "
    return f"{value:5.3f}"


def print_report(report: dict) -> None:
    meta = report["corpus"]
    print()
    print("LearnForge retrieval eval")
    print(
        f"  corpus    {meta['documents']} documents, {meta['chunks']} chunks"
        f"  ·  cases {meta['cases']} ({meta['answerable']} answerable,"
        f" {meta['unanswerable']} unanswerable)"
    )
    print(f"  shapes    {meta['shapes']}")
    print(f"  run       {report['generated_at']}")

    for scope, rows in report["scopes"].items():
        label = (
            "document scope — production behaviour, retrieval inside one document"
            if scope == "document"
            else "corpus scope — retrieval across every document"
        )
        print(f"\n{label}")
        print(
            f"  {'strategy':<14} {'r@1':>6} {'r@3':>6} {'r@5':>6} {'p@3':>6}"
            f" {'mrr':>6} {'gate':>6} {'refuse':>7} {'p50 ms':>8}"
        )
        print(f"  {'-' * 14} {'-' * 6} {'-' * 6} {'-' * 6} {'-' * 6} {'-' * 6} {'-' * 6} {'-' * 7} {'-' * 8}")

        for r in rows:
            print(
                f"  {r['strategy']:<14} {fmt(r['recall@1'])} {fmt(r['recall@3'])}"
                f" {fmt(r['recall@5'])} {fmt(r['precision@3'])} {fmt(r['mrr'])}"
                f" {fmt(r['gate_auroc'])} {'yes' if r['can_refuse'] else 'no':>7}"
                f" {r['latency_p50_ms']:8.2f}"
            )

        print("\n  recall@3 by question shape")
        for r in rows:
            shaped = "  ".join(
                f"{s}={fmt(v)}" for s, v in r["recall@3_by_shape"].items()
            )
            print(f"    {r['strategy']:<14} {shaped}")

        notes = reading_notes(rows, meta, scope)
        if notes:
            print("\n  reading notes")
            for note in notes:
                print(f"    - {note}")

    print()


def gate(report: dict, baseline: dict) -> int:
    """Fail when a gated metric drops further than the budget allows."""
    failures = []

    for scope, rows in report["scopes"].items():
        base_rows = {r["strategy"]: r for r in baseline["scopes"].get(scope, [])}

        for row in rows:
            base = base_rows.get(row["strategy"])
            if not base:
                continue

            for metric in GATED_METRICS:
                now, was = row.get(metric), base.get(metric)
                if now is None or was is None or now != now or was != was:
                    continue
                drop = was - now
                if drop > REGRESSION_BUDGET:
                    failures.append(
                        f"{scope}/{row['strategy']}/{metric}: {was:.3f} -> {now:.3f}"
                        f" (dropped {drop:.3f}, budget {REGRESSION_BUDGET})"
                    )

    if failures:
        print("REGRESSION — eval gate failed")
        for f in failures:
            print(f"  {f}")
        print(
            "\nIf the drop is intended, rerun with --update-baseline and commit"
            " evals/baseline.json in the same change."
        )
        return 1

    print(f"Eval gate passed — no gated metric dropped more than {REGRESSION_BUDGET}.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="LearnForge retrieval eval harness")
    parser.add_argument(
        "--scope",
        choices=["document", "corpus", "both"],
        default="both",
        help="document = production behaviour; corpus = search every document",
    )
    parser.add_argument(
        "--strategy",
        action="append",
        choices=sorted(STRATEGIES),
        help="limit to one or more strategies (default: all)",
    )
    parser.add_argument("--gate", action="store_true", help="compare to baseline and exit 1 on regression")
    parser.add_argument("--update-baseline", action="store_true", help="write the current run as the baseline")
    parser.add_argument("--json", metavar="PATH", help="also write the full report here")
    parser.add_argument("--quiet", action="store_true", help="suppress the printed table")
    args = parser.parse_args()

    chunks = load_chunks()
    cases = load_cases(chunks)
    names = args.strategy or sorted(STRATEGIES)
    scopes = ["document", "corpus"] if args.scope == "both" else [args.scope]

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "corpus": summary(),
        "regression_budget": REGRESSION_BUDGET,
        "scopes": {
            scope: [evaluate(name, scope, chunks, cases) for name in names]
            for scope in scopes
        },
    }

    if not args.quiet:
        print_report(report)

    os.makedirs(RESULTS_DIR, exist_ok=True)
    stamp = report["generated_at"].replace(":", "").replace("-", "")
    latest = os.path.join(RESULTS_DIR, "latest.json")
    for path in (os.path.join(RESULTS_DIR, f"{stamp}.json"), latest):
        with open(path, "w") as fh:
            json.dump(report, fh, indent=2)

    if args.json:
        with open(args.json, "w") as fh:
            json.dump(report, fh, indent=2)

    if args.update_baseline:
        with open(BASELINE_PATH, "w") as fh:
            json.dump(report, fh, indent=2)
        print(f"Baseline written to {BASELINE_PATH}")
        return 0

    if args.gate:
        if not os.path.exists(BASELINE_PATH):
            print("No baseline yet. Run with --update-baseline first.")
            return 1
        with open(BASELINE_PATH) as fh:
            return gate(report, json.load(fh))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
