# Retrieval eval harness

Measures the retrieval stage of LearnForge document mode. Deterministic,
offline, stdlib-only — no API key, no database, no network — so it runs on
every pull request instead of only when someone remembers.

```bash
python evals/run_eval.py                    # full report, both scopes
python evals/run_eval.py --scope document   # production behaviour only
python evals/run_eval.py --strategy bm25 --strategy prod_keyword
python evals/run_eval.py --quiet --gate     # CI gate: exit 1 on regression
python evals/run_eval.py --update-baseline  # accept the current numbers
python evals/test_retrieval_equivalence.py  # refactor did not change behaviour
```

Every run writes `evals/results/<timestamp>.json` and `evals/results/latest.json`.

## What is being measured

`prod_keyword` is the live implementation, imported from `backend/retrieval.py`
rather than reimplemented, so the measurement cannot drift away from the code
that is deployed. The other three are candidates:

| Strategy | What it is |
| --- | --- |
| `prod_keyword` | Keyword overlap scoring over 1,200-character chunks. What `/documents/ask` does today. |
| `bm25` | BM25 with idf weighting, term-frequency saturation (k1 = 1.2) and length normalisation (b = 0.75). |
| `tfidf_cosine` | TF-IDF vectors, cosine similarity. Named for what it is — this is not a learned embedding and is never called semantic search. |
| `hybrid_rrf` | Reciprocal rank fusion (k = 60) over the BM25 and TF-IDF rankings. |

Two scopes, because they answer different questions:

- **document** — candidates are the chunks of one document. This is what
  production does, since `/documents/ask` filters by `document_id`.
- **corpus** — candidates are every chunk in the corpus. Harder, and where
  retrieval differences show up.

## Metrics

| Metric | Meaning |
| --- | --- |
| `recall@k` | Share of answerable questions where a gold chunk is in the top k. |
| `precision@3` | Share of the returned window that is labelled relevant — padding the context is not free. |
| `mrr` | Mean reciprocal rank of the first gold chunk. Correlates best with whether an answer ends up grounded. |
| `gate_auroc` | Probability an answerable question's top-1 score beats an unanswerable one's. Threshold-free (Mann-Whitney), so it is not tuned against this set. 1.0 means a perfect refusal gate exists; 0.5 means the score says nothing about answerability. |
| `can_refuse` | Whether the strategy's selection rule can return nothing. `prod_keyword` cannot: it falls back to the first four chunks. |
| `latency_p50_ms` / `p95` | Wall clock per query, measured locally. |

`recall@3` is also broken out by question shape, which is where strategies
actually differ.

## The golden set

`golden.jsonl`, one case per line:

```json
{"id":"q12","shape":"paraphrase","doc":"optimizers",
 "question":"Is the early instability about how big the steps are, or how unreliable they are?",
 "gold_spans":["This is a variance problem, not a scale problem"]}
```

- `shape` is one of `literal` (uses the document's own words), `paraphrase`
  (deliberately avoids them), `multi` (needs more than one section), or
  `unanswerable` (the corpus cannot answer it; `gold_spans` is empty).
- `gold_spans` are exact strings from the corpus. At load time each span is
  resolved to the chunk ids that contain it, so re-chunking cannot silently
  invalidate a label. A span that straddles a chunk boundary labels both
  neighbours.
- A span that matches nothing raises an error rather than scoring zero, so a
  typo in a label fails loudly.

## Adding a case

1. Append a line to `golden.jsonl`. Copy `gold_spans` verbatim out of the
   corpus file.
2. `python evals/run_eval.py --scope document` — a bad span errors immediately.
3. If the numbers move for a legitimate reason, `--update-baseline` and commit
   `evals/baseline.json` in the same change.

The best source of new cases is production: a downvote carrying the question
and the retrieved context is a finished eval case. Hand-written questions
drift away from what people actually ask.

## Known limits

- **The corpus is small.** Three documents, 17 chunks. `recall@5` saturates in
  document scope because a document holds about six chunks; the report flags
  this automatically. `recall@1`, `mrr` and `gate_auroc` are the discriminating
  metrics at this size. Growing the corpus is the single best improvement.
- **No generation metrics.** Faithfulness and answer relevancy need a model to
  judge them, so they are out of scope for a gate that must run without
  secrets. They belong in a separate, slower job, reported separately so a
  retrieval regression is never confused with a generation one.
- **TF-IDF is a stand-in, not a conclusion.** It shows what moving beyond
  keyword overlap buys. A real embedding model will differ; measure it here
  before claiming it.

## Gate

`--gate` compares the current run to `evals/baseline.json` and fails if
`recall@1`, `recall@3`, `recall@5`, `mrr` or `gate_auroc` drops by more than
0.02 for any strategy in any scope. Moving the baseline is a deliberate commit,
visible in review.
