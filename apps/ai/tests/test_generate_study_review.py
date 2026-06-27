from __future__ import annotations

import unittest

from app.jobs.generate_quiz import SourceChunk
from app.jobs.generate_study_review import (
    AttemptRecord,
    GenerateStudyReviewHandler,
    build_review_prompt,
    study_review_schema,
)
from app.jobs.models import AiJob
from app.llm import GenerationResult


def chunk(i: int, text: str, p: int | None = None) -> SourceChunk:
    return SourceChunk(chunk_id=f"chunk-{i}", chunk_index=i, content=text, page_start=p, page_end=p)


def attempt(*, is_correct: bool, topic="Cell biology", prompt="What makes ATP?", answer="Mitochondria") -> AttemptRecord:
    return AttemptRecord(
        question_id="q-1",
        quiz_set_id="src-set-1",
        topic=topic,
        prompt=prompt,
        correct_answer=answer,
        is_correct=is_correct,
    )


def weak(*, source_chunk: int, topic="Cellular respiration", **extra) -> dict:
    base = {
        "topic": topic,
        "why": "missed the role of mitochondria",
        "source_chunk": source_chunk,
        "recommended_action": "re-read the ATP section",
    }
    base.update(extra)
    return base


class FakeAttemptSource:
    def __init__(self, attempts) -> None:
        self._attempts = attempts
        self.calls = []

    def fetch_attempts(self, document_id, user_id, *, source_quiz_set_id, limit):
        self.calls.append({"source_quiz_set_id": source_quiz_set_id, "limit": limit})
        return list(self._attempts)


class FakeChunkSource:
    def __init__(self, chunks) -> None:
        self._chunks = chunks
        self.calls = 0

    def fetch_chunks(self, document_id, user_id, *, limit):
        self.calls += 1
        return list(self._chunks)


class FakeReviewGenerator:
    def __init__(self, *, summary="You're getting there.", weak_topics=None, actions=None, error=None) -> None:
        self._summary = summary
        self._weak = weak_topics
        self._actions = actions if actions is not None else ["Review chapter 3"]
        self._error = error
        self.received_schema = None
        self.received_prompt = None
        self.calls = 0

    def generate(self, prompt, *, schema, system=None):
        self.calls += 1
        self.received_schema = schema
        self.received_prompt = prompt
        if self._error is not None:
            raise self._error
        return GenerationResult(
            data={
                "summary": self._summary,
                "weak_topics": self._weak if self._weak is not None else [],
                "recommended_actions": self._actions,
            },
            provider_name="fake",
            model="fake-1",
            repaired=False,
            fell_back=False,
        )


class RecordingReviewStore:
    def __init__(self) -> None:
        self.created = []
        self.saved = []

    def create_quiz_set(self, **kwargs) -> str:
        self.created.append(kwargs)
        return "quiz-set-1"

    def save_study_review(self, *, quiz_set_id, user_id, document_id, review) -> str:
        self.saved.append({"quiz_set_id": quiz_set_id, "review": review})
        return "study-review-1"


class RecordingProgress:
    def __init__(self) -> None:
        self.events = []

    def update_progress(self, job_id, progress, current_step=None) -> None:
        self.events.append((progress, current_step))


def make_job(**input_override) -> AiJob:
    base = {"document_id": "doc-1"}
    base.update(input_override)
    return AiJob(
        id="job-1", user_id="user-1", job_type="generate_study_review",
        input=base, attempt_count=1, max_attempts=3,
    )


def make_handler(*, attempts, chunks, generator, store=None, progress=None):
    return GenerateStudyReviewHandler(
        attempts=FakeAttemptSource(attempts),
        chunks=FakeChunkSource(chunks),
        generator=generator,
        store=store or RecordingReviewStore(),
        progress=progress or RecordingProgress(),
    )


