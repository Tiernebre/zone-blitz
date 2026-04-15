# 0022 — Fused owner/GM role as canonical

- **Date:** 2026-04-15
- **Status:** Accepted
- **Area:** [League Genesis](../north-star/league-genesis.md),
  [NPC AI](../north-star/npc-ai.md),
  [Teams & Branding](../north-star/teams-and-branding.md)

## Context

Zone Blitz franchises are operated by a single person who is both the owner and
the GM. This fused role has been the working model since the project's inception
and is documented across multiple north-star docs:
[League Genesis](../north-star/league-genesis.md) ("You are the owner _and_ the
GM"), [Teams & Branding](../north-star/teams-and-branding.md) (market pressure
targets the fused operator), [NPC AI](../north-star/npc-ai.md) (one AI persona
per franchise), [Media](../north-star/media.md) (accountability comes from fans
and peers, not an employer), and [Coaches](../north-star/coaches.md) (the head
coach answers to the owner/GM).

The design intent is clear across these docs, but no dated ADR ratifies this as
a formal product decision. Without one, future contributors may reasonably
propose re-introducing a separate owner layer — the model most franchise sims
use — not realizing the fused role is deliberate, not a simplification waiting
to be unwound. The deprecation of the standalone `owners.md` north-star doc (PR
#233) further motivates recording this decision explicitly.

## Decision

**Every franchise in a Zone Blitz league is run by a single fused owner/GM
operator — for both human-run and NPC franchises, for the life of the league.**

The person who owns the franchise is the same person who makes football
operations decisions: roster moves, draft picks, coaching hires, cap management,
trades, relocation proposals, and expansion votes. There is no separate "owner"
entity sitting above the GM, and no plan to introduce one as the league matures.

This applies universally:

- **Human franchises**: the player is the owner/GM. No simulated boss above
  them.
- **NPC franchises**: a single AI persona handles both ownership-level decisions
  (identity, expansion votes, non-cap spending) and football operations (roster,
  draft, trades, coaching).
- **Expansion franchises**: new franchises added via expansion follow the same
  fused model. There is no point in league history where a separate owner layer
  emerges.

## Alternatives considered

- **Separate opaque-owner layer (the classic franchise-sim model).** Most
  franchise sims place the player in a GM role beneath an AI owner who sets
  budgets, imposes win-now mandates, and can fire the player. Rejected because
  it conflicts with Zone Blitz's scrappy start-up identity — a new league
  doesn't have absentee billionaire owners — and because it introduces an "owner
  patience" mechanic that replaces player agency with an artificial countdown
  timer. The pressure in Zone Blitz comes from fans, media, league peers, and
  expansion votes, not from an employer.

- **Owner/GM split re-emerging as the league matures.** A variant where the
  fused role is a genesis-era simplification that evolves into a separated model
  once the league reaches a certain size or age. Rejected because it would
  require every downstream system to support two operating models (fused and
  split), doubling the design surface for NPC AI, media, coaching dynamics, and
  expansion voting. It would also retroactively reframe the founding experience
  as temporary rather than canonical, undermining the identity players built
  during genesis.

## Consequences

- **NPC AI modeling**: each NPC franchise needs only one AI persona, not a
  separate owner persona and GM persona. Personality, risk tolerance, and
  decision-making style are unified in a single agent. This simplifies the AI
  architecture and makes NPC behavior more legible to the player.
- **No "owner patience" mechanic**: there is no hidden timer counting down to
  the player being fired. Stakes come from fan sentiment, media pressure, peer
  reputation among other owner/GMs, and expansion-vote dynamics. This shifts
  accountability from a single opaque authority to a distributed set of visible
  pressures.
- **Relocation and expansion votes**: these are owner-level decisions made by
  the same people running football operations. Every owner/GM votes with full
  awareness of the competitive implications — a vote to expand means your roster
  will be exposed to an expansion draft. This creates richer strategic tension
  than a model where an abstract owner votes independently of the GM's football
  concerns.
- **Media and accountability**: media pressure targets the fused operator
  directly. There is no "will the owner fire the GM?" storyline — instead, media
  tracks whether the owner/GM is losing the fanbase, whether peer owner/GMs
  respect their management, and whether the franchise's trajectory justifies its
  market position.
- **Follow-up work**: none required. The north-star docs already reflect this
  model, and the standalone `owners.md` was deprecated in PR #233. This ADR
  formalizes what is already in place.
