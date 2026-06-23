"""US-RAG-005: Docling-backed PDF extraction + chunking.

``docling`` is imported lazily inside ``extract`` so importing this module (and
the ``process_document`` handler) never requires the heavy dependency — unit
tests inject a fake ``PdfExtractor`` instead. This production path is exercised
by the documented manual real-Docling run (see the story validation.md).
"""

from __future__ import annotations

import io
import re

from app.jobs.process_document import (
    ExtractedChunk,
    ExtractedDocument,
    ExtractedPage,
    UnsupportedDocument,
)


def _estimate_tokens(text: str) -> int:
    # Rough ~4-chars-per-token estimate; replaced by a real tokenizer when the
    # embedding/generation providers land (US-RAG-006/007).
    return max(1, len(text) // 4)


def _clean(text: str) -> str:
    return re.sub(r"[ \t]+", " ", text).strip()


class DoclingPdfExtractor:
    def extract(self, pdf: bytes, *, max_pages: int) -> ExtractedDocument:
        try:
            from docling.chunking import HybridChunker
            from docling.datamodel.base_models import DocumentStream
            from docling.document_converter import DocumentConverter
        except ImportError as exc:  # pragma: no cover - environment dependent
            raise RuntimeError(
                "docling is not installed; run `pip install -r apps/ai/requirements.txt`"
            ) from exc

        source = DocumentStream(name="document.pdf", stream=io.BytesIO(pdf))
        try:
            converted = DocumentConverter().convert(source)
        except Exception as exc:  # unparseable / encrypted / not a PDF
            raise UnsupportedDocument(f"could not parse PDF: {exc}") from exc

        document = converted.document
        return ExtractedDocument(
            pages=self._pages(document),
            chunks=self._chunks(document, HybridChunker()),
        )

    def _pages(self, document) -> list[ExtractedPage]:
        # Group exported text by source page using item provenance.
        texts: dict[int, list[str]] = {}
        for item, _level in document.iterate_items():
            text = getattr(item, "text", None)
            if not text:
                continue
            prov = getattr(item, "prov", None) or []
            page_no = int(prov[0].page_no) if prov else 1
            texts.setdefault(page_no, []).append(text)

        pages: list[ExtractedPage] = []
        for page_no in sorted(texts):
            raw = "\n".join(texts[page_no]).strip()
            pages.append(
                ExtractedPage(page_number=page_no, raw_text=raw, cleaned_text=_clean(raw))
            )
        return pages

    def _chunks(self, document, chunker) -> list[ExtractedChunk]:
        chunks: list[ExtractedChunk] = []
        for index, chunk in enumerate(chunker.chunk(document)):
            content = (getattr(chunk, "text", "") or "").strip()
            if not content:
                continue
            page_start, page_end, heading = self._chunk_meta(chunk)
            chunks.append(
                ExtractedChunk(
                    chunk_index=index,
                    content=content,
                    page_start=page_start,
                    page_end=page_end,
                    heading=heading,
                    token_count=_estimate_tokens(content),
                    metadata={"chunker": "docling.HybridChunker"},
                )
            )
        return chunks

    @staticmethod
    def _chunk_meta(chunk) -> tuple[int | None, int | None, str | None]:
        page_nos: list[int] = []
        heading: str | None = None
        meta = getattr(chunk, "meta", None)
        if meta is not None:
            headings = getattr(meta, "headings", None) or []
            if headings:
                heading = str(headings[0])
            for item in getattr(meta, "doc_items", None) or []:
                for prov in getattr(item, "prov", None) or []:
                    page_nos.append(int(prov.page_no))
        page_start = min(page_nos) if page_nos else None
        page_end = max(page_nos) if page_nos else None
        return page_start, page_end, heading
