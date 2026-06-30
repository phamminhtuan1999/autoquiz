"""US-RAG-013: RAG evaluation gate CLI.

Runs the release-bar gate (docs/product/ai-provider-strategy.md) either as a
**live provider benchmark** (default — generate against the fixtures via the
US-RAG-007 service, score the raw output, report rates + latency) or **offline**
against a recorded cases file (no network). Prints a JSON report and exits 0 if
the gate passes, 1 if it fails the release bar, 2 on error. Persists nothing and
spends no credits (decision 0014).

Usage:
    python eval_gate.py                 # live benchmark over the fixtures
    python eval_gate.py --num 5         # override questions per case (live)
    python eval_gate.py --offline f.json  # score a recorded cases file
"""

from __future__ import annotations

import json
import sys
import time

from app.eval.fixtures import FIXTURE_CASES
from app.eval.gate import RELEASE_BAR, run_gate
from app.eval.metrics import score_case
from app.jobs.generate_quiz import SourceChunk


def _report(gate, per_case, provider, model) -> int:
    report = gate.as_dict()
    if provider:
        report["provider"] = provider
        report["model"] = model
    if per_case is not None:
        report["per_case"] = per_case
    print(json.dumps(report, indent=2))
    return 0 if gate.passed else 1


def _run_live(num_override: int | None) -> int:
    from app.config import get_settings
    from app.jobs.generate_quiz import SYSTEM_PROMPT, build_prompt, quiz_schema
    from app.llm import build_generation_service

    service = build_generation_service(get_settings())
    cases: list[tuple[list[dict], list[SourceChunk]]] = []
    per_case: list[dict] = []
    provider = model = None

    for fixture in FIXTURE_CASES:
        num_questions = num_override or fixture.num_questions
        schema = quiz_schema(len(fixture.chunks), num_questions)
        prompt = build_prompt(fixture.chunks, num_questions, "medium")
        start = time.monotonic()
        try:
            result = service.generate(prompt, schema=schema, system=SYSTEM_PROMPT)
        except Exception as exc:
            # A generation failure is a benchmark data point, not a crash: record
            # the case as empty (it counts against the gate) and keep going.
            per_case.append(
                {
                    "case": fixture.name,
                    "items": 0,
                    "latency_s": round(time.monotonic() - start, 2),
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )
            cases.append(([], fixture.chunks))
            continue
        elapsed = time.monotonic() - start

        items = result.data.get("questions", []) or []
        provider, model = result.provider_name, result.model
        counts = score_case(items, fixture.chunks)
        cases.append((items, fixture.chunks))
        per_case.append(
            {
                "case": fixture.name,
                "items": counts.total,
                "latency_s": round(elapsed, 2),
                "json_validity": round(counts.json_validity, 3),
                "citation_validity": round(counts.citation_validity, 3),
                "duplicate_rate": round(counts.duplicate_rate, 3),
                "grounding_rate": round(counts.grounding_rate, 3),
                "repaired": result.repaired,
                "fell_back": result.fell_back,
            }
        )

    return _report(run_gate(cases), per_case, provider, model)


def _run_offline(path: str) -> int:
    """Score a recorded cases file:
    ``{"cases": [{"chunks": [{"content": "...", "page_start": 1}], "items": [ ... ]}]}``"""
    with open(path) as handle:
        data = json.load(handle)
    cases: list[tuple[list[dict], list[SourceChunk]]] = []
    for case in data.get("cases", []):
        chunks = [
            SourceChunk(
                chunk_id=str(i),
                chunk_index=i,
                content=chunk.get("content", ""),
                page_start=chunk.get("page_start"),
                page_end=chunk.get("page_end"),
            )
            for i, chunk in enumerate(case.get("chunks", []))
        ]
        cases.append((case.get("items", []), chunks))
    return _report(run_gate(cases), None, None, None)


def main(argv: list[str]) -> int:
    if "--offline" in argv:
        idx = argv.index("--offline")
        if idx + 1 >= len(argv):
            print(json.dumps({"error": "--offline requires a file path"}))
            return 2
        return _run_offline(argv[idx + 1])

    num_override = None
    if "--num" in argv:
        idx = argv.index("--num")
        try:
            num_override = int(argv[idx + 1])
        except (IndexError, ValueError):
            print(json.dumps({"error": "--num requires an integer"}))
            return 2
    return _run_live(num_override)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
