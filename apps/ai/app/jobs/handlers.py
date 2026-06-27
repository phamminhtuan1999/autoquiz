from app.jobs.generate_cram import generate_cram
from app.jobs.generate_quiz import generate_regular_quiz
from app.jobs.generate_study_review import generate_study_review
from app.jobs.models import AiJob, JobResult
from app.jobs.process_document import process_document


def generate_mock_exam(job: AiJob) -> JobResult:
    raise NotImplementedError("generate_mock_exam handler is implemented in US-RAG-012")


DEFAULT_HANDLERS = {
    "process_document": process_document,
    "generate_regular_quiz": generate_regular_quiz,
    "generate_cram": generate_cram,
    "generate_study_review": generate_study_review,
}
