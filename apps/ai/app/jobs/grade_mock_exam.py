"""US-RAG-012b: grade_mock_exam handler — student essay answers → rubric grades.

Closes the mock-exam loop. A student takes a mock ``quiz_set`` (US-RAG-012) in
the web app: their MCQ answers auto-grade from ``answer_options`` and each essay
answer is captured to ``rag_question_attempts.answer_text``. This job grades every
**answered** essay against its stored rubric (``questions.metadata`` per decision
0012) using the US-RAG-007 generation / repair / fallback service, and returns
per-essay rubric scores + written feedback + an exam total.

The grade is the job's *output* — persisted to ``ai_jobs.output`` by the runner
and read back by the player (decision 0013). There is no grade table and no new
attempt column; an unanswered essay scores 0 deterministically (no model call).

Mirrors ``generate_quiz.py`` / ``generate_mock_exam.py`` (US-RAG-008/012):
orchestration sits behind protocols (essay answer source, grader, progress) so it
is unit-testable without the network or a live model. Production wiring lives in
``build_grade_mock_exam_handler``; the registered ``grade_mock_exam`` builds it
lazily from settings.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from app.jobs.models import AiJob, JobResult
from app.jobs.process_document import ProgressReporter
from app.llm import GenerationResult


@dataclass(frozen=True)
class EssayToGrade:
    """One mock essay question paired with the student's latest answer (if any).

    ``rubric`` is the stored grading rubric (``questions.metadata.rubric``);
    ``sample_answer`` is the reference answer (``questions.correct_answer``);
    ``student_answer`` is ``None``/blank when the student left it unanswered.
    """

    question_id: str
    prompt: str
    rubric: dict
    max_points: int | None
    sample_answer: str | None
    student_answer: str | None


@dataclass(frozen=True)
class CriterionGrade:
    name: str
    score: int
    max_points: int
    comment: str


@dataclass(frozen=True)
class EssayGrade:
    question_id: str
    prompt: str
    answered: bool
    score: int
    max_points: int
    feedback: str
    criteria: list[CriterionGrade] = field(default_factory=list)


class EssayAnswerSource(Protocol):
    def fetch_essays_to_grade(self, quiz_set_id: str, user_id: str) -> list[EssayToGrade]: ...


class Grader(Protocol):
    def generate(self, prompt: str, *, schema: dict, system: str | None = None) -> GenerationResult: ...


SYSTEM_PROMPT = (
    "You are a fair, rubric-based exam grader. You score a student's essay answer "
    "strictly against the provided rubric criteria, awarding points only for what "
    "the student actually wrote. You are encouraging but honest, and you never "
    "invent credit for content the student did not state."
)

# The grading service validates against this flat schema (one call per essay). It
# is intentionally shallow — the rubric itself rides in the prompt — so the model
# rarely needs the single repair attempt the service allows.
ESSAY_GRADE_SCHEMA: dict = {
    "type": "object",
    "required": ["criteria", "overall_feedback"],
    "properties": {
        "criteria": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "required": ["name", "score", "max_points"],
                "properties": {
                    "name": {"type": "string"},
                    "score": {"type": "integer", "minimum": 0},
                    "max_points": {"type": "integer", "minimum": 1},
                    "comment": {"type": "string"},
                },
            },
        },
        "overall_feedback": {"type": "string"},
    },
}


def _criterion_max(criterion: dict) -> int:
    """The authoritative max for a rubric criterion: its ``max_points`` if set,
    else the highest ``score`` among its levels, else 1."""
    max_points = criterion.get("max_points")
    if isinstance(max_points, int) and max_points > 0:
        return max_points
    scores = [
        level.get("score")
        for level in (criterion.get("levels") or [])
        if isinstance(level.get("score"), int)
    ]
    return max(scores) if scores else 1


def build_grade_prompt(essay: EssayToGrade) -> str:
    lines = [
        "Grade the STUDENT ANSWER against the RUBRIC for the essay question below.",
        "Rules:",
        "- Score each rubric criterion as an integer from 0 to its max points, "
        "using the criterion's described levels as a guide.",
        "- Return one `criteria` entry per rubric criterion, echoing its `name` "
        "and `max_points` and adding your `score` and a one-sentence `comment`.",
        "- Write a short `overall_feedback` (2-3 sentences): what was strong and "
        "what to improve.",
        "- Grade ONLY what the student wrote; do not award points for content the "
        "student did not state.",
        "",
        f"QUESTION: {essay.prompt}",
    ]
    if essay.sample_answer:
        lines += [
            "",
            "REFERENCE SAMPLE ANSWER (use it to judge correctness, not as a "
            f"ceiling): {essay.sample_answer}",
        ]
    lines += ["", "RUBRIC:"]
    for criterion in essay.rubric.get("criteria") or []:
        name = criterion.get("name") or "(unnamed criterion)"
        lines.append(f"- {name} (max {_criterion_max(criterion)} points): "
                     f"{criterion.get('description', '')}".rstrip())
        for level in criterion.get("levels") or []:
            lines.append(
                f"    [{level.get('score')}] {level.get('label', '')}: "
                f"{level.get('description', '')}".rstrip()
            )
    lines += ["", "STUDENT ANSWER:", (essay.student_answer or "").strip()]
    return "\n".join(lines)


@dataclass
class GradeMockExamHandler:
    answers: EssayAnswerSource
    grader: Grader
    progress: ProgressReporter

    def __call__(self, job: AiJob) -> JobResult:
        quiz_set_id = str(job.input.get("quiz_set_id") or "")
        if not quiz_set_id:
            raise ValueError("grade_mock_exam job missing quiz_set_id")
        user_id = job.user_id

        self._report(job, 5, "loading essays")
        essays = self.answers.fetch_essays_to_grade(quiz_set_id, user_id)

        to_grade = sum(1 for e in essays if (e.student_answer or "").strip())
        grades: list[EssayGrade] = []
        last_result: GenerationResult | None = None
        repaired_any = False
        fell_back_any = False
        graded_count = 0

        for essay in essays:
            answer = (essay.student_answer or "").strip()
            criteria_defs = essay.rubric.get("criteria") or []
            if not answer:
                # Unanswered: deterministic zero, no model call.
                criteria = [
                    CriterionGrade(
                        name=(c.get("name") or "Criterion").strip(),
                        score=0,
                        max_points=_criterion_max(c),
                        comment="No answer submitted.",
                    )
                    for c in criteria_defs
                ]
                grades.append(
                    EssayGrade(
                        question_id=essay.question_id,
                        prompt=essay.prompt,
                        answered=False,
                        score=0,
                        max_points=sum(c.max_points for c in criteria) or (essay.max_points or 0),
                        feedback="No answer submitted.",
                        criteria=criteria,
                    )
                )
                continue

            self._report(
                job,
                10 + int(80 * (graded_count / max(to_grade, 1))),
                f"grading essay {graded_count + 1} of {to_grade}",
            )
            result = self.grader.generate(
                build_grade_prompt(essay), schema=ESSAY_GRADE_SCHEMA, system=SYSTEM_PROMPT
            )
            last_result = result
            repaired_any = repaired_any or result.repaired
            fell_back_any = fell_back_any or result.fell_back

            criteria = self._map_criteria(result.data.get("criteria") or [], criteria_defs)
            grades.append(
                EssayGrade(
                    question_id=essay.question_id,
                    prompt=essay.prompt,
                    answered=True,
                    score=sum(c.score for c in criteria),
                    max_points=sum(c.max_points for c in criteria) or (essay.max_points or 0),
                    feedback=(result.data.get("overall_feedback") or "").strip(),
                    criteria=criteria,
                )
            )
            graded_count += 1

        self._report(job, 95, "aggregating")
        return JobResult(
            {
                "result": "graded",
                "quiz_set_id": quiz_set_id,
                "graded": graded_count,
                "essays_total": len(grades),
                "total_score": sum(g.score for g in grades),
                "max_total": sum(g.max_points for g in grades),
                "essays": [self._grade_dict(g) for g in grades],
                "provider": last_result.provider_name if last_result else None,
                "model": last_result.model if last_result else None,
                "repaired": repaired_any,
                "fell_back": fell_back_any,
            }
        )

    def _map_criteria(self, raw_criteria: list[dict], criteria_defs: list[dict]) -> list[CriterionGrade]:
        """Map the model's per-criterion scores to clamped grades. The rubric's
        own ``max_points`` is authoritative (the model cannot inflate the scale);
        each score is clamped to ``[0, max_points]``."""
        mapped: list[CriterionGrade] = []
        for index, raw in enumerate(raw_criteria):
            rubric_def = criteria_defs[index] if index < len(criteria_defs) else {}
            max_points = _criterion_max(rubric_def) if rubric_def else None
            if not max_points:
                model_max = raw.get("max_points")
                max_points = model_max if isinstance(model_max, int) and model_max > 0 else 1
            raw_score = raw.get("score")
            score = raw_score if isinstance(raw_score, int) else 0
            score = max(0, min(score, max_points))
            name = (raw.get("name") or rubric_def.get("name") or "Criterion").strip()
            mapped.append(
                CriterionGrade(
                    name=name,
                    score=score,
                    max_points=max_points,
                    comment=(raw.get("comment") or "").strip(),
                )
            )
        return mapped

    @staticmethod
    def _grade_dict(grade: EssayGrade) -> dict:
        return {
            "question_id": grade.question_id,
            "prompt": grade.prompt,
            "answered": grade.answered,
            "score": grade.score,
            "max_points": grade.max_points,
            "feedback": grade.feedback,
            "criteria": [
                {
                    "name": c.name,
                    "score": c.score,
                    "max_points": c.max_points,
                    "comment": c.comment,
                }
                for c in grade.criteria
            ],
        }

    def _report(self, job: AiJob, progress: int, step: str) -> None:
        try:
            self.progress.update_progress(job.id, progress, step)
        except Exception:
            pass


def build_grade_mock_exam_handler(settings) -> GradeMockExamHandler:
    from app.jobs.repository import SupabaseRpcJobRepository
    from app.llm import build_generation_service
    from app.supabase_io import SupabaseEssayAnswerSource

    return GradeMockExamHandler(
        answers=SupabaseEssayAnswerSource(
            supabase_url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key,
        ),
        grader=build_generation_service(settings),
        progress=SupabaseRpcJobRepository(
            supabase_url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key,
            worker_id=settings.worker_id,
        ),
    )


def grade_mock_exam(job: AiJob) -> JobResult:
    from app.config import get_settings

    return build_grade_mock_exam_handler(get_settings())(job)
