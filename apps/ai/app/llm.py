"""US-RAG-007: LLM generation providers (OpenAI primary, Gemini fallback).

A provider-agnostic layer that turns a prompt + JSON Schema into a validated
object. SDK-free HTTP, consistent with ``embeddings.py``. The ``GenerationService``
owns the contract from ``docs/product/ai-provider-strategy.md``:

- one JSON repair attempt per provider, then fall back to the secondary provider;
- retryable vs non-retryable failure classification for the caller;
- API keys stay server-side (this module runs only in ``apps/ai``).

The product schemas/prompts (quiz, cram, review, mock exam) are NOT defined here
— callers pass their own schema. This story validates against it and orchestrates
providers; US-RAG-008+ own what to generate.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Protocol
from urllib import error, request

# --- Failure classification (ai-provider-strategy.md) -----------------------

# HTTP statuses that mean "transient — a retry or another provider may succeed".
_RETRYABLE_STATUS = {408, 409, 425, 429, 500, 502, 503, 504}
# HTTP statuses that mean "do not retry, do not fall back — the caller is wrong".
_NON_RETRYABLE_STATUS = {400, 401, 402, 403, 404, 422}


def status_is_retryable(status: int) -> bool:
    """Classify an HTTP status per the provider strategy.

    Unknown statuses default to non-retryable: we would rather surface a real
    error to the caller than silently burn the fallback provider on it.
    """
    if status in _RETRYABLE_STATUS:
        return True
    if status in _NON_RETRYABLE_STATUS:
        return False
    return status >= 500


class LlmError(RuntimeError):
    """A generation failure carrying its retry disposition for the caller.

    ``retryable`` drives the orchestration: retryable errors may trigger a
    repair (for bad JSON) or a fallback to the secondary provider; non-retryable
    errors short-circuit immediately.
    """

    def __init__(
        self,
        message: str,
        *,
        retryable: bool,
        category: str,
        provider: str | None = None,
    ) -> None:
        super().__init__(message)
        self.retryable = retryable
        self.category = category
        self.provider = provider


# --- Structural JSON Schema validation --------------------------------------

_TYPE_MAP: dict[str, tuple[type, ...]] = {
    "string": (str,),
    "number": (int, float),
    "integer": (int,),
    "boolean": (bool,),
    "array": (list,),
    "object": (dict,),
}


def validate_json(value, schema: dict, *, path: str = "$") -> list[str]:
    """Validate ``value`` against a small JSON-Schema subset.

    Supports ``type``, ``required``, ``properties``, ``enum``, ``minimum`` /
    ``maximum`` (numbers), and ``items`` / ``minItems`` / ``maxItems`` (arrays).
    Returns a list of human-readable error strings (empty == valid). Deliberately
    dependency-free; covers the product schemas US-RAG-008+ will define.
    """
    errors: list[str] = []
    expected = schema.get("type")

    if expected is not None:
        allowed = _TYPE_MAP.get(expected, ())
        # bool is a subclass of int — keep them distinct for number/integer.
        is_bool = isinstance(value, bool)
        ok = isinstance(value, allowed) and not (
            expected in {"number", "integer"} and is_bool
        )
        if not ok:
            errors.append(f"{path}: expected {expected}, got {type(value).__name__}")
            return errors  # type mismatch — deeper checks would be noise

    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {value!r} not in enum {schema['enum']}")

    if expected in {"number", "integer"} and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{path}: {value} < minimum {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            errors.append(f"{path}: {value} > maximum {schema['maximum']}")

    if expected == "object" or isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                errors.append(f"{path}: missing required key '{key}'")
        for key, subschema in schema.get("properties", {}).items():
            if key in value:
                errors.extend(validate_json(value[key], subschema, path=f"{path}.{key}"))

    if expected == "array" or isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            errors.append(f"{path}: {len(value)} items < minItems {schema['minItems']}")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errors.append(f"{path}: {len(value)} items > maxItems {schema['maxItems']}")
        item_schema = schema.get("items")
        if item_schema:
            for index, item in enumerate(value):
                errors.extend(validate_json(item, item_schema, path=f"{path}[{index}]"))

    return errors


# --- HTTP helper that preserves status for classification -------------------


def _post_json(url: str, payload: dict, headers: dict, timeout: int, provider: str) -> dict:
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url,
        data=body,
        method="POST",
        headers={"content-type": "application/json", **headers},
    )
    try:
        with request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        retryable = status_is_retryable(exc.code)
        raise LlmError(
            f"{provider} request failed ({exc.code}): {detail}",
            retryable=retryable,
            category=f"http_{exc.code}",
            provider=provider,
        ) from exc
    except error.URLError as exc:
        # Connection refused / DNS / timeout — transient transport, retryable.
        raise LlmError(
            f"{provider} request error: {exc.reason}",
            retryable=True,
            category="transport",
            provider=provider,
        ) from exc


def _parse_json_object(text: str, provider: str) -> dict:
    """Parse a model's text output into a JSON object.

    A non-JSON or non-object body is a retryable ``invalid_json`` condition: the
    orchestrator will attempt one repair before giving up on the provider.
    """
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, TypeError) as exc:
        raise LlmError(
            f"{provider} returned non-JSON output",
            retryable=True,
            category="invalid_json",
            provider=provider,
        ) from exc
    if not isinstance(data, dict):
        raise LlmError(
            f"{provider} returned JSON but not an object ({type(data).__name__})",
            retryable=True,
            category="invalid_json",
            provider=provider,
        )
    return data


# --- Providers --------------------------------------------------------------


class LlmProvider(Protocol):
    name: str
    model: str

    def generate_json(self, prompt: str, *, schema: dict, system: str | None = None) -> dict: ...


class OpenAIChatProvider:
    name = "openai"

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "gpt-4o-mini",
        base_url: str = "https://api.openai.com/v1",
        timeout_seconds: int = 90,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def generate_json(self, prompt: str, *, schema: dict, system: str | None = None) -> dict:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        data = _post_json(
            f"{self.base_url}/chat/completions",
            {
                "model": self.model,
                "messages": messages,
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
            },
            {"authorization": f"Bearer {self.api_key}"},
            self.timeout_seconds,
            self.name,
        )
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LlmError(
                "openai response missing choices/message content",
                retryable=True,
                category="invalid_json",
                provider=self.name,
            ) from exc
        return _parse_json_object(content, self.name)


class GeminiChatProvider:
    name = "gemini"

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "gemini-2.5-flash",
        base_url: str = "https://generativelanguage.googleapis.com/v1beta",
        timeout_seconds: int = 90,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def generate_json(self, prompt: str, *, schema: dict, system: str | None = None) -> dict:
        payload: dict = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
        }
        if system:
            payload["systemInstruction"] = {"parts": [{"text": system}]}
        data = _post_json(
            f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}",
            payload,
            {},
            self.timeout_seconds,
            self.name,
        )
        candidates = data.get("candidates") or []
        if not candidates:
            # No candidate usually means a safety block — non-retryable per strategy.
            reason = (data.get("promptFeedback") or {}).get("blockReason", "no candidates")
            raise LlmError(
                f"gemini produced no candidate ({reason})",
                retryable=False,
                category="unsafe",
                provider=self.name,
            )
        try:
            content = candidates[0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LlmError(
                "gemini response missing candidate content",
                retryable=True,
                category="invalid_json",
                provider=self.name,
            ) from exc
        return _parse_json_object(content, self.name)


# --- Orchestration ----------------------------------------------------------


@dataclass
class GenerationResult:
    data: dict
    provider_name: str
    model: str
    repaired: bool
    fell_back: bool


def _repair_prompt(prompt: str, schema: dict, problem: str) -> str:
    return (
        f"{prompt}\n\n"
        "Your previous response was rejected. Problem:\n"
        f"{problem}\n\n"
        "Return ONLY a single JSON object that conforms exactly to this JSON Schema. "
        "Do not include markdown fences or any prose.\n"
        f"{json.dumps(schema)}"
    )


class GenerationService:
    """Primary→fallback orchestration with one JSON repair attempt per provider."""

    def __init__(self, *, primary: LlmProvider, fallback: LlmProvider | None = None) -> None:
        self.primary = primary
        self.fallback = fallback

    def generate(self, prompt: str, *, schema: dict, system: str | None = None) -> GenerationResult:
        providers = [self.primary]
        if self.fallback is not None and self.fallback is not self.primary:
            providers.append(self.fallback)

        last_error: LlmError | None = None
        for index, provider in enumerate(providers):
            try:
                data, repaired = self._attempt(provider, prompt, schema, system)
                return GenerationResult(
                    data=data,
                    provider_name=provider.name,
                    model=provider.model,
                    repaired=repaired,
                    fell_back=index > 0,
                )
            except LlmError as exc:
                last_error = exc
                if not exc.retryable:
                    raise  # non-retryable: no repair, no fallback
                continue  # retryable: try the next provider
        assert last_error is not None  # providers is never empty
        raise last_error

    def _attempt(
        self, provider: LlmProvider, prompt: str, schema: dict, system: str | None
    ) -> tuple[dict, bool]:
        """Return (data, repaired) or raise LlmError. At most one repair call."""
        data, problem = self._call_and_validate(provider, prompt, schema, system)
        if problem is None:
            return data, False
        # The only path here is a content problem (bad JSON or schema-invalid);
        # transport/HTTP errors propagate out of _call_and_validate. Repair once.
        repaired_data, problem2 = self._call_and_validate(
            provider, _repair_prompt(prompt, schema, problem), schema, system
        )
        if problem2 is None:
            return repaired_data, True
        raise LlmError(
            f"{provider.name} output invalid after one repair: {problem2}",
            retryable=True,
            category="invalid_json_after_repair",
            provider=provider.name,
        )

    @staticmethod
    def _call_and_validate(
        provider: LlmProvider, prompt: str, schema: dict, system: str | None
    ) -> tuple[dict, str | None]:
        try:
            data = provider.generate_json(prompt, schema=schema, system=system)
        except LlmError as exc:
            if exc.category in {"invalid_json"}:
                return {}, str(exc)  # content problem → repairable
            raise  # transport / HTTP / safety → propagate to the service
        errors = validate_json(data, schema)
        if errors:
            return {}, "; ".join(errors)
        return data, None


# --- Factories --------------------------------------------------------------


def build_llm_provider(settings, role: str) -> LlmProvider | None:
    """Build the ``primary`` or ``fallback`` provider from settings.

    Returns ``None`` for a fallback that is unset/``none`` so a single-provider
    deployment is valid.
    """
    if role == "primary":
        name = (getattr(settings, "generation_provider", "openai") or "openai").lower()
    elif role == "fallback":
        name = (getattr(settings, "generation_fallback_provider", "") or "").lower()
        if name in {"", "none"}:
            return None
    else:
        raise ValueError(f"unknown provider role: {role}")

    if name == "openai":
        return OpenAIChatProvider(
            api_key=settings.openai_api_key,
            model=getattr(settings, "openai_chat_model", "gpt-4o-mini"),
        )
    if name == "gemini":
        return GeminiChatProvider(
            api_key=settings.gemini_api_key,
            model=getattr(settings, "gemini_chat_model", "gemini-2.0-flash"),
        )
    raise ValueError(f"unknown generation provider: {name}")


def build_generation_service(settings) -> GenerationService:
    primary = build_llm_provider(settings, "primary")
    if primary is None:
        raise ValueError("generation_provider must name a provider")
    return GenerationService(primary=primary, fallback=build_llm_provider(settings, "fallback"))
