"""US-RAG-005: Supabase Storage download + PostgREST writes for extraction.

Uses the same SDK-free ``urllib`` pattern as the job repository (US-RAG-003).
All requests use the service-role key, which bypasses RLS — so every written row
must carry the correct ``user_id`` (the document owner).
"""

from __future__ import annotations

import json
from urllib import error, request

from app.embeddings import to_pgvector


class SupabaseHttpError(RuntimeError):
    pass


def _auth_headers(service_role_key: str) -> dict[str, str]:
    return {
        "apikey": service_role_key,
        "authorization": f"Bearer {service_role_key}",
    }


class SupabaseStorageDownloader:
    def __init__(
        self,
        *,
        supabase_url: str,
        service_role_key: str,
        bucket: str = "documents",
        timeout_seconds: int = 60,
    ) -> None:
        self.base = supabase_url.rstrip("/")
        self.service_role_key = service_role_key
        self.bucket = bucket
        self.timeout_seconds = timeout_seconds

    def download(self, storage_path: str) -> bytes:
        url = f"{self.base}/storage/v1/object/{self.bucket}/{storage_path}"
        req = request.Request(url, method="GET", headers=_auth_headers(self.service_role_key))
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as response:
                return response.read()
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise SupabaseHttpError(f"storage download failed ({exc.code}): {detail}") from exc
        except error.URLError as exc:
            raise SupabaseHttpError(str(exc.reason)) from exc


class SupabaseDocumentStore:
    def __init__(
        self,
        *,
        supabase_url: str,
        service_role_key: str,
        timeout_seconds: int = 30,
    ) -> None:
        self.base = supabase_url.rstrip("/")
        self.service_role_key = service_role_key
        self.timeout_seconds = timeout_seconds

    # --- document status transitions ---

    def mark_processing(self, document_id: str, user_id: str) -> None:
        self._patch_document(document_id, {"status": "processing", "processing_error": None})

    def mark_ready(
        self,
        document_id: str,
        user_id: str,
        *,
        page_count: int,
        embedding_provider: str | None = None,
        embedding_model: str | None = None,
    ) -> None:
        patch = {"status": "ready", "page_count": page_count, "processing_error": None}
        if embedding_provider is not None:
            patch["embedding_provider"] = embedding_provider
        if embedding_model is not None:
            patch["embedding_model"] = embedding_model
        self._patch_document(document_id, patch)

    def mark_unsupported(self, document_id: str, user_id: str, *, reason: str) -> None:
        self._patch_document(document_id, {"status": "unsupported", "processing_error": reason})

    def mark_failed(self, document_id: str, user_id: str, *, error: str) -> None:
        self._patch_document(document_id, {"status": "failed", "processing_error": error})

    # --- page / chunk persistence (idempotent upserts) ---

    def save_pages(self, document_id: str, user_id: str, pages) -> None:
        rows = [
            {
                "user_id": user_id,
                "document_id": document_id,
                "page_number": page.page_number,
                "raw_text": page.raw_text,
                "cleaned_text": page.cleaned_text,
                "char_count": page.char_count,
            }
            for page in pages
        ]
        if rows:
            self._upsert("document_pages", rows, on_conflict="document_id,page_number")

    def save_chunks(self, document_id: str, user_id: str, chunks) -> None:
        rows = [
            {
                "user_id": user_id,
                "document_id": document_id,
                "chunk_index": chunk.chunk_index,
                "page_start": chunk.page_start,
                "page_end": chunk.page_end,
                "heading": chunk.heading,
                "content": chunk.content,
                "token_count": chunk.token_count,
                "metadata": chunk.metadata or {},
            }
            for chunk in chunks
        ]
        if rows:
            self._upsert("document_chunks", rows, on_conflict="document_id,chunk_index")

    def save_embeddings(
        self,
        document_id: str,
        user_id: str,
        *,
        provider: str,
        model: str,
        target_table: str,
        embeddings_by_index: dict[int, list[float]],
    ) -> None:
        if not embeddings_by_index:
            return
        # Resolve chunk_index -> chunk_id from the just-written chunks (survives
        # upsert re-runs; keeps save_chunks' signature unchanged).
        chunks = self._get(
            f"{self.base}/rest/v1/document_chunks"
            f"?document_id=eq.{document_id}&select=id,chunk_index"
        )
        id_by_index = {int(row["chunk_index"]): row["id"] for row in chunks}
        rows = []
        for index, vector in embeddings_by_index.items():
            chunk_id = id_by_index.get(int(index))
            if chunk_id is None:
                continue
            rows.append(
                {
                    "user_id": user_id,
                    "chunk_id": chunk_id,
                    "provider": provider,
                    "model": model,
                    "embedding": to_pgvector(vector),
                }
            )
        if rows:
            self._upsert(target_table, rows, on_conflict="chunk_id,provider,model")

    # --- HTTP ---

    def _get(self, url: str) -> list[dict]:
        req = request.Request(url, method="GET", headers=_auth_headers(self.service_role_key))
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8") or "[]")
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise SupabaseHttpError(f"GET {url} failed ({exc.code}): {detail}") from exc
        except error.URLError as exc:
            raise SupabaseHttpError(str(exc.reason)) from exc

    def _patch_document(self, document_id: str, patch: dict) -> None:
        url = f"{self.base}/rest/v1/documents?id=eq.{document_id}"
        self._send(url, "PATCH", patch, prefer="return=minimal")

    def _upsert(self, table: str, rows: list[dict], *, on_conflict: str) -> None:
        url = f"{self.base}/rest/v1/{table}?on_conflict={on_conflict}"
        self._send(url, "POST", rows, prefer="resolution=merge-duplicates,return=minimal")

    def _send(self, url: str, method: str, payload, *, prefer: str) -> None:
        body = json.dumps(payload).encode("utf-8")
        headers = {
            **_auth_headers(self.service_role_key),
            "content-type": "application/json",
            "prefer": prefer,
        }
        req = request.Request(url, data=body, method=method, headers=headers)
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as response:
                response.read()
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise SupabaseHttpError(f"{method} {url} failed ({exc.code}): {detail}") from exc
        except error.URLError as exc:
            raise SupabaseHttpError(str(exc.reason)) from exc


