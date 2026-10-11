"""Build the evaluable corpus: chunk the fixture documents the way production
does, then resolve each labelled gold span to the chunk ids that carry it.

Chunking goes through backend/retrieval.py, so the eval always chunks exactly
the way the deployed code chunks.
"""

from __future__ import annotations

import glob
import json
import os
import sys
from dataclasses import dataclass, field

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from retrieval import split_text_into_chunks  # noqa: E402

CORPUS_DIR = os.path.join(os.path.dirname(__file__), "corpus")
GOLDEN_PATH = os.path.join(os.path.dirname(__file__), "golden.jsonl")


def normalise(text: str) -> str:
    return " ".join(text.split())


@dataclass
class Chunk:
    id: int
    doc: str
    local_index: int
    text: str


@dataclass
class Case:
    id: str
    shape: str
    doc: str
    question: str
    gold_spans: list[str]
    gold_chunks: set[int] = field(default_factory=set)
    straddled: list[str] = field(default_factory=list)

    @property
    def answerable(self) -> bool:
        return bool(self.gold_spans)


def load_chunks() -> list[Chunk]:
    chunks: list[Chunk] = []
    next_id = 0

    for path in sorted(glob.glob(os.path.join(CORPUS_DIR, "*.md"))):
        doc = os.path.basename(path).removesuffix(".md")
        for local, text in enumerate(split_text_into_chunks(open(path).read())):
            chunks.append(Chunk(next_id, doc, local, text))
            next_id += 1

    return chunks


def load_cases(chunks: list[Chunk]) -> list[Case]:
    by_doc: dict[str, list[Chunk]] = {}
    for c in chunks:
        by_doc.setdefault(c.doc, []).append(c)

    cases: list[Case] = []

    with open(GOLDEN_PATH) as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue

            raw = json.loads(line)
            case = Case(
                id=raw["id"],
                shape=raw["shape"],
                doc=raw["doc"],
                question=raw["question"],
                gold_spans=raw["gold_spans"],
            )

            for span in case.gold_spans:
                needle = normalise(span)
                owners = {c.id for c in chunks if needle in c.text}

                if not owners:
                    # The span crosses a chunk boundary. Both neighbours are
                    # labelled gold: retrieving either gives the reader access
                    # to part of the answer.
                    for doc_chunks in by_doc.values():
                        for a, b in zip(doc_chunks, doc_chunks[1:]):
                            if needle in a.text + b.text:
                                owners |= {a.id, b.id}
                    if owners:
                        case.straddled.append(span)

                if not owners:
                    raise ValueError(
                        f"{case.id}: gold span not found in any chunk: {span!r}"
                    )

                case.gold_chunks |= owners

            cases.append(case)

    return cases


def summary() -> dict:
    chunks = load_chunks()
    cases = load_cases(chunks)
    shapes: dict[str, int] = {}
    for c in cases:
        shapes[c.shape] = shapes.get(c.shape, 0) + 1

    return {
        "documents": len({c.doc for c in chunks}),
        "chunks": len(chunks),
        "cases": len(cases),
        "answerable": sum(1 for c in cases if c.answerable),
        "unanswerable": sum(1 for c in cases if not c.answerable),
        "shapes": shapes,
        "straddled_spans": sum(len(c.straddled) for c in cases),
    }


if __name__ == "__main__":
    print(json.dumps(summary(), indent=2))
