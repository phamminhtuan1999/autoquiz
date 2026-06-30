"""US-RAG-013: RAG generation evaluation gate.

A deterministic metric library (``metrics``) + a release-bar gate (``gate``) +
fixture cases (``fixtures``) that score a provider's raw generation output against
the Evaluation Gates in ``docs/product/ai-provider-strategy.md``. See decision
0014. The live provider benchmark lives in ``apps/ai/eval_gate.py``.
"""
