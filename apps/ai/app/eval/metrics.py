"""US-RAG-013: deterministic quality metrics over raw RAG generation output.

Scores a provider's *raw* model output — the items as the model returned them,
before the generation handlers' defensive dropping (US-RAG-008+) — against the
criteria in ``docs/product/ai-provider-strategy.md``: structural / JSON validity,
citation validity, duplicate-question rate, and a lightweight grounding proxy.

Pure functions, no network and no model, so the gate is reproducible and
unit-testable (decision 0014). An MCQ item is the schema shape the generators
already use: ``{prompt, options[4], answer_index, source_chunk (1-based),
explanation, ...}``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.jobs.generate_quiz import SourceChunk

_WORD_RE = re.compile(r"[a-z0-9]+")

# Common function words carry no grounding signal; excluded from overlap scoring.
_STOPWORDS = frozenset(
    {
        "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "by",
        "for", "with", "from", "as", "is", "are", "was", "were", "be", "been",
        "being", "it", "its", "this", "that", "these", "those", "which", "what",
        "who", "whom", "into", "than", "then", "they", "them", "their", "there",
        "here", "when", "where", "how", "why", "can", "could", "will", "would",
        "do", "does", "did", "not", "no", "yes", "all", "any", "each", "more",
        "most", "such", "some", "one", "two", "during", "via", "using", "used",
        "between", "within", "above", "below", "about", "also", "both", "has",
        "have", "had",
    }
)

# Minimum shared content words between an item's claim (correct option +
# explanation) and the chunk it cites for the item to count as "grounded".
GROUNDING_MIN_OVERLAP = 2


def _words(text: str | None) -> list[str]:
    return _WORD_RE.findall((text or "").lower())


def _content_words(text: str | None) -> set[str]:
    return {w for w in _words(text) if len(w) > 2 and w not in _STOPWORDS}


def normalize_prompt(prompt: str | None) -> str:
    """Whitespace/case/punctuation-insensitive key for duplicate detection."""
    return " ".join(_words(prompt))


def is_structurally_valid(item: dict) -> bool:
    """A well-formed MCQ: a non-empty prompt, exactly 4 non-empty string options,
    and an ``answer_index`` in 0..3 (the JSON-validity signal)."""
    prompt = item.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        return False
    options = item.get("options")
    if not isinstance(options, list) or len(options) != 4:
        return False
    if any(not isinstance(o, str) or not o.strip() for o in options):
        return False
    index = item.get("answer_index")
    return isinstance(index, bool) is False and isinstance(index, int) and 0 <= index < 4


def is_citation_valid(item: dict, chunk_count: int) -> bool:
    """The cited ``source_chunk`` (1-based) resolves to a provided chunk."""
    position = item.get("source_chunk")
    return (
        isinstance(position, bool) is False
        and isinstance(position, int)
        and 1 <= position <= chunk_count
    )


def is_grounded(item: dict, chunks: list[SourceChunk]) -> bool:
    """Lexical grounding proxy: the item's claim (correct option + explanation)
    shares at least ``GROUNDING_MIN_OVERLAP`` content words with the chunk it
    cites. Only meaningful when the citation resolves; a dangling citation is not
    grounded. This is a proxy (reported, not gated) — not a semantic check."""
    position = item.get("source_chunk")
    if not (isinstance(position, int) and not isinstance(position, bool) and 1 <= position <= len(chunks)):
        return False
    chunk_words = _content_words(chunks[position - 1].content)
    if not chunk_words:
        return False
    options = item.get("options") or []
    index = item.get("answer_index")
    answer = options[index] if isinstance(index, int) and 0 <= index < len(options) else ""
    claim_words = _content_words(f"{answer} {item.get('explanation', '')}")
    return len(claim_words & chunk_words) >= GROUNDING_MIN_OVERLAP


def _rate(numerator: int, denominator: int) -> float:
    """Rate in [0, 1]; an empty set scores 0.0 so validity gates fail on it."""
    return numerator / denominator if denominator else 0.0


@dataclass(frozen=True)
class MetricCounts:
    total: int = 0
    structural_valid: int = 0
    citation_valid: int = 0
    duplicates: int = 0
    grounded: int = 0

    def __add__(self, other: "MetricCounts") -> "MetricCounts":
        return MetricCounts(
            total=self.total + other.total,
            structural_valid=self.structural_valid + other.structural_valid,
            citation_valid=self.citation_valid + other.citation_valid,
            duplicates=self.duplicates + other.duplicates,
            grounded=self.grounded + other.grounded,
        )

    @property
    def json_validity(self) -> float:
        return _rate(self.structural_valid, self.total)

    @property
    def citation_validity(self) -> float:
        return _rate(self.citation_valid, self.total)

    @property
    def duplicate_rate(self) -> float:
        return _rate(self.duplicates, self.total)

    @property
    def grounding_rate(self) -> float:
        return _rate(self.grounded, self.total)


def score_case(items: list[dict], chunks: list[SourceChunk]) -> MetricCounts:
    """Score one generation case (the raw items produced from ``chunks``).

    Duplicates are counted *within the case* — a generated set should not repeat a
    question. A blank/whitespace prompt is structurally invalid and never counted
    as a duplicate (its normalized key is empty)."""
    seen: set[str] = set()
    total = structural = citation = duplicates = grounded = 0
    for item in items:
        if not isinstance(item, dict):
            total += 1
            continue
        total += 1
        if is_structurally_valid(item):
            structural += 1
        if is_citation_valid(item, len(chunks)):
            citation += 1
        if is_grounded(item, chunks):
            grounded += 1
        key = normalize_prompt(item.get("prompt"))
        if key:
            if key in seen:
                duplicates += 1
            else:
                seen.add(key)
    return MetricCounts(
        total=total,
        structural_valid=structural,
        citation_valid=citation,
        duplicates=duplicates,
        grounded=grounded,
    )


def aggregate(counts: list[MetricCounts]) -> MetricCounts:
    total = MetricCounts()
    for count in counts:
        total = total + count
    return total
