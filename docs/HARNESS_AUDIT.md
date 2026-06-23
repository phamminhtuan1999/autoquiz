# Harness Audit

`scripts/bin/harness-cli audit` detects drift in durable Harness state and
prints an entropy score. Lower is better.

## Checks

| Category | Meaning | Weight |
| --- | --- | --- |
| Orphaned stories | Planned or in-progress stories with no linked trace. | 10 |
| Unverified stories | Stories with `verify_command` but no recorded verification result. | 5 |
| Unverified decisions | Decisions with `verify_command` but no recorded verification result. | 5 |
| Open backlog without outcomes | Implemented backlog items with predicted impact but no actual outcome. | 2 |
| Stale stories | Unimplemented stories whose latest linked trace is more than 30 days old. | 3 |
| Broken tools | Registered tools whose command is not found on disk or `PATH`. | 8 |

## Score

```text
score = orphaned_stories * 10
      + unverified_stories * 5
      + unverified_decisions * 5
      + backlog_without_outcomes * 2
      + stale_stories * 3
      + broken_tools * 8
```

The score is capped at 100.

| Range | Interpretation |
| --- | --- |
| 0 | Perfect: records are traced, verified, and healthy. |
| 1-25 | Healthy: minor housekeeping remains. |
| 26-50 | Attention needed: drift is accumulating. |
| 51-100 | Action required: stale state undermines Harness value. |

Audit findings feed `scripts/bin/harness-cli propose`, which can turn repeated
drift into proposed backlog items.

## Current Snapshot

Last checked: 2026-06-23.

Command:

```bash
scripts/bin/harness-cli audit
```

Result:

- Orphaned stories: 11.
- Unverified stories: 0.
- Unverified decisions: 0.
- Open backlog without outcomes: 0.
- Stale stories: 0.
- Broken tools: 0.
- Entropy score: 100/100.

The 11 orphaned stories are planned Lean RAG stories that have not started yet:
`US-RAG-001` and `US-RAG-004` through `US-RAG-013`. This is expected planning
state rather than implemented-work drift.

Trace note:

- Trace `#6` is a duplicate standard trace for `US-RAG-003` created before the
  high-risk trace had complete metadata.
- Trace `#7` is the detailed trace linked to intake `#2` and meets the
  high-risk trace requirement.
