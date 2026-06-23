from __future__ import annotations

from dataclasses import dataclass
from typing import Any


JsonObject = dict[str, Any]


@dataclass(frozen=True)
class AiJob:
    id: str
    user_id: str
    job_type: str
    input: JsonObject
    attempt_count: int
    max_attempts: int
    locked_by: str | None = None

    @classmethod
    def from_row(cls, row: JsonObject) -> "AiJob":
        return cls(
            id=str(row["id"]),
            user_id=str(row["user_id"]),
            job_type=str(row["job_type"]),
            input=dict(row.get("input") or {}),
            attempt_count=int(row.get("attempt_count") or 0),
            max_attempts=int(row.get("max_attempts") or 1),
            locked_by=row.get("locked_by"),
        )


@dataclass(frozen=True)
class JobResult:
    output: JsonObject

    @classmethod
    def empty(cls) -> "JobResult":
        return cls(output={})
