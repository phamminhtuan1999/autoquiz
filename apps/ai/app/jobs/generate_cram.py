"""US-RAG-009: generate_cram handler — ready document → cited flashcard set.

Grounds a rapid-review cram deck in a document's retrieval chunks and persists a
normalized ``quiz_set`` (mode ``cram``) + ``questions`` (``type='flashcard'``).
Each card carries a valid source citation (chunk id + page range + excerpt) per
``docs/product/lean-rag-mvp.md`` and ``ai-provider-strategy.md``. A flashcard is
recall (front/back), so it has no ``answer_options``.

Mirrors ``generate_quiz.py`` (US-RAG-008): orchestration sits behind protocols
(chunk source, generator, cram store, progress) so it is unit-testable without
the network or a live model. Production wiring lives in
``build_generate_cram_handler``; the registered ``generate_cram`` builds it
lazily from settings.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from app.jobs.generate_quiz import ChunkSource, SourceChunk, _clamp
from app.jobs.models import AiJob, JobResult
from app.jobs.process_document import ProgressReporter
from app.llm import GenerationResult

DEFAULT_NUM_CARDS = 10
MAX_NUM_CARDS = 30
# How many of the document's chunks to put in the grounding context. Bounded so a
# large document does not blow the model's context window; the model cites by the
# 1-based position within this set.
DEFAULT_CHUNK_LIMIT = 30


@dataclass(frozen=True)
class GeneratedCard:
    prompt: str
    answer: str
    explanation: str
    source_chunk_id: str
    source_page_start: int | None
    source_page_end: int | None
    source_excerpt: str
    topic: str | None = None
    difficulty: str | None = None
    metadata: dict = field(default_factory=dict)


class CramGenerator(Protocol):
    def generate(self, prompt: str, *, schema: dict, system: str | None = None) -> GenerationResult: ...


class CramStore(Protocol):
    def create_quiz_set(
        self,
        *,
        user_id: str,
        document_id: str,
        job_id: str,
        mode: str,
        title: str,
        difficulty: str | None,
        credit_cost: int,
    ) -> str: ...
    def save_cards(
        self,
        *,
        quiz_set_id: str,
        user_id: str,
        document_id: str,
        cards: list[GeneratedCard],
    ) -> None: ...


SYSTEM_PROMPT = (
    "You are a careful study-cram writer. You write concise front/back review "
    "flashcards grounded ONLY in the provided source chunks. You never invent "
    "facts that are not supported by a chunk, and every card cites the chunk it "
    "came from."
)


def cram_schema(chunk_count: int, num_cards: int) -> dict:
    """Caller schema for the generation service, bound to this request.

    ``source_chunk`` is a 1-based index into the provided chunks, so its maximum
    is the number of chunks actually supplied. A card is front (``prompt``) +
    back (``answer``); there are no options.
    """
    return {
        "type": "object",
        "required": ["cards"],
        "properties": {
            "cards": {
                "type": "array",
                "minItems": 1,
                "maxItems": num_cards,
                "items": {
                    "type": "object",
                    "required": ["prompt", "answer", "source_chunk"],
                    "properties": {
                        "prompt": {"type": "string"},
                        "answer": {"type": "string"},
                        "source_chunk": {"type": "integer", "minimum": 1, "maximum": chunk_count},
                        "explanation": {"type": "string"},
                        "topic": {"type": "string"},
                        "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]},
                    },
                },
            }
        },
    }


def build_cram_prompt(chunks: list[SourceChunk], num_cards: int, difficulty: str | None) -> str:
    lines = [
        f"Write {num_cards} rapid-review flashcards from the SOURCE CHUNKS below.",
        "Rules:",
        "- Use ONLY information stated in the chunks; do not add outside facts.",
        "- Each card has a `prompt` (the front: a question or cue) and a concise "
        "`answer` (the back).",
        "- `source_chunk` is the number ([1], [2], ...) of the chunk the card is "
        "grounded in.",
        "- Add a one-sentence `explanation` and a short `topic`.",
    ]
    if difficulty:
        lines.append(f"- Target difficulty: {difficulty}.")
    lines.append("")
    lines.append("SOURCE CHUNKS:")
    for position, chunk in enumerate(chunks, start=1):
        pages = ""
        if chunk.page_start:
            pages = (
                f" (p{chunk.page_start})"
                if not chunk.page_end or chunk.page_end == chunk.page_start
                else f" (p{chunk.page_start}-{chunk.page_end})"
            )
        lines.append(f"[{position}]{pages} {chunk.content.strip()}")
    return "\n".join(lines)


@dataclass
class GenerateCramHandler:
    chunks: ChunkSource
    generator: CramGenerator
    store: CramStore
    progress: ProgressReporter
    chunk_limit: int = DEFAULT_CHUNK_LIMIT
    excerpt_chars: int = 500

    def __call__(self, job: AiJob) -> JobResult:
        document_id = str(job.input.get("document_id") or "")
        if not document_id:
            raise ValueError("generate_cram job missing document_id")
        user_id = job.user_id
        num_cards = _clamp(
            int(job.input.get("num_cards") or DEFAULT_NUM_CARDS), 1, MAX_NUM_CARDS
        )
        difficulty = job.input.get("difficulty") or None

        self._report(job, 5, "loading source")
        chunks = self.chunks.fetch_chunks(document_id, user_id, limit=self.chunk_limit)
        if not chunks:
            # An un-indexed document should not have been queued. The runner treats
            # raised exceptions as retryable; exhausted attempts finalize as failed.
            raise ValueError(f"document {document_id} has no chunks to ground a cram set")

        self._report(job, 30, "generating")
        schema = cram_schema(len(chunks), num_cards)
        result = self.generator.generate(
            build_cram_prompt(chunks, num_cards, difficulty),
            schema=schema,
            system=SYSTEM_PROMPT,
        )

        self._report(job, 70, "validating citations")
        cards = self._map_cards(result.data.get("cards", []), chunks)
        if not cards:
            raise ValueError("no generated card carried a valid source citation")

        self._report(job, 90, "saving cram set")
        title = self._title(difficulty, len(cards))
        quiz_set_id = self.store.create_quiz_set(
            user_id=user_id,
            document_id=document_id,
            job_id=job.id,
            mode="cram",
            title=title,
            difficulty=difficulty,
            credit_cost=0,
        )
        self.store.save_cards(
            quiz_set_id=quiz_set_id,
            user_id=user_id,
            document_id=document_id,
            cards=cards,
        )

        return JobResult(
            {
                "result": "ready",
                "quiz_set_id": quiz_set_id,
                "cards": len(cards),
                "provider": result.provider_name,
                "model": result.model,
                "repaired": result.repaired,
                "fell_back": result.fell_back,
            }
        )

    def _map_cards(self, raw_cards: list[dict], chunks: list[SourceChunk]) -> list[GeneratedCard]:
        """Map model output to persistable cards, dropping any whose citation is
        out of range or whose front/back is blank. The schema already bounds
        ``source_chunk``; this is the defensive backstop that also resolves the
        citation to a concrete chunk id / page range / excerpt."""
        mapped: list[GeneratedCard] = []
        for raw in raw_cards:
            position = raw.get("source_chunk")
            if not isinstance(position, int) or position < 1 or position > len(chunks):
                continue  # citation not in the provided context — drop it
            prompt = (raw.get("prompt") or "").strip()
            answer = (raw.get("answer") or "").strip()
            if not prompt or not answer:
                continue  # a flashcard needs both a front and a back
            chunk = chunks[position - 1]
            mapped.append(
                GeneratedCard(
                    prompt=prompt,
                    answer=answer,
                    explanation=raw.get("explanation", ""),
                    source_chunk_id=chunk.chunk_id,
                    source_page_start=chunk.page_start,
                    source_page_end=chunk.page_end,
                    source_excerpt=(chunk.content or "")[: self.excerpt_chars],
                    topic=raw.get("topic"),
                    difficulty=raw.get("difficulty"),
                )
            )
        return mapped

    @staticmethod
    def _title(difficulty: str | None, count: int) -> str:
        base = f"{count}-card cram"
        return f"{base} ({difficulty})" if difficulty else base

    def _report(self, job: AiJob, progress: int, step: str) -> None:
        try:
            self.progress.update_progress(job.id, progress, step)
        except Exception:
            pass


def build_generate_cram_handler(settings) -> GenerateCramHandler:
    from app.jobs.repository import SupabaseRpcJobRepository
    from app.llm import build_generation_service
    from app.supabase_io import SupabaseChunkSource, SupabaseQuizStore

    return GenerateCramHandler(
        chunks=SupabaseChunkSource(
            supabase_url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key,
        ),
        generator=build_generation_service(settings),
        store=SupabaseQuizStore(
            supabase_url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key,
        ),
        progress=SupabaseRpcJobRepository(
            supabase_url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key,
            worker_id=settings.worker_id,
        ),
    )


def generate_cram(job: AiJob) -> JobResult:
    from app.config import get_settings

    return build_generate_cram_handler(get_settings())(job)
