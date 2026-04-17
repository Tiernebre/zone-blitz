# NFL Franchise + Transition Tag Usage

A calibration reference for the Zone Blitz sim's **retained-player decision
tree**, **contract-negotiation AI** (tag as leverage), and **cap-management
tradeoffs**. The tag is a specific front-office lever: it is used ~5–10 times
per league offseason, concentrated at a handful of positions, and resolves along
a three-way path (sign long-term, play on the tag, or get traded). Without
calibrated tag priors the sim either under-tags (the tool feels dead) or
over-tags (cap implications become unrealistic).

Companion band: [`data/bands/tag-usage.json`](../bands/tag-usage.json).
Companion script: [`data/R/bands/tag-usage.R`](../R/bands/tag-usage.R). Gap
index row: [calibration-gaps.md (#538)](./calibration-gaps.md).

## Sources

- `nflreadr::load_contracts()` — OverTheCap historical feed. **Verified
  2026-04-17**: despite the hint in issue #538, this feed does _not_ expose
  `is_franchise_tag` / `is_transition_tag` columns. The only top-level tag-
  related signal is that tagged deals are `years == 1` contracts with a specific
  `value` that matches the NFL's published tag amount for that (position, year).
- NFL / OverTheCap published tag tables — the per-year, per-position franchise
  and transition tag amounts from 2011 onward. These are fixed dollar amounts
  (top-5 average for exclusive franchise, top-5 5-year average for
  non-exclusive, top-10 for transition) computed each spring from the salary-cap
  formula.
  - <https://overthecap.com/franchise-tag-history>
  - <https://www.spotrac.com/nfl/cba/franchise-tag>
- `nflreadr::load_rosters()` — cross-referenced to determine same-year outcome
  (played for tagging team, traded, or signed a new deal).
- Season window: **2011–2025** (15 years, post-2011 CBA; the formula was
  recalibrated in the 2011 CBA so pre-2011 amounts aren't directly comparable).

## What counts as a "tag" in the band

A contract row is classified as a tag if:

- `years == 1` and `year_signed` equals the league year it applies to, **and**
- `value` (total contract value = 1-year APY for a tag) falls within **$0.3M**
  of the NFL-published franchise or transition tag amount for the player's
  position-group in that year.

Exclusive franchise tags — used rarely and almost exclusively at QB, where the
formula (top-5 current-year) yields a materially larger number than the
non-exclusive tag (top-5 five-year average) — are detected at QB only, when
`value > 1.05 * non-exclusive franchise amount`.

The $0.3M tolerance absorbs minor negotiated extras (workout bonuses, per- game
roster bonuses treated as incentives) without catching veteran-minimum deals,
which all land below $2M. Expect the detection to **slightly undercount** tags —
a handful of historical tags were converted to long-term deals before the player
ever signed the tender, and those show up only as the long-term deal. The
**relative** shape (position mix, tag-type split, resolution distribution) is
what the sim should anchor on.

## Tag volume — offseason by offseason

From 2011–2025, an average of **~5 detected tagged deals per offseason** (sd ~3)
land in the band. The historical actual count is higher (6–10 is the
commonly-cited range) because of the undercount noted above — use the band's
relative shape and cross-check volume against the overall [NFL tag tracker]
(https://overthecap.com/franchise-tag-history) when tuning the sim's annual tag
rate.

Year-over-year variance is driven by three forces:

1. **Cap environment** — when the cap jumps abruptly (2022, 2024, 2025), tag
   amounts jump with it, which disincentivizes tagging mid-market players (a
   $24M DE tag becomes unaffordable unless you're keeping a top-5 player). In
   flat-cap years (2011, 2021) tags spike because they're relatively cheap.
2. **Position-specific salary spikes** — WR tags surged in 2023–2024 as the top
   of the WR market hit $30M+ AAV and teams used tags to delay paying that
   number.
3. **CBA cliff effects** — tags cluster in the final years before an expected
   CBA change, because owners front-load retention before a potential work
   stoppage.

## P(tag | position) — why WR / DE / QB / S dominate

In the 15-year window, the position distribution of tags looks roughly like:

| Position | Share of tags | Per offseason | Why                                                                                                                                                                                          |
| -------- | ------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DE (ED)  | ~17%          | ~0.9          | Elite pass rush is scarce and top-of-market AAV escalates fastest. Tag is cheap relative to a $30M+ extension.                                                                               |
| WR       | ~13%          | ~0.7          | WR1 production is irreplaceable; receiver market jumped from $20M → $35M APY in 3 years, making tags a bargain.                                                                              |
| S        | ~13%          | ~0.7          | Safety tag has historically been the league's cheapest tag (the position's APY is compressed), so teams tag to buy time.                                                                     |
| QB       | ~12%          | ~0.6          | Franchise QBs rarely get tagged (they sign $50M/yr extensions instead), but bridge / recently-drafted QBs get tagged before a fifth-year decision.                                           |
| DT (IDL) | ~12%          | ~0.6          | Interior-pass-rush tag is still cheaper than EDGE and the market is shallower.                                                                                                               |
| OL       | ~9%           | ~0.5          | Offensive-line tag collapses LT / C / G into a single number — teams use it to retain a premier LT whose market would pay OT-premium.                                                        |
| CB       | ~8%           | ~0.5          | Corners get tagged when the player is locker-room critical; trade volume at CB is high so tag-and-trade is also a real path.                                                                 |
| RB       | ~6%           | ~0.4          | RB tags have _collapsed_ from the 2014–2018 era (Le'Veon, Bell, Gurley) because the league now discounts RB value — tagging an RB signals the team won't extend.                             |
| TE       | ~6%           | ~0.4          | Mid-tier tag; used opportunistically when a TE emerges as a top-5 player (Engram 2022, Freiermuth-type cases).                                                                               |
| LB       | ~4%           | ~0.2          | **Almost never**. Off-ball LB is the league's most devalued position — teams would rather let a Pro-Bowl LB walk than tag one. When it does happen (Mosley 2018) the tag is usually revoked. |
| K        | <1%           | ~0.05         | Kickers essentially never get tagged. The tag number is cheap but specialists sign multi-year deals voluntarily.                                                                             |

The **sim implication**: when an AI GM evaluates "tag this player?", the prior
on acting should be weighted by this position-distribution. An LB hitting UFA
should almost never draw a tag even if the player grade is elite; a DE or WR
with an expired rookie deal should draw a tag roughly once per two seasons
across the league.

## Tag-type split — franchise vs. exclusive vs. transition

Of the detected tags in the window:

| Type                    | Share | Role in the sim                                                                                                                                                                                                                                                         |
| ----------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Non-exclusive franchise | ~83%  | The default tag. Player can negotiate with other teams; tagging team has right of first refusal + 2 first-round picks if they let him walk.                                                                                                                             |
| Exclusive franchise     | ~8%   | QB-only, effectively. Higher cost (top-5 current-year vs. 5-year average) and no right for the player to negotiate elsewhere. Used when the tagging team has zero tolerance for losing the player, even to a matched offer sheet.                                       |
| Transition tag          | ~9%   | Right of first refusal only — no draft-pick compensation if the player signs elsewhere. Cheaper than franchise (~top-10 average for the position). The transition tag is falling out of favor because it gives leverage away; most modern usage is as a signaling move. |

The sim's offseason AI should default to non-exclusive franchise (the "normal"
tag). Exclusive is reserved for QB scenarios where the player is Prescott-tier
and the team is explicitly blocking a bidding war. Transition is a signaling
option for GMs with strong scouting confidence that the market will undershoot
their internal valuation.

## Resolution path — sign / play / trade

Once tagged, the 15-year window resolves roughly:

| Resolution    | Share | Sim meaning                                                                                                                                                                                                                  |
| ------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tag-and-play  | ~73%  | Player signs the tag tender and plays on the 1-year deal. Most common outcome because the league's mid-July deadline is hard and negotiations often stall.                                                                   |
| tag-and-sign  | ~18%  | Player and team agree on a multi-year extension before the ~mid-July deadline. Highest rate at QB (where the tag itself is a leverage point) and at positions where the player wants long-term security.                     |
| tag-and-trade | ~9%   | The tagging team works a sign-and-trade — almost always because the player refused to sign the tender and held out. Rare, but signature cases (Clowney 2019, Ngakoue 2020) set the sim's "held-out and got moved" archetype. |

For the sim's retained-player decision tree, the shape means:

- **Default action after tag**: play. 73% of the time, the simulation should
  treat the tagged player as on the roster for Y1 under the tag cap hit.
- **Extension attempt**: the AI GM should attempt a multi-year extension before
  July 15; the sim should hit (player accepts) ~18% of the time with the
  remainder walking into the tag year.
- **Trade market**: tag-and-trade is rare but signature — the sim's trade AI
  should expose it as a late-June option, typically at the player's request
  after extension talks break down.

Per-position path shares (from the band) let the sim bias QBs toward
tag-and-sign (the tag is almost always a bridge to a $50M/yr extension) and RBs
toward tag-and-play (extensions rarely materialize; the tag was the best outcome
the player was going to get).

## Exclusive-franchise escalator

The exclusive franchise tag is meaningfully more expensive than the
non-exclusive because the formula uses **top-5 current-year** APYs at the
position rather than the 5-year average. At QB this premium is large: a 2023
exclusive QB tag was ~$36M while the non-exclusive was $32.4M — a
~$3.6M delta. At other positions the two numbers are often within 1–2% of each
other and teams default to non-exclusive to avoid locking out offer sheets
(which they can match anyway under non-exclusive rules).

Practical rule for the sim: **only QBs should ever draw exclusive tags**. The
cost premium at every other position is too small to justify the absolute veto
on the player's market.

## Consecutive-tag cost ramp

The NFL's CBA imposes an escalator for consecutive tags on the same player:

- **First tag**: position's published tag amount.
- **Second consecutive tag**: **120% of the player's prior cap hit**, or the
  position's current tag amount, whichever is higher.
- **Third consecutive tag**: **144% of the prior cap hit** — OR — if the player
  plays a non-QB position, the **QB tag amount**. The second rule is what makes
  a third tag at any position except QB essentially unaffordable; tagging an
  edge rusher a third time means paying him the QB tag (currently ~$40M), which
  no team has ever actually executed.

In the 15-year window the band detects only ~2 consecutive-tag events. The
third-tag scenario has never been used in practice. The sim should expose the
consecutive-tag lever but bias the AI GM strongly against it: the second tag is
reasonable when a deal is close but not quite finalized; the third tag is
essentially a "this player has unilateral leverage" move that no rational GM
takes.

## Sim implications — retained-player decision tree

When the sim enters the offseason retained-player phase and a veteran's contract
expires, the AI GM should walk the following tree:

```mermaid
flowchart TD
    START([Veteran contract expires])
    START --> GRADE{Player grade &<br/>position tag-propensity?}
    GRADE -- "high + tag-heavy position<br/>(DE/WR/QB/S/DT/OL)" --> TAG{Use tag?}
    GRADE -- "low or tag-averse position<br/>(LB/K/RB)" --> UFA[Let hit UFA]
    TAG -- "~5–10/yr league-wide" --> CHOOSE{Tag type?}
    TAG -- "most retained players" --> EXTEND[Negotiate extension directly]
    CHOOSE -- "default" --> NONEX[Non-exclusive franchise]
    CHOOSE -- "QB + block market" --> EXCL[Exclusive franchise]
    CHOOSE -- "signal intent" --> TRANS[Transition tag]
    NONEX & EXCL & TRANS --> RESOLVE{Resolution<br/>by mid-July}
    RESOLVE -- "~18%" --> SIGN[Extension signed]
    RESOLVE -- "~73%" --> PLAY[Player signs tender<br/>plays on 1-yr tag]
    RESOLVE -- "~9%" --> TRADE[Tag-and-trade<br/>(usually after holdout)]
    PLAY --> NEXT{Next offseason}
    NEXT -- "second tag @ 120%" --> TAG2[Rare but legal]
    NEXT -- "let walk" --> WALK[UFA, comp-pick]
```

The resolution-path priors (18 / 73 / 9) and the position distribution are what
feed the branch probabilities. The exclusive-tag and consecutive-tag rules are
hard guardrails: the sim should expose them as options but the AI GM should
almost never pick them.

## Known gaps

- **Undercounted volume**: structural detection against published tag amounts
  misses ~1–3 tags per year that were immediately converted into multi-year
  deals before the player signed the tender. The band's volume is a floor; tune
  the sim's annual tag rate slightly upward (~7–8/yr league-wide) to match the
  league's published tag tracker.
- **No exclusive vs. non-exclusive split at non-QB positions**: the amounts are
  within 1–2% of each other at most positions, so structural detection can't
  separate them. This is fine because the two tags are functionally the same
  when the dollar delta is that small.
- **Tag-and-trade attribution is noisy**: a player traded mid-season appears on
  multiple teams' rosters in `load_rosters()`. The band resolves this by
  preferring the tagging-team match (play) over the other-team match (trade),
  which is the correct default but will classify a small number of true mid-year
  trades as "play" rather than "trade". The published ~9% trade rate is a floor.
