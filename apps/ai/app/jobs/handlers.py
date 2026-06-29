from app.jobs.generate_cram import generate_cram
from app.jobs.generate_mock_exam import generate_mock_exam
from app.jobs.generate_quiz import generate_regular_quiz
from app.jobs.generate_study_review import generate_study_review
from app.jobs.grade_mock_exam import grade_mock_exam
from app.jobs.process_document import process_document

DEFAULT_HANDLERS = {
    "process_document": process_document,
    "generate_regular_quiz": generate_regular_quiz,
    "generate_cram": generate_cram,
    "generate_study_review": generate_study_review,
    "generate_mock_exam": generate_mock_exam,
    "grade_mock_exam": grade_mock_exam,
}
