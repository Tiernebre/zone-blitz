#!/usr/bin/env Rscript
# ufa-pool-composition.R — Position-weighted UFA pool composition and re-sign
# rate gating from year-over-year roster transitions.
#
# The existing free-agent-market band counts *contract rows* where team !=
# draft_team as "external UFA signings". That heuristic massively overcounts
# because the OTC feed also carries minimum-salary depth churn, practice-squad
# signings, futures contracts, ERFA tenders, and cut-day re-signings. Counts
# like "425 WR external signings per offseason" are useful for relative shape
# across positions but not for sizing the sim's FA pool.
#
# This band answers two tighter questions:
#
#   1. UFA pool composition — how many *distinct players* per position become
#      UFAs each offseason, measured by year-over-year roster membership:
#      a player who was on a roster in season N but whose contract term ended
#      is a potential UFA in offseason N+1. The pool per position is what the
#      generator should sample from.
#
#   2. Re-sign rate gating — of those potential UFAs, split outcomes three
#      ways by comparing their season-N team to their season-(N+1) team:
#        * re_sign_before_fa    = stayed on own team (extension, re-up, tag)
#        * signed_elsewhere     = changed team (hit the open market and moved)
#        * out_of_league        = no season-(N+1) roster appearance
#      The sim gates the FA pool at re_sign_before_fa: those players never hit
#      the market. The remaining pool is what NPC / user GMs bid on.
#
# Data sources:
#   - nflreadr::load_rosters()   — player-season-team membership, years_exp,
#                                   entry_year/rookie_year, draft_club
#   - nflreadr::load_contracts() — used to enrich year-N-end players with a
#                                   plausible signed contract in offseason N+1
#                                   (optional — used for the by-tier resign-rate
#                                   cross-check so the sim can distinguish
#                                   top-10 retention from depth churn).
#
# UFA eligibility proxy: a player is treated as potentially-UFA-eligible in
# offseason N+1 if they were on a season-N roster AND had years_exp >= 3 at
# that point (CBA rule is 4 accrued seasons for true UFA status; using >= 3
# here captures RFA/ERFA + true UFA and matches the sim's player lifecycle
# which doesn't distinguish tender types).
#
# Output: data/bands/ufa-pool-composition.json
#
# Usage:
#   Rscript data/R/bands/ufa-pool-composition.R [--seasons 2019:2024]

suppressPackageStartupMessages({
  library(nflreadr)
  library(dplyr)
  library(tidyr)
})

script_file <- (function() {
  args <- commandArgs(trailingOnly = FALSE)
  f <- grep("^--file=", args, value = TRUE)
  if (length(f) > 0) normalizePath(sub("^--file=", "", f[1]), mustWork = FALSE) else NULL
})()
source(file.path(dirname(script_file), "..", "lib.R"))

args <- commandArgs(trailingOnly = TRUE)
seasons <- parse_seasons(args)

# We need one extra leading season to establish the "season N roster" for the
# earliest transition window, and we sample transitions N -> N+1 so we only
# resolve transitions up through max(seasons) - 1.
transition_seasons <- head(seasons, -1)
cat("Resolving UFA transitions for offseasons ending in:",
    paste(transition_seasons + 1L, collapse = ", "), "\n")

# ---------------------------------------------------------------------------
# 1. Load rosters for the window (one row per player-season-team-week-ish;
#    dedupe to one row per player-season-team by keeping the modal team).
# ---------------------------------------------------------------------------
cat("Loading rosters for", paste(range(seasons), collapse = "-"), "\n")
rosters_raw <- nflreadr::load_rosters(seasons)

position_map <- function(pos, depth_chart) {
  # Prefer depth_chart_position where it splits OL (T/G/C). Fall back to the
  # general position label. Map into the sim's position groups.
  p <- ifelse(!is.na(depth_chart) & depth_chart != "", depth_chart, pos)
  case_when(
    p %in% c("QB")                        ~ "QB",
    p %in% c("RB", "FB", "HB")            ~ "RB",
    p %in% c("WR")                        ~ "WR",
    p %in% c("TE")                        ~ "TE",
    p %in% c("T", "LT", "RT", "OT")       ~ "OT",
    p %in% c("G", "LG", "RG", "C", "OG", "IOL") ~ "IOL",
    p %in% c("DE", "OLB", "EDGE", "ED")   ~ "EDGE",
    p %in% c("DT", "NT", "IDL", "DL")     ~ "IDL",
    p %in% c("LB", "ILB", "MLB")          ~ "LB",
    p %in% c("CB", "DB")                  ~ "CB",
    p %in% c("S", "FS", "SS", "SAF")      ~ "S",
    p %in% c("K", "P", "LS")              ~ "ST",
    TRUE                                  ~ "other"
  )
}

