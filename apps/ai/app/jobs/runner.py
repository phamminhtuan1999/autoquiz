from __future__ import annotations

from collections.abc import Callable

from app.jobs.models import AiJob, JobResult
from app.jobs.repository import JobRepository


JobHandler = Callable[[AiJob], JobResult]


class NoJobClaimed(Exception):
    pass


class UnsupportedJobType(Exception):
    pass


class JobRunner:
    def __init__(self, repository: JobRepository, handlers: dict[str, JobHandler]) -> None:
        self.repository = repository
        self.handlers = handlers

    def run_once(self) -> AiJob:
        job = self.repository.claim_next()
        if job is None:
            raise NoJobClaimed("no claimable AI job")

        handler = self.handlers.get(job.job_type)
        if handler is None:
            self.repository.fail(
                job.id,
                f"unsupported job type: {job.job_type}",
                retryable=False,
            )
            raise UnsupportedJobType(job.job_type)

        try:
            result = handler(job)
        except Exception as exc:
            self.repository.fail(job.id, str(exc), retryable=True)
            raise

        self.repository.complete(job.id, result.output)
        return job
