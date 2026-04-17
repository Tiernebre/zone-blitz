# IR Usage — Placements, Designated-to-Return, Position Concentration

A calibration reference for how NFL teams actually **use the injured reserve
list** during the regular season. The sim's `injuries.json` band tells us how
often a body breaks; this band tells us what the roster does about it —
season-ending IR vs designated-to-return vs PUP vs NFI, how often a team gets
its player back, and which positions are most IR-concentrated.

Companion band: [`data/bands/ir-usage.json`](../bands/ir-usage.json). Companion
script: [`data/R/bands/ir-usage.R`](../R/bands/ir-usage.R). Gap index row:
[calibration-gaps.md (#539)](./calibration-gaps.md).

## Sources

- `nflreadr::load_rosters_weekly(2020:2024)` — one row per player per week per
  team. The relevant field is `status_description_abbr`, NFL's granular
  transaction code:
  - **R01** — Reserve/Injured (the season-ending "IR" line)
  - **R23** / **R30** — Reserve/Injured, Designated for Return
  - **R04** / **R06** — Reserve/PUP (active preseason list and reserve list)
  - **R27** / **R40** — Reserve/Non-Football Injury or Illness
  - **A01** — Active (on the 53-man)
  - **I01** / **I02** — Active, Inactive for the week's game
- Season window: **2020–2024**. The `status_description_abbr` field only
  populates reliably from 2020 forward — earlier seasons collapse every reserve
  flavor into the top-level `status == "RES"` bucket, so the IR / IR-R / PUP /
  NFI split simply isn't available before then. The weekly snapshot also rarely
  surfaces the transient R23 designated-for-return tag (teams submit the
  designation and the player flips back to A01 before the next week's snapshot
  is taken), so the script treats every R01 placement as a potential return
  candidate and measures the realized return rate.

## The IR-return rule — a fifteen-year moving target

The IR list used to be a career-enders-only container. A team that placed a
player on IR lost him for the season, full stop, with no path back. That turned
minor-but-multi-week injuries (a high-ankle sprain, a broken hand) into a roster
trap: cut the player and hope to re-sign him (risky — he could be claimed), or
burn a 53-man slot holding a body who couldn't practice for a month. Teams
lobbied for a designated-to-return mechanic for years.

**2012** — the league introduced **one** designated-to-return slot per team per
season. A player placed on IR after week 1 could be designated immediately (or
later) and was eligible to return after eight weeks on the list and six weeks of
absence from games. Only one per team per year. Strict.

**2017** — the "must designate at time of placement" restriction was dropped.
Teams could retroactively designate any IR'd player to return, so they no longer
had to forecast return prospects at placement.

**2020** (COVID era) — two designated-to-return slots per team per season.

**2021** — three slots per team per season, and — more importantly — the
**eight-week minimum was reduced to three games**. This is the modern era. A
player placed on IR on a Monday is eligible to play again in the team's fourth
game after placement.

**2023** — the per-season cap was **removed entirely**. A team can now designate
an unlimited number of IR'd players to return, subject only to an
**eight-player-per-season activation limit** (i.e. you can designate as many as
you like, but only eight of them can actually come back onto the 53). The
minimum stay dropped to four games per the most recent CBA rider on practice
window mechanics, though the practical minimum absence remains three games.

The observable consequence in the data: IR is now a **reversible** roster move
for most non-catastrophic injuries. That's a structural change the sim has to
model.

## What the 2020–2024 data shows

### Placement volume — IR is common, PUP/NFI are rare

| Stat per team per season | mean | sd  | p10 | p50 | p90 |
| ------------------------ | ---- | --- | --- | --- | --- |
| All IR-family placements | 13.1 | 5.1 | 7   | 12  | 20  |
| IR (R01)                 | 12.5 | 5.1 | 7   | 12  | 20  |
| NFI                      | 0.44 | 0.7 | 0   | 0   | 1   |
| PUP (in-season)          | 0.11 | 0.4 | 0   | 0   | 0   |
| IR-R (R23 surfaced)      | 0.01 | 0.1 | 0   | 0   | 0   |

The IR-R line is effectively noise for calibration purposes — teams use the
designation in practice, but the weekly roster snapshot rarely catches it. What
the sim should read is: **IR itself is the placement, and 30% of those
placements come back**.

PUP and NFI are genuinely rare in-season transactions — most PUP activity
happens in training camp, which is outside the weekly roster feed's
regular-season window.

### Return rate — about 1 in 3 IR placements comes back

| Metric                              | Value                                    |
| ----------------------------------- | ---------------------------------------- |
| IR placements (2020–2024, REG only) | 2,001                                    |
| Returned to ACT same season         | 615                                      |
| **P(return given IR placement)**    | **30.7%**                                |
| Mean weeks absent before return     | 5.6 (p25 = 4, p90 = 9)                   |
| Minimum observed absence            | 1 week (very rare carry-over activation) |
| Modal absence                       | 5 weeks                                  |

This lines up with the rule-era expectations: a team designates a player who is
expected to miss ~4–8 weeks (e.g. a hamstring tear, a PCL sprain, a high ankle),
pockets the roster spot in the meantime, and activates when the medical clears.
Players who land on IR for season-ending injuries (ACL, Achilles, Lisfranc,
broken fibula) stay there — hence the 70% that never return.

### Position concentration — trenches and secondary dominate

Share of all IR-family placements by position group:

| Position              | % of placements |
| --------------------- | --------------- |
| CB_DB                 | 22.3%           |
| OL                    | 17.5%           |
| LB                    | 15.2%           |
| iDL                   | 13.6%           |
| WR                    | 11.1%           |
| RB                    | 8.6%            |
| TE                    | 6.6%            |
| QB                    | 2.2%            |
| K / P / LS (combined) | 2.8%            |

The secondary leads — corners and safeties play high-speed space, get hamstring
pulls and ankle rolls, and rosters carry eight or nine of them so the raw count
is high. OL and trenches fill out the next tier; they're also deep rosters
(eight OL, eight-plus DL) with week-over-week grind injuries. WR/RB/TE track the
injury-rate bands from `injuries.json` — soft-tissue injuries land
skill-position players on IR for the designated-to-return window.

QB is a roster-depth artifact: teams only carry two to three, so even though QBs
get hurt plenty (see `position_injury_rates.QB` in `injuries.json`), very few of
those injuries become IR placements — teams would rather burn a game-day
inactive designation than lose the slot for three weeks.

## Gamesmanship patterns the sim should model

A few behaviors show up once you look at the placement-week and return-week
distributions together:

1. **"Placeholder IR" early in the season.** Teams with a late-signed UFA or a
   claimed-off-waivers player will sometimes IR a borderline-injured depth guy
   in week 2 or 3 specifically to open a 53-man slot for the new acquisition,
   then designate-to-return later. The modal placement week is weeks 3–6; the
   modal return week is weeks 10–14. Three- and four-week absences are the sweet
   spot.
2. **"Close enough to playoffs" IR in weeks 8–11.** A team whose playoff hopes
   are still live will IR a player whose injury would realistically keep him out
   3–4 games anyway, then activate him for the stretch run. Free roster spot +
   no real competitive cost. The p90 weeks-on-IR is 9, so the window is wide
   enough to cover most rehab arcs.
3. **Season-ending at week 16–18 on true IR.** Teams also use IR as a "we're
   done with him, let's evaluate a rookie from the practice squad" move. These
   players don't return (the season ends first) so they show up in the 70% no
   return cohort but aren't actually injured — they're simply done.

The sim doesn't need a full gamesmanship model, but it should:

- Treat IR as a **reversible move** with a ~30% return rate.
- Draw weeks-on-IR from a right-skewed distribution centered on ~5 weeks (the
  empirical mean and p50 agree, with a long tail to 9+ weeks for the 10% longest
  rehabs).
- Over-weight placement probability on CB/S, OL, LB, iDL, WR when selecting
  "which injured player becomes an IR event" vs "stays Q on the injury report".
- Under-weight QB heavily — IR is almost never used for QB injuries in the real
  data.

## How this feeds downstream

- **In-season roster-slot pressure model** — the weekly "do we have an open
  53-man slot?" check should trigger on `injuries.json` severity ≥ 4 weeks with
  probability roughly proportional to the position mix above.
- **Waiver-claim AI** — teams that just placed a player on IR are the ones
  scanning the wire for a replacement; the sim should bias its waiver activity
  toward recent-IR teams.
- **Practice-squad elevation AI** — the three-game IR minimum lines up with the
  practice-squad elevation cadence; a player who IRs gets elevation cover for
  his position group for ~4 weeks.
- **Realism validation for `injuries.json`** — the severity distribution in the
  injury band predicts that roughly 12–15% of injuries should be "season ending"
  (8+ weeks missed). The observed 13.1 IR placements per team per season lines
  up with that — if a future refit of injuries.json drifts away from this
  anchor, one of the two bands is miscalibrated.