def _get_json(base_url: str, service_role_key: str, path_and_query: str, timeout: int) -> list[dict]:
    url = f"{base_url.rstrip('/')}/rest/v1/{path_and_query}"
    req = request.Request(url, method="GET", headers=_auth_headers(service_role_key))
    try:
        with request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8") or "[]")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise SupabaseHttpError(f"GET {url} failed ({exc.code}): {detail}") from exc
    except error.URLError as exc:
        raise SupabaseHttpError(str(exc.reason)) from exc


def _post_returning(
    base_url: str, service_role_key: str, table: str, rows: list[dict], timeout: int
) -> list[dict]:
    """Insert rows and return the created representations (in insert order)."""
    url = f"{base_url.rstrip('/')}/rest/v1/{table}"
    body = json.dumps(rows).encode("utf-8")
    headers = {
        **_auth_headers(service_role_key),
        "content-type": "application/json",
        "prefer": "return=representation",
    }
    req = request.Request(url, data=body, method="POST", headers=headers)
    try:
        with request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8") or "[]")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise SupabaseHttpError(f"POST {url} failed ({exc.code}): {detail}") from exc
    except error.URLError as exc:
        raise SupabaseHttpError(str(exc.reason)) from exc


class SupabaseChunkSource:
    """US-RAG-008: fetch a document's retrieval chunks to ground generation.

    Returns chunks ordered by ``chunk_index`` so the model's 1-based citation
    index is stable across the prompt and the persisted question.
    """

    def __init__(self, *, supabase_url: str, service_role_key: str, timeout_seconds: int = 30) -> None:
        self.base = supabase_url.rstrip("/")
        self.service_role_key = service_role_key
        self.timeout_seconds = timeout_seconds

    def fetch_chunks(self, document_id: str, user_id: str, *, limit: int):
        from app.jobs.generate_quiz import SourceChunk

        rows = _get_json(
            self.base,
            self.service_role_key,
            f"document_chunks?document_id=eq.{document_id}&user_id=eq.{user_id}"
            f"&select=id,chunk_index,content,page_start,page_end"
            f"&order=chunk_index.asc&limit={int(limit)}",
            self.timeout_seconds,
        )
        return [
            SourceChunk(
                chunk_id=row["id"],
                chunk_index=int(row["chunk_index"]),
                content=row.get("content") or "",
                page_start=row.get("page_start"),
                page_end=row.get("page_end"),
            )
            for row in rows
        ]


