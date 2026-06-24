from __future__ import annotations

import unittest

from app.jobs.generate_quiz import (
    GenerateRegularQuizHandler,
    SourceChunk,
    build_prompt,
    quiz_schema,
)
from app.jobs.models import AiJob
from app.llm import GenerationResult


def chunk(i: int, text: str, p: int | None = None) -> SourceChunk:
    return SourceChunk(chunk_id=f"chunk-{i}", chunk_index=i, content=text, page_start=p, page_end=p)


def question(*, source_chunk: int, answer_index: int = 0, options=None, prompt="Q?", **extra) -> dict:
    base = {
        "prompt": prompt,
        "options": options or ["a", "b", "c", "d"],
        "answer_index": answer_index,
        "source_chunk": source_chunk,
        "explanation": "because the chunk says so",
    }
    base.update(extra)
    return base


class FakeChunkSource:
    def __init__(self, chunks) -> None:
        self._chunks = chunks
        self.calls = 0

    def fetch_chunks(self, document_id, user_id, *, limit):
        self.calls += 1
        return list(self._chunks)


class FakeGenerator:
    def __init__(self, *, questions=None, error=None) -> None:
        self._questions = questions
        self._error = error
        self.received_schema = None
        self.calls = 0

    def generate(self, prompt, *, schema, system=None):
        self.calls += 1
        self.received_schema = schema
        if self._error is not None:
            raise self._error
        return GenerationResult(
            data={"questions": self._questions},
            provider_name="fake",
            model="fake-1",
            repaired=False,
            fell_back=False,
        )


class RecordingQuizStore:
    def __init__(self) -> None:
        self.created = []
        self.saved = []

    def create_quiz_set(self, **kwargs) -> str:
        self.created.append(kwargs)
        return "quiz-set-1"

    def save_questions(self, *, quiz_set_id, user_id, document_id, questions) -> None:
        self.saved.append({"quiz_set_id": quiz_set_id, "questions": questions})


class RecordingProgress:
    def __init__(self) -> None:
        self.events = []

    def update_progress(self, job_id, progress, current_step=None) -> None:
        self.events.append((progress, current_step))


def make_job(**input_override) -> AiJob:
    base = {"document_id": "doc-1"}
    base.update(input_override)
    return AiJob(
        id="job-1", user_id="user-1", job_type="generate_regular_quiz",
        input=base, attempt_count=1, max_attempts=3,
    )


def make_handler(*, chunks, generator, store=None, progress=None):
    return GenerateRegularQuizHandler(
        chunks=FakeChunkSource(chunks),
        generator=generator,
        store=store or RecordingQuizStore(),
        progress=progress or RecordingProgress(),
    )


class SchemaAndPromptTest(unittest.TestCase):
    def test_schema_bounds_source_chunk_to_chunk_count(self) -> None:
        schema = quiz_schema(chunk_count=3, num_questions=5)
        src = schema["properties"]["questions"]["items"]["properties"]["source_chunk"]
        self.assertEqual(src["maximum"], 3)
        self.assertEqual(schema["properties"]["questions"]["maxItems"], 5)

    def test_prompt_numbers_chunks_and_includes_pages(self) -> None:
        text = build_prompt([chunk(0, "Mitochondria make ATP.", p=2)], 1, "easy")
        self.assertIn("[1]", text)
        self.assertIn("(p2)", text)
        self.assertIn("Mitochondria make ATP.", text)
        self.assertIn("Target difficulty: easy", text)


