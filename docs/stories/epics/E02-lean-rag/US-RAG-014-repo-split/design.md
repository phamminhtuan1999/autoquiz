# Design

## Domain Model

No product domain model changes in this story.

## Application Flow

No user-facing flow changes in this story.

Developer flows after the split:

- `npm run dev` starts the web app from `apps/web`.
- `npm run build` builds the web app from `apps/web`.
- `npm run lint` lints the web app from `apps/web`.
- `npm run ai:dev` starts the FastAPI scaffold from `apps/ai`.
- `npm run ai:health` imports the AI app and returns the health payload.

## Interface Contract

AI scaffold:

- `GET /health`
- Response: `{ "status": "ok" }`

Root script compatibility:

- Existing web scripts remain available at the root and delegate to
  `@autoquiz/web`.

## Data Model

No database changes.

## UI / Platform Impact

- Web source moves from `src` to `apps/web/src`.
- Web public assets move from `public` to `apps/web/public`.
- Web config files move to `apps/web`.
- Future Vercel deployment should use `apps/web` as the project root.
- Future Railway/Render deployment should use `apps/ai` as the service root.

## Observability

No runtime observability changes. The AI health endpoint provides a minimal
platform smoke target for later deployment checks.

## Alternatives Considered

1. Keep Next.js at repository root and add only `apps/ai`. Rejected by decision
   `0010`.
2. Implement the AI backend fully during the split. Rejected: that belongs to
   later RAG stories and would mix structural work with provider/job behavior.
