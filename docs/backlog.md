# Backlog

Lightweight list of follow-ups and small ideas we don't want to forget. Promote
an entry to a GitHub issue or a full document under `docs/incidents/` (or a
future `docs/action-items/`) once it grows past a one-liner.

Format: one bullet per item. Add a date and a short context line. Remove the
entry when it's resolved or superseded.

## Open

- **2026-04-13 — Finer-grained league phase sub-states.** The `season.phase`
  enum only tracks `preseason | regular_season | playoffs | offseason`. Product
  docs (`docs/product/league-management.md`) describe sub-steps during the
  offseason (cut-down, draft, free agency, waiver periods). Decide whether to
  expand the enum, add a separate `offseasonStage` field, or model these as
  scheduled events. Surfaced while adding a league status column to the home
  page — today we can only show "Offseason" rather than "Drafting" or "Free
  Agency".
