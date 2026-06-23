# AutoQuiz AI Backend

Python FastAPI service for the Lean RAG MVP.

Current scope:

- expose `GET /health`
- keep the service under `apps/ai`
- claim AI jobs through Supabase RPC using the service role
- provide a one-job runner contract for later document processing and generation
- leave Docling, provider calls, retrieval, and generation handlers to later RAG
  stories

Run locally:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r apps/ai/requirements.txt
npm run ai:dev
```

Health check:

```bash
npm run ai:health
curl http://localhost:8000/health
```

Run one queued job after a later story wires at least one concrete handler:

```bash
export AUTOQUIZ_AI_SUPABASE_URL=http://localhost:54321
export AUTOQUIZ_AI_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
export AUTOQUIZ_AI_WORKER_ID=autoquiz-ai-local
PYTHONPATH=apps/ai python3 apps/ai/run_once.py
```

Optional `AUTOQUIZ_AI_JOB_TYPES_CSV` restricts claims to a comma-separated list
of job types. Until the Docling/provider/generation handler stories are
implemented, `run_once.py` exits without claiming live jobs.