class GenerateRegularQuizHandlerTest(unittest.TestCase):
    def test_happy_path_persists_cited_quiz(self) -> None:
        chunks = [chunk(0, "Cells use mitochondria.", p=1), chunk(1, "ATP is energy.", p=2)]
        gen = FakeGenerator(questions=[
            question(source_chunk=1, answer_index=2, prompt="Where is ATP made?"),
            question(source_chunk=2, answer_index=0, options=["ATP", "DNA", "RNA", "Lipid"]),
        ])
        store = RecordingQuizStore()
        handler = make_handler(chunks=chunks, generator=gen, store=store)

        result = handler(make_job(num_questions=2))

        self.assertEqual(result.output["result"], "ready")
        self.assertEqual(result.output["quiz_set_id"], "quiz-set-1")
        self.assertEqual(result.output["questions"], 2)
        self.assertEqual(result.output["provider"], "fake")

        self.assertEqual(len(store.created), 1)
        self.assertEqual(store.created[0]["mode"], "regular")
        self.assertEqual(store.created[0]["job_id"], "job-1")

        saved = store.saved[0]["questions"]
        self.assertEqual(len(saved), 2)
        # Citation maps to the right chunk id + page range + correct answer.
        self.assertEqual(saved[0].source_chunk_id, "chunk-0")
        self.assertEqual(saved[0].source_page_start, 1)
        self.assertEqual(saved[1].source_chunk_id, "chunk-1")
        self.assertEqual(saved[1].correct_answer, "ATP")  # options[answer_index=0]
        self.assertEqual(saved[0].source_excerpt, "Cells use mitochondria.")

    def test_drops_question_with_out_of_range_citation(self) -> None:
        chunks = [chunk(0, "Only chunk.", p=1)]
        gen = FakeGenerator(questions=[
            question(source_chunk=1, prompt="valid"),
            question(source_chunk=99, prompt="dangling citation"),
        ])
        store = RecordingQuizStore()
        result = make_handler(chunks=chunks, generator=gen, store=store)(make_job())

        self.assertEqual(result.output["questions"], 1)
        self.assertEqual(len(store.saved[0]["questions"]), 1)
        self.assertEqual(store.saved[0]["questions"][0].prompt, "valid")

    def test_drops_malformed_question(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeGenerator(questions=[
            question(source_chunk=1, prompt="good"),
            question(source_chunk=1, options=["only", "three", "opts"]),  # not 4 options
            question(source_chunk=1, answer_index=7),  # answer out of range
        ])
        store = RecordingQuizStore()
        result = make_handler(chunks=chunks, generator=gen, store=store)(make_job())

        self.assertEqual(result.output["questions"], 1)

    def test_no_valid_citations_raises_and_persists_nothing(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeGenerator(questions=[question(source_chunk=42)])
        store = RecordingQuizStore()
        with self.assertRaises(ValueError):
            make_handler(chunks=chunks, generator=gen, store=store)(make_job())
        self.assertEqual(store.created, [])  # no quiz_set created on a dead result
        self.assertEqual(store.saved, [])

    def test_no_chunks_raises_before_generating(self) -> None:
        gen = FakeGenerator(questions=[question(source_chunk=1)])
        with self.assertRaises(ValueError):
            make_handler(chunks=[], generator=gen)(make_job())
        self.assertEqual(gen.calls, 0)  # never called the model

    def test_missing_document_id_raises(self) -> None:
        gen = FakeGenerator(questions=[])
        handler = make_handler(chunks=[chunk(0, "x")], generator=gen)
        job = AiJob(id="j", user_id="u", job_type="generate_regular_quiz",
                    input={}, attempt_count=1, max_attempts=1)
        with self.assertRaises(ValueError):
            handler(job)

    def test_num_questions_is_clamped(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeGenerator(questions=[question(source_chunk=1)])
        make_handler(chunks=chunks, generator=gen)(make_job(num_questions=500))
        # schema passed to the generator reflects the clamp, not the raw 500.
        self.assertEqual(gen.received_schema["properties"]["questions"]["maxItems"], 20)

    def test_progress_reported_in_order(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeGenerator(questions=[question(source_chunk=1)])
        progress = RecordingProgress()
        make_handler(chunks=chunks, generator=gen, progress=progress)(make_job())
        values = [p for p, _ in progress.events]
        self.assertEqual(values, sorted(values))
        self.assertTrue(values)


if __name__ == "__main__":
    unittest.main()
