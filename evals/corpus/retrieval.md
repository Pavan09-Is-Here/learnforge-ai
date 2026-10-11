# Document Retrieval for Question Answering

## 1. What retrieval has to do

A retrieval system takes a question and returns the passages most likely to contain the
answer. It is judged on two things at once: whether the right passage is in the returned
set, and whether the set is small enough that the generator is not drowned in irrelevant
text. These pull against each other. Returning fifty passages almost guarantees the answer
is somewhere in there and almost guarantees the model will anchor on the wrong one.

The metric for the first property is recall at k: across a labelled set of questions, the
fraction for which at least one of the top k retrieved passages contains the answer. The
metric for the second is precision at k, the share of returned passages that are actually
relevant. Mean reciprocal rank captures something neither does, namely how close to the top
the first correct passage sits, and it is the metric that correlates best with whether an
answer ends up grounded.

## 2. Chunking

Documents have to be cut into retrievable units. The naive approach cuts every N characters,
which is cheap and reliable and also cuts through the middle of tables, code blocks and
sentences. A chunk that begins mid-sentence and ends mid-table is not a unit of meaning, and
no retrieval strategy can rescue it.

Recursive splitting cuts on the largest available boundary first: section headings, then
paragraphs, then sentences, then characters as the last resort. The result respects the
document's own structure. Overlapping consecutive chunks by ten to fifteen percent of their
length means a fact that straddles a boundary appears whole in at least one chunk.

The single highest-leverage trick in chunking is to prepend the heading path to the chunk
body before embedding or indexing it. A chunk whose text reads "it decays exponentially
after the first phase" is unretrievable on its own, because nothing in it names the subject.
Prefixed with "Optimisers > Learning-rate schedules > Cosine decay", the same chunk becomes
specific. This costs a handful of tokens per chunk and typically moves recall more than any
change to the retrieval algorithm itself.

## 3. Lexical retrieval and BM25

Lexical retrieval matches the words of the query against the words of the document. The
crude version counts how many query terms appear in each passage. The problem is immediate:
a passage that mentions a common word ten times outranks a passage that mentions the rare,
decisive word once, because raw counting has no notion of how informative a term is.

BM25 fixes both halves of that. Inverse document frequency weights each term by how rare it
is across the corpus, so a term appearing in nearly every passage contributes almost
nothing. Term-frequency saturation means the fifth occurrence of a word adds far less than
the second, controlled by a parameter conventionally set to k1 = 1.2. Length normalisation,
controlled by b = 0.75, stops long passages from winning simply by containing more words.
BM25 remains a strong baseline that is difficult to beat on queries containing rare or
exact terms, which is why it has survived every wave of neural retrieval.

## 4. Dense retrieval with embeddings

Dense retrieval maps the query and every passage into the same vector space and ranks by
cosine similarity. Because the comparison happens in a learned space rather than over
surface tokens, a question about "the opening phase of training" can match a passage that
only ever says "early steps". That is the whole value proposition: paraphrase robustness.

The corresponding weakness is exact tokens. Identifiers, error codes, acronyms, function
names and numbers are precisely where embeddings blur distinctions, because the model was
trained to put semantically similar things close together and two different error codes are
semantically almost identical. A system that only does dense retrieval will fail on the
query shape users produce most often when they are stuck, which is pasting the exact string
in front of them.

## 5. Hybrid retrieval and reciprocal rank fusion

Hybrid retrieval runs both and merges the results. The merge cannot simply compare scores,
because a BM25 score and a cosine similarity are not on the same scale and no fixed
conversion between them exists.

Reciprocal rank fusion sidesteps the problem by discarding the scores and using only the
ranks. Each passage receives, from each ranked list it appears in, a contribution of one
divided by the sum of a constant and its rank in that list, with the constant conventionally
set to 60. The contributions are summed across lists. A passage ranked third by BM25 and
seventh by the dense retriever accumulates two moderate contributions and beats a passage
ranked first by one method and absent from the other. The method requires no tuning and no
score calibration, which is why it is the default fusion choice in practice.

## 6. Reranking and the refusal gate

A reranker is a cross-encoder: it reads the question and a candidate passage together and
outputs a single relevance score. It is far more accurate than the retriever because it can
model the interaction between query and passage, and far slower for the same reason, so it
runs over the twelve to twenty candidates the retriever produced rather than the whole
corpus.

Reranking buys two things. The obvious one is a better ordering of the top five. The less
obvious and more valuable one is a calibrated score that supports a threshold. If no
candidate clears the relevance floor, the correct behaviour is to answer that the documents
do not contain this information, rather than to hand the generator the best of a bad set.

A system with no floor cannot refuse. If the retrieval stage always returns its top few
passages regardless of score, then every question gets context that looks superficially
legitimate, and the generator will dutifully produce a confident answer built on passages
that have nothing to do with the question. The fallback that returns the first few chunks
when nothing matched is the single most common cause of confident hallucination in
retrieval systems, because it converts "I found nothing" into "here is some text" without
telling anyone downstream that it did so.

## 7. Evaluating the whole thing

Retrieval metrics can be computed without a model, which makes them cheap enough to run on
every change. A labelled set of questions, each paired with a span of text that must appear
in the retrieved context, is enough to compute recall at k, precision at k and mean
reciprocal rank deterministically.

Generation metrics are different. Faithfulness, whether every claim in the answer is
supported by the retrieved context, and answer relevancy, whether the answer addresses the
question asked, both require a model to judge. They are more expensive, slower and noisier,
and they should be reported separately from the deterministic retrieval numbers so that a
regression in one is never mistaken for a regression in the other.
