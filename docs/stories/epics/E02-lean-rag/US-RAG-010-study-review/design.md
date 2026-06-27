# Design

## Domain Model

- **AttemptRecord** — one answered RAG question, enriched from the join of
  `rag_question_attempts` → `questions`: `question_id`, `quiz_set_id`, `topic`,
  `prompt`, `correct_answer`, `is_correct`. The weak-area signal the review
  reasons over.
- **SourceChunk** (reused from US-RAG-008) — `chunk_id`, `chunk_index`,
  `content`, `page_start/end`. The grounding evidence unit; its 1-based position
  in the provided list is the citation key the model returns.
- **WeakTopic** — a persistable, cited review item: `topic`, `why`,
  `recommended_action`, resolved citation (`source_chunk_id`,
  `source_page_start/end`, `source_excerpt`).
- **StudyReview** — the generated artifact: `summary` (text + attempt stats),
  `weak_topics` (list of `WeakTopic`), `recommended_actions` (list of strings).
- **GenerateStudyReviewHandler** — orchestrates load attempts + chunks →
  generate → validate citations → persist; holds an `AttemptSource`,
  `ChunkSource`, `ReviewGenerator`, `ReviewStore`, and `ProgressReporter`.

## Application Flow

`GenerateStudyReviewHandler.__call__(job)`:

1. Parse `document_id` (required) and `source_quiz_set_id` (optional) from
   `job.input`.
2. `AttemptSource.fetch_attempts(document_id, user_id, source_quiz_set_id,
   limit)` → attempts for this user/document. Empty ⇒ `ValueError` (nothing to
   review; a review job should not have been queued without attempts).
3. `ChunkSource.fetch_chunks(document_id, user_id, limit)` → ordered evidence
   chunks. Empty ⇒ `ValueError` (an un-indexed document should not have been
   queued).
4. Build the prompt (attempt roster with ✓/✗ + aggregate, then numbered chunks +
   rules) and the per-request schema (`study_review_schema(chunk_count)` bounds
   each weak topic's `source_chunk` to `[1, chunk_count]`).
5. `ReviewGenerator.generate(prompt, schema, system)` (US-RAG-007 service:
   validate + one repair + provider fallback).
6. Map weak topics: drop any whose `source_chunk` is out of range or whose
   `topic` is blank; resolve the rest to `WeakTopic` with the cited chunk's
   id/page/excerpt. If the model returned weak topics but **none** survive
   citation validation ⇒ `ValueError` (grounding failure, nothing persisted). An
   empty model `weak_topics` is allowed (the student aced it) and persists a
   positive review.
7. `ReviewStore.create_quiz_set(mode='study_review', ...)` → `quiz_set_id`;
   `ReviewStore.save_study_review(...)` writes the `study_reviews` row keyed to
   it.
8. Return `JobResult({result: ready, quiz_set_id, study_review_id, weak_topics,
   attempts_reviewed, provider, model, repaired, fell_back})`.

Progress is reported at load-attempts (5) → load-evidence (20) → generate (40) →
validate (70) → save (90), best-effort (never fails the job) — same cadence as
US-RAG-008/009.

## Interface Contract

- Job input: `{document_id, source_quiz_set_id?}`.
- Job output: `{result, quiz_set_id, study_review_id, weak_topics,
  attempts_reviewed, provider, model, repaired, fell_back}`.
- `build_generate_study_review_handler(settings)` wires `SupabaseAttemptSource`,
  `SupabaseChunkSource`, `build_generation_service` (US-RAG-007),
  `SupabaseQuizStore` (its new `save_study_review` method), and the job
  repository as progress reporter. Registered as `generate_study_review` in
  `DEFAULT_HANDLERS` (replaces the stub).

## Data Model

Writes only (no schema change — tables exist from US-RAG-002):

- `quiz_sets` — `mode='study_review'`, `status='ready'`, `document_id`,
  `job_id`, `credit_cost=0`. The generated artifact, symmetric with the other
  modes so the web can list it.
- `study_reviews` — `quiz_set_id` (the new set), `document_id`, `summary`
  (jsonb: `{text, attempts_reviewed, correct, incorrect, source_quiz_set_id?}`),
  `weak_topics` (jsonb array of `{topic, why, recommended_action, source:{...}}`),
  `recommended_actions` (jsonb array of strings).

Reads:

- `rag_question_attempts` joined to `questions` (PostgREST embedded resource) for
  the attempt roster; `document_chunks` for evidence.

Service role bypasses RLS, so every written row carries the document owner's
`user_id`. `study_reviews` cascade-deletes with its `quiz_set`.

`SupabaseQuizStore` gains a `save_study_review(...)` method beside
`save_questions`/`save_cards`; `create_quiz_set` is reused unchanged (it already
takes any `mode`). A new `SupabaseAttemptSource` performs the attempts read.

## UI / Platform Impact

`apps/ai` only. No web change in this slice (the review UI is a later web
slice). No new dependency. New module `app/jobs/generate_study_review.py`
mirrors `generate_quiz.py`/`generate_cram.py`; it reuses `SourceChunk` /
`ChunkSource` and the generation service protocol shape.

## Observability

Job output records the serving `provider`/`model`, whether a `repaired` or
`fell_back` path was taken, and the review shape (`weak_topics`,
`attempts_reviewed`). `study_review_id` + `quiz_set_id` make the generation
auditable; dropped weak topics (failed citation) are simply absent.

## Alternatives Considered

1. **Point `study_reviews.quiz_set_id` at the reviewed source set instead of a
   new set.** Rejected: `quiz_sets.mode='study_review'` exists precisely so a
   review is a first-class generated artifact, symmetric with regular/cram/mock
   and listable by the web. The reviewed source is recorded in `summary`
   (`source_quiz_set_id`) instead, keeping the FK meaning consistent across
   modes (set → its own content).
2. **Require a `source_quiz_set_id` (review one set only).** Rejected: a
   document-wide review across all of a student's attempts is the more general
   and useful default; narrowing to one set is an optional input. The
   `study_reviews.quiz_set_id` nullability is not needed for this — every row we
   write keys to its own `study_review` set.
3. **Hard-fail when `weak_topics` is empty.** Rejected: a student who answered
   everything correctly has no weak areas; an empty list with a positive summary
   is a correct review. Grounding is still enforced — weak topics that ARE
   returned must cite a provided chunk, and an all-dangling list raises.
4. **A separate `SupabaseStudyReviewStore` class.** Rejected for now: the only
   addition over `SupabaseQuizStore` is one insert into `study_reviews`. A
   `save_study_review` method reuses `create_quiz_set` without a parallel class,
   matching the `save_cards` precedent (US-RAG-009).
