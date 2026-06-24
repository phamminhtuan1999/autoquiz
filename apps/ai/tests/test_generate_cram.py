from __future__ import annotations

import unittest

from app.jobs.generate_cram import (
    GenerateCramHandler,
    build_cram_prompt,
    cram_schema,
)
from app.jobs.generate_quiz import SourceChunk
from app.jobs.models import AiJob
from app.llm import GenerationResult


def chunk(i: int, text: str, p: int | None = None) -> SourceChunk:
    return SourceChunk(chunk_id=f"chunk-{i}", chunk_index=i, content=text, page_start=p, page_end=p)


def card(*, source_chunk: int, prompt="Q?", answer="A.", **extra) -> dict:
    base = {
        "prompt": prompt,
        "answer": answer,
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


class FakeCramGenerator:
    def __init__(self, *, cards=None, error=None) -> None:
        self._cards = cards
        self._error = error
        self.received_schema = None
        self.calls = 0

    def generate(self, prompt, *, schema, system=None):
        self.calls += 1
        self.received_schema = schema
        if self._error is not None:
            raise self._error
        return GenerationResult(
            data={"cards": self._cards},
            provider_name="fake",
            model="fake-1",
            repaired=False,
            fell_back=False,
        )


class RecordingCramStore:
    def __init__(self) -> None:
        self.created = []
        self.saved = []

    def create_quiz_set(self, **kwargs) -> str:
        self.created.append(kwargs)
        return "quiz-set-1"

    def save_cards(self, *, quiz_set_id, user_id, document_id, cards) -> None:
        self.saved.append({"quiz_set_id": quiz_set_id, "cards": cards})


class RecordingProgress:
    def __init__(self) -> None:
        self.events = []

    def update_progress(self, job_id, progress, current_step=None) -> None:
        self.events.append((progress, current_step))


def make_job(**input_override) -> AiJob:
    base = {"document_id": "doc-1"}
    base.update(input_override)
    return AiJob(
        id="job-1", user_id="user-1", job_type="generate_cram",
        input=base, attempt_count=1, max_attempts=3,
    )


def make_handler(*, chunks, generator, store=None, progress=None):
    return GenerateCramHandler(
        chunks=FakeChunkSource(chunks),
        generator=generator,
        store=store or RecordingCramStore(),
        progress=progress or RecordingProgress(),
    )


class SchemaAndPromptTest(unittest.TestCase):
    def test_schema_bounds_source_chunk_and_is_flashcard_shaped(self) -> None:
        schema = cram_schema(chunk_count=3, num_cards=10)
        item = schema["properties"]["cards"]["items"]
        self.assertEqual(item["properties"]["source_chunk"]["maximum"], 3)
        self.assertEqual(schema["properties"]["cards"]["maxItems"], 10)
        # A flashcard is front/back — no options or answer_index in the schema.
        self.assertIn("answer", item["properties"])
        self.assertNotIn("options", item["properties"])
        self.assertNotIn("answer_index", item["properties"])

    def test_prompt_numbers_chunks_and_includes_pages(self) -> None:
        text = build_cram_prompt([chunk(0, "Mitochondria make ATP.", p=2)], 1, "easy")
        self.assertIn("[1]", text)
        self.assertIn("(p2)", text)
        self.assertIn("Mitochondria make ATP.", text)
        self.assertIn("Target difficulty: easy", text)
        self.assertIn("flashcard", text.lower())


class GenerateCramHandlerTest(unittest.TestCase):
    def test_happy_path_persists_cited_cram(self) -> None:
        chunks = [chunk(0, "Cells use mitochondria.", p=1), chunk(1, "ATP is energy.", p=2)]
        gen = FakeCramGenerator(cards=[
            card(source_chunk=1, prompt="Where is ATP made?", answer="The mitochondria"),
            card(source_chunk=2, prompt="What is ATP?", answer="The energy currency"),
        ])
        store = RecordingCramStore()
        handler = make_handler(chunks=chunks, generator=gen, store=store)

        result = handler(make_job(num_cards=2))

        self.assertEqual(result.output["result"], "ready")
        self.assertEqual(result.output["quiz_set_id"], "quiz-set-1")
        self.assertEqual(result.output["cards"], 2)
        self.assertEqual(result.output["provider"], "fake")

        self.assertEqual(len(store.created), 1)
        self.assertEqual(store.created[0]["mode"], "cram")
        self.assertEqual(store.created[0]["job_id"], "job-1")
        self.assertEqual(store.created[0]["credit_cost"], 0)

        saved = store.saved[0]["cards"]
        self.assertEqual(len(saved), 2)
        # Citation maps to the right chunk id + page range + back-of-card answer.
        self.assertEqual(saved[0].source_chunk_id, "chunk-0")
        self.assertEqual(saved[0].source_page_start, 1)
        self.assertEqual(saved[0].answer, "The mitochondria")
        self.assertEqual(saved[1].source_chunk_id, "chunk-1")
        self.assertEqual(saved[0].source_excerpt, "Cells use mitochondria.")

    def test_drops_card_with_out_of_range_citation(self) -> None:
        chunks = [chunk(0, "Only chunk.", p=1)]
        gen = FakeCramGenerator(cards=[
            card(source_chunk=1, prompt="valid"),
            card(source_chunk=99, prompt="dangling citation"),
        ])
        store = RecordingCramStore()
        result = make_handler(chunks=chunks, generator=gen, store=store)(make_job())

        self.assertEqual(result.output["cards"], 1)
        self.assertEqual(len(store.saved[0]["cards"]), 1)
        self.assertEqual(store.saved[0]["cards"][0].prompt, "valid")

    def test_drops_card_with_blank_front_or_back(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeCramGenerator(cards=[
            card(source_chunk=1, prompt="good", answer="real answer"),
            card(source_chunk=1, prompt="", answer="no front"),
            card(source_chunk=1, prompt="no back", answer="   "),
        ])
        store = RecordingCramStore()
        result = make_handler(chunks=chunks, generator=gen, store=store)(make_job())

        self.assertEqual(result.output["cards"], 1)
        self.assertEqual(store.saved[0]["cards"][0].prompt, "good")

    def test_no_valid_citations_raises_and_persists_nothing(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeCramGenerator(cards=[card(source_chunk=42)])
        store = RecordingCramStore()
        with self.assertRaises(ValueError):
            make_handler(chunks=chunks, generator=gen, store=store)(make_job())
        self.assertEqual(store.created, [])  # no quiz_set created on a dead result
        self.assertEqual(store.saved, [])

    def test_no_chunks_raises_before_generating(self) -> None:
        gen = FakeCramGenerator(cards=[card(source_chunk=1)])
        with self.assertRaises(ValueError):
            make_handler(chunks=[], generator=gen)(make_job())
        self.assertEqual(gen.calls, 0)  # never called the model

    def test_missing_document_id_raises(self) -> None:
        gen = FakeCramGenerator(cards=[])
        handler = make_handler(chunks=[chunk(0, "x")], generator=gen)
        job = AiJob(id="j", user_id="u", job_type="generate_cram",
                    input={}, attempt_count=1, max_attempts=1)
        with self.assertRaises(ValueError):
            handler(job)

    def test_num_cards_is_clamped(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeCramGenerator(cards=[card(source_chunk=1)])
        make_handler(chunks=chunks, generator=gen)(make_job(num_cards=500))
        # schema passed to the generator reflects the clamp, not the raw 500.
        self.assertEqual(gen.received_schema["properties"]["cards"]["maxItems"], 30)

    def test_progress_reported_in_order(self) -> None:
        chunks = [chunk(0, "Chunk.", p=1)]
        gen = FakeCramGenerator(cards=[card(source_chunk=1)])
        progress = RecordingProgress()
        make_handler(chunks=chunks, generator=gen, progress=progress)(make_job())
        values = [p for p, _ in progress.events]
        self.assertEqual(values, sorted(values))
        self.assertTrue(values)


if __name__ == "__main__":
    unittest.main()
