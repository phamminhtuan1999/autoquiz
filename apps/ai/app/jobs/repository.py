from __future__ import annotations

import json
from typing import Protocol
from urllib import error, request

from app.jobs.models import AiJob, JsonObject


class JobRepository(Protocol):
    def claim_next(self) -> AiJob | None:
        ...

    def complete(self, job_id: str, output: JsonObject) -> None:
        ...

    def fail(
        self,
        job_id: str,
        error_message: str,
        *,
        retryable: bool,
        output: JsonObject | None = None,
    ) -> None:
        ...

    def update_progress(
        self,
        job_id: str,
        progress: int,
        current_step: str | None = None,
    ) -> None:
        ...


class SupabaseRpcError(RuntimeError):
    pass


class SupabaseRpcJobRepository:
    def __init__(
        self,
        *,
        supabase_url: str,
        service_role_key: str,
        worker_id: str,
        job_types: list[str] | None = None,
        timeout_seconds: int = 30,
    ) -> None:
        self.supabase_url = supabase_url.rstrip("/")
        self.service_role_key = service_role_key
        self.worker_id = worker_id
        self.job_types = job_types
        self.timeout_seconds = timeout_seconds

    def claim_next(self) -> AiJob | None:
        payload: JsonObject = {"p_worker_id": self.worker_id}
        if self.job_types:
            payload["p_job_types"] = self.job_types

        rows = self._rpc("claim_ai_job", payload)
        if not rows:
            return None
        if not isinstance(rows, list):
            raise SupabaseRpcError("claim_ai_job returned a non-list response")
        return AiJob.from_row(rows[0])

    def complete(self, job_id: str, output: JsonObject) -> None:
        self._rpc(
            "complete_ai_job",
            {
                "p_job_id": job_id,
                "p_worker_id": self.worker_id,
                "p_output": output,
            },
        )

    def fail(
        self,
        job_id: str,
        error_message: str,
        *,
        retryable: bool,
        output: JsonObject | None = None,
    ) -> None:
        self._rpc(
            "fail_ai_job",
            {
                "p_job_id": job_id,
                "p_worker_id": self.worker_id,
                "p_error_message": error_message,
                "p_retryable": retryable,
                "p_output": output or {},
            },
        )

    def update_progress(
        self,
        job_id: str,
        progress: int,
        current_step: str | None = None,
    ) -> None:
        self._rpc(
            "update_ai_job_progress",
            {
                "p_job_id": job_id,
                "p_worker_id": self.worker_id,
                "p_progress": progress,
                "p_current_step": current_step,
            },
        )

    def _rpc(self, function_name: str, payload: JsonObject) -> JsonObject | list[JsonObject]:
        body = json.dumps(payload).encode("utf-8")
        rpc_request = request.Request(
            f"{self.supabase_url}/rest/v1/rpc/{function_name}",
            data=body,
            method="POST",
            headers={
                "apikey": self.service_role_key,
                "authorization": f"Bearer {self.service_role_key}",
                "content-type": "application/json",
                "accept": "application/json",
            },
        )

        try:
            with request.urlopen(rpc_request, timeout=self.timeout_seconds) as response:
                response_body = response.read().decode("utf-8")
        except error.HTTPError as exc:
            message = exc.read().decode("utf-8", errors="replace")
            raise SupabaseRpcError(message) from exc
        except error.URLError as exc:
            raise SupabaseRpcError(str(exc.reason)) from exc

        if not response_body:
            return {}
        decoded = json.loads(response_body)
        if not isinstance(decoded, (dict, list)):
            raise SupabaseRpcError("RPC returned an unsupported JSON payload")
        return decoded
