from __future__ import annotations

import unittest

from app.jobs.models import AiJob
from app.jobs.process_document import (
    ExtractedChunk,
    ExtractedDocument,
    ExtractedPage,
    ProcessDocumentHandler,
)


class FakeStorage:
    def __init__(self, *, data: bytes = b"%PDF-1.4 fake", error: Exception | None = None) -> None:
        self._data = data
        self._error = error
        self.downloaded: list[str] = []

    def download(self, storage_path: str) -> bytes:
        self.downloaded.append(storage_path)
        if self._error is not None:
            raise self._error
        return self._data


class FakeExtractor:
    def __init__(self, *, document: ExtractedDocument | None = None, error: Exception | None = None) -> None:
        self._document = document
        self._error = error
        self.calls = 0

    def extract(self, pdf: bytes, *, max_pages: int) -> ExtractedDocument:
        self.calls += 1
        if self._error is not None:
            raise self._error
        assert self._document is not None
        return self._document


class FakeEmbeddingProvider:
    name = "fake"
    model = "fake-embed-1"
    dimension = 3
    target_table = "chunk_embeddings_openai"

    def __init__(self, *, error: Exception | None = None, vectors=None) -> None:
        self._error = error
        self._vectors = vectors

    def embed(self, texts):
        if self._error is not None:
            raise self._error
        if self._vectors is not None:
            return self._vectors
        return [[float(i), 0.0, 0.0] for i, _ in enumerate(texts)]

    def embed_query(self, text):
        return self.embed([text])[0]


class RecordingStore:
    def __init__(self) -> None:
        self.calls: list[tuple] = []

    def mark_processing(self, document_id: str, user_id: str) -> None:
        self.calls.append(("processing", document_id, user_id))

    def save_pages(self, document_id: str, user_id: str, pages) -> None:
        self.calls.append(("pages", len(pages)))

    def save_chunks(self, document_id: str, user_id: str, chunks) -> None:
        self.calls.append(("chunks", len(chunks)))

    def save_embeddings(self, document_id, user_id, *, provider, model, target_table, embeddings_by_index) -> None:
        self.calls.append(("embeddings", len(embeddings_by_index), provider, target_table))

    def mark_ready(
        self,
        document_id: str,
        user_id: str,
        *,
        page_count: int,
        embedding_provider: str | None = None,
        embedding_model: str | None = None,
    ) -> None:
        self.calls.append(("ready", page_count, embedding_provider, embedding_model))

    def mark_unsupported(self, document_id: str, user_id: str, *, reason: str) -> None:
        self.calls.append(("unsupported", reason))

    def mark_failed(self, document_id: str, user_id: str, *, error: str) -> None:
        self.calls.append(("failed", error))

    def steps(self) -> list[str]:
        return [call[0] for call in self.calls]


class RecordingProgress:
    def __init__(self) -> None:
        self.events: list[tuple[int, str | None]] = []

    def update_progress(self, job_id: str, progress: int, current_step: str | None = None) -> None:
        self.events.append((progress, current_step))


def make_job(*, attempt_count: int = 1, max_attempts: int = 3, input_override: dict | None = None) -> AiJob:
    return AiJob(
        id="job-1",
        user_id="user-1",
        job_type="process_document",
        input=input_override
        if input_override is not None
        else {"document_id": "doc-1", "storage_path": "user-1/doc-1/file.pdf"},
        attempt_count=attempt_count,
        max_attempts=max_attempts,
    )


def doc(pages, chunks=None) -> ExtractedDocument:
    return ExtractedDocument(pages=pages, chunks=chunks or [])


