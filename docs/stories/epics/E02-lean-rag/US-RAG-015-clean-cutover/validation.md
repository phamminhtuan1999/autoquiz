# Validation

## Proof Strategy

This story is a contract/story-packet change. It does not perform destructive
cleanup. Proof is therefore documentation consistency plus Harness evidence.
Destructive cleanup validation belongs to the future migration story.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | n/a |
| Integration | Later: credit balance and Stripe idempotency survive RAG schema/cutover. |
| E2E | Later: dashboard routes new generation/history to RAG records and old URLs show retired state. |
| Platform | `git diff --check`; existing `npm run lint`; existing build proof from `US-RAG-014` remains valid. |
| Performance | n/a |
| Logs/Audit | Later: cleanup migration reports generated-content cleanup counts without touching billing/account records. |

## Fixtures

Later migration proof should use:

- user with credits and no generated history
- user with credits plus legacy quiz rows
- user with credits plus legacy mock exam rows
- duplicate Stripe session already present in `payment_events`

## Commands

```text
git diff --check
npm run lint
```

## Acceptance Evidence

- `git diff --check` passed.
- `npm run lint` passed. It prints a stale `baseline-browser-mapping` advisory.
- Harness matrix updated with `US-RAG-015` as implemented.