rosters <- rosters_raw |>
  filter(!is.na(gsis_id), gsis_id != "") |>
  mutate(position_group = position_map(position, depth_chart_position)) |>
  # Pick one team per player-season (last week's team is a reasonable proxy
  # for "end-of-season team", i.e. whose cap book they hit going into the
  # offseason).
  group_by(season, gsis_id) |>
  slice_max(order_by = week, n = 1, with_ties = FALSE) |>
  ungroup() |>
  transmute(
    season, gsis_id, team, position_group,
    years_exp = as.integer(years_exp),
    entry_year, rookie_year, draft_club
  ) |>
  filter(position_group != "other")

cat("Roster rows (one per player-season):", nrow(rosters), "\n")

# ---------------------------------------------------------------------------
# 2. Build year-over-year transitions: for each (player, N) find (player, N+1).
# ---------------------------------------------------------------------------
next_year_lookup <- rosters |>
  transmute(gsis_id,
            season_n = season - 1L,   # so this row is the "next" season for season_n
            team_next = team)

transitions <- rosters |>
  rename(season_n = season, team_n = team) |>
  left_join(next_year_lookup,
            by = c("gsis_id", "season_n"),
            relationship = "one-to-one")

# Restrict to transition_seasons (N such that N+1 is resolvable).
transitions <- transitions |>
  filter(season_n %in% transition_seasons) |>
  # UFA-eligibility proxy: at least 3 accrued seasons at the end of season N.
  # years_exp on rosters is "years entering this season" per nflreadr;
  # so a rookie is years_exp = 0, a third-year vet is years_exp = 2.
  # "Entering season N+1 with >= 3 accrued" = years_exp at season N >= 2.
  # We widen to >= 2 to include RFA-eligible players who also move.
  filter(!is.na(years_exp), years_exp >= 2L) |>
  mutate(
    outcome = case_when(
      is.na(team_next)          ~ "out_of_league",
      team_next == team_n       ~ "re_sign_before_fa",
      TRUE                      ~ "signed_elsewhere"
    )
  )

cat("Eligible-UFA transitions rows:", nrow(transitions), "\n")

# ---------------------------------------------------------------------------
# 3. UFA pool composition — distinct eligible UFAs per offseason, by position.
#    "Pool" here = season-N roster members with >= 2 years_exp who were NOT
#    re-signed before FA (i.e. signed_elsewhere + out_of_league would enter
#    the open market, except out_of_league are retirees/cut depth who don't
#    sign anywhere in the league). The effective FA pool the sim samples is
#    signed_elsewhere + (subset of) out_of_league who could still sign.
#    We report all three so the generator can choose the gate.
# ---------------------------------------------------------------------------
pool_by_pos_year <- transitions |>
  mutate(outcome = factor(outcome,
                          levels = c("re_sign_before_fa",
                                     "signed_elsewhere",
                                     "out_of_league"))) |>
  count(season_n, position_group, outcome, name = "n", .drop = FALSE) |>
  pivot_wider(names_from = outcome, values_from = n, values_fill = 0) |>
  mutate(
    eligible_ufas = re_sign_before_fa + signed_elsewhere + out_of_league,
    open_market_pool = signed_elsewhere + out_of_league
  )

pool_summary <- pool_by_pos_year |>
  group_by(position_group) |>
  summarise(
    seasons = n(),
    mean_eligible_ufas = mean(eligible_ufas),
    sd_eligible_ufas = stats::sd(eligible_ufas),
    mean_open_market_pool = mean(open_market_pool),
    sd_open_market_pool = stats::sd(open_market_pool),
    mean_re_sign_before_fa = mean(re_sign_before_fa),
    mean_signed_elsewhere = mean(signed_elsewhere),
    mean_out_of_league = mean(out_of_league),
    .groups = "drop"
  ) |>
  arrange(desc(mean_open_market_pool))

total_open_market <- sum(pool_summary$mean_open_market_pool)

pool_summary <- pool_summary |>
  mutate(open_market_share = mean_open_market_pool / total_open_market)

