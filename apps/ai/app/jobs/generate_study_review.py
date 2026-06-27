"""US-RAG-010: generate_study_review handler — RAG attempts → cited study review.

Turns a student's ``rag_question_attempts`` (the weak-area signal) plus the
document's retrieval chunks (grounding evidence) into a normalized
``study_reviews`` row keyed to a ``quiz_set`` (mode ``study_review``). The review
is an overall ``summary``, a list of ``weak_topics`` — each grounded in a source
chunk (chunk id + page range + excerpt) per ``docs/product/lean-rag-mvp.md`` and
``ai-provider-strategy.md`` — and ``recommended_actions``.

A student who answered everything correctly yields an empty ``weak_topics`` and a
positive summary: that is a valid review, not a failure. Grounding is still
enforced — any weak topic the model DOES return must cite a provided chunk.

Mirrors ``generate_quiz.py``/``generate_cram.py`` (US-RAG-008/009): orchestration
sits behind protocols (attempt source, chunk source, generator, review store,
progress) so it is unit-testable without the network or a live model. Production
wiring lives in ``build_generate_study_review_handler``; the registered
``generate_study_review`` builds it lazily from settings.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from app.jobs.generate_quiz import ChunkSource, SourceChunk
from app.jobs.models import AiJob, JobResult
from app.jobs.process_document import ProgressReporter
from app.llm import GenerationResult

# How many of the document's chunks to put in the grounding context, and how many
# attempts to summarize in the prompt. Bounded so a large document / long history
# does not blow the model's context window; the model cites by the 1-based
# position within the chunk set.
DEFAULT_CHUNK_LIMIT = 30
DEFAULT_ATTEMPT_LIMIT = 100


@dataclass(frozen=True)
class AttemptRecord:
    """One answered RAG question, enriched from ``rag_question_attempts`` ⨝
    ``questions``. The weak-area signal the review reasons over."""

    question_id: str
    quiz_set_id: str | None
    topic: str | None
    prompt: str
    correct_answer: str | None
    is_correct: bool | None


@dataclass(frozen=True)
class WeakTopic:
    """A persistable, cited review item."""

    topic: str
    why: str
    recommended_action: str
    source_chunk_id: str
    source_page_start: int | None
    source_page_end: int | None
    source_excerpt: str


@dataclass(frozen=True)
class StudyReview:
    """The generated artifact persisted into ``study_reviews``."""

    summary: dict
    weak_topics: list[WeakTopic]
    recommended_actions: list[str] = field(default_factory=list)


class AttemptSource(Protocol):
    def fetch_attempts(
        self, document_id: str, user_id: str, *, source_quiz_set_id: str | None, limit: int
    ) -> list[AttemptRecord]: ...


class ReviewGenerator(Protocol):
    def generate(self, prompt: str, *, schema: dict, system: str | None = None) -> GenerationResult: ...


class ReviewStore(Protocol):
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
    def save_study_review(
        self,
        *,
        quiz_set_id: str,
        user_id: str,
        document_id: str,
        review: StudyReview,
    ) -> str: ...


SYSTEM_PROMPT = (
    "You are a careful study coach. Given a student's quiz attempts (which they "
    "got right or wrong) and the source material, you write a concise, encouraging "
    "study review grounded ONLY in the provided source chunks. You identify the "
    "weak topics from the questions the student missed, you never invent facts that "
    "are not supported by a chunk, and every weak topic cites the chunk it came from."
)


def study_review_schema(chunk_count: int) -> dict:
    """Caller schema for the generation service, bound to this request.

    Each weak topic's ``source_chunk`` is a 1-based index into the provided
    chunks, so its maximum is the number of chunks actually supplied.
    ``weak_topics`` may be empty (the student aced it); ``summary`` is required.
    """
    return {
        "type": "object",
        "required": ["summary", "weak_topics", "recommended_actions"],
        "properties": {
            "summary": {"type": "string"},
            "weak_topics": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["topic", "why", "source_chunk"],
                    "properties": {
                        "topic": {"type": "string"},
                        "why": {"type": "string"},
                        "source_chunk": {"type": "integer", "minimum": 1, "maximum": chunk_count},
                        "recommended_action": {"type": "string"},
                    },
                },
            },
            "recommended_actions": {"type": "array", "items": {"type": "string"}},
        },
    }


def build_review_prompt(attempts: list[AttemptRecord], chunks: list[SourceChunk]) -> str:
    correct = sum(1 for a in attempts if a.is_correct)
    incorrect = sum(1 for a in attempts if a.is_correct is False)
    lines = [
        "Write a study review for the student based on their ATTEMPTS and the "
        "SOURCE CHUNKS below.",
        "Rules:",
        "- Identify WEAK TOPICS from the questions the student got WRONG; group "
        "related misses into a topic.",
        "- Ground every weak topic in the source material: `source_chunk` is the "
        "number ([1], [2], ...) of the chunk that covers it.",
        "- For each weak topic add a one-sentence `why` (what the student is "
        "missing) and a concrete `recommended_action`.",
        "- Write an overall `summary` (2-3 sentences) and a short list of "
        "`recommended_actions` (next steps).",
        "- Use ONLY information stated in the chunks; do not add outside facts.",
        "- If the student answered everything correctly, return an empty "
        "`weak_topics` list and an encouraging summary.",
        "",
        f"ATTEMPTS ({len(attempts)} answered — {correct} correct, {incorrect} incorrect):",
    ]
    for attempt in attempts:
        mark = "correct" if attempt.is_correct else "WRONG"
        topic = f" [topic: {attempt.topic}]" if attempt.topic else ""
        answer = f" (correct answer: {attempt.correct_answer})" if attempt.correct_answer else ""
        lines.append(f"- ({mark}){topic} {attempt.prompt.strip()}{answer}")
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
class GenerateStudyReviewHandler:
    attempts: AttemptSource
    chunks: ChunkSource
    generator: ReviewGenerator
    store: ReviewStore
    progress: ProgressReporter
    chunk_limit: int = DEFAULT_CHUNK_LIMIT
    attempt_limit: int = DEFAULT_ATTEMPT_LIMIT
    excerpt_chars: int = 500

    def __call__(self, job: AiJob) -> JobResult:
        document_id = str(job.input.get("document_id") or "")
        if not document_id:
            raise ValueError("generate_study_review job missing document_id")
        user_id = job.user_id
        source_quiz_set_id = job.input.get("source_quiz_set_id") or None

        self._report(job, 5, "loading attempts")
        attempts = self.attempts.fetch_attempts(
            document_id, user_id, source_quiz_set_id=source_quiz_set_id, limit=self.attempt_limit
        )
        if not attempts:
            # Nothing to review. The runner treats raised exceptions as retryable;
            # a review job should not have been queued without attempts. Exhausted
            # attempts finalize the job as failed.
            raise ValueError(f"document {document_id} has no attempts to review")

        self._report(job, 20, "loading source")
        chunks = self.chunks.fetch_chunks(document_id, user_id, limit=self.chunk_limit)
        if not chunks:
            raise ValueError(f"document {document_id} has no chunks to ground a study review")

        self._report(job, 40, "generating")
        schema = study_review_schema(len(chunks))
        result = self.generator.generate(
            build_review_prompt(attempts, chunks),
            schema=schema,
            system=SYSTEM_PROMPT,
        )

        self._report(job, 70, "validating citations")
        raw_weak = result.data.get("weak_topics") or []
        weak_topics = self._map_weak_topics(raw_weak, chunks)
        if raw_weak and not weak_topics:
            # The model named weak topics but none cited a provided chunk — a
            # grounding failure. An empty model list (student aced it) is fine.
            raise ValueError("no generated weak topic carried a valid source citation")

        correct = sum(1 for a in attempts if a.is_correct)
        incorrect = sum(1 for a in attempts if a.is_correct is False)
        summary = {
            "text": (result.data.get("summary") or "").strip(),
            "attempts_reviewed": len(attempts),
            "correct": correct,
            "incorrect": incorrect,
        }
        if source_quiz_set_id:
            summary["source_quiz_set_id"] = source_quiz_set_id
        recommended_actions = [
            str(a).strip()
            for a in (result.data.get("recommended_actions") or [])
            if str(a).strip()
        ]
        review = StudyReview(
            summary=summary,
            weak_topics=weak_topics,
            recommended_actions=recommended_actions,
        )

        self._report(job, 90, "saving study review")
        quiz_set_id = self.store.create_quiz_set(
            user_id=user_id,
            document_id=document_id,
            job_id=job.id,
            mode="study_review",
            title=self._title(len(attempts)),
            difficulty=None,
            credit_cost=0,
        )
        study_review_id = self.store.save_study_review(
            quiz_set_id=quiz_set_id,
            user_id=user_id,
            document_id=document_id,
            review=review,
        )

        return JobResult(
            {
                "result": "ready",
                "quiz_set_id": quiz_set_id,
                "study_review_id": study_review_id,
                "weak_topics": len(weak_topics),
                "attempts_reviewed": len(attempts),
                "provider": result.provider_name,
                "model": result.model,
                "repaired": result.repaired,
                "fell_back": result.fell_back,
            }
        )

    def _map_weak_topics(self, raw_topics: list[dict], chunks: list[SourceChunk]) -> list[WeakTopic]:
        """Map model output to persistable weak topics, dropping any whose
        citation is out of range or whose topic is blank. The schema already
        bounds ``source_chunk``; this is the defensive backstop that also resolves
        the citation to a concrete chunk id / page range / excerpt."""
        mapped: list[WeakTopic] = []
        for raw in raw_topics:
            position = raw.get("source_chunk")
            if not isinstance(position, int) or position < 1 or position > len(chunks):
                continue  # citation not in the provided context — drop it
            topic = (raw.get("topic") or "").strip()
            if not topic:
                continue  # a weak topic needs a name
            chunk = chunks[position - 1]
            mapped.append(
                WeakTopic(
                    topic=topic,
                    why=(raw.get("why") or "").strip(),
                    recommended_action=(raw.get("recommended_action") or "").strip(),
                    source_chunk_id=chunk.chunk_id,
                    source_page_start=chunk.page_start,
                    source_page_end=chunk.page_end,
                    source_excerpt=(chunk.content or "")[: self.excerpt_chars],
                )
            )
        return mapped

    @staticmethod
    def _title(attempt_count: int) -> str:
        return f"Study review of {attempt_count} attempts"

    def _report(self, job: AiJob, progress: int, step: str) -> None:
        try:
            self.progress.update_progress(job.id, progress, step)
        except Exception:
            pass


def build_generate_study_review_handler(settings) -> GenerateStudyReviewHandler:
    from app.jobs.repository import SupabaseRpcJobRepository
    from app.llm import build_generation_service
    from app.supabase_io import SupabaseAttemptSource, SupabaseChunkSource, SupabaseQuizStore

    return GenerateStudyReviewHandler(
        attempts=SupabaseAttemptSource(
            supabase_url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key,
        ),
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


def generate_study_review(job: AiJob) -> JobResult:
    from app.config import get_settings

    return build_generate_study_review_handler(get_settings())(job)
