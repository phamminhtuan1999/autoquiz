from app.jobs.models import AiJob, JobResult


def process_document(job: AiJob) -> JobResult:
    raise NotImplementedError("process_document handler is implemented in US-RAG-005")


def generate_regular_quiz(job: AiJob) -> JobResult:
    raise NotImplementedError("generate_regular_quiz handler is implemented in US-RAG-008")


def generate_cram(job: AiJob) -> JobResult:
    raise NotImplementedError("generate_cram handler is implemented in US-RAG-009")


def generate_study_review(job: AiJob) -> JobResult:
    raise NotImplementedError("generate_study_review handler is implemented in US-RAG-010")


def generate_mock_exam(job: AiJob) -> JobResult:
    raise NotImplementedError("generate_mock_exam handler is implemented in US-RAG-012")


DEFAULT_HANDLERS = {}
