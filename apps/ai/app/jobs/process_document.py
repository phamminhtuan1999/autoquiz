"""US-RAG-005: process_document handler — PDF → pages + chunks.

The handler orchestration (validation, status transitions, persistence,
progress, error handling) is decomposed behind protocols so it is unit-testable
without Docling or the network. Production wiring lives in
``build_process_document_handler``; the registered ``process_document`` builds it
lazily from settings so importing this module never requires the heavy Docling
dependency.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from app.jobs.models import AiJob, JobResult


MAX_PDF_BYTES = 30 * 1024 * 1024  # 30 MB — matches the documents bucket limit
MAX_PAGES = 150  # product cap (docs/product/lean-rag-mvp.md)


@dataclass(frozen=True)
class ExtractedPage:
    page_number: int  # 1-based
    raw_text: str
    cleaned_text: str | None = None

    @property
    def char_count(self) -> int:
        return len(self.raw_text or "")


@dataclass(frozen=True)
class ExtractedChunk:
    chunk_index: int  # 0-based
    content: str
    page_start: int | None = None
    page_end: int | None = None
    heading: str | None = None
    token_count: int | None = None
    metadata: dict = field(default_factory=dict)


@dataclass(frozen=True)
class ExtractedDocument:
    pages: list[ExtractedPage]
    chunks: list[ExtractedChunk]


class PdfExtractor(Protocol):
    def extract(self, pdf: bytes, *, max_pages: int) -> ExtractedDocument: ...


class StorageDownloader(Protocol):
    def download(self, storage_path: str) -> bytes: ...


class DocumentStore(Protocol):
    def mark_processing(self, document_id: str, user_id: str) -> None: ...
    def save_pages(self, document_id: str, user_id: str, pages: list[ExtractedPage]) -> None: ...
    def save_chunks(self, document_id: str, user_id: str, chunks: list[ExtractedChunk]) -> None: ...
    def mark_ready(self, document_id: str, user_id: str, *, page_count: int) -> None: ...
    def mark_unsupported(self, document_id: str, user_id: str, *, reason: str) -> None: ...
    def mark_failed(self, document_id: str, user_id: str, *, error: str) -> None: ...


class ProgressReporter(Protocol):
    def update_progress(self, job_id: str, progress: int, current_step: str | None = None) -> None: ...


class UnsupportedDocument(Exception):
    """A terminal validation verdict (e.g. scanned PDF, unparseable).

    NOT a job error: the runner marks any raised handler exception as retryable,
    so the handler converts this into a *successful* job that sets the document
    status to ``unsupported``.
    """


@dataclass
class ProcessDocumentHandler:
    storage: StorageDownloader
    store: DocumentStore
    extractor: PdfExtractor
    progress: ProgressReporter
    max_pdf_bytes: int = MAX_PDF_BYTES
    max_pages: int = MAX_PAGES

    def __call__(self, job: AiJob) -> JobResult:
        document_id = str(job.input.get("document_id") or "")
        storage_path = str(job.input.get("storage_path") or "")
        if not document_id or not storage_path:
            raise ValueError("process_document job missing document_id/storage_path")
        user_id = job.user_id

        self.store.mark_processing(document_id, user_id)
        self._report(job, 5, "downloading")

        try:
            pdf = self.storage.download(storage_path)
            if len(pdf) > self.max_pdf_bytes:
                return self._unsupported(
                    document_id, user_id, reason="PDF exceeds the 30 MB limit"
                )

            self._report(job, 20, "extracting")
            document = self.extractor.extract(pdf, max_pages=self.max_pages)

            if not document.pages or len(document.pages) > self.max_pages:
                return self._unsupported(
                    document_id,
                    user_id,
                    reason=f"unsupported page count: {len(document.pages)}",
                )
            if sum(page.char_count for page in document.pages) == 0:
                return self._unsupported(
                    document_id,
                    user_id,
                    reason="no extractable text (scanned PDF without OCR is unsupported)",
                )

            self._report(job, 60, "saving pages")
            self.store.save_pages(document_id, user_id, document.pages)
            self._report(job, 75, "saving chunks")
            self.store.save_chunks(document_id, user_id, document.chunks)
            self._report(job, 95, "finalizing")
            self.store.mark_ready(document_id, user_id, page_count=len(document.pages))

            return JobResult(
                {
                    "result": "ready",
                    "pages": len(document.pages),
                    "chunks": len(document.chunks),
                }
            )
        except UnsupportedDocument as exc:
            return self._unsupported(document_id, user_id, reason=str(exc))
        except Exception as exc:
            # Transient failure (storage / Docling / DB). On the final attempt,
            # don't leave the document stuck in 'processing'. Re-raise either way
            # so the runner requeues (or finalizes the job as failed).
            if job.attempt_count >= job.max_attempts:
                self.store.mark_failed(document_id, user_id, error=str(exc))
            raise

    def _unsupported(self, document_id: str, user_id: str, *, reason: str) -> JobResult:
        self.store.mark_unsupported(document_id, user_id, reason=reason)
        return JobResult({"result": "unsupported", "reason": reason})

    def _report(self, job: AiJob, progress: int, step: str) -> None:
        # Progress is best-effort observability; never fail a job over it.
        try:
            self.progress.update_progress(job.id, progress, step)
        except Exception:
            pass


def build_process_document_handler(settings) -> ProcessDocumentHandler:
    from app.extraction import DoclingPdfExtractor
    from app.jobs.repository import SupabaseRpcJobRepository
    from app.supabase_io import SupabaseDocumentStore, SupabaseStorageDownloader

    return ProcessDocumentHandler(
        storage=SupabaseStorageDownloader(
            supabase_url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key,
        ),
        store=SupabaseDocumentStore(
            supabase_url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key,
        ),
        extractor=DoclingPdfExtractor(),
        progress=SupabaseRpcJobRepository(
            supabase_url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key,
            worker_id=settings.worker_id,
        ),
    )


def process_document(job: AiJob) -> JobResult:
    from app.config import get_settings

    return build_process_document_handler(get_settings())(job)