class ProcessDocumentHandlerTest(unittest.TestCase):
    def _handler(self, *, storage, store, extractor, progress=None, embedder=None, **kwargs):
        return ProcessDocumentHandler(
            storage=storage,
            store=store,
            extractor=extractor,
            progress=progress or RecordingProgress(),
            embedder=embedder or FakeEmbeddingProvider(),
            **kwargs,
        )

    def test_happy_path_persists_pages_chunks_and_marks_ready(self) -> None:
        store = RecordingStore()
        progress = RecordingProgress()
        document = doc(
            pages=[
                ExtractedPage(page_number=1, raw_text="hello world"),
                ExtractedPage(page_number=2, raw_text="second page"),
            ],
            chunks=[ExtractedChunk(chunk_index=0, content="hello world", page_start=1, page_end=1)],
        )
        handler = self._handler(
            storage=FakeStorage(),
            store=store,
            extractor=FakeExtractor(document=document),
            progress=progress,
        )

        result = handler(make_job())

        self.assertEqual(
            result.output, {"result": "ready", "pages": 2, "chunks": 1, "embeddings": 1}
        )
        self.assertEqual(
            store.steps(), ["processing", "pages", "chunks", "embeddings", "ready"]
        )
        self.assertIn(("pages", 2), store.calls)
        self.assertIn(("embeddings", 1, "fake", "chunk_embeddings_openai"), store.calls)
        self.assertIn(("ready", 2, "fake", "fake-embed-1"), store.calls)
        # progress is reported across stages and ends before completion
        self.assertTrue(progress.events)
        self.assertLessEqual(progress.events[0][0], progress.events[-1][0])

    def test_embedding_provider_failure_is_transient(self) -> None:
        store = RecordingStore()
        document = doc(
            pages=[ExtractedPage(page_number=1, raw_text="hello")],
            chunks=[ExtractedChunk(chunk_index=0, content="hello")],
        )
        handler = self._handler(
            storage=FakeStorage(),
            store=store,
            extractor=FakeExtractor(document=document),
            embedder=FakeEmbeddingProvider(error=RuntimeError("rate limited")),
        )

        with self.assertRaises(RuntimeError):
            handler(make_job(attempt_count=3, max_attempts=3))

        self.assertNotIn("ready", store.steps())  # never marked ready
        self.assertIn("failed", store.steps())  # final attempt marks failed

    def test_no_extractable_text_is_unsupported_not_an_error(self) -> None:
        store = RecordingStore()
        document = doc(pages=[ExtractedPage(page_number=1, raw_text="")])
        handler = self._handler(
            storage=FakeStorage(), store=store, extractor=FakeExtractor(document=document)
        )

        result = handler(make_job())

        self.assertEqual(result.output["result"], "unsupported")
        self.assertEqual(store.steps(), ["processing", "unsupported"])
        self.assertNotIn("pages", store.steps())  # no persistence on unsupported

    def test_too_many_pages_is_unsupported(self) -> None:
        store = RecordingStore()
        pages = [ExtractedPage(page_number=n, raw_text="x") for n in range(1, 5)]
        handler = self._handler(
            storage=FakeStorage(),
            store=store,
            extractor=FakeExtractor(document=doc(pages=pages)),
            max_pages=3,
        )

        result = handler(make_job())

        self.assertEqual(result.output["result"], "unsupported")
        self.assertIn("unsupported", store.steps())

    def test_oversize_pdf_is_unsupported_before_extraction(self) -> None:
        store = RecordingStore()
        extractor = FakeExtractor(document=doc(pages=[ExtractedPage(1, "x")]))
        handler = self._handler(
            storage=FakeStorage(data=b"0123456789"),
            store=store,
            extractor=extractor,
            max_pdf_bytes=4,
        )

        result = handler(make_job())

        self.assertEqual(result.output["result"], "unsupported")
        self.assertEqual(extractor.calls, 0)  # never extracted

    def test_transient_failure_on_final_attempt_marks_document_failed(self) -> None:
        store = RecordingStore()
        handler = self._handler(
            storage=FakeStorage(error=RuntimeError("network down")),
            store=store,
            extractor=FakeExtractor(document=doc(pages=[])),
        )

        with self.assertRaises(RuntimeError):
            handler(make_job(attempt_count=3, max_attempts=3))

        self.assertIn("failed", store.steps())

    def test_transient_failure_with_attempts_remaining_does_not_mark_failed(self) -> None:
        store = RecordingStore()
        handler = self._handler(
            storage=FakeStorage(error=RuntimeError("network down")),
            store=store,
            extractor=FakeExtractor(document=doc(pages=[])),
        )

        with self.assertRaises(RuntimeError):
            handler(make_job(attempt_count=1, max_attempts=3))

        self.assertNotIn("failed", store.steps())  # leave it processing for retry

    def test_missing_input_raises(self) -> None:
        handler = self._handler(
            storage=FakeStorage(), store=RecordingStore(), extractor=FakeExtractor(document=doc([]))
        )
        with self.assertRaises(ValueError):
            handler(make_job(input_override={"document_id": "doc-1"}))  # no storage_path


if __name__ == "__main__":
    unittest.main()
