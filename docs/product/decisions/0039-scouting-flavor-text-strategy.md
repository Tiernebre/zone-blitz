# 0039 — Scouting flavor text generation strategy

- **Date:** 2026-04-16
- **Status:** Proposed
- **Area:** [Scouting](../north-star/scouting.md),
  [Media](../north-star/media.md),
  [0034 — Genesis draft scouting phase](./0034-genesis-draft-scouting-phase.md),
  [0035 — Scouting advocacy and dissent event model](./0035-scouting-advocacy-dissent-event-model.md)

## Context

ADR 0034 acknowledges that flavor text — the prose in scouting reports, advocacy
lines, dissent quotes, media mock blurbs, and the director's consensus
commentary — is essential to the phase's feel but leaves generation strategy to
a follow-up ADR. ADR 0035's event payloads have a designated slot for rendered
text; without a generation strategy, every event type invents its own ad-hoc
string construction and the scouting phase reads like a spreadsheet dump.

MVP cannot ship with an LLM dependency: cost, latency, and determinism concerns
conflict directly with the sim calibration harness (ADR 0021), which requires
seeded runs to produce identical output. But a templated- only strategy for the
lifetime of the product would lock us out of qualitative improvements that LLMs
are well-suited for, so the schema has to make swapping in an LLM a bounded
change rather than a rewrite.

## Decision

Ship MVP with deterministic, author-written templates. Structure the generation
pipeline so that the LLM swap is a single DI change at the feature-wiring layer,
without touching event payloads, consumers, or the calibration harness.

### Template catalog

A `flavor_text_templates` table (or bundled JSON, TBD at implementation time)
with columns:

- `event_kind` — one of the kinds from ADR 0035 (`report_published`, `advocacy`,
  `dissent`, `cross_check_resolved`, `media_mock_published`,
  `director_consensus_update`).
- `scout_personality_tag` — `confident`, `hedger`, `contrarian`, `measured`
  (drawn from the scout's hidden personality attribute).
- `prospect_archetype_tag` — `freak_athlete`, `polished_technician`,
  `character_risk`, `small_school_prospect`, `injury_concern`, `late_bloomer`,
  etc.
- `template_id` — deterministic primary key.
- `body` — handlebars-style text with placeholders: `{{prospect.first_name}}`,
  `{{prospect.position}}`, `{{scout.last_name}}`, `{{grade}}`,
  `{{strength_trait}}`, `{{concern_trait}}`, etc.

Target volume for MVP: roughly 30 templates per event kind, split across the
personality × archetype combinations so that the same scout grading two
different archetypes produces visibly distinct text, and two scouts with
different personalities grading the same prospect sound different.

### The resolver

A `FlavorTextResolver` factory function (per the service-naming convention)
takes a scout, a prospect, an event kind, and a structured context and returns a
rendered string plus the `template_id` that produced it. Two implementations:

1. **`TemplateResolver`** (MVP): filters templates by `event_kind`,
   `scout_personality_tag`, and `prospect_archetype_tag`; picks one using a
   seeded RNG scoped to the event; substitutes placeholders.
2. **`LlmResolver`** (future): treats matched templates as few-shot examples;
   sends the structured context to an LLM; caches output keyed by
   `(event_id, template_set_version)` so re-renders are deterministic within a
   session.

Feature wiring selects the resolver via dependency injection at the
scouting-feature factory. Every consumer takes the resolver interface, not an
implementation.

### Structured context retained on the event

Event payloads (from ADR 0035) carry **both** the rendered string and the
structured substitution context (scout attributes at emission time, prospect
archetype tags, grade vectors). Retaining the context means:

- Templates can be edited post-hoc and events re-rendered.
- An LLM swap can re-generate historical flavor text from structured context
  without needing to preserve the original template output.
- Tests can assert structured fields independently of text quality.

The rendered string lives in the payload because it participates in the
historical record — the decision log (ADR 0037) references events, and those
events need stable text for review years later.

### Determinism

The `TemplateResolver` uses a seeded RNG derived from `(league_id,
event_id)` so
the same event always produces the same text within a league run. This is what
lets the calibration harness assert on text- bearing events without flakiness.
The `LlmResolver`, when introduced, achieves determinism through caching on
`event_id`.

### Template authoring workflow

Templates live in `packages/scouting/flavor/templates/` as JSON or handlebars
files checked into the repo. Authors iterate without a code deploy — the
template bundle is loaded at service startup. A simple linter validates
placeholder usage against the declared context schema.

## Alternatives considered

- **LLM from day one.** Use an LLM for all flavor text generation in MVP.
  Rejected: per-event latency + cost makes the calibration harness impractical;
  determinism requires per-event caching which we can defer; template-first lets
  us ship and iterate without API spend.
- **Hardcoded strings at each emission site.** Build the text inline in the
  event emitter for each event kind. Rejected: no iteration path for writers, no
  localization hook, no LLM swap path, and the emission sites become
  string-building factories instead of event-logic functions.
- **Render flavor text lazily in the UI.** Generate text on read instead of at
  emission. Rejected: decision-log history (ADR 0037) references events and
  needs stable text; lazy rendering means historical entries can drift as
  templates evolve, which breaks retrospective review.
- **Structured text-object payload (no rendered string at all).** Events carry
  only structured fields; every consumer renders on its own. Rejected:
  duplicates rendering logic across inbox, decision log, and retrospective
  tools; introduces inconsistency; breaks the "what did my scout actually say?"
  record.

## Consequences

- **MVP ships without an LLM.** Cost, latency, and determinism are bounded
  problems we don't solve yet.
- **LLM swap is a scoped ADR in its own right when we're ready.** The swap is a
  DI change; event shape, consumer code, and the calibration harness are
  untouched.
- **Writers have an iteration loop independent of engineering.** Template edits
  are data changes; no code deploys required, no event re-emission required.
- **Template quality is a soft goal.** Shipping with ~30 templates per kind is
  enough for the MVP to feel varied; the catalog will grow over time as writers
  identify gaps from real playthroughs.
- **Event payloads are larger.** Retaining structured context on every event has
  a storage cost; acceptable given the historical-record role the event log
  plays and the small volume of scouting events per league-year.
- **Follow-up work:**
  - Implement `FlavorTextResolver` factory + `TemplateResolver`.
  - Author initial template bundle covering all six event kinds × core
    personality/archetype combinations.
  - Add placeholder linter to catch missing context fields at build time.
  - Extend ADR 0035 event payloads with a `flavor_context` column alongside the
    rendered `body`.

## Related decisions

- [0021 — Sim calibration harness](./0021-sim-calibration-harness.md)
- [0034 — Genesis draft scouting phase](./0034-genesis-draft-scouting-phase.md)
- [0035 — Scouting advocacy and dissent event model](./0035-scouting-advocacy-dissent-event-model.md)
- [0037 — Draft board data model](./0037-draft-board-data-model.md)
