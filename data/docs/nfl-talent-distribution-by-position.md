# NFL Talent Distribution by Position

A practical reference for mapping NFL player talent into tiers (Replacement →
Weak → Average → Strong → Elite). Intended as a calibration aid for the Zone
Blitz player-generation and rating systems.

All percentages are approximate and describe the distribution across players who
see **meaningful NFL snaps in a given season** — not 90-man offseason rosters.
Tier boundaries are fuzzy; the shapes matter more than the exact cutoffs.

## Tier definitions

| Tier            | Meaning                                        | Typical fate                             |
| --------------- | ---------------------------------------------- | ---------------------------------------- |
| **Elite**       | Top of the position; game-breakers             | All-Pro / Pro Bowl locks                 |
| **Strong**      | Clear above-average starters                   | Quality starters, fringe Pro Bowl        |
| **Average**     | Competent starters                             | Middle-of-the-pack, replaceable but fine |
| **Weak**        | Starting but shouldn't be, or low-end starters | Churn candidates                         |
| **Replacement** | Practice-squad / waiver-wire / backup caliber  | The "next body available"                |

**Rating midpoint (0–100) = 50.** Average = ~50. Elite rides the tail.

---

## Quarterback (QB)

Bimodal distribution — thin middle, fat tails. The league has ~12–15 "real"
starters and everyone else is scrambling.

| Tier        | % of QBs | Count (of ~96 rostered) | Examples                                     |
| ----------- | -------- | ----------------------- | -------------------------------------------- |
| Elite       | 5–8%     | 2–3                     | Mahomes, Allen, Jackson                      |
| Strong      | 15–20%   | 5–7                     | Burrow, Herbert, Hurts, Stafford             |
| Average     | 25–30%   | 8–10                    | Goff, Tua, Dak, Geno                         |
| Weak        | 25–30%   | 8–10                    | Fields/Wilson-in-down-years, Mayfield pre-TB |
| Replacement | 25–30%   | 8–10                    | Minshew, Trubisky, Brissett, Cooper Rush     |

**Replacement-level QB baseline:** ~55–58% completion, ~6.0 Y/A, 1.5:1 TD:INT,
~75 passer rating. Quirk: weak-tier starters often grade _below_ replacement
because they take sacks and turn it over; a savvy veteran backup plays cleaner
low-ceiling football.

**Why the gap matters:** Mahomes → Cooper Rush is the largest talent chasm in
the sport. This is why QB WAR dwarfs every other position.

---

## Running Back (RB)

Flatter distribution than QB — replacement level is genuinely functional. Star
RBs are rare but backups can keep an offense alive.

| Tier        | % of RBs | Examples                                    |
| ----------- | -------- | ------------------------------------------- |
| Elite       | 3–5%     | CMC, Derrick Henry (peak), Saquon           |
| Strong      | 10–15%   | Josh Jacobs, Kamara, Mixon-tier             |
| Average     | 30–35%   | Bulk of RB1s and quality RB2s               |
| Weak        | 25–30%   | Low-end RB1s, committee pieces              |
| Replacement | 20–25%   | Practice squad call-ups, late-round rookies |

**Key distribution quirk:** replacement RBs produce ~80–85% of what an average
starter produces in counting stats. This is the core of the analytics-vs-film
debate around RB value.

---

## Wide Receiver (WR)

Closer to a normal distribution. Deep position — you can find competent WR3s
easily, but true #1s are scarce.

| Tier        | % of WRs | Examples                         |
| ----------- | -------- | -------------------------------- |
| Elite       | 3–5%     | Jefferson, Chase, Tyreek, CeeDee |
| Strong      | 12–15%   | Solid WR1s, dominant WR2s        |
| Average     | 30–35%   | WR2s and quality slot guys       |
| Weak        | 25–30%   | WR3s, rotational pieces          |
| Replacement | 20–25%   | 4th/5th receivers, camp bodies   |

**Note:** WR1 gets ~38% of team targets on average. Target concentration is a
stronger signal of "true WR1-ness" than raw yards.

---

## Tight End (TE)

Heavily bimodal by role. A handful of receiving TEs dominate the top; the rest
are blocking TEs who barely register offensively.

| Tier        | % of TEs | Examples                                    |
| ----------- | -------- | ------------------------------------------- |
| Elite       | 3–5%     | Kelce (peak), Kittle, Andrews, LaPorta      |
| Strong      | 10–12%   | Engram, Njoku, Goedert                      |
| Average     | 20–25%   | Starting TEs with modest production         |
| Weak        | 25–30%   | TE2s, blocking specialists with some routes |
| Replacement | 30–35%   | Pure blocking TEs, jumbo-package guys       |

**Quirk:** the "replacement" tier is inflated because many rostered TEs are
effectively 6th linemen. Split the position by role (receiving vs blocking) and
each sub-distribution tightens dramatically.

---

## Offensive Line (OL)

Tighter distribution than any skill position. The drop-off from elite to
replacement is real but smaller — scheme and continuity matter more than
individual talent.

| Tier        | % of OL | Examples                                     |
| ----------- | ------- | -------------------------------------------- |
| Elite       | 3–5%    | Trent Williams, Penei Sewell, Quenton Nelson |
| Strong      | 15–20%  | Pro Bowl-caliber starters                    |
| Average     | 35–40%  | Solid starters; the bulk of the league       |
| Weak        | 25–30%  | Low-end starters, liability at one skill     |
| Replacement | 10–15%  | Swing tackles, practice-squad interior       |

