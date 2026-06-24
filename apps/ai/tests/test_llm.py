from __future__ import annotations

import unittest

from app.llm import (
    GenerationService,
    GeminiChatProvider,
    LlmError,
    OpenAIChatProvider,
    build_generation_service,
    build_llm_provider,
    status_is_retryable,
    validate_json,
)

# A small caller schema, the shape US-RAG-008 will pass in for a quiz question.
QUESTION_SCHEMA = {
    "type": "object",
    "required": ["question", "options", "answer_index"],
    "properties": {
        "question": {"type": "string"},
        "options": {"type": "array", "minItems": 4, "maxItems": 4, "items": {"type": "string"}},
        "answer_index": {"type": "integer", "minimum": 0, "maximum": 3},
        "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]},
    },
}

VALID = {"question": "What is 2+2?", "options": ["1", "2", "3", "4"], "answer_index": 3}


class _Settings:
    def __init__(self, *, primary="openai", fallback="gemini") -> None:
        self.generation_provider = primary
        self.generation_fallback_provider = fallback
        self.openai_api_key = "openai-key"
        self.openai_chat_model = "gpt-4o-mini"
        self.gemini_api_key = "gemini-key"
        self.gemini_chat_model = "gemini-2.0-flash"


class FakeProvider:
    """Scripted provider: each element of ``script`` is either a dict to return,
    an ``LlmError`` to raise, or a JSON-ish value to validate (e.g. a malformed
    object). Consumed one entry per ``generate_json`` call."""

    def __init__(self, name, script) -> None:
        self.name = name
        self.model = f"{name}-model"
        self._script = list(script)
        self.calls = 0

    def generate_json(self, prompt, *, schema, system=None):
        self.calls += 1
        item = self._script.pop(0)
        if isinstance(item, LlmError):
            raise item
        if isinstance(item, BaseException):
            raise item
        return item


# --- validate_json ----------------------------------------------------------


class ValidateJsonTest(unittest.TestCase):
    def test_accepts_valid(self) -> None:
        self.assertEqual(validate_json(VALID, QUESTION_SCHEMA), [])

    def test_rejects_missing_required_key(self) -> None:
        errors = validate_json({"question": "q", "options": ["a", "b", "c", "d"]}, QUESTION_SCHEMA)
        self.assertTrue(any("answer_index" in e for e in errors))

    def test_rejects_wrong_type(self) -> None:
        bad = {**VALID, "answer_index": "3"}
        errors = validate_json(bad, QUESTION_SCHEMA)
        self.assertTrue(any("answer_index" in e and "integer" in e for e in errors))

    def test_bool_is_not_integer(self) -> None:
        bad = {**VALID, "answer_index": True}
        self.assertTrue(validate_json(bad, QUESTION_SCHEMA))

    def test_rejects_bad_enum(self) -> None:
        bad = {**VALID, "difficulty": "trivial"}
        errors = validate_json(bad, QUESTION_SCHEMA)
        self.assertTrue(any("enum" in e for e in errors))

    def test_rejects_out_of_range(self) -> None:
        bad = {**VALID, "answer_index": 9}
        errors = validate_json(bad, QUESTION_SCHEMA)
        self.assertTrue(any("maximum" in e for e in errors))

    def test_rejects_wrong_item_count(self) -> None:
        bad = {**VALID, "options": ["a", "b"]}
        errors = validate_json(bad, QUESTION_SCHEMA)
        self.assertTrue(any("minItems" in e for e in errors))


# --- classification ---------------------------------------------------------


class ClassificationTest(unittest.TestCase):
    def test_retryable_statuses(self) -> None:
        for status in (408, 429, 500, 502, 503, 504):
            self.assertTrue(status_is_retryable(status), status)

    def test_non_retryable_statuses(self) -> None:
        for status in (400, 401, 402, 403, 404, 422):
            self.assertFalse(status_is_retryable(status), status)


# --- GenerationService orchestration ----------------------------------------


