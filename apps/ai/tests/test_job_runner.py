from __future__ import annotations

import unittest

from app.jobs.models import AiJob, JobResult
from app.jobs.runner import JobRunner, NoJobClaimed, UnsupportedJobType


class FakeRepository:
    def __init__(self, job: AiJob | None) -> None:
        self.job = job
        self.completed: list[tuple[str, dict]] = []
        self.failed: list[tuple[str, str, bool]] = []

    def claim_next(self) -> AiJob | None:
        return self.job

    def complete(self, job_id: str, output: dict) -> None:
        self.completed.append((job_id, output))

    def fail(
        self,
        job_id: str,
        error_message: str,
        *,
        retryable: bool,
        output: dict | None = None,
    ) -> None:
        self.failed.append((job_id, error_message, retryable))

    def update_progress(
        self,
        job_id: str,
        progress: int,
        current_step: str | None = None,
    ) -> None:
        raise AssertionError("progress updates are not used by these tests")


def make_job(job_type: str = "process_document") -> AiJob:
    return AiJob(
        id="job-1",
        user_id="user-1",
        job_type=job_type,
        input={"document_id": "doc-1"},
        attempt_count=1,
        max_attempts=3,
        locked_by="worker-1",
    )


class JobRunnerTest(unittest.TestCase):
    def test_run_once_completes_claimed_job(self) -> None:
        repository = FakeRepository(make_job())
        runner = JobRunner(
            repository,
            {"process_document": lambda job: JobResult({"ok": True, "job_id": job.id})},
        )

        job = runner.run_once()

        self.assertEqual(job.id, "job-1")
        self.assertEqual(repository.completed, [("job-1", {"ok": True, "job_id": "job-1"})])
        self.assertEqual(repository.failed, [])

    def test_run_once_reports_idle_when_no_job_is_claimed(self) -> None:
        runner = JobRunner(FakeRepository(None), {})

        with self.assertRaises(NoJobClaimed):
            runner.run_once()

    def test_run_once_fails_unknown_job_type_without_retry(self) -> None:
        repository = FakeRepository(make_job("unknown"))
        runner = JobRunner(repository, {})

        with self.assertRaises(UnsupportedJobType):
            runner.run_once()

        self.assertEqual(repository.completed, [])
        self.assertEqual(repository.failed, [("job-1", "unsupported job type: unknown", False)])

    def test_run_once_retries_handler_error(self) -> None:
        repository = FakeRepository(make_job())

        def fail_handler(job: AiJob) -> JobResult:
            raise RuntimeError("boom")

        runner = JobRunner(repository, {"process_document": fail_handler})

        with self.assertRaises(RuntimeError):
            runner.run_once()

        self.assertEqual(repository.completed, [])
        self.assertEqual(repository.failed, [("job-1", "boom", True)])


if __name__ == "__main__":
    unittest.main()
