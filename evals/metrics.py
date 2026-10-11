"""Deterministic retrieval metrics.

None of these need a model, which is what makes the gate cheap enough to run on
every pull request. Each takes a ranked list of chunk ids and the set of chunk
ids labelled as carrying the answer.
"""

from __future__ import annotations


def recall_at_k(ranked: list[int], gold: set[int], k: int) -> float:
    """1.0 if any gold chunk is inside the top k, else 0.0."""
    return 1.0 if gold & set(ranked[:k]) else 0.0


def precision_at_k(ranked: list[int], gold: set[int], k: int) -> float:
    """Share of the top-k window that is labelled relevant."""
    if k == 0:
        return 0.0
    hits = sum(1 for cid in ranked[:k] if cid in gold)
    return hits / min(k, len(ranked)) if ranked else 0.0


def reciprocal_rank(ranked: list[int], gold: set[int]) -> float:
    """1/rank of the first gold chunk; 0.0 if none was retrieved at all."""
    for i, cid in enumerate(ranked, start=1):
        if cid in gold:
            return 1.0 / i
    return 0.0


def auroc(positive: list[float], negative: list[float]) -> float:
    """Probability a random answerable query outscores a random unanswerable one.

    This is the Mann-Whitney U statistic. It answers "could any threshold
    separate these two groups" without picking a threshold, so the number is
    not tuned against the eval set. 1.0 means a perfect refusal gate exists;
    0.5 means the top-1 score carries no information about answerability.
    """
    if not positive or not negative:
        return float("nan")

    wins = 0.0
    for p in positive:
        for n in negative:
            if p > n:
                wins += 1.0
            elif p == n:
                wins += 0.5

    return wins / (len(positive) * len(negative))


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else float("nan")


def percentile(values: list[float], q: float) -> float:
    """Nearest-rank percentile; q in [0, 1]."""
    if not values:
        return float("nan")
    ordered = sorted(values)
    idx = min(int(round(q * (len(ordered) - 1))), len(ordered) - 1)
    return ordered[idx]
