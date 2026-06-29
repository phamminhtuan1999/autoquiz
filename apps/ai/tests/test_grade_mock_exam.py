from __future__ import annotations

import unittest

from app.jobs.grade_mock_exam import (
    ESSAY_GRADE_SCHEMA,
    EssayToGrade,
    GradeMockExamHandler,
    build_grade_prompt,
)
from app.jobs.models import AiJob
from app.llm import GenerationResult


def _rubric(*, max_points=10):
    return {
        "criteria": [
            {
                "name": "Content Accuracy",
                "max_points": max_points,
                "levels": [
                    {"score": max_points, "label": "Excellent", "description": "all correct"},
                    {"score": 0, "label": "Poor", "description": "incorrect"},
                ],
            }
        ]
    }


def essay(
    *,
    question_id="q1",
    prompt="Explain ATP synthesis.",
    rubric=None,
    max_points=10,
    sample_answer="ATP is the energy currency of the cell.",
    student_answer="The mitochondria make ATP via the electron transport chain.",
) -> EssayToGrade:
    return EssayToGrade(
        question_id=question_id,
        prompt=prompt,
        rubric=rubric if rubric is not None else _rubric(max_points=max_points),
        max_points=max_points,
        sample_answer=sample_answer,
        student_answer=student_answer,
    )


class FakeEssayAnswerSource:
    def __init__(self, essays) -> None:
        self._essays = essays
        self.calls = 0

    def fetch_essays_to_grade(self, quiz_set_id, user_id):
        self.calls += 1
        return list(self._essays)


class FakeGrader:
    """Returns a canned grade per call; cycles through ``responses`` if given."""

    def __init__(self, *, criteria=None, overall="Good effort.", responses=None, error=None) -> None:
        self._responses = responses
        self._criteria = criteria if criteria is not None else [
            {"name": "Content Accuracy", "score": 8, "max_points": 10, "comment": "solid"}
        ]
        self._overall = overall
        self._error = error
        self.calls = 0
        self.received_schema = None

    def generate(self, prompt, *, schema, system=None):
        self.received_schema = schema
        if self._error is not None:
            raise self._error
        if self._responses is not None:
            data = self._responses[min(self.calls, len(self._responses) - 1)]
        else:
            data = {"criteria": self._criteria, "overall_feedback": self._overall}
        self.calls += 1
        return GenerationResult(
            data=data, provider_name="fake", model="fake-1", repaired=False, fell_back=False
        )


class RecordingProgress:
    def __init__(self) -> None:
        self.events = []

    def update_progress(self, job_id, progress, current_step=None) -> None:
        self.events.append((progress, current_step))


def make_job(**input_override) -> AiJob:
    base = {"quiz_set_id": "quiz-set-1"}
    base.update(input_override)
    return AiJob(
        id="job-1", user_id="user-1", job_type="grade_mock_exam",
        input=base, attempt_count=1, max_attempts=3,
    )


def make_handler(*, essays, grader=None, progress=None):
    return GradeMockExamHandler(
        answers=FakeEssayAnswerSource(essays),
        grader=grader or FakeGrader(),
        progress=progress or RecordingProgress(),
    )


class SchemaAndPromptTest(unittest.TestCase):
    def test_grade_schema_requires_criteria_and_feedback(self) -> None:
        self.assertIn("criteria", ESSAY_GRADE_SCHEMA["required"])
        self.assertIn("overall_feedback", ESSAY_GRADE_SCHEMA["required"])
        item = ESSAY_GRADE_SCHEMA["properties"]["criteria"]["items"]
        self.assertEqual(item["required"], ["name", "score", "max_points"])

    def test_prompt_includes_rubric_levels_question_and_answer(self) -> None:
        text = build_grade_prompt(essay(student_answer="My answer about ATP."))
        self.assertIn("Explain ATP synthesis.", text)
        self.assertIn("Content Accuracy", text)
        self.assertIn("Excellent", text)  # a rubric level label
        self.assertIn("My answer about ATP.", text)
        self.assertIn("REFERENCE SAMPLE ANSWER", text)


