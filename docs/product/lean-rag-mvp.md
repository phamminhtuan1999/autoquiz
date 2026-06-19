# Lean RAG MVP Product Contract

## Product Target

AutoQuiz is a student-first SaaS for turning PDFs into grounded quizzes, cram
content, study reviews, and mock exams.

## Accepted Scope

- PDF only.
- Maximum PDF size: 30 MB.
- Maximum PDF length: 150 pages.
- Save the original PDF in Supabase Storage.
- No OCR in the first RAG pass; scanned PDFs are marked unsupported.
- Use a Python FastAPI AI backend from the start of RAG development.
- Split implementation into `apps/web` for Next.js and `apps/ai` for Python
  FastAPI.
- Use Supabase Auth, Postgres, Storage, RLS, and pgvector.
- Use RAG citations and Study Review before AI Tutor Chat.
- Include Cram Mode in the core RAG path.
- Develop Mock Exam immediately after the core regular quiz, cram, study
  review, job, provider, and credit substrate is working.
- Use OpenAI as the primary generation and embedding provider.
- Use Gemini as generation fallback and optional development embedding provider.

## Core Flow

1. The user uploads a PDF.
2. The browser uploads the PDF to Supabase Storage.
3. Next.js creates a `documents` row and a `process_document` AI job.
4. Python claims the job, downloads the PDF, validates size/page count, and
   extracts text with Docling.
5. Python saves document pages, chunks, and provider-specific embeddings.
6. The document becomes `ready`.
7. The user can generate regular quizzes, cram content, study reviews, and mock
   exams from the ready document.
8. Generated questions and review items cite source chunk IDs, source pages, and
   short source excerpts.

## Document Statuses

- `uploaded`
- `processing`
- `ready`
- `failed`
- `unsupported`

## Generation Modes

| Mode | Contract |
| --- | --- |
| `regular` | Multiple-choice quiz generated from retrieved chunks, with one valid source citation per question. |
| `cram` | Golden nuggets and rapid-review questions generated from retrieved chunks, with source citations. |
| `study_review` | Weak-topic summary and recommended next actions generated from attempts and source evidence. |
| `mock` | Timed MCQ/essay exam generated from retrieved chunks, with citations and rubric-backed grading. |

## Non-Goals

- OCR for scanned PDFs.
- AI Tutor Chat.
- GraphRAG.
- External vector databases.
- Redis/Celery unless job volume requires it later.
- Teacher/classroom roles.
- Multi-user study rooms.
- Advanced admin dashboard.

## Clean Cutover Notes

The current app already has `quizzes`, `question_attempts`, and `mock_exams`
tables plus direct Gemini generation actions. Old generated quiz/mock-exam data
does not need to be preserved. The RAG implementation should favor the faster
clean cutover path:

- Build the normalized RAG schema directly.
- Route new generation through `documents`, `ai_jobs`, `quiz_sets`,
  `questions`, `answer_options`, `question_attempts`, and `study_reviews`.
- Retire or ignore old generated-data paths rather than migrating historical
  rows.
- Keep user auth, profile, credit balance, Stripe payment idempotency, and any
  still-valid account records intact.