class SchemaAndPromptTest(unittest.TestCase):
    def test_schema_bounds_source_chunk_and_requires_sections(self) -> None:
        schema = study_review_schema(chunk_count=4)
        self.assertEqual(
            set(schema["required"]), {"summary", "weak_topics", "recommended_actions"}
        )
        item = schema["properties"]["weak_topics"]["items"]
        self.assertEqual(item["properties"]["source_chunk"]["maximum"], 4)
        self.assertIn("topic", item["required"])
        # weak_topics may be empty (the student aced it) — no minItems floor.
        self.assertNotIn("minItems", schema["properties"]["weak_topics"])

    def test_prompt_shows_roster_aggregate_and_numbered_chunks(self) -> None:
        text = build_review_prompt(
            [attempt(is_correct=False), attempt(is_correct=True)],
            [chunk(0, "Mitochondria make ATP.", p=2)],
        )
        self.assertIn("2 answered", text)
        self.assertIn("1 correct", text)
        self.assertIn("1 incorrect", text)
        self.assertIn("WRONG", text)
        self.assertIn("correct answer: Mitochondria", text)
        self.assertIn("[1]", text)
        self.assertIn("(p2)", text)
        self.assertIn("Mitochondria make ATP.", text)


class GenerateStudyReviewHandlerTest(unittest.TestCase):
    def test_happy_path_persists_cited_review(self) -> None:
        chunks = [chunk(0, "Cells use mitochondria.", p=1), chunk(1, "ATP is energy.", p=2)]
        attempts = [attempt(is_correct=False), attempt(is_correct=True), attempt(is_correct=False)]
        gen = FakeReviewGenerator(
            summary="Focus on energy metabolism.",
            weak_topics=[weak(source_chunk=1), weak(source_chunk=2, topic="ATP")],
            actions=["Re-read chapter 3", "Redo the quiz"],
        )
        store = RecordingReviewStore()
        handler = make_handler(attempts=attempts, chunks=chunks, generator=gen, store=store)

        result = handler(make_job())

        self.assertEqual(result.output["result"], "ready")
        self.assertEqual(result.output["quiz_set_id"], "quiz-set-1")
        self.assertEqual(result.output["study_review_id"], "study-review-1")
        self.assertEqual(result.output["weak_topics"], 2)
        self.assertEqual(result.output["attempts_reviewed"], 3)
        self.assertEqual(result.output["provider"], "fake")

        self.assertEqual(len(store.created), 1)
        self.assertEqual(store.created[0]["mode"], "study_review")
        self.assertEqual(store.created[0]["job_id"], "job-1")
        self.assertEqual(store.created[0]["credit_cost"], 0)

        review = store.saved[0]["review"]
        # Summary carries the attempt stats.
        self.assertEqual(review.summary["text"], "Focus on energy metabolism.")
        self.assertEqual(review.summary["attempts_reviewed"], 3)
        self.assertEqual(review.summary["correct"], 1)
        self.assertEqual(review.summary["incorrect"], 2)
        # Each weak topic resolves to its cited chunk id / page / excerpt.
        self.assertEqual(review.weak_topics[0].source_chunk_id, "chunk-0")
        self.assertEqual(review.weak_topics[0].source_page_start, 1)
        self.assertEqual(review.weak_topics[0].source_excerpt, "Cells use mitochondria.")
        self.assertEqual(review.weak_topics[1].source_chunk_id, "chunk-1")
        self.assertEqual(review.recommended_actions, ["Re-read chapter 3", "Redo the quiz"])

    def test_drops_weak_topic_with_out_of_range_citation(self) -> None:
        chunks = [chunk(0, "Only chunk.", p=1)]
        gen = FakeReviewGenerator(weak_topics=[weak(source_chunk=1), weak(source_chunk=99, topic="dangling")])
        store = RecordingReviewStore()
        result = make_handler(attempts=[attempt(is_correct=False)], chunks=chunks, generator=gen, store=store)(make_job())

        self.assertEqual(result.output["weak_topics"], 1)
        self.assertEqual(len(store.saved[0]["review"].weak_topics), 1)
        self.assertEqual(store.saved[0]["review"].weak_topics[0].source_chunk_id, "chunk-0")

    def test_drops_weak_topic_with_blank_name(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeReviewGenerator(weak_topics=[weak(source_chunk=1, topic="real"), weak(source_chunk=1, topic="  ")])
        store = RecordingReviewStore()
        result = make_handler(attempts=[attempt(is_correct=False)], chunks=chunks, generator=gen, store=store)(make_job())

        self.assertEqual(result.output["weak_topics"], 1)
        self.assertEqual(store.saved[0]["review"].weak_topics[0].topic, "real")

    def test_all_dangling_weak_topics_raises_and_persists_nothing(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeReviewGenerator(weak_topics=[weak(source_chunk=42)])
        store = RecordingReviewStore()
        with self.assertRaises(ValueError):
            make_handler(attempts=[attempt(is_correct=False)], chunks=chunks, generator=gen, store=store)(make_job())
        self.assertEqual(store.created, [])  # no quiz_set created on a dead result
        self.assertEqual(store.saved, [])

    def test_empty_weak_topics_persists_positive_review(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        # Student aced it: model returns no weak topics. That is a valid review.
        gen = FakeReviewGenerator(summary="Great work — no weak areas.", weak_topics=[])
        store = RecordingReviewStore()
        result = make_handler(attempts=[attempt(is_correct=True)], chunks=chunks, generator=gen, store=store)(make_job())

        self.assertEqual(result.output["weak_topics"], 0)
        self.assertEqual(len(store.saved), 1)
        self.assertEqual(store.saved[0]["review"].weak_topics, [])
        self.assertEqual(store.saved[0]["review"].summary["correct"], 1)

    def test_no_attempts_raises_before_generating(self) -> None:
        gen = FakeReviewGenerator(weak_topics=[weak(source_chunk=1)])
        with self.assertRaises(ValueError):
            make_handler(attempts=[], chunks=[chunk(0, "x")], generator=gen)(make_job())
        self.assertEqual(gen.calls, 0)  # never called the model

    def test_no_chunks_raises_before_generating(self) -> None:
        gen = FakeReviewGenerator(weak_topics=[weak(source_chunk=1)])
        with self.assertRaises(ValueError):
            make_handler(attempts=[attempt(is_correct=False)], chunks=[], generator=gen)(make_job())
        self.assertEqual(gen.calls, 0)

    def test_missing_document_id_raises(self) -> None:
        gen = FakeReviewGenerator()
        handler = make_handler(attempts=[attempt(is_correct=False)], chunks=[chunk(0, "x")], generator=gen)
        job = AiJob(id="j", user_id="u", job_type="generate_study_review",
                    input={}, attempt_count=1, max_attempts=1)
        with self.assertRaises(ValueError):
            handler(job)

    def test_source_quiz_set_id_forwarded_and_recorded(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeReviewGenerator(weak_topics=[weak(source_chunk=1)])
        store = RecordingReviewStore()
        source = FakeAttemptSource([attempt(is_correct=False)])
        handler = GenerateStudyReviewHandler(
            attempts=source, chunks=FakeChunkSource(chunks), generator=gen,
            store=store, progress=RecordingProgress(),
        )

        handler(make_job(source_quiz_set_id="src-set-9"))

        self.assertEqual(source.calls[0]["source_quiz_set_id"], "src-set-9")
        self.assertEqual(store.saved[0]["review"].summary["source_quiz_set_id"], "src-set-9")

    def test_progress_reported_in_order(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeReviewGenerator(weak_topics=[weak(source_chunk=1)])
        progress = RecordingProgress()
        make_handler(attempts=[attempt(is_correct=False)], chunks=chunks, generator=gen, progress=progress)(make_job())
        values = [p for p, _ in progress.events]
        self.assertEqual(values, sorted(values))
        self.assertTrue(values)


if __name__ == "__main__":
    unittest.main()
