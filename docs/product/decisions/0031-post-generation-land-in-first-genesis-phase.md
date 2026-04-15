# 0031 — Post-generation landing on the first in-dashboard genesis phase

- **Date:** 2026-04-15
- **Status:** Accepted
- **Area:** [League Genesis](../north-star/league-genesis.md),
  [0014 — Season calendar and phase state machine](./0014-season-calendar-phase-state-machine.md),
  [0018 — Genesis phase state machine](./0018-genesis-phase-state-machine.md),
  [0020 — Phase-gated sidebar navigation](./0020-phase-gated-sidebar-navigation.md)

## Context

ADR 0027 defines the MVP wizard as ending with generation and a redirect to the
dashboard. ADR 0018 defines the genesis phase state machine as a linear sequence
of phases owned by the `league_clock` row, starting with `GENESIS_CHARTER` and
ending with `GENESIS_KICKOFF → PRESEASON`.

The MVP wizard itself completes the work that would have lived in
`GENESIS_CHARTER` (league name, settings) and a slice of
`GENESIS_FRANCHISE_ESTABLISHMENT` (the founder's team claim, plus auto-
assignment of the other seven NPC franchises). When generation finishes, some
early phases are already substantively done and subsequent phases — staff
hiring, allocation draft, free agency, kickoff — still need to happen inside the
dashboard against the phase state machine and phase-gated navigation (ADR 0020).

The question is: after the redirect, what phase is the `league_clock` in, and
what does the dashboard show?

## Decision

**When generation completes, the server persists the league with its
`league_clock` positioned on the first in-dashboard genesis phase — the earliest
phase whose work has not been completed by the wizard — and the client redirects
the founder directly into the dashboard view for that phase.** There is no
summary screen, no "League created!" confirmation page, and no intermediate
dashboard home state. The founder lands inside the phase state machine already
in motion.

Concretely, the wizard's first three steps plus generation cover league charter
and the auto-establishment of franchises; the founder arrives in the dashboard
at the next phase in ADR 0018's sequence (staff hiring under the current
sequencing). If ADR 0018's sequence changes, this ADR's landing-phase follows it
— the rule is "first phase whose work is not already complete," not a hardcoded
phase name.

Phase-gated sidebar navigation (ADR 0020) applies from the first dashboard
render: the founder sees only the nav entries that are valid for the current
phase, which keeps the first view focused on what genesis needs next rather than
on the mature-league surface.

## Alternatives considered

- **Land on a "league created" confirmation / summary screen.** Gives the
  founder a moment to review what was generated. Rejected because the wizard
  already represents that moment (team select, settings preview, a named
  generation step) and a standalone confirmation is filler. If we want a
  league-summary view it should be a real dashboard page, not a one-shot screen.
- **Land on a generic dashboard home with the phase state as a sidebar
  concern.** The classic "here's everything" landing. Rejected because in the
  genesis period most of "everything" is empty or pre-state; showing it invites
  confusion. ADR 0020's phase-gated nav is the right answer and landing straight
  into the active phase is consistent with it.
- **Start the league in `GENESIS_CHARTER` even though the wizard already did
  that work, and let the founder advance through it.** Honest about the state
  machine but wastes the founder's time replaying decisions they just made. The
  work being done counts as the phase being done.
- **Skip all genesis phases and land the founder in preseason/Week 1.** The
  other extreme — treats generation as "the league is fully founded." This
  collapses the entire founder journey (staff hiring, allocation draft, founding
  free agency) and directly contradicts the north-star. The MVP defers the
  _richness_ of those phases, not their existence.

## Consequences

- **Makes easier:** routing. One redirect target — `/league/:id/dashboard` —
  whose content is driven by the current phase. No branch on a post-creation
  summary view.
- **Makes easier:** reasoning about the `league_clock` as the single source of
  truth for "where is this league." The wizard writes it once at generation time
  and the dashboard reads it from then on.
- **Makes easier:** future changes to which wizard steps do which phase's work.
  If we later move staff hiring into the wizard, the starting phase shifts
  forward; if we pull something out, it shifts back. The rule — "earliest
  incomplete phase" — absorbs that without a code-path rewrite.
- **Makes harder:** onboarding copy. Because there's no confirmation screen, the
  dashboard's first-render copy has to orient a founder who just arrived. This
  work lives in the phase UI itself, which is where it belongs.
- **Follow-up work:**
  - Wire the wizard's generation endpoint to set the `league_clock` to the
    correct starting phase per ADR 0018's current sequence
  - Verify phase-gated nav (ADR 0020) renders sensibly for a founder on their
    very first dashboard render — this is the one render where _every_ piece of
    UI is seeing the league for the first time
  - Revisit this ADR if ADR 0018's phase sequence is reordered; the
    landing-phase rule remains the same but the concrete phase name will change
