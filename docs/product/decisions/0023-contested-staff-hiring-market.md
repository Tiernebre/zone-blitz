# 0023 — Contested staff hiring market

- **Date:** 2026-04-15
- **Status:** Accepted
- **Area:** [Coaches](../north-star/coaches.md),
  [League Genesis](../north-star/league-genesis.md)

## Context

League genesis includes a staff-hiring phase (Phase 3) where every franchise
hires coaches and scouts from a single shared candidate pool. The north-star
docs ([league-genesis.md](../north-star/league-genesis.md) Phase 3,
[coaches.md](../north-star/coaches.md) League Genesis section) describe this as
a competitive market — candidates have preferences, franchises compete in
parallel, and the best hires are contested — but no ADR formalizes how candidate
preferences, multi-franchise bidding, and resolution order actually work.

## Decision

Staff hires during genesis (and the annual coaching carousel thereafter) are
resolved via a **preference-driven contested market**:

1. **Shared candidate pool.** A single pool of coaches and scouts is generated
   for the league. Every franchise — human and NPC — hires from the same pool
   simultaneously.

2. **Candidate preferences.** Each candidate carries an explicit preference
   function over franchise attributes:
   - **Market tier** — some candidates prefer large-market visibility; others
     value small-market stability.
   - **Philosophy fit** — candidates favor franchises whose declared build
     philosophy aligns with their own scheme and coaching style.
   - **Existing-staff fit** — a coordinator candidate may prefer a franchise
     that already hired a head coach whose system complements theirs.
   - **Compensation** — salary and incentive package weight varies by candidate
     personality (some chase money, others chase fit).

3. **Parallel bidding.** All franchises submit offers during the same hiring
   window. There is no fixed pick order — every franchise can pursue any
   candidate at any time.

4. **Candidate-side resolution.** When multiple franchises offer the same
   candidate, the candidate chooses based on their preference function. The
   franchise that best matches the candidate's weighted preferences wins the
   hire. Ties are broken by compensation, then randomly.

5. **Candidates can refuse.** A candidate may decline all offers if no franchise
   clears a minimum preference threshold, remaining in the pool for later rounds
   or going unhired entirely.

6. **Iterative rounds.** Hiring proceeds in rounds. Each round, franchises
   submit offers, candidates resolve, and results are revealed. Unhired
   candidates and unfilled positions carry into the next round until all
   franchises have filled mandatory staff slots or the pool is exhausted.

## Alternatives considered

- **Round-robin (snake-draft) hiring** — franchises pick staff in a fixed order,
  one at a time. Simple to implement, but eliminates the competitive tension the
  north-star docs describe. Candidates become passive assets rather than agents
  with preferences. Rejected because it contradicts the design goal of
  candidates making real choices about where to sign.

- **Auction-style explicit bidding** — franchises place monetary bids and the
  highest bid wins, regardless of candidate preference. Reduces hiring to a pure
  spending game and removes the non-monetary preference dimensions (philosophy,
  market, staff fit) that make the system interesting. A big-market franchise
  could simply outspend everyone. Rejected because it flattens the decision
  space and undermines the narrative of candidates choosing destinations.

- **Fully random assignment** — candidates are distributed to franchises by
  lottery. No competition, no preferences, no agency. Rejected because it
  eliminates player decision-making entirely and produces no interesting
  stories.

## Consequences

- **NPC hiring AI must reason about competing bids.** Each NPC owner/GM needs
  logic to evaluate candidates against its philosophy, budget, and existing
  staff, then submit offers that balance fit and cost. This is more complex than
  a simple draft-pick AI but produces richer NPC behavior.

- **Multiplayer genesis requires real-time bidding mechanics.** Human franchises
  bidding against each other for the same head coach need a UI that supports
  simultaneous offers, round resolution, and result reveals within the hiring
  window.

- **Candidates can refuse offers.** The system must handle the case where a
  candidate declines all suitors, which means franchises need fallback
  strategies and the pool must support multiple hiring rounds.

- **Preference weights create emergent market dynamics.** A franchise with a
  strong philosophy match but modest compensation can beat a richer franchise if
  the candidate weights fit over money. This rewards thoughtful franchise
  building during Phase 2 (identity and philosophy declaration) because those
  choices now directly affect hiring outcomes.

- **Staff hiring outcomes shape the allocation draft.** Because coaches and
  scouts are hired before the player draft, the contested market's results
  cascade into scouting report quality, scheme-fit evaluations, and NPC draft
  strategy for Phase 5.
