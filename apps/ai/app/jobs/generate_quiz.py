"""US-RAG-008: generate_regular_quiz handler — ready document → cited MCQ set.

Grounds a regular multiple-choice quiz in a document's retrieval chunks and
persists a normalized ``quiz_set`` + ``questions`` + ``answer_options``. Each
question carries a valid source citation (chunk id + page range + excerpt) per
``docs/product/lean-rag-mvp.md`` and ``ai-provider-strategy.md``.

Orchestration sits behind protocols (chunk source, generator, quiz store,
progress) so it is unit-testable without the network or a live model. Production
wiring lives in ``build_generate_regular_quiz_handler``; the registered
``generate_regular_quiz`` builds it lazily from settings.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from app.jobs.models import AiJob, JobResult
from app.jobs.process_document import ProgressReporter
from app.llm import GenerationResult

DEFAULT_NUM_QUESTIONS = 5
MAX_NUM_QUESTIONS = 20
# How many of the document's chunks to put in the grounding context. Bounded so a
# large document does not blow the model's context window; the model cites by the
# 1-based position within this set.
DEFAULT_CHUNK_LIMIT = 30


@dataclass(frozen=True)
class SourceChunk:
    chunk_id: str
    chunk_index: int
    content: str
    page_start: int | None = None
    page_end: int | None = None


@dataclass(frozen=True)
class GeneratedQuestion:
    prompt: str
    options: list[str]
    answer_index: int
    correct_answer: str
    explanation: str
    source_chunk_id: str
    source_page_start: int | None
    source_page_end: int | None
    source_excerpt: str
    topic: str | None = None
    difficulty: str | None = None
    metadata: dict = field(default_factory=dict)


class ChunkSource(Protocol):
    def fetch_chunks(self, document_id: str, user_id: str, *, limit: int) -> list[SourceChunk]: ...


class QuizGenerator(Protocol):
    def generate(self, prompt: str, *, schema: dict, system: str | None = None) -> GenerationResult: ...


class QuizStore(Protocol):
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
    def save_questions(
        self,
        *,
        quiz_set_id: str,
        user_id: str,
        document_id: str,
        questions: list[GeneratedQuestion],
    ) -> None: ...


SYSTEM_PROMPT = (
    "You are a careful study-quiz writer. You write multiple-choice questions "
    "grounded ONLY in the provided source chunks. You never invent facts that are "
    "not supported by a chunk, and every question cites the chunk it came from."
)


def quiz_schema(chunk_count: int, num_questions: int) -> dict:
    """Caller schema for the generation service, bound to this request.

    ``source_chunk`` is a 1-based index into the provided chunks, so its maximum
    is the number of chunks actually supplied.
    """
    return {
        "type": "object",
        "required": ["questions"],
        "properties": {
            "questions": {
                "type": "array",
                "minItems": 1,
                "maxItems": num_questions,
                "items": {
                    "type": "object",
                    "required": ["prompt", "options", "answer_index", "source_chunk", "explanation"],
                    "properties": {
                        "prompt": {"type": "string"},
                        "options": {
                            "type": "array",
                            "minItems": 4,
                            "maxItems": 4,
                            "items": {"type": "string"},
                        },
                        "answer_index": {"type": "integer", "minimum": 0, "maximum": 3},
                        "source_chunk": {"type": "integer", "minimum": 1, "maximum": chunk_count},
                        "explanation": {"type": "string"},
                        "topic": {"type": "string"},
                        "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]},
                    },
                },
            }
        },
    }


def build_prompt(chunks: list[SourceChunk], num_questions: int, difficulty: str | None) -> str:
    lines = [
        f"Write {num_questions} multiple-choice questions from the SOURCE CHUNKS below.",
        "Rules:",
        "- Use ONLY information stated in the chunks; do not add outside facts.",
        "- Each question has exactly 4 options and one correct answer.",
        "- `answer_index` is the 0-based index of the correct option.",
        "- `source_chunk` is the number ([1], [2], ...) of the chunk the question "
        "is grounded in.",
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
class GenerateRegularQuizHandler:
    chunks: ChunkSource
    generator: QuizGenerator
    store: QuizStore
    progress: ProgressReporter
    chunk_limit: int = DEFAULT_CHUNK_LIMIT
    excerpt_chars: int = 500

    def __call__(self, job: AiJob) -> JobResult:
        document_id = str(job.input.get("document_id") or "")
        if not document_id:
            raise ValueError("generate_regular_quiz job missing document_id")
        user_id = job.user_id
        num_questions = _clamp(
            int(job.input.get("num_questions") or DEFAULT_NUM_QUESTIONS), 1, MAX_NUM_QUESTIONS
        )
        difficulty = job.input.get("difficulty") or None

        self._report(job, 5, "loading source")
        chunks = self.chunks.fetch_chunks(document_id, user_id, limit=self.chunk_limit)
        if not chunks:
            # Not retryable in spirit (the document is not indexed), but the runner
            # treats raised exceptions as retryable; an un-indexed document should
            # not have been queued. Exhausted attempts finalize the job as failed.
            raise ValueError(f"document {document_id} has no chunks to ground a quiz")

        self._report(job, 30, "generating")
        schema = quiz_schema(len(chunks), num_questions)
        result = self.generator.generate(
            build_prompt(chunks, num_questions, difficulty),
            schema=schema,
            system=SYSTEM_PROMPT,
        )

        self._report(job, 70, "validating citations")
        questions = self._map_questions(result.data.get("questions", []), chunks)
        if not questions:
            raise ValueError("no generated question carried a valid source citation")

        self._report(job, 90, "saving quiz")
        title = self._title(difficulty, len(questions))
        quiz_set_id = self.store.create_quiz_set(
            user_id=user_id,
            document_id=document_id,
            job_id=job.id,
            mode="regular",
            title=title,
            difficulty=difficulty,
            credit_cost=0,
        )
        self.store.save_questions(
            quiz_set_id=quiz_set_id,
            user_id=user_id,
            document_id=document_id,
            questions=questions,
        )

        return JobResult(
            {
                "result": "ready",
                "quiz_set_id": quiz_set_id,
                "questions": len(questions),
                "provider": result.provider_name,
                "model": result.model,
                "repaired": result.repaired,
                "fell_back": result.fell_back,
            }
        )

    def _map_questions(
        self, raw_questions: list[dict], chunks: list[SourceChunk]
    ) -> list[GeneratedQuestion]:
        """Map model output to persistable questions, dropping any whose citation
        is out of range. The schema already bounds ``source_chunk`` to the chunk
        count; this is the defensive backstop that also resolves the citation to a
        concrete chunk id / page range / excerpt."""
        mapped: list[GeneratedQuestion] = []
        for raw in raw_questions:
            position = raw.get("source_chunk")
            if not isinstance(position, int) or position < 1 or position > len(chunks):
                continue  # citation not in the provided context — drop it
            options = raw.get("options") or []
            answer_index = raw.get("answer_index")
            if len(options) != 4 or not isinstance(answer_index, int) or not 0 <= answer_index < 4:
                continue
            chunk = chunks[position - 1]
            mapped.append(
                GeneratedQuestion(
                    prompt=raw["prompt"],
                    options=list(options),
                    answer_index=answer_index,
                    correct_answer=options[answer_index],
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
        base = f"{count}-question quiz"
        return f"{base} ({difficulty})" if difficulty else base

    def _report(self, job: AiJob, progress: int, step: str) -> None:
        try:
            self.progress.update_progress(job.id, progress, step)
        except Exception:
            pass


def _clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, value))


def build_generate_regular_quiz_handler(settings) -> GenerateRegularQuizHandler:
    from app.jobs.repository import SupabaseRpcJobRepository
    from app.llm import build_generation_service
    from app.supabase_io import SupabaseChunkSource, SupabaseQuizStore

    return GenerateRegularQuizHandler(
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


def generate_regular_quiz(job: AiJob) -> JobResult:
    from app.config import get_settings

    return build_generate_regular_quiz_handler(get_settings())(job)
