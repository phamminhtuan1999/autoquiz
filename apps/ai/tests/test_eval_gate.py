from __future__ import annotations

import unittest

from app.eval.gate import RELEASE_BAR, GateResult, evaluate_counts, run_gate
from app.eval.metrics import MetricCounts
from app.jobs.generate_quiz import SourceChunk


def chunk(i: int, content: str) -> SourceChunk:
    return SourceChunk(chunk_id=f"c{i}", chunk_index=i, content=content, page_start=i + 1, page_end=i + 1)


CHUNKS = [
    chunk(0, "Mitochondria produce most ATP using the electron transport chain and a proton gradient."),
    chunk(1, "Photosynthesis occurs in chloroplasts converting carbon dioxide and water into glucose and oxygen."),
]


def good_item(n: int, source_chunk: int = 1) -> dict:
    return {
        "prompt": f"Question number {n}",
        "options": ["Mitochondria", "Nucleus", "Ribosome", "Golgi"],
        "answer_index": 0,
        "source_chunk": source_chunk,
        "explanation": "ATP is produced in the mitochondria via the electron transport chain.",
    }


class ReleaseBarTest(unittest.TestCase):
    def test_release_bar_matches_strategy_doc(self) -> None:
        # ai-provider-strategy.md: JSON >=95%, citation >=95%, duplicate <=10%.
        self.assertEqual(RELEASE_BAR["json_validity"], 0.95)
        self.assertEqual(RELEASE_BAR["citation_validity"], 0.95)
        self.assertEqual(RELEASE_BAR["duplicate_rate_max"], 0.10)


class GateTest(unittest.TestCase):
    def test_clean_set_passes(self) -> None:
        cases = [([good_item(i) for i in range(5)], CHUNKS)]
        result = run_gate(cases)
        self.assertTrue(result.passed)
        self.assertEqual(result.failures, [])
        self.assertEqual(result.counts.total, 5)

    def test_dangling_citations_fail_citation_gate(self) -> None:
        # 8 valid + 2 dangling = 80% citation validity (< 95%).
        items = [good_item(i) for i in range(8)] + [good_item(i, source_chunk=9) for i in range(8, 10)]
        result = run_gate([(items, CHUNKS)])
        self.assertFalse(result.passed)
        self.assertTrue(any("citation_validity" in f for f in result.failures))

    def test_duplicates_fail_duplicate_gate(self) -> None:
        # 5 unique + 5 repeats of one prompt = 50% duplicate rate (> 10%).
        items = [good_item(i) for i in range(5)] + [good_item(0) for _ in range(5)]
        result = run_gate([(items, CHUNKS)])
        self.assertFalse(result.passed)
        self.assertTrue(any("duplicate_rate" in f for f in result.failures))

    def test_malformed_fail_json_gate(self) -> None:
        bad = dict(good_item(99))
        bad["options"] = ["only", "three", "opts"]
        items = [good_item(i) for i in range(8)] + [bad, dict(bad)]
        # mark the two bad ones with distinct prompts so they aren't duplicates
        items[-1]["prompt"] = "another malformed"
        result = run_gate([(items, CHUNKS)])
        self.assertFalse(result.passed)
        self.assertTrue(any("json_validity" in f for f in result.failures))

    def test_empty_fails_with_no_items(self) -> None:
        result = run_gate([([], CHUNKS)])
        self.assertFalse(result.passed)
        self.assertIn("no_items_generated", result.failures)

    def test_aggregates_across_cases(self) -> None:
        cases = [
            ([good_item(i) for i in range(4)], CHUNKS),
            ([good_item(i) for i in range(6)], CHUNKS),
        ]
        result = run_gate(cases)
        self.assertEqual(result.cases, 2)
        self.assertEqual(result.counts.total, 10)
        self.assertTrue(result.passed)

    def test_evaluate_counts_reports_all_missed_thresholds(self) -> None:
        # 0 valid citations, all malformed: both json + citation fail.
        counts = MetricCounts(total=10, structural_valid=0, citation_valid=0, duplicates=0, grounded=0)
        result = evaluate_counts(counts, cases=1)
        self.assertFalse(result.passed)
        self.assertTrue(any("json_validity" in f for f in result.failures))
        self.assertTrue(any("citation_validity" in f for f in result.failures))

    def test_as_dict_shape(self) -> None:
        result: GateResult = run_gate([([good_item(i) for i in range(3)], CHUNKS)])
        d = result.as_dict()
        self.assertIn("passed", d)
        self.assertIn("aggregate", d)
        self.assertIn("json_validity", d["aggregate"])
        self.assertEqual(d["release_bar"], RELEASE_BAR)


if __name__ == "__main__":
    unittest.main()
