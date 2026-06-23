# Harness Backlog

Use this file when an agent discovers a missing harness capability but should
not change the operating model immediately.

## Template

```md
## Missing Harness Capability

### Title

Short name.

### Discovered While

Task or story that exposed the gap.

### Current Pain

What was hard, repeated, ambiguous, or unsafe?

### Suggested Improvement

What should be added or changed?

### Risk

Tiny, normal, or high-risk.

CLI value: `--risk tiny`, `--risk normal`, or `--risk high-risk`.

### Status

proposed | accepted | implemented | rejected
```

## Items

No backlog items yet.

Last checked: 2026-06-23 with:

```bash
scripts/bin/harness-cli query backlog --open
```

The durable backlog table is empty. Current trace friction is tracked in traces
instead:

- Live Supabase integration proof is blocked until service-role credentials are
  available.
- Network-restricted validation requires escalation for npm registry, Vercel,
  GitHub, and Google Fonts.
