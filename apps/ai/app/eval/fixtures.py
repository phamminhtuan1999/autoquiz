"""US-RAG-013: fixture cases for the evaluation gate — the "fixed set" analog.

A few small, self-contained grounded chunk sets the live benchmark generates
against (and that unit tests can score). Hand-authored, deterministic; growing
this toward a larger golden corpus is future work (decision 0014).
"""

from __future__ import annotations

from dataclasses import dataclass

from app.jobs.generate_quiz import SourceChunk


@dataclass(frozen=True)
class FixtureCase:
    name: str
    chunks: list[SourceChunk]
    num_questions: int


def _chunk(index: int, content: str, page: int) -> SourceChunk:
    return SourceChunk(
        chunk_id=f"fixture-{index}",
        chunk_index=index,
        content=content,
        page_start=page,
        page_end=page,
    )


FIXTURE_CASES: list[FixtureCase] = [
    FixtureCase(
        name="cell-biology",
        chunks=[
            _chunk(
                0,
                "Cellular respiration converts glucose and oxygen into ATP, water, and "
                "carbon dioxide. The mitochondrion is the site of the citric acid cycle "
                "and oxidative phosphorylation, where most ATP is produced via the "
                "electron transport chain and a proton gradient across the inner membrane.",
                1,
            ),
            _chunk(
                1,
                "Photosynthesis in chloroplasts captures light energy to convert carbon "
                "dioxide and water into glucose and oxygen. The light-dependent reactions "
                "occur in the thylakoid membranes, and the Calvin cycle fixes carbon in "
                "the stroma.",
                2,
            ),
            _chunk(
                2,
                "DNA replication is semiconservative: each strand serves as a template "
                "for a new complementary strand. DNA polymerase synthesizes the new "
                "strand in the 5-prime to 3-prime direction; the leading strand is "
                "continuous while the lagging strand is made in Okazaki fragments.",
                3,
            ),
        ],
        num_questions=4,
    ),
    FixtureCase(
        name="world-history",
        chunks=[
            _chunk(
                0,
                "The printing press, developed by Johannes Gutenberg around 1440, used "
                "movable metal type to mass-produce books. It dramatically lowered the "
                "cost of printing and accelerated the spread of literacy and ideas across "
                "Europe during the Renaissance.",
                1,
            ),
            _chunk(
                1,
                "The Industrial Revolution began in Britain in the late eighteenth "
                "century. The steam engine, improved by James Watt, powered factories, "
                "railways, and ships, shifting production from hand tools to machines and "
                "driving rapid urbanization.",
                2,
            ),
            _chunk(
                2,
                "The Silk Road was a network of trade routes connecting China to the "
                "Mediterranean. Beyond silk and spices, it carried technologies, "
                "religions, and ideas between East and West for centuries.",
                3,
            ),
        ],
        num_questions=4,
    ),
    FixtureCase(
        name="basic-physics",
        chunks=[
            _chunk(
                0,
                "Newton's first law states that an object at rest stays at rest and an "
                "object in motion stays in motion at constant velocity unless acted upon "
                "by a net external force. This property is called inertia.",
                1,
            ),
            _chunk(
                1,
                "Newton's second law states that the net force on an object equals its "
                "mass times its acceleration (F equals m times a). A larger force "
                "produces a larger acceleration for the same mass.",
                2,
            ),
            _chunk(
                2,
                "Energy is conserved: it can change form but is neither created nor "
                "destroyed. Kinetic energy is the energy of motion, and potential energy "
                "is stored energy due to position, such as gravitational potential energy.",
                3,
            ),
        ],
        num_questions=3,
    ),
]
