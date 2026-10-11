"""Proof that extracting retrieval out of main.py changed no behaviour.

The scoring logic used to live inline in the /documents/ask endpoint. This test
keeps a verbatim copy of that original implementation and asserts the extracted
module agrees with it — on the fixture corpus, on the golden questions, and on
edge cases. Run it before trusting any eval number.

    python evals/test_retrieval_equivalence.py
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, os.path.dirname(__file__))

from corpus_index import load_chunks  # noqa: E402
from retrieval import score_chunks, select_chunks  # noqa: E402


def original_implementation(question: str, chunks: list[dict]) -> list[dict]:
    """Copied verbatim from main.py before the extraction. Do not tidy."""
    stop_words = {
        "what", "when", "where", "which", "who", "why", "how",
        "is", "are", "was", "were", "the", "a", "an", "and",
        "or", "to", "of", "in", "on", "for", "from", "with",
        "this", "that", "it", "as", "by", "be", "about"
    }

    question_words = [
        word.strip(".,?!:;()[]{}").lower()
        for word in question.split()
        if len(word.strip(".,?!:;()[]{}")) > 2
        and word.strip(".,?!:;()[]{}").lower() not in stop_words
    ]

    scored_chunks = []

    for chunk in chunks:
        text = chunk["chunk_text"].lower()
        score = 0

        for word in question_words:
            if word in text:
                score += 2

            word_count = text.count(word)
            if word_count > 1:
                score += word_count

        if question.lower() in text:
            score += 10

        scored_chunks.append({
            "chunk_text": chunk["chunk_text"],
            "chunk_index": chunk["chunk_index"],
            "score": score
        })

    scored_chunks.sort(key=lambda x: x["score"], reverse=True)

    best_chunks = [chunk for chunk in scored_chunks if chunk["score"] > 0][:8]

    if not best_chunks:
        best_chunks = scored_chunks[:4]

    return best_chunks


def questions() -> list[str]:
    out = []
    path = os.path.join(os.path.dirname(__file__), "golden.jsonl")
    with open(path) as fh:
        for line in fh:
            if line.strip():
                out.append(json.loads(line)["question"])

    out += [
        "",
        "   ",
        "a",
        "the and or of",                      # stop words only
        "WARMUP",                             # casing
        "warmup?!",                           # punctuation
        "Warmup keeps the learning rate low",  # verbatim-ish substring
        "zzzz nonexistent token",             # nothing matches
        "the the the the",
    ]
    return out


def main() -> int:
    chunks = [
        {"chunk_text": c.text, "chunk_index": c.id} for c in load_chunks()
    ]

    compared = 0
    for question in questions():
        expected = original_implementation(question, chunks)
        actual = select_chunks(score_chunks(question, chunks))

        assert len(expected) == len(actual), (
            f"{question!r}: selected {len(actual)} chunks, original selected {len(expected)}"
        )

        for e, a in zip(expected, actual):
            assert e["chunk_index"] == a.chunk_index, f"{question!r}: order differs"
            assert e["score"] == a.score, f"{question!r}: score differs"
            assert e["chunk_text"] == a.chunk_text, f"{question!r}: text differs"

        compared += 1

    print(f"Equivalence holds across {compared} questions x {len(chunks)} chunks.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
