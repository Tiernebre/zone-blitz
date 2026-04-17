# Calibration Gaps — League-Building Data Index

An index of the **real-NFL data insights** the Zone Blitz sim still needs in
order to feel like a credible league, not just a credible game of football. Each
entry points at a planned band artifact (`data/bands/*.json`) or a research doc
(`data/docs/*.md`), and the open GitHub issue tracking the work.

The existing [`data/README.md`](../README.md#bands-currently-produced) covers
the **in-game** calibration (play-by-play realism). This index covers the
**meta-game**: how players enter the league, how they're paid, how they move
between teams, how careers end, and how coaching staffs churn. These are the
inputs that decide whether a league feels _alive between games_.

## Organizing principle

The sim has three layers of calibration targets:

1. **Play-level realism** — one snap at a time. Mostly done (`passing-plays`,
   `rushing-plays`, `special-teams`, `situational`).
2. **Game-level realism** — drive and game flow, personnel usage, game script.
   Partially done (`team-game`). Gaps listed below in the **Game Flow** group.
3. **Season / career realism** — who's on rosters, who gets paid, who gets
   drafted, who retires, who gets fired. Entirely missing. Gaps listed below in
   the **Market & Career** group.

## Market & Career (the league-building layer)

| # | Gap                                                                                                                                                    | Primary source                                          | Issue       |
| - | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ----------- |
| 1 | Position market sizing (roster slots, starter counts, snap-share thresholds per position)                                                              | `nflreadr::load_rosters_weekly()`, `load_snap_counts()` | #510        |
| 2 | Draft position distribution (positions picked per round, last 10 drafts)                                                                               | `nflreadr::load_draft_picks()`                          | #511        |
| 3 | Draft pick trade-value (observed vs Jimmy Johnson / Rich Hill curves)                                                                                  | `load_draft_picks()` + trade scrape                     | #512        |
| 4 | Draft hit-rate bands — `P(multi-year starter \| round, position)`                                                                                      | `load_draft_picks()` + career snaps                     | #513        |
| 5 | Free agent market (UFAs signed per offseason by position, AAV bands) — [band](../bands/free-agent-market.json) + [doc](./free-agent-market.md)         | `nflreadr::load_contracts()`                            | #514 (done) |
| 6 | Contract structure (length, guarantee %, cap-hit shape by position × tier) — [band](../bands/contract-structure.json) + [doc](./contract-structure.md) | `load_contracts()` + OTC cross-check                    | #515 (done) |
| 7 | Career length + aging curves — `P(active \| age, position)`, peak years                                                                                | `load_rosters()` longitudinal                           | #516        |
| 8 | Coaching tenure + firing patterns (HC tenure distribution, W-L triggers, coordinator → HC rates)                                                       | Manual scrape (PFR head-coach history)                  | #517        |

These directly serve the user-named asks:

- **Position markets** — #1, #2, #7.
- **Draft pick economy** — #2, #3, #4.
- **Roster movement / contracts** — #5, #6, #8.

## Game Flow (the situational-realism layer)

| #  | Gap                                                                               | Primary source         | Issue |
| -- | --------------------------------------------------------------------------------- | ---------------------- | ----- |
| 9  | Play-call tendencies by situation (pass/run by D&D, score diff, time, field zone) | `nflreadr::load_pbp()` | #518  |
| 10 | Red-zone + 3rd-down efficiency (play-call mix + conversion rates)                 | `load_pbp()`           | #519  |

## Future consideration (not yet issue-filed)

Promising but lower-priority, or requiring non-nflfastR sources:

- **Game script / win-probability behavior** — how pass rate shifts with WP and
  score differential. Needed for end-game realism. `load_pbp()` has `wp`.
- **Home field advantage + weather/dome splits** — point spread and scoring
  deltas. Needed for schedule-level realism.
- **Injury return timelines by injury category** — already have injury rates
  (`injuries.json`); the return-timeline distribution is the next slice.
- **Player development curves** — rookie Y1 → Y2 → Y3 stat jumps by position.
  Powers the "breakout season" sim beat.
- **Snap-share rotations** — starter vs committee (RB1/RB2 carry share is
  covered; WR3/TE2/nickel CB rotations are not).
- **Big Data Bowl — coverage shell (man vs zone) usage rates** — needs the
  `bigdatabowl` skill. Feeds NPC defensive-coordinator AI.
- **Big Data Bowl — formation / personnel frequency (11/12/21, shotgun)** —
  feeds offensive play-selection realism.
- **Penalty distributions by position × situation** — extends `team-game`
  penalty mean.

## How to fill a gap

Each filed issue produces one or both of:

- **A band artifact** under `data/bands/*.json` — if the insight is a
  distribution the sim can assert against.
- **A research doc** under `data/docs/*.md` — if the insight is a qualitative
  reference (like
  [`nfl-talent-distribution-by-position.md`](./nfl-talent-distribution-by-position.md)).

Most Market & Career gaps need **both**: a doc to document tiers and narrative,
and a band if the numbers are tight enough to assert.

Use the `nflfastr` skill for nflverse-reachable data and the `bigdatabowl` skill
for player-tracking-specific questions. Every band script follows the pattern in
[`data/R/bands/`](../R/bands/) — `parse_seasons()` + `write_band()` helpers live
in [`data/R/lib.R`](../R/lib.R).
