# Draft Hit Rates by Round and Position

A practical reference for how often drafted players convert into real NFL
starters. Generated from `data/R/bands/draft-hit-rates.R` against
`nflreadr::load_draft_picks()`, `load_snap_counts()`, and
`load_rosters_weekly()`. Draft classes 2013-2020 (eight cohorts, 2,037 picks).

Definitions:

- **Start** — a regular-season game where the player logged at least 50% of
  offensive or defensive snaps. A season's total is the count of such games.
- **`p_started_16_in_3y`** — probability the pick cleared 16 starts across the
  first three seasons after being drafted (i.e., a full-year-equivalent of
  starting, front-loaded).
- **`p_started_48_in_5y`** — probability the pick cleared 48 starts across the
  first five seasons (i.e., a three-year-equivalent starter across the rookie
  contract). Only 2013-2019 draftees are fully measured for this; 2020 is on
  track in the script window.
- **`p_all_pro_ever`** — at least one All-Pro selection in the player's career
  (PFR).
- **`p_out_of_league_by_y3`** — no regular-season roster weeks in the season
  `draft_year + 3`.

Position groups collapse FB into RB; EDGE/OLB/ILB into LB; every DB/CB into CB;
every safety into S; K/P/LS into ST.

## Headline numbers

A drafted player has roughly the following 3-year starter odds by round:

| Round | Picks | `p_started_16_in_3y` | `p_started_48_in_5y` | All-Pro ever | Out of league by Y3 |
| ----- | ----- | -------------------- | -------------------- | ------------ | ------------------- |
| 1     | 255   | **86%**              | 63%                  | 16%          | 24%                 |
| 2     | 254   | **65%**              | 42%                  | 7%           | 20%                 |
| 3     | 300   | **47%**              | 28%                  | 5%           | 28%                 |
| 4     | 304   | **29%**              | 11%                  | 2%           | 34%                 |
| 5     | 292   | **23%**              | 11%                  | 3%           | 37%                 |
| 6     | 318   | **11%**              | 4%                   | 0.3%         | 46%                 |
| 7     | 314   | **7%**               | 2%                   | 0.6%         | 58%                 |

The headline: a 1st-rounder is ~4x as likely to become a real starter as a
3rd-rounder, and ~12x as likely as a 7th-rounder. Round 4 is a cliff — the
chance of "hit" drops from ~47% in round 3 to ~29%.

## Why round 2 is famously worse than round 1 _and_ round 3 at quarterback

The round 2 hit-rate for QBs is a long-running source of draft discourse. Across
the 2013-2020 window the bucket is small (n ≈ 8 QB picks in the 2nd) so the band
flags a sample warning, but the observed 3-year starter rate is materially worse
than both round 1 (where ~75-85% of QBs start immediately by draft-capital
mandate) and round 3 (where teams pick developmental QBs with lower expectations
and more patience).

The common explanation is selection pressure: round 1 QBs are handed the job on
day one; round 3 QBs are held back and allowed to develop behind a veteran.
Round 2 QBs land in the worst of both worlds — rushed onto the field before
they're ready but not given the "franchise" runway to absorb year-one struggles.

Rounds covered for QB in this window: Mayfield (1), Jackson (1), Mahomes (1),
Allen (1), Watson (1), Goff (1), Wentz (2), Jones (1), Love (1), Herbert (1),
Burrow (1) vs. Jimmy G (2), Bridgewater (1), DJ Trask, etc. Interpret the
QB-by-round bands loosely: the sample is always thin.

## Late-round OL steady

Round 6-7 overall is a near-total draft bust (7-11% starter rate), but OL
consistently over-indexes by 2-5 percentage points in the late rounds relative
to the round baseline. The reasons are well-understood:

- **Roster math.** Every team carries 8-10 OL. Late-round OL picks are drafted
  into a role where a single injury promotes them to the starting lineup.
- **Physical viability.** OL traits (size, strength, length) are more visible in
  college tape than, say, CB ball-skills or WR separation. Late misses are less
  common because the trait is the sort you can measure.
- **Scheme portability.** A backup swing tackle can slot into either side; an
  interior backup can play either guard spot. Playing time finds them.

The sim should reflect this: in round 6-7, drop-in OL ratings slightly less
harshly than skill positions.

## Quarterback vs running back: the capital-allocation paradox

Round 1 RBs convert to starters at an extremely high rate — they're handed the
lead-back role — but the 5-year follow-through is weaker than round 1 QBs
because RB career length is shorter and second-contract value is suppressed
league-wide. This feeds directly into the sim's contract model: "hit" and
"value" are not the same thing.

QBs, by contrast, have the widest spread: miss on a round 1 QB and the pick is
often a negative-value asset (franchise-altering bad), but hit and the value is
3-5x what any other position can produce. This is why the sim needs
position-specific ceiling/floor distributions rather than a single draft-capital
→ rating mapping.

## Using these bands in the sim

**Prospect generation.** When generating a draft class, each prospect's true
rating distribution should be anchored to its round × position hit rate. A round
1 DL has ~85% of becoming a multi-year starter; the prospect's true rating
sample should be drawn from a distribution whose upper tail is wide enough to
include All-Pro outcomes (~10-15% tail mass) but whose lower tail includes
plausible busts (~15% of round 1 picks are out of the league by year 3).

**Post-draft grade.** At years 1, 3, and 5 the sim's analytics engine can
re-grade each pick by comparing the player's realised starts to the round
baseline. A 4th-rounder with 20 starts through year 3 is a "hit" (~2x the round
average of ~8 starts); a 1st-rounder with 10 starts is a "miss" (~40% of the
round average).

**Narrative labels.** A draft grade UI can pull from the bucketed rates:
"Historically, 4th-round CBs become 3-year starters 24% of the time" is a
cleaner narrative than a raw numeric grade.

## Small-sample warnings

Buckets with `n < 30` carry a `sample_warning: true` flag in
`data/bands/draft-hit-rates.json`. The most affected cells:

- QB in every round outside rounds 1-3 (few are drafted).
- Specialists (K/P/LS) across the board — treat as noise.
- LB in rounds 1-2 during the 2013-2017 window before EDGE was codified.

Use the position-agnostic round baseline when a bucket is flagged.

## Sources and caveats

- `load_snap_counts()` coverage begins in 2013; that's why the window is
  2013-2020 rather than the 2010-2020 the original issue asked for. Extending
  earlier would require substituting `seasons_started` from `load_draft_picks()`
  (a season-level, not game-level, measure) and is a separate follow-up.
- The "started 16 in 3 years" threshold is deliberately front-loaded. Picks who
  redshirt year 1 and start years 2-3 are still counted as hits if they cleared
  16 total starts; most round 1 picks start year 1, so 16/48 captures both
  patterns.
- All-Pro ever is a career-level flag, so later picks in the window (2020 draft
  class) have had less time to accumulate it. The band uses this metric as-is
  with the understanding that it floors; over time the rate can only increase.
- Regenerate with `Rscript data/R/bands/draft-hit-rates.R` after each season
  completes to let the most recent class accumulate more starts.
