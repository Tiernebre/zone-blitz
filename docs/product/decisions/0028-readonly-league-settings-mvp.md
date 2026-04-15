# 0028 — Readonly league settings in MVP creation wizard

- **Date:** 2026-04-15
- **Status:** Accepted
- **Area:** [League Genesis](../north-star/league-genesis.md),
  [League Management](../north-star/league-management.md)

## Context

ADR 0027 establishes the MVP creation wizard as a four-step flow. Step 2 is a
"league settings" screen. The north-star doc describes several
founder-configurable knobs — founding franchise count, schedule length,
conference/division structure, rules package (cap, roster limits, draft rounds).
Building real editors for each of those is a significant design and validation
project, and picking defaults that work well for the MVP would be undermined if
we also let the founder override them before we've validated the defaults in
play.

We still want the founder to _see_ what they're agreeing to. Hiding settings
entirely would make the league feel arbitrary ("why is my schedule 10 games?")
and leave the founder guessing at what the product has decided on their behalf.

## Decision

**The MVP league settings screen displays every relevant league setting as a
disabled form input prefilled with its default value. No setting is editable in
v1.** The screen is a preview, not a configurator. Settings shown include — but
are not limited to — founding franchise count, regular-season schedule length,
conference/division structure, roster limits, salary cap figures, and draft
rounds.

The founder advances past this screen with a single "Continue" action. There is
no per-field save; the settings are locked in at league-creation time from the
current MVP defaults.

## Alternatives considered

- **Hide the settings screen entirely.** Simpler, but leaves the founder without
  any sense of what league they're creating. The 10-game schedule or the
  two-division structure is going to surface eventually; better to surface it at
  creation time.
- **Show settings as static text (no inputs).** Lower implementation effort than
  disabled inputs. Rejected because disabled inputs telegraph "this will be
  editable later" to the founder without any extra copy, which is exactly the
  roadmap we expect. Using real form controls now also means the screen becomes
  editable by flipping a `disabled` flag later, not by rebuilding the screen.
- **Make one or two settings editable (e.g., league name is editable, everything
  else is readonly).** League name is its own step (ADR 0027 step 1), so it
  doesn't belong on this screen. For everything else, partial editability
  creates an awkward "why can I change this but not that" question. All-readonly
  is cleaner.
- **Let the founder pick from a small set of presets (short/medium/long season,
  small/medium cap, etc.) rather than editing raw values.** A reasonable future
  direction, but still more design than the MVP needs. Deferred.

## Consequences

- **Makes easier:** shipping step 2 of the wizard. It's a static form with a
  Continue button; there is no validation, no cross-field logic, no write path.
- **Makes easier:** changing the defaults before first public release. Because
  no founder can override them, tuning the defaults in code propagates cleanly
  to every new league without data-migration concerns.
- **Makes easier:** future editability. Each disabled input is already wired to
  a real setting value, so enabling a setting becomes a matter of removing
  `disabled`, writing a validation rule, and persisting the edit.
- **Makes harder:** users who want to configure their league at creation time.
  They cannot, until a follow-up ADR opens specific settings for edit. This is
  an intentional MVP constraint, not a permanent one.
- **Follow-up work:** once the MVP has shipped and defaults are validated by
  real play, open follow-up ADRs to progressively enable individual settings for
  edit. Schedule length and cap figures are the most likely first candidates
  because they're the most tangible at creation time. Founding franchise count
  is _not_ on that list for the MVP — see ADR 0029.
