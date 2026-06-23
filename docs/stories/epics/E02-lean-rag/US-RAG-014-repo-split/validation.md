# Validation

## Proof Strategy

Prove that the repo split preserves the current web app build/lint path and
that the new AI backend scaffold is importable.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | `npm run ai:health` imports the AI health payload and returns `{"status": "ok"}`. |
| Integration | n/a |
| E2E | n/a |
| Platform | `npm run lint`; `npm run build`; optional `npm run ai:dev` manual smoke. |
| Performance | n/a |
| Logs/Audit | n/a |

## Fixtures

No external fixtures. Web build may require no Supabase/Stripe/Gemini secrets
because current app reads them at runtime paths.

## Commands

```text
npm install --package-lock-only --ignore-scripts
npm run lint
npm run build
npm run ai:health
```

## Acceptance Evidence

- `npm install --package-lock-only --ignore-scripts` passed.
- `npm install --cache /private/tmp/autoquiz-npm-cache --logs-dir /private/tmp/autoquiz-npm-logs` passed after network approval.
- `npm run lint` passed. It prints a stale `baseline-browser-mapping` advisory.
- `npm run ai:health` passed and returned `{"status": "ok"}`.
- `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npm run build` passed after network approval for Google Fonts.