class SupabaseQuizStore:
    """US-RAG-008: persist a generated quiz_set + questions + answer_options."""

    def __init__(self, *, supabase_url: str, service_role_key: str, timeout_seconds: int = 30) -> None:
        self.base = supabase_url.rstrip("/")
        self.service_role_key = service_role_key
        self.timeout_seconds = timeout_seconds

    def create_quiz_set(
        self,
        *,
        user_id: str,
        document_id: str,
        job_id: str,
        mode: str,
        title: str,
        difficulty: str | None,
        credit_cost: int,
    ) -> str:
        created = _post_returning(
            self.base,
            self.service_role_key,
            "quiz_sets",
            [
                {
                    "user_id": user_id,
                    "document_id": document_id,
                    "job_id": job_id,
                    "mode": mode,
                    "title": title,
                    "difficulty": difficulty,
                    "status": "ready",
                    "credit_cost": credit_cost,
                }
            ],
            self.timeout_seconds,
        )
        return created[0]["id"]

    def save_questions(self, *, quiz_set_id: str, user_id: str, document_id: str, questions) -> None:
        if not questions:
            return
        question_rows = [
            {
                "user_id": user_id,
                "quiz_set_id": quiz_set_id,
                "document_id": document_id,
                "source_chunk_id": q.source_chunk_id,
                "type": "mcq",
                "difficulty": q.difficulty,
                "topic": q.topic,
                "prompt": q.prompt,
                "correct_answer": q.correct_answer,
                "explanation": q.explanation,
                "source_page_start": q.source_page_start,
                "source_page_end": q.source_page_end,
                "source_excerpt": q.source_excerpt,
                "metadata": q.metadata or {},
            }
            for q in questions
        ]
        created = _post_returning(
            self.base, self.service_role_key, "questions", question_rows, self.timeout_seconds
        )
        # PostgREST returns inserted rows in request order — zip back to options.
        option_rows: list[dict] = []
        for question, row in zip(questions, created):
            for index, content in enumerate(question.options):
                option_rows.append(
                    {
                        "user_id": user_id,
                        "question_id": row["id"],
                        "label": chr(ord("A") + index),
                        "content": content,
                        "is_correct": index == question.answer_index,
                    }
                )
        if option_rows:
            _post_returning(
                self.base, self.service_role_key, "answer_options", option_rows, self.timeout_seconds
            )

    def save_cards(self, *, quiz_set_id: str, user_id: str, document_id: str, cards) -> None:
        """US-RAG-009: persist cram flashcards as ``questions`` (``type='flashcard'``).

        A flashcard is front (``prompt``) + back (``correct_answer``); there are
        no ``answer_options``."""
        if not cards:
            return
        card_rows = [
            {
                "user_id": user_id,
                "quiz_set_id": quiz_set_id,
                "document_id": document_id,
                "source_chunk_id": c.source_chunk_id,
                "type": "flashcard",
                "difficulty": c.difficulty,
                "topic": c.topic,
                "prompt": c.prompt,
                "correct_answer": c.answer,
                "explanation": c.explanation,
                "source_page_start": c.source_page_start,
                "source_page_end": c.source_page_end,
                "source_excerpt": c.source_excerpt,
                "metadata": c.metadata or {},
            }
            for c in cards
        ]
        _post_returning(
            self.base, self.service_role_key, "questions", card_rows, self.timeout_seconds
        )

    def save_essays(self, *, quiz_set_id: str, user_id: str, document_id: str, essays) -> None:
        """US-RAG-012: persist mock-exam essay questions as ``questions``
        (``type='essay'``). The grading rubric / max-points / suggested-minutes
        ride in ``metadata`` (decision 0012); ``correct_answer`` holds the
        reference sample answer. Essays have no ``answer_options``."""
        if not essays:
            return
        essay_rows = [
            {
                "user_id": user_id,
                "quiz_set_id": quiz_set_id,
                "document_id": document_id,
                "source_chunk_id": e.source_chunk_id,
                "type": "essay",
                "difficulty": e.difficulty,
                "topic": e.topic,
                "prompt": e.prompt,
                "correct_answer": e.sample_answer,
                "explanation": e.explanation,
                "source_page_start": e.source_page_start,
                "source_page_end": e.source_page_end,
                "source_excerpt": e.source_excerpt,
                "metadata": {
                    "rubric": e.rubric,
                    "max_points": e.max_points,
                    "suggested_minutes": e.suggested_minutes,
                },
            }
            for e in essays
        ]
        _post_returning(
            self.base, self.service_role_key, "questions", essay_rows, self.timeout_seconds
        )

    def save_study_review(self, *, quiz_set_id: str, user_id: str, document_id: str, review) -> str:
        """US-RAG-010: persist one ``study_reviews`` row keyed to a
        ``study_review`` quiz_set. ``summary``/``weak_topics``/
        ``recommended_actions`` are jsonb columns written as JSON values."""
        weak_topics = [
            {
                "topic": w.topic,
                "why": w.why,
                "recommended_action": w.recommended_action,
                "source": {
                    "chunk_id": w.source_chunk_id,
                    "page_start": w.source_page_start,
                    "page_end": w.source_page_end,
                    "excerpt": w.source_excerpt,
                },
            }
            for w in review.weak_topics
        ]
        created = _post_returning(
            self.base,
            self.service_role_key,
            "study_reviews",
            [
                {
                    "user_id": user_id,
                    "quiz_set_id": quiz_set_id,
                    "document_id": document_id,
                    "summary": review.summary,
                    "weak_topics": weak_topics,
                    "recommended_actions": review.recommended_actions,
                }
            ],
            self.timeout_seconds,
        )
        return created[0]["id"]


