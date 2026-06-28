"""US-RAG-012: generate_mock_exam handler — ready document → cited mock exam.

Grounds a timed mock exam in a document's retrieval chunks and persists a
normalized ``quiz_set`` (mode ``mock``) + ``questions``: MCQ questions
(``type='mcq'`` + ``answer_options``, exactly as US-RAG-008) and essay questions
(``type='essay'`` with the grading rubric / max-points / suggested-minutes in
``metadata`` per decision 0012). Each question carries a valid source citation
(chunk id + page range + excerpt) per ``docs/product/lean-rag-mvp.md`` and
``ai-provider-strategy.md``.

Mirrors ``generate_quiz.py``/``generate_cram.py``/``generate_study_review.py``
(US-RAG-008/009/010): orchestration sits behind protocols (chunk source,
generator, mock store, progress) so it is unit-testable without the network or a
live model. This story is the backend producer only — it generates the rubric;
the mock session / essay grading is a later web slice. Production wiring lives in
``build_generate_mock_exam_handler``; the registered ``generate_mock_exam``
builds it lazily from settings.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from app.jobs.generate_quiz import ChunkSource, GeneratedQuestion, SourceChunk, _clamp
from app.jobs.models import AiJob, JobResult
from app.jobs.process_document import ProgressReporter
from app.llm import GenerationResult

DEFAULT_NUM_MCQ = 10
MAX_NUM_MCQ = 30
DEFAULT_NUM_ESSAY = 2
MAX_NUM_ESSAY = 5
# How many of the document's chunks to put in the grounding context. Bounded so a
# large document does not blow the model's context window; the model cites by the
# 1-based position within this set.
DEFAULT_CHUNK_LIMIT = 30
# Rough per-question time allowance used to derive a default exam time limit when
# the caller does not specify one.
MCQ_MINUTES = 1.5
ESSAY_MINUTES = 12


@dataclass(frozen=True)
class GeneratedEssay:
    prompt: str
    sample_answer: str
    rubric: dict
    max_points: int | None
    suggested_minutes: int | None
    explanation: str
    source_chunk_id: str
    source_page_start: int | None
    source_page_end: int | None
    source_excerpt: str
    topic: str | None = None
    difficulty: str | None = None


class MockGenerator(Protocol):
    def generate(self, prompt: str, *, schema: dict, system: str | None = None) -> GenerationResult: ...


class MockStore(Protocol):
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
        self, *, quiz_set_id: str, user_id: str, document_id: str, questions: list[GeneratedQuestion]
    ) -> None: ...
    def save_essays(
        self, *, quiz_set_id: str, user_id: str, document_id: str, essays: list[GeneratedEssay]
    ) -> None: ...


SYSTEM_PROMPT = (
    "You are a careful exam designer. You write a grounded mock exam — multiple-"
    "choice questions and rubric-graded essay questions — using ONLY the provided "
    "source chunks. You never invent facts that are not supported by a chunk, and "
    "every question cites the chunk it came from."
)


def _mcq_item(chunk_count: int) -> dict:
    return {
        "type": "object",
        "required": ["prompt", "options", "answer_index", "source_chunk", "explanation"],
        "properties": {
            "prompt": {"type": "string"},
            "options": {"type": "array", "minItems": 4, "maxItems": 4, "items": {"type": "string"}},
            "answer_index": {"type": "integer", "minimum": 0, "maximum": 3},
            "source_chunk": {"type": "integer", "minimum": 1, "maximum": chunk_count},
            "explanation": {"type": "string"},
            "topic": {"type": "string"},
            "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]},
        },
    }


def _essay_item(chunk_count: int) -> dict:
    return {
        "type": "object",
        "required": ["prompt", "source_chunk", "rubric"],
        "properties": {
            "prompt": {"type": "string"},
            "source_chunk": {"type": "integer", "minimum": 1, "maximum": chunk_count},
            "sample_answer": {"type": "string"},
            "max_points": {"type": "integer", "minimum": 1},
            "suggested_minutes": {"type": "integer", "minimum": 1},
            "topic": {"type": "string"},
            "rubric": {
                "type": "object",
                "required": ["criteria"],
                "properties": {
                    "criteria": {
                        "type": "array",
                        "minItems": 1,
                        "items": {
                            "type": "object",
                            "required": ["name", "max_points", "levels"],
                            "properties": {
                                "name": {"type": "string"},
                                "description": {"type": "string"},
                                "max_points": {"type": "integer", "minimum": 1},
                                "levels": {
                                    "type": "array",
                                    "minItems": 2,
                                    "items": {
                                        "type": "object",
                                        "required": ["score", "label"],
                                        "properties": {
                                            "score": {"type": "integer"},
                                            "label": {"type": "string"},
                                            "description": {"type": "string"},
                                        },
                                    },
                                },
                            },
                        },
                    }
                },
            },
        },
    }


def mock_schema(chunk_count: int, num_mcq: int, num_essay: int) -> dict:
    """Caller schema for the generation service, bound to this request.

    Each question's ``source_chunk`` is a 1-based index into the provided chunks.
    The two arrays are bounded to their requested counts; either may be empty, but
    the handler requires at least one cited question overall.
    """
    return {
        "type": "object",
        "required": ["mcq_questions", "essay_questions"],
        "properties": {
            "mcq_questions": {
                "type": "array", "minItems": 0, "maxItems": num_mcq,
                "items": _mcq_item(chunk_count),
            },
            "essay_questions": {
                "type": "array", "minItems": 0, "maxItems": num_essay,
                "items": _essay_item(chunk_count),
            },
        },
    }


def build_mock_prompt(
    chunks: list[SourceChunk], num_mcq: int, num_essay: int, difficulty: str | None
) -> str:
    lines = [
        f"Design a mock exam with {num_mcq} multiple-choice questions and "
        f"{num_essay} essay questions from the SOURCE CHUNKS below.",
        "Rules:",
        "- Use ONLY information stated in the chunks; do not add outside facts.",
        "- Each MCQ has exactly 4 options and one correct answer; `answer_index` "
        "is the 0-based index of the correct option.",
        "- Each essay has a `prompt`, a `sample_answer`, a `suggested_minutes`, a "
        "`max_points`, and a `rubric` with scored `criteria` (each criterion has "
        "named `levels` with a `score` and `label`).",
        "- `source_chunk` is the number ([1], [2], ...) of the chunk the question "
        "is grounded in.",
        "- Add a one-sentence `explanation` and a short `topic` to each MCQ.",
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
class GenerateMockExamHandler:
    chunks: ChunkSource
    generator: MockGenerator
    store: MockStore
    progress: ProgressReporter
    chunk_limit: int = DEFAULT_CHUNK_LIMIT
    excerpt_chars: int = 500

    def __call__(self, job: AiJob) -> JobResult:
        document_id = str(job.input.get("document_id") or "")
        if not document_id:
            raise ValueError("generate_mock_exam job missing document_id")
        user_id = job.user_id
        num_mcq = _clamp(int(job.input.get("num_mcq") or DEFAULT_NUM_MCQ), 1, MAX_NUM_MCQ)
        num_essay = _clamp(int(job.input.get("num_essay") or DEFAULT_NUM_ESSAY), 0, MAX_NUM_ESSAY)
        difficulty = job.input.get("difficulty") or None

        self._report(job, 5, "loading source")
        chunks = self.chunks.fetch_chunks(document_id, user_id, limit=self.chunk_limit)
        if not chunks:
            # An un-indexed document should not have been queued. The runner treats
            # raised exceptions as retryable; exhausted attempts finalize as failed.
            raise ValueError(f"document {document_id} has no chunks to ground a mock exam")

        self._report(job, 35, "generating")
        schema = mock_schema(len(chunks), num_mcq, num_essay)
        result = self.generator.generate(
            build_mock_prompt(chunks, num_mcq, num_essay, difficulty),
            schema=schema,
            system=SYSTEM_PROMPT,
        )

        self._report(job, 70, "validating citations")
        mcqs = self._map_mcqs(result.data.get("mcq_questions", []), chunks, difficulty)
        essays = self._map_essays(result.data.get("essay_questions", []), chunks, difficulty)
        if not mcqs and not essays:
            raise ValueError("no generated question carried a valid source citation")

        self._report(job, 90, "saving mock exam")
        time_limit_minutes = int(job.input.get("time_limit_minutes") or self._default_time(mcqs, essays))
        title = self._title(len(mcqs), len(essays))
        quiz_set_id = self.store.create_quiz_set(
            user_id=user_id,
            document_id=document_id,
            job_id=job.id,
            mode="mock",
            title=title,
            difficulty=difficulty,
            credit_cost=0,
        )
        if mcqs:
            self.store.save_questions(
                quiz_set_id=quiz_set_id, user_id=user_id, document_id=document_id, questions=mcqs
            )
        if essays:
            self.store.save_essays(
                quiz_set_id=quiz_set_id, user_id=user_id, document_id=document_id, essays=essays
            )

        return JobResult(
            {
                "result": "ready",
                "quiz_set_id": quiz_set_id,
                "mcq": len(mcqs),
                "essays": len(essays),
                "time_limit_minutes": time_limit_minutes,
                "provider": result.provider_name,
                "model": result.model,
                "repaired": result.repaired,
                "fell_back": result.fell_back,
            }
        )

    def _map_mcqs(
        self, raw_questions: list[dict], chunks: list[SourceChunk], difficulty: str | None
    ) -> list[GeneratedQuestion]:
        """Map model MCQ output to persistable questions, dropping any whose
        citation is out of range or that is not a well-formed 4-option MCQ. Same
        contract as US-RAG-008."""
        mapped: list[GeneratedQuestion] = []
        for raw in raw_questions:
            position = raw.get("source_chunk")
            if not isinstance(position, int) or position < 1 or position > len(chunks):
                continue  # citation not in the provided context — drop it
            options = raw.get("options") or []
            answer_index = raw.get("answer_index")
            if len(options) != 4 or not isinstance(answer_index, int) or not 0 <= answer_index < 4:
                continue
            prompt = (raw.get("prompt") or "").strip()
            if not prompt:
                continue
            chunk = chunks[position - 1]
            mapped.append(
                GeneratedQuestion(
                    prompt=prompt,
                    options=list(options),
                    answer_index=answer_index,
                    correct_answer=options[answer_index],
                    explanation=raw.get("explanation", ""),
                    source_chunk_id=chunk.chunk_id,
                    source_page_start=chunk.page_start,
                    source_page_end=chunk.page_end,
                    source_excerpt=(chunk.content or "")[: self.excerpt_chars],
                    topic=raw.get("topic"),
                    difficulty=raw.get("difficulty") or difficulty,
                )
            )
        return mapped

    def _map_essays(
        self, raw_essays: list[dict], chunks: list[SourceChunk], difficulty: str | None
    ) -> list[GeneratedEssay]:
        """Map model essay output to persistable essays, dropping any whose
        citation is out of range, whose prompt is blank, or whose rubric has no
        criteria. The rubric / max-points / suggested-minutes ride in metadata
        (decision 0012)."""
        mapped: list[GeneratedEssay] = []
        for raw in raw_essays:
            position = raw.get("source_chunk")
            if not isinstance(position, int) or position < 1 or position > len(chunks):
                continue  # citation not in the provided context — drop it
            prompt = (raw.get("prompt") or "").strip()
            rubric = raw.get("rubric") or {}
            if not prompt or not rubric.get("criteria"):
                continue  # an essay needs a question and a gradable rubric
            chunk = chunks[position - 1]
            mapped.append(
                GeneratedEssay(
                    prompt=prompt,
                    sample_answer=(raw.get("sample_answer") or "").strip(),
                    rubric=rubric,
                    max_points=raw.get("max_points"),
                    suggested_minutes=raw.get("suggested_minutes"),
                    explanation=raw.get("explanation", ""),
                    source_chunk_id=chunk.chunk_id,
                    source_page_start=chunk.page_start,
                    source_page_end=chunk.page_end,
                    source_excerpt=(chunk.content or "")[: self.excerpt_chars],
                    topic=raw.get("topic"),
                    difficulty=difficulty,
                )
            )
        return mapped

    @staticmethod
    def _default_time(mcqs: list, essays: list) -> int:
        suggested = sum(e.suggested_minutes or ESSAY_MINUTES for e in essays)
        return max(1, round(len(mcqs) * MCQ_MINUTES + suggested))

    @staticmethod
    def _title(mcq_count: int, essay_count: int) -> str:
        return f"Mock exam ({mcq_count} MCQ + {essay_count} essay)"

    def _report(self, job: AiJob, progress: int, step: str) -> None:
        try:
            self.progress.update_progress(job.id, progress, step)
        except Exception:
            pass


def build_generate_mock_exam_handler(settings) -> GenerateMockExamHandler:
    from app.jobs.repository import SupabaseRpcJobRepository
    from app.llm import build_generation_service
    from app.supabase_io import SupabaseChunkSource, SupabaseQuizStore

    return GenerateMockExamHandler(
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


def generate_mock_exam(job: AiJob) -> JobResult:
    from app.config import get_settings

    return build_generate_mock_exam_handler(get_settings())(job)