**Tackle vs interior split:** LT skews harder to the top (premium position,
scarcity). Guard and center have flatter distributions. Replacement LT is
meaningfully worse than replacement guard.

---

## Edge / Defensive End (EDGE)

Top-heavy like QB, but less bimodal. Elite pass rushers are franchise-altering;
the middle is deep.

| Tier        | % of EDGE | Examples                                           |
| ----------- | --------- | -------------------------------------------------- |
| Elite       | 3–5%      | Micah Parsons, Nick Bosa, Myles Garrett, T.J. Watt |
| Strong      | 12–15%    | Double-digit sack guys                             |
| Average     | 30–35%    | 6–9 sack starters, solid run defenders             |
| Weak        | 25–30%    | Rotational rushers, 3–5 sack ceiling               |
| Replacement | 20–25%    | Camp-body edges, situational-only                  |

**Premium position tax:** elite edges are paid like QBs because the tier gap in
pressure-generation is massive and uncorrelated with scheme.

---

## Interior Defensive Line (DT / NT)

Flatter than edge. Elite 3-techs (Aaron Donald archetype) are rare enough to
distort the curve.

| Tier        | % of iDL | Examples                                           |
| ----------- | -------- | -------------------------------------------------- |
| Elite       | 2–4%     | Aaron Donald (peak), Chris Jones, Quinnen Williams |
| Strong      | 10–15%   | Dexter Lawrence, Cam Heyward tier                  |
| Average     | 35–40%   | Starting DTs, rotational 3-techs                   |
| Weak        | 25–30%   | Run-plugging NTs with no pass rush                 |
| Replacement | 15–20%   | Rotational DTs, practice-squad bodies              |

---

## Linebacker (LB)

The position WAR models most consistently undervalue. Flatter distribution;
scheme fit drives a lot of apparent variance.

| Tier        | % of LBs | Examples                                       |
| ----------- | -------- | ---------------------------------------------- |
| Elite       | 2–4%     | Fred Warner, Roquan Smith, Bobby Wagner (peak) |
| Strong      | 10–15%   | Three-down starters with coverage ability      |
| Average     | 35–40%   | Two-down thumpers, early-down starters         |
| Weak        | 25–30%   | Situational or scheme-dependent                |
| Replacement | 15–20%   | Special-teams LBs, dime-package misfits        |

---

## Cornerback (CB)

Wide variance year-to-year. CB1/CB2 gap within teams is often larger than the
league-wide average gap between tiers.

| Tier        | % of CBs | Examples                                           |
| ----------- | -------- | -------------------------------------------------- |
| Elite       | 3–5%     | Sauce Gardner, Pat Surtain II, Jalen Ramsey (peak) |
| Strong      | 12–15%   | Shutdown CB1s, quality press corners               |
| Average     | 30–35%   | Competent CB2s and nickel starters                 |
| Weak        | 25–30%   | Exploitable CB2s and CB3s                          |
| Replacement | 20–25%   | Dime/practice-squad corners                        |

**Volatility note:** year-over-year CB grading is noisier than any other
position. A "strong" CB one season can slide to "weak" the next without obvious
cause (QBs avoid them, or target them).

---

## Safety (S)

Flat distribution. Position has been commoditized — elite safeties exist but
teams increasingly rely on scheme and rotation.

| Tier        | % of S | Examples                                               |
| ----------- | ------ | ------------------------------------------------------ |
| Elite       | 2–4%   | Minkah Fitzpatrick (peak), Derwin James, Kyle Hamilton |
| Strong      | 12–15% | Reliable starters on both safety types                 |
| Average     | 35–40% | Split FS/SS starters                                   |
| Weak        | 25–30% | Coverage-limited box safeties                          |
| Replacement | 15–20% | Dime package, special-teams-first                      |

---

## Specialists (K / P / LS)

Extremely flat, but with real replacement gaps — especially kickers.

| Tier        | % of K       | Notes                                 |
| ----------- | ------------ | ------------------------------------- |
| Elite       | ~6% (2 guys) | Justin Tucker (peak), Harrison Butker |
| Strong      | 20–25%       | 88%+ FG, reliable from 50+            |
| Average     | 35–40%       | 82–88% FG, league-standard            |
| Weak        | 20–25%       | Accuracy or leg-limited               |
| Replacement | 10–15%       | Street free-agents, 75%-range         |

**Punters** cluster even tighter; **long snappers** are effectively binary
(competent vs liability).

---

## Meta observations for sim calibration

1. **QB is the only position where replacement-tier is a disaster.** Everywhere
   else, replacement is functional-if-limited.
2. **OL and specialists have the narrowest spreads** — ratings for these
   positions should compress toward the mean.
3. **EDGE and QB have the widest spreads** — elite tier should ride further from
   50 than any other position.
4. **Tier counts are roster-contextual.** A 53-man roster carries ~2–3 QBs but
   ~9 OL and ~6 WRs. Distribution shapes describe _per-position-group_ slots,
   not per-team slots.
5. **Weak-tier starters are a real category.** Don't collapse them into
   replacement — they're worse than average but hold jobs for reasons (draft
   capital, contract, lack of alternatives). Sim should reflect that teams start
   players who grade below replacement in models.

## Sources & caveats

Distributions synthesized from PFF grading, nflfastR EPA allocations, and
roster-count reality. No single source defines these tiers — they're a working
model. Refine against actual band data in `data/bands/` when calibrating the
sim's player-generation distributions.
