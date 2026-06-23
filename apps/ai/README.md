# AutoQuiz AI Backend

Python FastAPI service for the Lean RAG MVP.

Current scope for `US-RAG-014` is a runnable scaffold only:

- expose `GET /health`
- keep the service under `apps/ai`
- leave document processing, jobs, providers, and retrieval to later RAG stories

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