class GradeMockExamHandlerTest(unittest.TestCase):
    def test_happy_path_grades_answered_essay(self) -> None:
        grader = FakeGrader(
            criteria=[{"name": "Content Accuracy", "score": 8, "max_points": 10, "comment": "solid"}],
            overall="Strong, add detail on the proton gradient.",
        )
        out = make_handler(essays=[essay()], grader=grader)(make_job()).output

        self.assertEqual(out["result"], "graded")
        self.assertEqual(out["quiz_set_id"], "quiz-set-1")
        self.assertEqual(out["graded"], 1)
        self.assertEqual(out["essays_total"], 1)
        self.assertEqual(out["total_score"], 8)
        self.assertEqual(out["max_total"], 10)
        self.assertEqual(out["provider"], "fake")
        graded = out["essays"][0]
        self.assertTrue(graded["answered"])
        self.assertEqual(graded["score"], 8)
        self.assertEqual(graded["criteria"][0]["name"], "Content Accuracy")
        self.assertIn("proton gradient", graded["feedback"])
        self.assertEqual(grader.calls, 1)

    def test_score_clamped_to_rubric_max(self) -> None:
        # Model over-scores (15 > rubric max 10) — must clamp to 10.
        grader = FakeGrader(
            criteria=[{"name": "Content Accuracy", "score": 15, "max_points": 50, "comment": "x"}]
        )
        out = make_handler(essays=[essay(max_points=10)], grader=grader)(make_job()).output
        self.assertEqual(out["essays"][0]["score"], 10)
        self.assertEqual(out["essays"][0]["criteria"][0]["max_points"], 10)
        self.assertEqual(out["max_total"], 10)

    def test_negative_score_floored_to_zero(self) -> None:
        grader = FakeGrader(
            criteria=[{"name": "Content Accuracy", "score": -3, "max_points": 10, "comment": "x"}]
        )
        out = make_handler(essays=[essay()], grader=grader)(make_job()).output
        self.assertEqual(out["essays"][0]["score"], 0)

    def test_unanswered_essay_scores_zero_without_model_call(self) -> None:
        grader = FakeGrader()
        out = make_handler(essays=[essay(student_answer=None)], grader=grader)(make_job()).output
        self.assertEqual(grader.calls, 0)  # no LLM call for a blank answer
        self.assertEqual(out["graded"], 0)
        self.assertEqual(out["essays_total"], 1)
        graded = out["essays"][0]
        self.assertFalse(graded["answered"])
        self.assertEqual(graded["score"], 0)
        self.assertEqual(graded["max_points"], 10)
        self.assertEqual(out["max_total"], 10)

    def test_blank_whitespace_answer_treated_as_unanswered(self) -> None:
        grader = FakeGrader()
        out = make_handler(essays=[essay(student_answer="   \n  ")], grader=grader)(make_job()).output
        self.assertEqual(grader.calls, 0)
        self.assertFalse(out["essays"][0]["answered"])

    def test_aggregates_across_multiple_essays(self) -> None:
        grader = FakeGrader(
            responses=[
                {"criteria": [{"name": "A", "score": 6, "max_points": 10, "comment": ""}], "overall_feedback": "ok"},
                {"criteria": [{"name": "B", "score": 9, "max_points": 10, "comment": ""}], "overall_feedback": "great"},
            ]
        )
        essays = [
            essay(question_id="q1", student_answer="answer one"),
            essay(question_id="q2", student_answer="answer two"),
        ]
        out = make_handler(essays=essays, grader=grader)(make_job()).output
        self.assertEqual(out["graded"], 2)
        self.assertEqual(out["total_score"], 15)
        self.assertEqual(out["max_total"], 20)
        self.assertEqual(grader.calls, 2)

    def test_mixed_answered_and_unanswered(self) -> None:
        grader = FakeGrader(
            criteria=[{"name": "A", "score": 7, "max_points": 10, "comment": ""}]
        )
        essays = [
            essay(question_id="q1", student_answer="answered"),
            essay(question_id="q2", student_answer=None),
        ]
        out = make_handler(essays=essays, grader=grader)(make_job()).output
        self.assertEqual(out["graded"], 1)
        self.assertEqual(out["essays_total"], 2)
        self.assertEqual(out["total_score"], 7)
        self.assertEqual(out["max_total"], 20)
        self.assertEqual(grader.calls, 1)

    def test_no_essays_returns_graded_empty(self) -> None:
        grader = FakeGrader()
        out = make_handler(essays=[], grader=grader)(make_job()).output
        self.assertEqual(out["result"], "graded")
        self.assertEqual(out["graded"], 0)
        self.assertEqual(out["essays_total"], 0)
        self.assertEqual(out["total_score"], 0)
        self.assertEqual(out["max_total"], 0)
        self.assertEqual(out["essays"], [])
        self.assertIsNone(out["provider"])  # no model call → no provider
        self.assertEqual(grader.calls, 0)

    def test_missing_quiz_set_id_raises(self) -> None:
        handler = make_handler(essays=[essay()])
        job = AiJob(id="j", user_id="u", job_type="grade_mock_exam",
                    input={}, attempt_count=1, max_attempts=1)
        with self.assertRaises(ValueError):
            handler(job)

    def test_criterion_max_derived_from_levels_when_missing(self) -> None:
        # Rubric criterion without max_points → derive max from highest level score.
        rubric = {
            "criteria": [
                {"name": "Depth", "levels": [{"score": 4, "label": "Deep"}, {"score": 0, "label": "Shallow"}]}
            ]
        }
        grader = FakeGrader(criteria=[{"name": "Depth", "score": 9, "max_points": 99, "comment": ""}])
        out = make_handler(
            essays=[essay(rubric=rubric, max_points=None)], grader=grader
        )(make_job()).output
        # max clamped to the rubric-derived 4, score clamped to 4.
        self.assertEqual(out["essays"][0]["criteria"][0]["max_points"], 4)
        self.assertEqual(out["essays"][0]["score"], 4)

    def test_repaired_and_fell_back_surface(self) -> None:
        class RepairingGrader(FakeGrader):
            def generate(self, prompt, *, schema, system=None):
                self.calls += 1
                return GenerationResult(
                    data={"criteria": [{"name": "A", "score": 5, "max_points": 10}], "overall_feedback": ""},
                    provider_name="gemini", model="gemini-2.5-flash", repaired=True, fell_back=True,
                )

        out = make_handler(essays=[essay()], grader=RepairingGrader())(make_job()).output
        self.assertTrue(out["repaired"])
        self.assertTrue(out["fell_back"])
        self.assertEqual(out["model"], "gemini-2.5-flash")

    def test_progress_reported_in_order(self) -> None:
        progress = RecordingProgress()
        make_handler(essays=[essay()], progress=progress)(make_job())
        values = [p for p, _ in progress.events]
        self.assertEqual(values, sorted(values))
        self.assertTrue(values)


if __name__ == "__main__":
    unittest.main()
