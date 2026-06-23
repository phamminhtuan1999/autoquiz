from __future__ import annotations

import json

from app.jobs.handlers import DEFAULT_HANDLERS
from app.jobs.runner import JobRunner, NoJobClaimed


def main() -> int:
    if not DEFAULT_HANDLERS:
        print(
            json.dumps(
                {
                    "status": "not_configured",
                    "message": "no AI job handlers are implemented yet",
                }
            )
        )
        return 0

    from app.config import get_settings
    from app.jobs.repository import SupabaseRpcJobRepository

    settings = get_settings()
    repository = SupabaseRpcJobRepository(
        supabase_url=settings.supabase_url,
        service_role_key=settings.supabase_service_role_key,
        worker_id=settings.worker_id,
        job_types=settings.job_types,
    )
    runner = JobRunner(repository, DEFAULT_HANDLERS)

    try:
        job = runner.run_once()
    except NoJobClaimed:
        print(json.dumps({"status": "idle"}))
        return 0

    print(json.dumps({"status": "claimed", "job_id": job.id, "job_type": job.job_type}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