pool_list <- setNames(
  lapply(seq_len(nrow(pool_summary)), function(i) {
    row <- pool_summary[i, ]
    list(
      seasons_sampled = row$seasons,
      mean_eligible_ufas_per_offseason = row$mean_eligible_ufas,
      sd_eligible_ufas = row$sd_eligible_ufas,
      mean_open_market_pool_per_offseason = row$mean_open_market_pool,
      sd_open_market_pool = row$sd_open_market_pool,
      open_market_pool_share = row$open_market_share,
      mean_re_sign_before_fa = row$mean_re_sign_before_fa,
      mean_signed_elsewhere = row$mean_signed_elsewhere,
      mean_out_of_league = row$mean_out_of_league
    )
  }),
  pool_summary$position_group
)

# ---------------------------------------------------------------------------
# 4. Re-sign rate gating — three outcomes, by position.
#    re_sign_rate = re_sign_before_fa / eligible_ufas
#    signed_elsewhere_rate = signed_elsewhere / eligible_ufas
#    out_of_league_rate = out_of_league / eligible_ufas
#    (Matches the issue's ask: distinguish re-sign-before-FA from open-market
#    outcomes.)
# ---------------------------------------------------------------------------
rate_by_pos <- transitions |>
  group_by(position_group) |>
  summarise(
    eligible_ufas = n(),
    re_sign_before_fa = sum(outcome == "re_sign_before_fa"),
    signed_elsewhere = sum(outcome == "signed_elsewhere"),
    out_of_league = sum(outcome == "out_of_league"),
    .groups = "drop"
  ) |>
  mutate(
    re_sign_rate = re_sign_before_fa / eligible_ufas,
    signed_elsewhere_rate = signed_elsewhere / eligible_ufas,
    out_of_league_rate = out_of_league / eligible_ufas
  ) |>
  arrange(desc(re_sign_rate))

rate_list <- setNames(
  lapply(seq_len(nrow(rate_by_pos)), function(i) {
    row <- rate_by_pos[i, ]
    list(
      eligible_ufas = row$eligible_ufas,
      re_sign_before_fa = row$re_sign_before_fa,
      signed_elsewhere = row$signed_elsewhere,
      out_of_league = row$out_of_league,
      re_sign_rate = row$re_sign_rate,
      signed_elsewhere_rate = row$signed_elsewhere_rate,
      out_of_league_rate = row$out_of_league_rate
    )
  }),
  rate_by_pos$position_group
)

# ---------------------------------------------------------------------------
# 5. Re-sign rate by (position, tier) — enrich with OTC contracts so the sim
#    can reproduce the tier multiplier (top-10 retention > top-25 > top-50 >
#    rest). A player is placed in a tier by the APY of the contract they
#    signed in offseason N+1; players without a signed contract (out-of-league
#    / camp-body minimums) fall into "rest".
# ---------------------------------------------------------------------------
cat("Loading contracts\n")
contracts_raw <- nflreadr::load_contracts()

# Rank APYs within each position group across the full window so tiers are
# stable (same convention as free-agent-market.R).
position_tiers <- contracts_raw |>
  filter(
    !is.na(year_signed), !is.na(apy), !is.na(gsis_id), gsis_id != "",
    year_signed %in% (transition_seasons + 1L)
  ) |>
  mutate(
    position_group = case_when(
      position == "QB"                       ~ "QB",
      position %in% c("RB", "FB")            ~ "RB",
      position == "WR"                       ~ "WR",
      position == "TE"                       ~ "TE",
      position %in% c("LT", "RT")            ~ "OT",
      position %in% c("LG", "RG", "C")       ~ "IOL",
      position %in% c("ED")                  ~ "EDGE",
      position == "IDL"                      ~ "IDL",
      position == "LB"                       ~ "LB",
      position == "CB"                       ~ "CB",
      position == "S"                        ~ "S",
      position %in% c("K", "P", "LS")        ~ "ST",
      TRUE                                   ~ "other"
    )
  ) |>
  filter(position_group != "other") |>
  group_by(position_group) |>
  mutate(apy_rank = rank(-apy, ties.method = "first")) |>
  ungroup() |>
  mutate(tier = case_when(
    apy_rank <= 10 ~ "top_10",
    apy_rank <= 25 ~ "top_25",
    apy_rank <= 50 ~ "top_50",
    TRUE           ~ "rest"
  )) |>
  transmute(gsis_id, year_signed, position_group_c = position_group, tier)

