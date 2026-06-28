from __future__ import annotations

import unittest

from app.jobs.generate_mock_exam import (
    GenerateMockExamHandler,
    build_mock_prompt,
    mock_schema,
)
from app.jobs.generate_quiz import SourceChunk
from app.jobs.models import AiJob
from app.llm import GenerationResult


def chunk(i: int, text: str, p: int | None = None) -> SourceChunk:
    return SourceChunk(chunk_id=f"chunk-{i}", chunk_index=i, content=text, page_start=p, page_end=p)


def mcq(*, source_chunk: int, prompt="Q?", options=None, answer_index=0, **extra) -> dict:
    base = {
        "prompt": prompt,
        "options": options if options is not None else ["A", "B", "C", "D"],
        "answer_index": answer_index,
        "source_chunk": source_chunk,
        "explanation": "because the chunk says so",
    }
    base.update(extra)
    return base


def _rubric() -> dict:
    return {
        "criteria": [
            {
                "name": "Content Accuracy",
                "max_points": 10,
                "levels": [
                    {"score": 10, "label": "Excellent", "description": "all correct"},
                    {"score": 5, "label": "Fair", "description": "some correct"},
                ],
            }
        ]
    }


def essay(*, source_chunk: int, prompt="Discuss ATP.", rubric=None, **extra) -> dict:
    base = {
        "prompt": prompt,
        "source_chunk": source_chunk,
        "sample_answer": "ATP is the energy currency of the cell.",
        "max_points": 10,
        "suggested_minutes": 12,
        "rubric": rubric if rubric is not None else _rubric(),
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


class FakeMockGenerator:
    def __init__(self, *, mcqs=None, essays=None, error=None) -> None:
        self._mcqs = mcqs if mcqs is not None else []
        self._essays = essays if essays is not None else []
        self._error = error
        self.received_schema = None
        self.calls = 0

    def generate(self, prompt, *, schema, system=None):
        self.calls += 1
        self.received_schema = schema
        if self._error is not None:
            raise self._error
        return GenerationResult(
            data={"mcq_questions": self._mcqs, "essay_questions": self._essays},
            provider_name="fake",
            model="fake-1",
            repaired=False,
            fell_back=False,
        )


class RecordingMockStore:
    def __init__(self) -> None:
        self.created = []
        self.saved_questions = []
        self.saved_essays = []

    def create_quiz_set(self, **kwargs) -> str:
        self.created.append(kwargs)
        return "quiz-set-1"

    def save_questions(self, *, quiz_set_id, user_id, document_id, questions) -> None:
        self.saved_questions.append(questions)

    def save_essays(self, *, quiz_set_id, user_id, document_id, essays) -> None:
        self.saved_essays.append(essays)


class RecordingProgress:
    def __init__(self) -> None:
        self.events = []

    def update_progress(self, job_id, progress, current_step=None) -> None:
        self.events.append((progress, current_step))


def make_job(**input_override) -> AiJob:
    base = {"document_id": "doc-1"}
    base.update(input_override)
    return AiJob(
        id="job-1", user_id="user-1", job_type="generate_mock_exam",
        input=base, attempt_count=1, max_attempts=3,
    )


def make_handler(*, chunks, generator, store=None, progress=None):
    return GenerateMockExamHandler(
        chunks=FakeChunkSource(chunks),
        generator=generator,
        store=store or RecordingMockStore(),
        progress=progress or RecordingProgress(),
    )


class SchemaAndPromptTest(unittest.TestCase):
    def test_schema_bounds_chunks_and_counts_and_shapes_items(self) -> None:
        schema = mock_schema(chunk_count=3, num_mcq=10, num_essay=2)
        mcq_item = schema["properties"]["mcq_questions"]["items"]
        essay_item = schema["properties"]["essay_questions"]["items"]
        self.assertEqual(schema["properties"]["mcq_questions"]["maxItems"], 10)
        self.assertEqual(schema["properties"]["essay_questions"]["maxItems"], 2)
        self.assertEqual(mcq_item["properties"]["source_chunk"]["maximum"], 3)
        self.assertEqual(essay_item["properties"]["source_chunk"]["maximum"], 3)
        # MCQ has options; essay has a rubric and no options.
        self.assertIn("options", mcq_item["properties"])
        self.assertIn("rubric", essay_item["properties"])
        self.assertNotIn("options", essay_item["properties"])

    def test_prompt_numbers_chunks_and_states_counts(self) -> None:
        text = build_mock_prompt([chunk(0, "Mitochondria make ATP.", p=2)], 5, 1, "hard")
        self.assertIn("5 multiple-choice", text)
        self.assertIn("1 essay", text)
        self.assertIn("[1]", text)
        self.assertIn("(p2)", text)
        self.assertIn("Mitochondria make ATP.", text)
        self.assertIn("Target difficulty: hard", text)


class GenerateMockExamHandlerTest(unittest.TestCase):
    def test_happy_path_persists_cited_mock(self) -> None:
        chunks = [chunk(0, "Cells use mitochondria.", p=1), chunk(1, "ATP is energy.", p=2)]
        gen = FakeMockGenerator(
            mcqs=[mcq(source_chunk=1, prompt="Where is ATP made?", answer_index=2)],
            essays=[essay(source_chunk=2, prompt="Explain ATP synthesis.")],
        )
        store = RecordingMockStore()
        result = make_handler(chunks=chunks, generator=gen, store=store)(make_job())

        self.assertEqual(result.output["result"], "ready")
        self.assertEqual(result.output["quiz_set_id"], "quiz-set-1")
        self.assertEqual(result.output["mcq"], 1)
        self.assertEqual(result.output["essays"], 1)
        self.assertEqual(result.output["provider"], "fake")
        self.assertGreater(result.output["time_limit_minutes"], 0)

        self.assertEqual(store.created[0]["mode"], "mock")
        self.assertEqual(store.created[0]["job_id"], "job-1")
        self.assertEqual(store.created[0]["credit_cost"], 0)

        saved_mcq = store.saved_questions[0][0]
        self.assertEqual(saved_mcq.source_chunk_id, "chunk-0")
        self.assertEqual(saved_mcq.source_page_start, 1)
        self.assertEqual(saved_mcq.correct_answer, "C")  # answer_index 2 -> options[2]

        saved_essay = store.saved_essays[0][0]
        self.assertEqual(saved_essay.source_chunk_id, "chunk-1")
        self.assertEqual(saved_essay.sample_answer, "ATP is the energy currency of the cell.")
        self.assertEqual(saved_essay.max_points, 10)
        self.assertIn("criteria", saved_essay.rubric)
        self.assertEqual(saved_essay.source_excerpt, "ATP is energy.")

    def test_drops_mcq_with_out_of_range_citation(self) -> None:
        chunks = [chunk(0, "Only chunk.", p=1)]
        gen = FakeMockGenerator(mcqs=[mcq(source_chunk=1), mcq(source_chunk=99, prompt="dangling")])
        store = RecordingMockStore()
        result = make_handler(chunks=chunks, generator=gen, store=store)(make_job())
        self.assertEqual(result.output["mcq"], 1)
        self.assertEqual(len(store.saved_questions[0]), 1)

    def test_drops_mcq_with_wrong_option_count(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeMockGenerator(mcqs=[
            mcq(source_chunk=1, prompt="good"),
            mcq(source_chunk=1, prompt="bad", options=["only", "three", "opts"]),
        ])
        store = RecordingMockStore()
        result = make_handler(chunks=chunks, generator=gen, store=store)(make_job())
        self.assertEqual(result.output["mcq"], 1)
        self.assertEqual(store.saved_questions[0][0].prompt, "good")

    def test_drops_essay_with_out_of_range_citation(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeMockGenerator(
            mcqs=[mcq(source_chunk=1)],
            essays=[essay(source_chunk=1, prompt="valid"), essay(source_chunk=42, prompt="dangling")],
        )
        store = RecordingMockStore()
        result = make_handler(chunks=chunks, generator=gen, store=store)(make_job())
        self.assertEqual(result.output["essays"], 1)
        self.assertEqual(store.saved_essays[0][0].prompt, "valid")

    def test_drops_essay_with_blank_prompt_or_no_rubric(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeMockGenerator(
            mcqs=[mcq(source_chunk=1)],
            essays=[
                essay(source_chunk=1, prompt="real"),
                essay(source_chunk=1, prompt="  "),  # blank prompt
                essay(source_chunk=1, prompt="no rubric", rubric={"criteria": []}),
            ],
        )
        store = RecordingMockStore()
        result = make_handler(chunks=chunks, generator=gen, store=store)(make_job())
        self.assertEqual(result.output["essays"], 1)
        self.assertEqual(store.saved_essays[0][0].prompt, "real")

    def test_no_valid_questions_raises_and_persists_nothing(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeMockGenerator(mcqs=[mcq(source_chunk=42)], essays=[essay(source_chunk=42)])
        store = RecordingMockStore()
        with self.assertRaises(ValueError):
            make_handler(chunks=chunks, generator=gen, store=store)(make_job())
        self.assertEqual(store.created, [])
        self.assertEqual(store.saved_questions, [])
        self.assertEqual(store.saved_essays, [])

    def test_no_chunks_raises_before_generating(self) -> None:
        gen = FakeMockGenerator(mcqs=[mcq(source_chunk=1)])
        with self.assertRaises(ValueError):
            make_handler(chunks=[], generator=gen)(make_job())
        self.assertEqual(gen.calls, 0)

    def test_missing_document_id_raises(self) -> None:
        gen = FakeMockGenerator(mcqs=[mcq(source_chunk=1)])
        handler = make_handler(chunks=[chunk(0, "x")], generator=gen)
        job = AiJob(id="j", user_id="u", job_type="generate_mock_exam",
                    input={}, attempt_count=1, max_attempts=1)
        with self.assertRaises(ValueError):
            handler(job)

    def test_counts_are_clamped(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeMockGenerator(mcqs=[mcq(source_chunk=1)])
        make_handler(chunks=chunks, generator=gen)(make_job(num_mcq=500, num_essay=99))
        self.assertEqual(gen.received_schema["properties"]["mcq_questions"]["maxItems"], 30)
        self.assertEqual(gen.received_schema["properties"]["essay_questions"]["maxItems"], 5)

    def test_time_limit_defaulted_and_overridden(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeMockGenerator(mcqs=[mcq(source_chunk=1)], essays=[essay(source_chunk=1)])
        # default derived from counts
        out = make_handler(chunks=chunks, generator=gen)(make_job()).output
        self.assertGreater(out["time_limit_minutes"], 0)
        # explicit input honored
        gen2 = FakeMockGenerator(mcqs=[mcq(source_chunk=1)])
        out2 = make_handler(chunks=chunks, generator=gen2)(make_job(time_limit_minutes=45)).output
        self.assertEqual(out2["time_limit_minutes"], 45)

    def test_progress_reported_in_order(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeMockGenerator(mcqs=[mcq(source_chunk=1)])
        progress = RecordingProgress()
        make_handler(chunks=chunks, generator=gen, progress=progress)(make_job())
        values = [p for p, _ in progress.events]
        self.assertEqual(values, sorted(values))
        self.assertTrue(values)


if __name__ == "__main__":
    unittest.main()
