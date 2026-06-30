from __future__ import annotations

import unittest

from app.eval.metrics import (
    MetricCounts,
    aggregate,
    is_citation_valid,
    is_grounded,
    is_structurally_valid,
    normalize_prompt,
    score_case,
)
from app.jobs.generate_quiz import SourceChunk


def chunk(i: int, content: str) -> SourceChunk:
    return SourceChunk(chunk_id=f"c{i}", chunk_index=i, content=content, page_start=i + 1, page_end=i + 1)


def item(
    *,
    prompt="Where is most ATP produced?",
    options=None,
    answer_index=0,
    source_chunk=1,
    explanation="ATP is produced in the mitochondria via the electron transport chain.",
) -> dict:
    return {
        "prompt": prompt,
        "options": options if options is not None else ["Mitochondria", "Nucleus", "Ribosome", "Golgi"],
        "answer_index": answer_index,
        "source_chunk": source_chunk,
        "explanation": explanation,
    }


GROUNDED_CHUNK = chunk(
    0, "Mitochondria produce most ATP using the electron transport chain and a proton gradient."
)


class StructuralValidityTest(unittest.TestCase):
    def test_well_formed_mcq_is_valid(self) -> None:
        self.assertTrue(is_structurally_valid(item()))

    def test_wrong_option_count_invalid(self) -> None:
        self.assertFalse(is_structurally_valid(item(options=["a", "b", "c"])))

    def test_blank_option_invalid(self) -> None:
        self.assertFalse(is_structurally_valid(item(options=["a", "  ", "c", "d"])))

    def test_blank_prompt_invalid(self) -> None:
        self.assertFalse(is_structurally_valid(item(prompt="   ")))

    def test_out_of_range_index_invalid(self) -> None:
        self.assertFalse(is_structurally_valid(item(answer_index=4)))

    def test_non_int_index_invalid(self) -> None:
        self.assertFalse(is_structurally_valid(item(answer_index="0")))

    def test_bool_index_invalid(self) -> None:
        # True is an int in Python; it must not pass as answer_index.
        self.assertFalse(is_structurally_valid(item(answer_index=True)))


class CitationValidityTest(unittest.TestCase):
    def test_in_range_valid(self) -> None:
        self.assertTrue(is_citation_valid(item(source_chunk=2), chunk_count=3))

    def test_out_of_range_invalid(self) -> None:
        self.assertFalse(is_citation_valid(item(source_chunk=4), chunk_count=3))

    def test_zero_invalid(self) -> None:
        self.assertFalse(is_citation_valid(item(source_chunk=0), chunk_count=3))

    def test_non_int_invalid(self) -> None:
        self.assertFalse(is_citation_valid(item(source_chunk="1"), chunk_count=3))


class NormalizeAndGroundingTest(unittest.TestCase):
    def test_normalize_is_case_and_punctuation_insensitive(self) -> None:
        self.assertEqual(
            normalize_prompt("  Where  is ATP made? "),
            normalize_prompt("where is atp made"),
        )

    def test_grounded_when_claim_overlaps_cited_chunk(self) -> None:
        self.assertTrue(is_grounded(item(source_chunk=1), [GROUNDED_CHUNK]))

    def test_not_grounded_when_unrelated(self) -> None:
        unrelated = item(
            source_chunk=1, options=["Paris", "London", "Rome", "Berlin"], explanation="The capital of France."
        )
        self.assertFalse(is_grounded(unrelated, [GROUNDED_CHUNK]))

    def test_not_grounded_when_citation_dangling(self) -> None:
        self.assertFalse(is_grounded(item(source_chunk=9), [GROUNDED_CHUNK]))


class ScoreCaseTest(unittest.TestCase):
    def test_all_valid_case(self) -> None:
        chunks = [GROUNDED_CHUNK, chunk(1, "Photosynthesis occurs in chloroplasts producing glucose and oxygen.")]
        items = [
            item(prompt="Q1 where is ATP produced", source_chunk=1),
            item(
                prompt="Q2 where does photosynthesis occur",
                source_chunk=2,
                options=["Chloroplasts", "Mitochondria", "Nucleus", "Ribosome"],
                explanation="Photosynthesis occurs in chloroplasts producing glucose and oxygen.",
            ),
        ]
        counts = score_case(items, chunks)
        self.assertEqual(counts.total, 2)
        self.assertEqual(counts.structural_valid, 2)
        self.assertEqual(counts.citation_valid, 2)
        self.assertEqual(counts.duplicates, 0)
        self.assertEqual(counts.grounded, 2)
        self.assertEqual(counts.json_validity, 1.0)
        self.assertEqual(counts.citation_validity, 1.0)

    def test_counts_dangling_citation_and_duplicate(self) -> None:
        chunks = [GROUNDED_CHUNK]
        items = [
            item(prompt="same question", source_chunk=1),
            item(prompt="Same Question!", source_chunk=1),  # duplicate (normalized)
            item(prompt="dangling", source_chunk=5),  # citation invalid
        ]
        counts = score_case(items, chunks)
        self.assertEqual(counts.total, 3)
        self.assertEqual(counts.duplicates, 1)
        self.assertEqual(counts.citation_valid, 2)  # the dangling one fails
        self.assertAlmostEqual(counts.citation_validity, 2 / 3)
        self.assertAlmostEqual(counts.duplicate_rate, 1 / 3)

    def test_malformed_item_counts_total_but_not_valid(self) -> None:
        counts = score_case([item(options=["only", "two"]), "not-a-dict"], [GROUNDED_CHUNK])
        self.assertEqual(counts.total, 2)
        self.assertEqual(counts.structural_valid, 0)

    def test_empty_case_scores_zero_validity(self) -> None:
        counts = score_case([], [GROUNDED_CHUNK])
        self.assertEqual(counts.total, 0)
        self.assertEqual(counts.json_validity, 0.0)  # empty fails the validity bar
        self.assertEqual(counts.duplicate_rate, 0.0)


class AggregateTest(unittest.TestCase):
    def test_aggregate_sums_counts(self) -> None:
        a = MetricCounts(total=4, structural_valid=4, citation_valid=3, duplicates=0, grounded=4)
        b = MetricCounts(total=6, structural_valid=6, citation_valid=6, duplicates=1, grounded=5)
        total = aggregate([a, b])
        self.assertEqual(total.total, 10)
        self.assertEqual(total.citation_valid, 9)
        self.assertEqual(total.duplicates, 1)
        self.assertAlmostEqual(total.citation_validity, 0.9)
        self.assertAlmostEqual(total.duplicate_rate, 0.1)


if __name__ == "__main__":
    unittest.main()
