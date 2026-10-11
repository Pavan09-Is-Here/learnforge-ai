"""Document retrieval for LearnForge document mode.

Extracted from the /documents/ask endpoint so it can be evaluated directly,
without a database or an API key. The behaviour of `score_chunks` and
`select_chunks` is identical to the inline implementation it replaces; the
eval harness in evals/ depends on that being true.
"""

from __future__ import annotations

from dataclasses import dataclass

STOP_WORDS = {
    "what", "when", "where", "which", "who", "why", "how",
    "is", "are", "was", "were", "the", "a", "an", "and",
    "or", "to", "of", "in", "on", "for", "from", "with",
    "this", "that", "it", "as", "by", "be", "about",
}

PUNCTUATION = ".,?!:;()[]{}"

DEFAULT_CHUNK_SIZE = 1200
TOP_K = 8
FALLBACK_K = 4


@dataclass
class ScoredChunk:
    chunk_text: str
    chunk_index: int
    score: float

    def as_dict(self) -> dict:
        return {
            "chunk_text": self.chunk_text,
            "chunk_index": self.chunk_index,
            "score": self.score,
        }


def split_text_into_chunks(text: str, chunk_size: int = DEFAULT_CHUNK_SIZE) -> list[str]:
    """Collapse whitespace, then cut into fixed-size character windows."""
    clean_text = " ".join(text.split())
    chunks = []

    for i in range(0, len(clean_text), chunk_size):
        chunk = clean_text[i:i + chunk_size]
        if chunk.strip():
            chunks.append(chunk)

    return chunks


def question_terms(question: str) -> list[str]:
    """Content words from a question: longer than two characters, not a stop word."""
    terms = []

    for word in question.split():
        cleaned = word.strip(PUNCTUATION)
        if len(cleaned) > 2 and cleaned.lower() not in STOP_WORDS:
            terms.append(cleaned.lower())

    return terms


def score_chunks(question: str, chunks: list[dict]) -> list[ScoredChunk]:
    """Score every chunk by keyword overlap with the question.

    Two points for containing a term at all, one more for each repeat beyond
    the first, and ten for containing the question verbatim.
    """
    terms = question_terms(question)
    scored: list[ScoredChunk] = []

    for chunk in chunks:
        text = chunk["chunk_text"].lower()
        score = 0

        for term in terms:
            if term in text:
                score += 2

            occurrences = text.count(term)
            if occurrences > 1:
                score += occurrences

        if question.lower() in text:
            score += 10

        scored.append(ScoredChunk(chunk["chunk_text"], chunk["chunk_index"], score))

    scored.sort(key=lambda c: c.score, reverse=True)
    return scored


def select_chunks(
    scored: list[ScoredChunk],
    top_k: int = TOP_K,
    fallback_k: int = FALLBACK_K,
) -> list[ScoredChunk]:
    """Keep the scoring chunks, or fall back to the first few when nothing scored.

    The fallback is why the current system cannot refuse: when no chunk matches
    the question at all, it still hands four arbitrary chunks to the model.
    """
    best = [c for c in scored if c.score > 0][:top_k]

    if not best:
        best = scored[:fallback_k]

    return best


def build_context(chunks: list[ScoredChunk]) -> str:
    return "\n\n".join(
        f"Source Chunk {c.chunk_index}:\n{c.chunk_text}" for c in chunks
    )
