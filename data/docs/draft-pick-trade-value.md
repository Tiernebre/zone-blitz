# Draft Pick Trade Value

A reference for how NFL teams value draft picks in trades. Three charts dominate
the conversation — **Jimmy Johnson** (1990s, still the public default), **Rich
Hill** (2017, analytics-weighted), and **Chase Stuart** (2013, AV-based). Real
trades generally land between Jimmy Johnson and Rich Hill, with Stuart acting as
a sanity check for the "how much did you actually get?" question.

Generated per-pick values for all three curves live at
[`data/bands/draft-pick-value.json`](../bands/draft-pick-value.json).

## TL;DR

| Pick                    | Jimmy Johnson | Rich Hill | Chase Stuart |
| ----------------------- | ------------- | --------- | ------------ |
| **1 overall**           | 3000          | 1000      | 34.6         |
| 5                       | 1700          | 620       | 25.2         |
| 10                      | 1300          | 487       | 18.0         |
| **32 (last Rd 1)**      | 590           | 270       | 9.4          |
| 64 (last Rd 2)          | 270           | 126       | 5.7          |
| 100                     | 124           | 60        | 3.5          |
| 150                     | 36            | 24        | 1.7          |
| 200                     | 9             | 9         | 0.7          |
| **256 (Mr Irrelevant)** | 0.4           | 1         | 0.0          |

Pick 1 valued at 3000 (JJ) vs 1000 (Hill) vs 34.6 (Stuart) is all scale — what
matters is the **shape of the decay**. Jimmy Johnson decays far too fast
relative to observed player outcomes; Stuart decays too slowly to match how
teams actually trade. Rich Hill sits between them and has become the
analytics-department default.

## The three charts

### Jimmy Johnson (Dallas Cowboys, early 1990s)

- **What it is.** A lookup table assigned to the Cowboys during Jimmy Johnson's
  draft tenure to simplify trade negotiations. Pick 1 = 3000 was chosen somewhat
  arbitrarily; the shape was intended to reflect the perceived "drop-off" in
  talent at each position.
- **How it's used.** Still the public default in every league broadcast. Most
  NFL war rooms keep a copy pinned for negotiation leverage even when their
  internal analytics disagree.
- **Where it fails.** The decay is way too steep. The chart says pick 1 is worth
  ~5x pick 10 and ~30x pick 32; in actual career-AV terms, pick 1 averages ~2x
  pick 10 and ~4x pick 32. Trading _down_ is systematically undervalued by the
  chart and trading _up_ is systematically overvalued.