class GenerationServiceTest(unittest.TestCase):
    def test_primary_success_no_repair_no_fallback(self) -> None:
        primary = FakeProvider("openai", [VALID])
        fallback = FakeProvider("gemini", [VALID])
        result = GenerationService(primary=primary, fallback=fallback).generate(
            "make a question", schema=QUESTION_SCHEMA
        )
        self.assertEqual(result.data, VALID)
        self.assertEqual(result.provider_name, "openai")
        self.assertFalse(result.repaired)
        self.assertFalse(result.fell_back)
        self.assertEqual(primary.calls, 1)
        self.assertEqual(fallback.calls, 0)

    def test_invalid_json_triggers_one_repair_then_succeeds(self) -> None:
        # First call returns schema-invalid object, repair returns valid.
        invalid = {"question": "q", "options": ["a", "b"], "answer_index": 9}
        primary = FakeProvider("openai", [invalid, VALID])
        result = GenerationService(primary=primary).generate("p", schema=QUESTION_SCHEMA)
        self.assertEqual(result.data, VALID)
        self.assertTrue(result.repaired)
        self.assertFalse(result.fell_back)
        self.assertEqual(primary.calls, 2)  # original + exactly one repair

    def test_retryable_error_falls_back_to_secondary(self) -> None:
        primary = FakeProvider(
            "openai", [LlmError("rate limited", retryable=True, category="http_429")]
        )
        fallback = FakeProvider("gemini", [VALID])
        result = GenerationService(primary=primary, fallback=fallback).generate(
            "p", schema=QUESTION_SCHEMA
        )
        self.assertEqual(result.provider_name, "gemini")
        self.assertTrue(result.fell_back)
        self.assertEqual(primary.calls, 1)  # no repair on a transport error
        self.assertEqual(fallback.calls, 1)

    def test_non_retryable_error_short_circuits(self) -> None:
        primary = FakeProvider(
            "openai", [LlmError("bad request", retryable=False, category="http_400")]
        )
        fallback = FakeProvider("gemini", [VALID])
        service = GenerationService(primary=primary, fallback=fallback)
        with self.assertRaises(LlmError) as ctx:
            service.generate("p", schema=QUESTION_SCHEMA)
        self.assertFalse(ctx.exception.retryable)
        self.assertEqual(fallback.calls, 0)  # never tried the fallback

    def test_invalid_after_repair_falls_back(self) -> None:
        bad = {"question": "q", "options": [], "answer_index": 0}
        primary = FakeProvider("openai", [bad, bad])  # bad, then still bad after repair
        fallback = FakeProvider("gemini", [VALID])
        result = GenerationService(primary=primary, fallback=fallback).generate(
            "p", schema=QUESTION_SCHEMA
        )
        self.assertEqual(result.provider_name, "gemini")
        self.assertTrue(result.fell_back)
        self.assertEqual(primary.calls, 2)  # original + one repair, then gave up

    def test_both_providers_fail_raises_retryable(self) -> None:
        primary = FakeProvider("openai", [LlmError("x", retryable=True, category="transport")])
        fallback = FakeProvider("gemini", [LlmError("y", retryable=True, category="http_503")])
        with self.assertRaises(LlmError) as ctx:
            GenerationService(primary=primary, fallback=fallback).generate(
                "p", schema=QUESTION_SCHEMA
            )
        self.assertTrue(ctx.exception.retryable)

    def test_repair_attempted_at_most_once_per_provider(self) -> None:
        invalid = {"question": "q", "options": ["a"], "answer_index": 0}
        # primary: invalid, invalid (repair fails) -> fallback: invalid, invalid -> raise
        primary = FakeProvider("openai", [invalid, invalid])
        fallback = FakeProvider("gemini", [invalid, invalid])
        with self.assertRaises(LlmError):
            GenerationService(primary=primary, fallback=fallback).generate(
                "p", schema=QUESTION_SCHEMA
            )
        self.assertEqual(primary.calls, 2)
        self.assertEqual(fallback.calls, 2)


# --- factories --------------------------------------------------------------


class FactoryTest(unittest.TestCase):
    def test_builds_openai_primary_gemini_fallback(self) -> None:
        service = build_generation_service(_Settings(primary="openai", fallback="gemini"))
        self.assertIsInstance(service.primary, OpenAIChatProvider)
        self.assertIsInstance(service.fallback, GeminiChatProvider)

    def test_fallback_none_yields_single_provider(self) -> None:
        self.assertIsNone(build_llm_provider(_Settings(fallback="none"), "fallback"))
        service = build_generation_service(_Settings(primary="gemini", fallback="none"))
        self.assertIsInstance(service.primary, GeminiChatProvider)
        self.assertIsNone(service.fallback)

    def test_rejects_unknown_provider(self) -> None:
        with self.assertRaises(ValueError):
            build_llm_provider(_Settings(primary="cohere"), "primary")

    def test_imports_without_keys(self) -> None:
        # A provider can be constructed with empty keys (import/build never calls out).
        OpenAIChatProvider(api_key="")
        GeminiChatProvider(api_key="")


if __name__ == "__main__":
    unittest.main()
