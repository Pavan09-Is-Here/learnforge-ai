"""Retrieval strategies under evaluation.

Every strategy is pure Python with no dependencies and no network calls, so the
harness runs offline and in CI. Each one exposes the same interface:

    rank(question, chunks) -> list[(chunk_id, score)]   sorted, best first

`prod_keyword` is the strategy LearnForge runs in production today, imported
from backend/retrieval.py rather than reimplemented, so the measurement cannot
drift away from the deployed code.

Naming is literal on purpose: `tfidf_cosine` is TF-IDF over the corpus
vocabulary, not a learned embedding, and is never described as semantic search.
"""

from __future__ import annotations

import math
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from retrieval import STOP_WORDS, question_terms, score_chunks  # noqa: E402

TOKEN = re.compile(r"[a-z0-9][a-z0-9.+-]*")

BM25_K1 = 1.2
BM25_B = 0.75
RRF_K = 60


def tokenize(text: str) -> list[str]:
    return [t for t in TOKEN.findall(text.lower()) if len(t) > 2 and t not in STOP_WORDS]


# --------------------------------------------------------------------------- #
# 1. production: keyword overlap scoring
# --------------------------------------------------------------------------- #

def prod_keyword(question: str, chunks: list[dict]) -> list[tuple[int, float]]:
    """Exactly what /documents/ask does today, via the extracted module."""
    scored = score_chunks(question, [
        {"chunk_text": c["text"], "chunk_index": c["id"]} for c in chunks
    ])
    return [(c.chunk_index, float(c.score)) for c in scored]


# --------------------------------------------------------------------------- #
# 2. BM25
# --------------------------------------------------------------------------- #

class Bm25Index:
    def __init__(self, chunks: list[dict]):
        self.ids = [c["id"] for c in chunks]
        self.docs = [tokenize(c["text"]) for c in chunks]
        self.lengths = [len(d) for d in self.docs]
        self.avg_len = (sum(self.lengths) / len(self.docs)) if self.docs else 0.0
        self.tf = [Counter(d) for d in self.docs]

        self.df: Counter[str] = Counter()
        for counts in self.tf:
            for term in counts:
                self.df[term] += 1

        self.n = len(self.docs)

    def idf(self, term: str) -> float:
        df = self.df.get(term, 0)
        if df == 0:
            return 0.0
        # Robertson-Sparck Jones idf, floored so common terms cannot go negative.
        return max(math.log((self.n - df + 0.5) / (df + 0.5) + 1.0), 0.0)

    def score(self, question: str) -> list[tuple[int, float]]:
        terms = tokenize(question)
        out = []

        for i, counts in enumerate(self.tf):
            total = 0.0
            for term in terms:
                f = counts.get(term, 0)
                if not f:
                    continue
                denom = f + BM25_K1 * (
                    1 - BM25_B + BM25_B * (self.lengths[i] / (self.avg_len or 1))
                )
                total += self.idf(term) * (f * (BM25_K1 + 1)) / denom
            out.append((self.ids[i], total))

        out.sort(key=lambda p: -p[1])
        return out


def bm25(question: str, chunks: list[dict]) -> list[tuple[int, float]]:
    return Bm25Index(chunks).score(question)


# --------------------------------------------------------------------------- #
# 3. TF-IDF cosine
# --------------------------------------------------------------------------- #

class TfidfIndex:
    def __init__(self, chunks: list[dict]):
        self.ids = [c["id"] for c in chunks]
        docs = [tokenize(c["text"]) for c in chunks]
        self.n = len(docs)

        df: Counter[str] = Counter()
        for d in docs:
            for term in set(d):
                df[term] += 1
        self.idf = {t: math.log((self.n + 1) / (c + 1)) + 1.0 for t, c in df.items()}

        self.vectors = [self._vector(d) for d in docs]

    def _vector(self, tokens: list[str]) -> dict[str, float]:
        counts = Counter(tokens)
        if not counts:
            return {}
        most = max(counts.values())
        vec = {
            t: (0.5 + 0.5 * (c / most)) * self.idf.get(t, math.log(self.n + 1) + 1.0)
            for t, c in counts.items()
        }
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
        return {t: v / norm for t, v in vec.items()}

    def score(self, question: str) -> list[tuple[int, float]]:
        q = self._vector(tokenize(question))
        out = []

        for cid, vec in zip(self.ids, self.vectors):
            shared = q.keys() & vec.keys()
            out.append((cid, sum(q[t] * vec[t] for t in shared)))

        out.sort(key=lambda p: -p[1])
        return out


def tfidf_cosine(question: str, chunks: list[dict]) -> list[tuple[int, float]]:
    return TfidfIndex(chunks).score(question)


# --------------------------------------------------------------------------- #
# 4. hybrid: reciprocal rank fusion over BM25 and TF-IDF
# --------------------------------------------------------------------------- #

def hybrid_rrf(question: str, chunks: list[dict]) -> list[tuple[int, float]]:
    lists = [bm25(question, chunks), tfidf_cosine(question, chunks)]
    fused: dict[int, float] = {}

    for ranked in lists:
        # Only rank position is used, so the two score scales never have to
        # be reconciled.
        for rank, (cid, score) in enumerate(ranked, start=1):
            if score <= 0:
                continue
            fused[cid] = fused.get(cid, 0.0) + 1.0 / (RRF_K + rank)

    for cid, _ in lists[0]:
        fused.setdefault(cid, 0.0)

    out = sorted(fused.items(), key=lambda p: -p[1])
    return out


STRATEGIES = {
    "prod_keyword": prod_keyword,
    "bm25": bm25,
    "tfidf_cosine": tfidf_cosine,
    "hybrid_rrf": hybrid_rrf,
}

# The production selector cannot refuse: when nothing scores, it still returns
# the first few chunks. Recorded here because the harness reports it.
NEVER_REFUSES = {"prod_keyword"}