- **Reference.**
  [NFL Football Operations —
  Draft Trade Value Chart](https://www.nflfootballoperations.com/the-game/operations/draft/draft-trade-value-chart/).

### Rich Hill (Pats Pulpit, 2017)

- **What it is.** An analytics-department rebuild of the JJ chart that Rich Hill
  published on the Patriots SB Nation blog in April 2017. Pick 1 anchored at
  1000, with a smoother logistic-like decay calibrated to how actual trades had
  settled over the preceding decade.
- **How it's used.** Widely adopted as the "baseline analytics chart" inside
  front offices that don't have a proprietary curve. OverTheCap and several
  salary-cap tools use Hill-style values by default.
- **Where it sits.** Very close to the median of actual trades. Pick 1 is ~2x
  pick 10 (matches AV), pick 1 is ~3.7x pick 32 (JJ says 5x, Stuart says 3.7x —
  Hill lands on Stuart).
- **Reference.** Rich Hill,
  ["2017 NFL Draft Value Chart," Pats Pulpit, April
  2017](https://www.patspulpit.com/2017/4/19/15347084/2017-nfl-draft-value-chart-trading-up-down-new-england-patriots).

### Chase Stuart (Football Perspective, 2013)

- **What it is.** A retrospective AV-based curve. Stuart took every draft pick's
  first-five-years AV from PFR, averaged by pick slot across many drafts, and
  called _that_ the "value" of the pick.
- **How it's used.** Mostly as a sanity check. If a trade beats Rich Hill but
  loses on Stuart, the "winning" side probably gave up future production for
  positional scarcity leverage.
- **Where it fails.** AV underweights quarterbacks (QB AV doesn't scale with
  impact); as a result Stuart's chart underprices the top of Round 1 relative to
  how teams actually treat QB-motivated trade-ups.
- **Reference.** Chase Stuart,
  ["Draft Value Chart," Football Perspective, March
  2013](https://www.footballperspective.com/draft-value-chart/).

## Shape comparison

Normalised to pick 1 = 1.0:

| Pick | Jimmy Johnson | Rich Hill | Chase Stuart |
| ---- | ------------- | --------- | ------------ |
| 1    | 1.00          | 1.00      | 1.00         |
| 5    | 0.57          | 0.62      | 0.73         |
| 10   | 0.43          | 0.49      | 0.52         |
| 32   | 0.20          | 0.27      | 0.27         |
| 64   | 0.09          | 0.13      | 0.16         |
| 100  | 0.04          | 0.06      | 0.10         |
| 150  | 0.01          | 0.02      | 0.05         |

Jimmy Johnson plunges fastest; Stuart flattens quickest; Rich Hill threads the
needle. The sim's AI GM should use Rich Hill as its primary valuator and use
Stuart (or a blend) as the "what do you actually get?" lens surfaced to the
user.

## Future-pick discount

Rule of thumb, endorsed by both Hill and Stuart:

> A pick in next year's draft is worth approximately **0.8x** the same pick in
> this year's draft.

So a 2nd-round pick next year trades for roughly a 3rd-round pick this year. Two
years out compounds to 0.64x; three years out is 0.51x. This discount dominates
most mid-round trade negotiations; GMs willing to take future picks usually
extract a round of value simply by accepting the time shift.

## Worked examples from real trades

### Jets → Rams, RG3 (2012)

The canonical "JJ chart is too steep" trade. Washington traded:

- 2012 No. 6 overall
- 2012 No. 39 (Rd 2)
- 2013 No. 22 (1st) — discounted 0.8x
- 2014 No. 2 overall (1st) — discounted 0.64x

...for Cleveland/Rams' (via chain) No. 2 overall in 2012 used on Robert Griffin
III. Against **Jimmy Johnson**, Washington paid ~2700 (JJ says pick 2 is worth
2600). Against **Rich Hill**, Washington paid ~2100 for a pick worth 810 — a
massive overpay. Against **Stuart**, it was 32 AV for a 31 AV pick — by AV
alone, it priced almost exactly. The trade is a cautionary tale precisely
because the JJ chart said it was close to fair, and the actual talent outcome
was catastrophic.

### Rams → Titans, Jared Goff (2016)

Rams traded up from No. 15 to No. 1:

- 2016 Rd 1 No. 15
- 2016 Rd 2 No. 43
- 2016 Rd 3 No. 76
- 2017 Rd 1 (discounted)
- 2017 Rd 3 (discounted)

For No. 1 overall + a Rd 4 and Rd 6. Against **Jimmy Johnson**, the Rams paid
3,427 for 3,020 of value (close; JJ loved it). Against **Rich Hill**, the Rams
paid 1,720 for 1,000 — a ~70% overpay. Against **Stuart**, a ~35 AV sacrifice
for 34.6 AV at pick 1 (fair-ish, because Stuart treats pick 1 as much less of an
outlier). This is the archetypal "QB-motivated trade-up overpays the Hill chart,
breaks even on JJ, is fair on AV."

### Broncos → Seahawks, Russell Wilson (2022)

Seattle received:

- 2022 Rd 1 No. 9
- 2022 Rd 2 No. 40
- 2022 Rd 5 No. 145
- 2023 Rd 1 (discounted 0.8x)
- 2023 Rd 2 (discounted 0.8x)
- Three veterans (Noah Fant, Drew Lock, Shelby Harris)

Against **Rich Hill**, Denver paid roughly 1,700 points of pick value plus three
veterans for a 33-year-old QB. This trade is commonly cited as the single
largest Hill-chart overpay of the modern era.

### Jets → Giants, Sam Darnold (2018)

Jets moved from No. 6 to No. 3:

- 2018 Rd 1 No. 6
- Two 2018 2nd-rounders (Nos. 37 and 49)
- 2019 Rd 2 (discounted)

For No. 3 overall. **Jimmy Johnson** says the Jets broke even (1,600 received
for 1,570 paid). **Rich Hill** says the Jets overpaid by ~30% (810 received for
~1,100 paid). The trade looks different depending on which chart the analyst is
holding.

### 49ers → Dolphins, Trey Lance (2021)

Niners traded up to No. 3:

- 2021 Rd 1 No. 12
- 2022 Rd 1 (discounted 0.8x)
- 2023 Rd 1 (discounted 0.64x)
- 2022 Rd 3 (discounted 0.8x)

For No. 3 overall. Against **Rich Hill**, San Francisco paid 1,220 for 675 — a
~80% overpay. Against **Jimmy Johnson**, roughly 2,400 for 2,200 — closer to
fair. The market had _already_ shifted toward Hill-style valuation by 2021,
making this a cautionary overpay for the Niners even before Lance failed to
stick.

### Eagles → Browns, Carson Wentz (2016, reverse direction)

Philly moved from No. 8 to No. 2:

- 2016 Rd 1 No. 8
- 2016 Rd 3 No. 77
- 2016 Rd 4 No. 100
- 2017 Rd 1 (discounted)
- 2018 Rd 2 (discounted 0.64x)

Against **Jimmy Johnson**, ~2,600 for 2,600 (exactly break-even). Against **Rich
Hill**, ~1,450 for 810 — a significant overpay. The Eagles won the trade via
Wentz's early production and the ring that followed, but the Hill-chart overpay
was real at the time.

## How the sim should use this

1. **AI GM trade evaluator.** Default to Rich Hill values for the AI GM's
   reservation price. The GM shouldn't accept a Hill-underwater trade unless
   it's QB-motivated (the explicit "we need the guy" override).
2. **User trade grade.** Display both Rich Hill and Chase Stuart deltas on the
   trade confirmation. "You paid 1,100 Hill points for 810; you paid 12 AV for
   9.4 AV." Two numbers let the user see when a trade looks bad on pick-value
   but reasonable on production.
3. **Future-pick discount.** Apply 0.8x per year, compounded. A 2026 2nd this
   offseason discounts to 0.8x for 2025, 0.64x for 2024-offseason trades, 0.51x
   for 2023-offseason trades.
4. **Quarterback premium.** When the team trading up is acquiring a QB at a
   top-5 slot, relax the Hill-chart reservation by up to 25%. This captures the
   RG3 / Goff / Wentz / Mahomes reality: QB-motivated trade-ups reliably overpay
   Hill even when the market knows better.
5. **Trade narratives.** "You won on the JJ chart but lost on Hill" is a cleaner
   beat than any single grade. Surface the disagreement when the charts diverge
   by more than ~20%.

## Band artifact

`data/bands/draft-pick-value.json` contains per-pick values (1-256) for all
three curves, plus a normalised copy (pick 1 = 1.0 per curve) and the
future-pick discount rule. Regenerate via:

```sh
Rscript data/R/bands/draft-pick-value.R
```

Values are reproduced from published anchor tables rather than scraped or fit;
see the top of the script for the canonical references.
