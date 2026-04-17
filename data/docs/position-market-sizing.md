# Position Market Sizing

A working reference for how many players of each position the NFL carries —
roster-slot counts per team, meaningful contributors per team-season, and
league-wide population per position. Feeds the Zone Blitz player-generator so QB
scarcity and OL abundance are reproduced correctly.

Numbers are drawn from the band artifact
[`data/bands/position-market.json`](../bands/position-market.json) (seasons
2020–2024). See the R script at
[`data/R/bands/position-market.R`](../R/bands/position-market.R).

## Three views of the market

1. **Active roster slots (53-man composition)** — how many of a given position
   are on the active roster on a typical week.
2. **Meaningful contributors** — players who cleared 25% of their side's snap
   share for the season (i.e. rotation-caliber or better).
3. **Clear starters** — players who cleared 70% season snap share (locked-in
   every-down players).

The three layers are what the sim needs:

- Slots tell the roster builder how many QBs to stock.
- Contributors tell it how many of those have to be _playable_.
- Starters tell it how many every-down anchors exist — the gap between
  contributors and starters is the "rotation tax" (especially big for DL).

## 53-man composition (typical week)

Per-team-week averages (ACT status only, regular season 2020–2024):

| Position    | Mean slots | Notes                                                    |
| ----------- | ---------- | -------------------------------------------------------- |
| DB (CB + S) | 9.2        | CB/S are mostly tagged as generic `DB` in weekly rosters |
| OL          | 8.0        | Near-invariant: p10 = p50 = p90 = 8                      |
| iDL         | 7.0        | DT/NT — wide spread (p10 = 5, p90 = 9)                   |
| LB          | 6.8        | Includes OLB variants                                    |
| WR          | 5.2        | Tight: p10 = 5, p90 = 6                                  |
| RB          | 3.6        | Teams routinely carry 3; a few carry 4                   |
| TE          | 3.1        | Very rarely more than 4                                  |
| QB          | 2.0        | ~1 in 20 weeks carries a 3rd QB                          |
| P           | 1.0        | Binary                                                   |
| LS          | 1.0        | Binary                                                   |
| K           | 1.0        | Binary                                                   |

**53 adds up to ~52** — the remainder goes to FB/emergency QB/practice-squad
elevations. The sim's roster builder can treat these as the hard base.

> **Data-reality note:** nflreadr's weekly rosters reports most offensive
> linemen as `OL` rather than T/G/C, and most DBs as `DB` rather than CB/S. We
> preserve that aggregate view here; the draft-position band carries the finer
> LT/LG/C/RG/RT and CB/S splits. When generating a 53-man roster the sim should
> allocate 8 OL with the internal split (2 OT + 2 OG + 1 OC + 3 swing/depth) and
> 9–10 DBs split ~5 CB + 4 S + 1 nickel.

## Meaningful contributors (≥ 25% snap share)

Per-team-season averages. This is what the sim calls a "rotation piece."

| Position | Meaningful (mean) | Starter (mean) | Rotation tax               |
| -------- | ----------------- | -------------- | -------------------------- |
| OT       | ~2.5              | 1.4            | Low — two OTs play         |
| OG       | ~2.2              | 1.3            | Low                        |
| OC       | ~1.0              | 0.7            | Binary                     |
| WR       | ~3.5              | 1.3            | High — WR rotations        |
| TE       | ~1.5              | 0.4            | Heavy — TE2 role           |
| RB       | ~1.8              | 0.1            | Highest — RBBC norm        |
| QB       | ~1.0              | 0.7            | 1 starter, sometimes       |
| iDL      | ~3.0              | 0.3            | Rotational by design       |
| EDGE     | ~2.0              | 0.3            | Always rotate pass-rushers |
| LB       | ~2.5              | 1.5            | Moderate                   |
| CB       | ~2.5              | 1.3            | Nickel rotation            |
| S        | ~2.5              | 1.5            | Two-starter position       |

**Low starter counts at RB/TE/iDL/EDGE are not a bug.** These positions are
designed to rotate: even an "RB1" rarely hits 70% snap share across a season, so
average starters-per-team is well below 1. The sim should lean on the 25%
threshold for depth-chart tiering and reserve the 70% starter tag for QB, OL,
LB, and S.

## League-wide totals

Across 32 teams in a typical season:

| Position | ~Unique players per season | Notes                                |
| -------- | -------------------------- | ------------------------------------ |
| OL       | ~380                       | High churn through practice-squad    |
| DB       | ~380                       | Generic DB tag dominates             |
| WR       | ~230                       | 5–6 per team, camp bodies churn high |
| iDL      | ~310                       | Rotational; 9+ per team              |
| LB       | ~300                       | Includes special-teams-first LBs     |
| TE       | ~160                       | 3 per team                           |
| RB       | ~175                       | 3–4 per team                         |
| QB       | ~96                        | The scarcest skill position          |
| K        | ~40                        | Barely above 32 — low churn          |
| P        | ~38                        | Low churn                            |
| LS       | ~36                        | Lowest churn in the league           |

## Roster-construction conventions the sim must honor

1. **QB is capped at 2 active** in ~95% of team-weeks. A third QB appears mostly
   in injury-shuffle weeks (and now with the post-2023 emergency QB rule). Don't
   let the sim generate 3-QB rosters as the default.
2. **OL floor is 8**. If the sim can't fill 8 OL, it should promote from
   practice squad before cutting anyone else.
3. **Specialists are 1-deep**. Backup kickers, punters, and long snappers exist
   only in injury weeks; otherwise the sim should never carry two.
4. **RB3 is real**. The mean of 3.6 is not noise — teams carry a clear RB1, RB2,
   and a special-teams/change-of-pace RB3.
5. **TE is the forgotten utility**. 3 TEs per team, but only 0.4 at starter snap
   share — most TE rooms are "one receiver, two blockers."

## Sources & caveats

- `nflreadr::load_rosters_weekly(2020:2024)` — active roster composition.
- `nflreadr::load_snap_counts(2020:2024)` — snap-share thresholds.
- Team snap denominator = `sum(offense_snaps) / 11` (or defense equivalent).
- `OL` and `DB` are aggregated in source data; treat the finer tackle/guard and
  CB/S splits from draft and snap-count data.
- Regular season only. Excludes players on IR, PUP, or with `status != "ACT"`.
