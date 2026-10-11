# Serving and Operating a Retrieval System

## 1. The latency budget

A question-answering request has a budget, and the only honest way to design one is to
decide the budget first and then spend it. A reasonable target for an interactive learning
tool is under one and a half seconds to first token. Generation dominates: streaming the
first token of an answer from a mid-sized model takes roughly five hundred to seven hundred
milliseconds, which leaves a few hundred milliseconds for everything retrieval does.

Within that remainder, embedding the query costs forty to eighty milliseconds, a vector
search over a few hundred thousand passages with an approximate index costs ten to fifty,
keyword search in the same database costs a similar amount, and a cross-encoder rerank over
twelve candidates costs one hundred to one hundred and fifty. The arithmetic is tight but it
closes, and it only closes because the expensive work — parsing, chunking, embedding the
corpus — happens at upload time rather than at question time.

Anything that can be precomputed must be precomputed. This is the single structural
decision that separates a system that feels responsive from one that does not.

## 2. Indexing choices

An exact nearest-neighbour search compares the query against every stored vector. It is
perfectly accurate and scales linearly, which is fine up to a few tens of thousands of
passages and untenable beyond that.

Approximate indexes trade a little recall for a large speedup. HNSW builds a navigable
small-world graph in layers; its build parameters, the number of neighbours per node and
the size of the candidate list during construction, trade index build time and memory
against query recall. Values of sixteen neighbours and a construction candidate list of
sixty-four are a reasonable starting point for corpora in the hundreds of thousands. IVF
partitions the space into clusters and searches only the nearest few, which builds faster
and uses less memory but is more sensitive to how well the clustering matches the data.

Keeping the vector index inside the same database as the application rows has a specific
operational payoff: per-user filtering and access control become a WHERE clause enforced by
the database rather than a join performed in application code after the fact. A system that
filters after retrieving has to over-fetch to compensate, and the amount of over-fetch
required is impossible to pick correctly.

## 3. Caching

Three caches matter, and they are not equally useful. Caching embeddings by content hash
means re-ingesting an edited document only pays for the chunks that changed, which turns a
document edit from an expensive operation into a trivial one. Caching the prompt prefix —
the system instructions that are identical on every request — reduces the input token cost
of every single call. Caching whole answers keyed by the question is tempting and usually
wrong, because two users asking the same question over different documents must not receive
the same answer, and getting that key wrong is a data-leak bug rather than a performance
bug.

## 4. Cost

Cost per answer decomposes into embedding the query, retrieval, optional reranking, and
generation. Generation dominates, and within generation the input tokens dominate, because
a retrieval system sends several passages of context for every short question. The lever
with the largest effect on cost is therefore the size of the retrieved context, not the
choice of model.

This is the direct trade against quality. Retrieving eight passages instead of five raises
the chance the answer is present and raises the input token count by sixty percent. The
reranker is what makes a smaller context viable: with a good ordering, five passages carry
more of the answer than eight unordered ones.

## 5. Observability

Per-request tracing with a span for each stage is the minimum. Each span should record its
duration, and the generation span should additionally record input tokens, output tokens and
the computed cost, so that a cost regression is visible in the same place as a latency
regression.

Aggregate dashboards mislead on their own. An average latency can look healthy while a
specific user hits the same retrieval miss on every question, because one user's repeated
failure is invisible in a mean taken over thousands of successful requests. Per-request
traces, retained and searchable, are what make that visible.

Capturing negative feedback with the full retrieved context attached is the highest-value
piece of instrumentation in the system. A thumbs-down with the question, the retrieved
passages and the generated answer is a complete, ready-made eval case. Routing those into
the labelled set means the test data comes to resemble what users actually ask, which no
amount of hand-written cases achieves.

## 6. Guardrails in production

Two failure modes deserve explicit handling. The first is retrieval returning nothing
relevant, which must produce a refusal rather than an answer built on irrelevant text. The
second is the generator producing a citation to a passage that was never retrieved, which
indicates the answer came from the model's parameters rather than from the documents.
Validating citations against the set of retrieved passage identifiers after generation
catches this cheaply, and the correct response is one retry followed by a refusal.

Neither guardrail improves a good answer. Both exist to convert a wrong answer into an
honest non-answer, which is the only trade a system that people rely on can afford to make.
