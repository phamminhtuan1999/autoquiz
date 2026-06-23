from app.jobs.models import AiJob, JobResult
from app.jobs.process_document import process_document


def generate_regular_quiz(job: AiJob) -> JobResult:
    raise NotImplementedError("generate_regular_quiz handler is implemented in US-RAG-008")


def generate_cram(job: AiJob) -> JobResult:
    raise NotImplementedError("generate_cram handler is implemented in US-RAG-009")


def generate_study_review(job: AiJob) -> JobResult:
    raise NotImplementedError("generate_study_review handler is implemented in US-RAG-010")


def generate_mock_exam(job: AiJob) -> JobResult:
    raise NotImplementedError("generate_mock_exam handler is implemented in US-RAG-012")


DEFAULT_HANDLERS = {
    "process_document": process_document,
}