# Join transitions (keyed on player + offseason) to their signed contract.
transitions_with_tier <- transitions |>
  mutate(offseason = season_n + 1L) |>
  left_join(
    position_tiers,
    by = c("gsis_id" = "gsis_id", "offseason" = "year_signed")
  ) |>
  mutate(tier = ifelse(is.na(tier), "rest", tier))

rate_by_pos_tier <- transitions_with_tier |>
  group_by(position_group, tier) |>
  summarise(
    eligible_ufas = n(),
    re_sign_before_fa = sum(outcome == "re_sign_before_fa"),
    signed_elsewhere = sum(outcome == "signed_elsewhere"),
    out_of_league = sum(outcome == "out_of_league"),
    .groups = "drop"
  ) |>
  mutate(
    re_sign_rate = re_sign_before_fa / eligible_ufas,
    signed_elsewhere_rate = signed_elsewhere / eligible_ufas
  )

rate_tier_nested <- split(rate_by_pos_tier, rate_by_pos_tier$position_group) |>
  lapply(function(df) {
    setNames(
      lapply(seq_len(nrow(df)), function(i) {
        list(
          eligible_ufas = df$eligible_ufas[i],
          re_sign_before_fa = df$re_sign_before_fa[i],
          signed_elsewhere = df$signed_elsewhere[i],
          out_of_league = df$out_of_league[i],
          re_sign_rate = df$re_sign_rate[i],
          signed_elsewhere_rate = df$signed_elsewhere_rate[i]
        )
      }),
      df$tier
    )
  })

# ---------------------------------------------------------------------------
# 6. Assemble and write
# ---------------------------------------------------------------------------
summaries <- list(
  pool_composition_by_position = pool_list,
  resign_rate_by_position = rate_list,
  resign_rate_by_position_tier = rate_tier_nested
)

out_path <- file.path(repo_root(), "data", "bands", "ufa-pool-composition.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "UFA pool composition and re-sign-vs-open-market gating derived from ",
    "year-over-year roster transitions (nflreadr::load_rosters()) rather than ",
    "contract rows. A player on a season-N roster with years_exp >= 2 is ",
    "counted as a potential UFA going into offseason N+1; outcome is ",
    "classified by comparing team_N to team_(N+1): re_sign_before_fa (same ",
    "team), signed_elsewhere (different team), out_of_league (no roster ",
    "appearance). open_market_pool = signed_elsewhere + out_of_league, which ",
    "is the effective sample space for the sim's FA generator AFTER applying ",
    "the re-sign-before-FA gate. Tier enrichment joins nflreadr::load_contracts() ",
    "on (gsis_id, offseason=year_signed) to place each transition in an APY ",
    "tier (top_10 / top_25 / top_50 / rest); unsigned / minimum deals fall to ",
    "rest. Position groups: QB, RB (incl FB/HB), WR, TE, OT (T/LT/RT), IOL ",
    "(G/LG/RG/C/OG), EDGE (DE/OLB/ED), IDL (DT/NT/DL), LB (ILB/MLB), CB (incl ",
    "DB), S (FS/SS/SAF), ST (K/P/LS)."
  )
)

cat("Wrote", out_path, "\n")

cat("\n=== Pool composition by position (mean per offseason) ===\n")
for (pg in names(pool_list)) {
  p <- pool_list[[pg]]
  cat(sprintf("  %-6s elig=%.1f  open_market=%.1f (share %.1f%%)  resign=%.1f  oofl=%.1f\n",
              pg,
              p$mean_eligible_ufas_per_offseason,
              p$mean_open_market_pool_per_offseason,
              100 * p$open_market_pool_share,
              p$mean_re_sign_before_fa,
              p$mean_out_of_league))
}

cat("\n=== Re-sign vs open-market rates by position ===\n")
for (pg in names(rate_list)) {
  r <- rate_list[[pg]]
  cat(sprintf("  %-6s  resign=%.1f%%  elsewhere=%.1f%%  oofl=%.1f%%  (n=%d)\n",
              pg,
              100 * r$re_sign_rate,
              100 * r$signed_elsewhere_rate,
              100 * r$out_of_league_rate,
              r$eligible_ufas))
}

cat("\n=== Re-sign rate by (position, tier) ===\n")
for (pg in names(rate_tier_nested)) {
  for (t in names(rate_tier_nested[[pg]])) {
    r <- rate_tier_nested[[pg]][[t]]
    cat(sprintf("  %-6s %-7s resign=%.1f%%  (n=%d)\n",
                pg, t, 100 * r$re_sign_rate, r$eligible_ufas))
  }
}
