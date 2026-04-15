# 0025 — Expansion by ownership vote

- **Date:** 2026-04-15
- **Status:** Accepted
- **Area:** [League Genesis](../north-star/league-genesis.md),
  [League Management](../north-star/league-management.md),
  [NPC AI](../north-star/npc-ai.md)

## Context

League genesis founds a league at a small scale (8 teams by default) with the
explicit expectation that the league grows via expansion over many seasons. The
north-star docs
([league-genesis.md — Expansion Over Time](../north-star/league-genesis.md#expansion-over-time),
[league-management.md — Expansion](../north-star/league-management.md#expansion))
describe expansion as a league-level event triggered by an ownership vote with
one franchise, one vote, and
[npc-ai.md — League Genesis](../north-star/npc-ai.md#league-genesis) describes
NPC personas voting according to personality and self-interest. No ADR
formalizes the vote mechanics, proposal lifecycle, or what happens when a vote
fails.

## Decision

Expansion happens through a **league-wide ownership vote** with the following
mechanics:

1. **Proposal origination.** Any owner/GM — human or NPC — may propose expansion
   during the offseason window between championship and free agency. A proposal
   specifies a target franchise count (e.g., "expand from 8 to 10") and is
   presented to the full ownership group for a vote. Only one expansion proposal
   may be active per offseason.

2. **One franchise, one vote.** Every franchise in the league casts exactly one
   vote — for or against. Human-run franchises vote through the UI; NPC
   franchises vote through their AI persona. There are no abstentions; every
   franchise must vote.

3. **Simple majority.** A proposal passes if more than half of the franchises
   vote in favor. For an 8-team league, that means 5 or more votes to expand.
   The threshold is a simple majority by default but is configurable at league
   creation (e.g., a commissioner could require a supermajority).

4. **NPC vote reasoning.** Each NPC persona evaluates the proposal through its
   personality model:
   - **Small-market / conservative** personas lean against — they fear talent
     dilution, increased competition for free agents, and loss of structural
     advantages in a compact league.
   - **Ambitious / win-now** personas lean in favor — they welcome a larger
     stage, more media attention, and the possibility of new markets creating
     new rivalries.
   - **Recently successful** personas may vote against to lock in competitive
     advantages before new franchises can catch up.
   - **Rebuilding / long-horizon** personas may vote in favor, seeing
     expansion-draft-exposed veterans as a low-cost roster churn opportunity and
     new franchises as weaker near-term opponents.

   NPC vote reasoning is surfaced to the player through media coverage and
   post-vote commentary, making the political landscape legible.

5. **Failed-proposal cooldown.** When a proposal fails, no new expansion
   proposal may be tabled for a configurable number of seasons (default: 2).
   This prevents vote spam and gives the league time to evolve before the
   question resurfaces. The cooldown is a league setting adjustable at creation.

6. **Successful expansion triggers the expansion cycle.** A passed vote
   initiates the full expansion sequence documented in
   [league-genesis.md — Expansion Over Time](../north-star/league-genesis.md#expansion-over-time):
   new franchise establishment, expansion draft, rookie-draft adjustments, and
   schedule/division realignment — all resolved between seasons.

## Alternatives considered

- **Commissioner-only expansion** — the commissioner (or single-player founder)
  unilaterally decides when to expand, bypassing the ownership group entirely.
  Rejected because it removes the political layer that makes expansion
  interesting. The north-star docs explicitly frame expansion as a collective
  decision, and a commissioner override contradicts the fused owner/GM model
  where every franchise has equal standing in league governance.

- **Automatic expansion triggered by league health metrics** — the league
  expands automatically when financial or competitive benchmarks are met (e.g.,
  average franchise revenue exceeds a threshold for N consecutive seasons).
  Rejected because it turns expansion into a passive event the player watches
  happen rather than a decision they participate in. Expansion should feel like
  a political moment, not a progress bar.

- **Supermajority requirement (two-thirds or three-quarters)** — raising the
  threshold makes expansion harder to pass, which could stall league growth for
  too long in small leagues where a single dissenting vote blocks progress.
  Rejected as the default, but preserved as a configurable option for
  commissioners who want a higher bar.

- **Market-driven expansion with no vote** — new franchises appear when enough
  viable markets exist and demand is high, with no ownership input. Rejected
  because it strips agency from the owners entirely. Expansion without consent
  undermines the cooperative-governance model and removes the coalition-building
  meta-game that makes multiplayer expansion compelling.

## Consequences

- **NPC AI needs expansion-vote reasoning tied to personality.** Each NPC
  persona must evaluate expansion proposals against its personality axes (risk
  tolerance, time horizon, market position) and cast a vote that follows
  logically from its situation. This is new AI logic but fits naturally into the
  existing personality-driven decision framework described in
  [npc-ai.md](../north-star/npc-ai.md).

- **Expansion becomes a multiplayer meta-game of coalition-building.** In
  multiplayer leagues, human owners can lobby each other and NPC owners before a
  vote. Proposing expansion at the right moment — when enough owners are
  receptive — becomes a strategic skill. This adds a governance layer on top of
  the football-operations game.

- **League growth is bounded by voter willingness at each step.** The league
  cannot grow faster than its owners collectively allow. A conservative
  ownership group may keep the league at 8 teams for a decade; an ambitious one
  may reach 16 within five seasons. This variance is a feature — it means every
  league's growth arc is unique and player-driven.

- **The cooldown mechanic prevents vote fatigue.** Without a cooldown, an eager
  owner could re-propose expansion every offseason until it passes by attrition.
  The configurable cooldown (default 2 seasons) ensures failed proposals have
  weight and that the league narrative moves on between attempts.

- **Media and UI must surface the vote.** Expansion proposals, NPC vote
  reasoning, vote results, and cooldown status all need to be visible to the
  player through media coverage and league management screens. The vote is a
  first-class league event, not a background toggle.
