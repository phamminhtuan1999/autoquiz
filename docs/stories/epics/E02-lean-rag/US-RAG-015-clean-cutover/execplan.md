# Exec Plan

## Goal

Make the clean cutover contract explicit before schema, UI, and backend work
starts, so later stories do not spend time preserving generated history that is
not required.

## Scope

In scope:

- Inventory legacy generated-content tables, actions, routes, and UI surfaces.
- Define preserved account/billing data.
- Define retired generated-content data.
- Define the safe sequencing for replacement and eventual cleanup.
- Add validation expectations for later schema/cleanup stories.
- Update Harness status for `US-RAG-015`.

Out of scope:

- Writing SQL migrations.
- Dropping data.
- Removing app routes.
- Implementing RAG generation.

## Risk Classification

Risk flags:

- Data model: the story defines future table retention and retirement.
- Existing behavior: dashboard/history behavior changes after cutover.
- Public contracts: users may no longer see old generated history.
- Audit/security: payment idempotency and credits must be explicitly preserved.
- Weak proof: destructive cleanup proof will happen in later stories.

Hard gates:

- Data loss intent is explicit and limited to generated quiz/cram/mock history.

## Work Phases

1. Read current legacy schema and generation paths.
2. Write the cutover product contract.
3. Create high-risk story packet.
4. Update backlog and Harness evidence.
5. Run docs/code hygiene checks.

## Stop Conditions

Pause for human confirmation if:

- Preserving generated history becomes required.
- Cleanup would touch auth, profiles, credits, or payment idempotency.
- A destructive migration is proposed before replacement RAG flows exist.
