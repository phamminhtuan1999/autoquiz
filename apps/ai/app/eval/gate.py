"""US-RAG-013: the release-bar gate over the evaluation metrics.

Aggregates the per-case ``MetricCounts`` and compares them to the minimum release
bar from ``docs/product/ai-provider-strategy.md``. Grounding is reported by the
metrics but **not** gated here — it is a lexical proxy (decision 0014).
"""

from __future__ import annotations

from dataclasses import dataclass

from app.eval.metrics import MetricCounts, aggregate, score_case
from app.jobs.generate_quiz import SourceChunk

# The minimum release bar — mirrors ai-provider-strategy.md verbatim.
RELEASE_BAR = {
    "json_validity": 0.95,
    "citation_validity": 0.95,
    "duplicate_rate_max": 0.10,
}


@dataclass(frozen=True)
class GateResult:
    counts: MetricCounts
    cases: int
    passed: bool
    failures: list[str]

    def as_dict(self) -> dict:
        return {
            "passed": self.passed,
            "failures": list(self.failures),
            "cases": self.cases,
            "items": self.counts.total,
            "aggregate": {
                "json_validity": round(self.counts.json_validity, 3),
                "citation_validity": round(self.counts.citation_validity, 3),
                "duplicate_rate": round(self.counts.duplicate_rate, 3),
                "grounding_rate": round(self.counts.grounding_rate, 3),
            },
            "release_bar": dict(RELEASE_BAR),
        }


def evaluate_counts(counts: MetricCounts, cases: int) -> GateResult:
    """Compare aggregate counts to ``RELEASE_BAR``; name every missed threshold."""
    failures: list[str] = []
    if counts.total == 0:
        failures.append("no_items_generated")
    else:
        if counts.json_validity < RELEASE_BAR["json_validity"]:
            failures.append(
                f"json_validity {counts.json_validity:.3f} < {RELEASE_BAR['json_validity']}"
            )
        if counts.citation_validity < RELEASE_BAR["citation_validity"]:
            failures.append(
                f"citation_validity {counts.citation_validity:.3f} < {RELEASE_BAR['citation_validity']}"
            )
        if counts.duplicate_rate > RELEASE_BAR["duplicate_rate_max"]:
            failures.append(
                f"duplicate_rate {counts.duplicate_rate:.3f} > {RELEASE_BAR['duplicate_rate_max']}"
            )
    return GateResult(counts=counts, cases=cases, passed=not failures, failures=failures)


def run_gate(cases: list[tuple[list[dict], list[SourceChunk]]]) -> GateResult:
    """Score and gate a set of cases. Each case is ``(raw_items, chunks)``."""
    counts = aggregate([score_case(items, chunks) for items, chunks in cases])
    return evaluate_counts(counts, len(cases))