class SupabaseEssayAnswerSource:
    """US-RAG-012b: read a mock set's essay questions and the student's latest
    answer for each, for ``grade_mock_exam``.

    Two plain reads (no fragile embedded-resource filter): the essay
    ``questions`` for the set — each carrying its grading rubric / max-points in
    ``metadata`` (decision 0012) and the reference sample answer in
    ``correct_answer`` — and the student's ``rag_question_attempts`` answer text
    for the set, keyed back to the latest answer per question. Returns one
    ``EssayToGrade`` per essay question (answered or not).
    """

    def __init__(self, *, supabase_url: str, service_role_key: str, timeout_seconds: int = 30) -> None:
        self.base = supabase_url.rstrip("/")
        self.service_role_key = service_role_key
        self.timeout_seconds = timeout_seconds

    def fetch_essays_to_grade(self, quiz_set_id: str, user_id: str):
        from app.jobs.grade_mock_exam import EssayToGrade

        questions = _get_json(
            self.base,
            self.service_role_key,
            f"questions?quiz_set_id=eq.{quiz_set_id}&user_id=eq.{user_id}&type=eq.essay"
            "&select=id,prompt,correct_answer,metadata&order=created_at.asc",
            self.timeout_seconds,
        )
        attempts = _get_json(
            self.base,
            self.service_role_key,
            f"rag_question_attempts?quiz_set_id=eq.{quiz_set_id}&user_id=eq.{user_id}"
            "&answer_text=not.is.null&select=question_id,answer_text,created_at"
            "&order=created_at.desc",
            self.timeout_seconds,
        )
        latest_answer: dict[str, str] = {}
        for attempt in attempts:
            qid = attempt.get("question_id")
            if qid and qid not in latest_answer:
                latest_answer[qid] = attempt.get("answer_text")

        essays = []
        for question in questions:
            metadata = question.get("metadata") or {}
            essays.append(
                EssayToGrade(
                    question_id=question["id"],
                    prompt=question.get("prompt") or "",
                    rubric=metadata.get("rubric") or {},
                    max_points=metadata.get("max_points"),
                    sample_answer=question.get("correct_answer"),
                    student_answer=latest_answer.get(question["id"]),
                )
            )
        return essays


class SupabaseAttemptSource:
    """US-RAG-010: read a student's RAG attempts for a document as the
    weak-area signal for a study review.

    Joins ``rag_question_attempts`` → ``questions`` (PostgREST embedded resource,
    inner so attempts without a live question are dropped) to enrich each attempt
    with its question's topic / prompt / correct answer. Optionally narrowed to
    one source ``quiz_set`` the student took.
    """

    def __init__(self, *, supabase_url: str, service_role_key: str, timeout_seconds: int = 30) -> None:
        self.base = supabase_url.rstrip("/")
        self.service_role_key = service_role_key
        self.timeout_seconds = timeout_seconds

    def fetch_attempts(
        self, document_id: str, user_id: str, *, source_quiz_set_id: str | None, limit: int
    ):
        from app.jobs.generate_study_review import AttemptRecord

        query = (
            f"rag_question_attempts?user_id=eq.{user_id}"
            "&select=question_id,quiz_set_id,is_correct,"
            "questions!inner(topic,prompt,correct_answer,document_id)"
            f"&questions.document_id=eq.{document_id}"
            f"&order=created_at.desc&limit={int(limit)}"
        )
        if source_quiz_set_id:
            query += f"&quiz_set_id=eq.{source_quiz_set_id}"
        rows = _get_json(self.base, self.service_role_key, query, self.timeout_seconds)
        attempts = []
        for row in rows:
            question = row.get("questions") or {}
            attempts.append(
                AttemptRecord(
                    question_id=row["question_id"],
                    quiz_set_id=row.get("quiz_set_id"),
                    topic=question.get("topic"),
                    prompt=question.get("prompt") or "",
                    correct_answer=question.get("correct_answer"),
                    is_correct=row.get("is_correct"),
                )
            )
        return attempts
