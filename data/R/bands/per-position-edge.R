#!/usr/bin/env Rscript
# per-position-edge.R — NFL EDGE rusher percentile-band reference.
#
# ============================================================================
# PROXY METRICS — v1 per issue #496
# ----------------------------------------------------------------------------
# EDGE is not a clean nflverse position label (players show up as DE or OLB
# depending on scheme) and — critically — nflreadr does NOT carry PFF
# pass-rush / run-defense grades. PFF is the gold-standard public data
# source for evaluating edge play (pass-rush win rate, run-defense grade,
# true pressures), but it's paid and not part of the nflverse release.
#
# This fixture therefore uses box-score proxies only:
#   - sacks_per_game     (proxy for pass-rush finishing)
#   - qb_hits_per_game   (proxy for pressure generation)
#   - tfl_per_game       (proxy for run-defense disruption)
#
# The ranking stat is a composite of those three. Expect higher variance
# than the QB / RB fixtures because:
#   1. Box-score defensive stats are lumpy week to week.
#   2. "Pressures" — the best proxy for pass-rush quality — is NOT in
#      load_player_stats. PFR's qb_hits is the closest free signal.
#   3. Edge-rusher usage varies wildly across schemes; DEs in a 4-3 and
#      OLBs in a 3-4 both show up here under the pass-rush threshold.
#
# Follow-up (tracked as a GitHub issue): swap the composite for a true
# pass-rush productivity metric (ESPN pass-rush-win-rate, or a licensed
# PFF grade pull) once available.
# ============================================================================
#
# Pulls weekly player stats from load_player_stats, filters to DE/OLB
# players meeting a pass-rush production threshold, aggregates to per-EDGE
# season lines, filters to "starters" (games >= 10 as a snap-count proxy),
# ranks by composite sack+qb_hit+tfl rate, and carves the population into
# five percentile bands (elite / good / average / weak / replacement). For
# each band, reports mean + sd + n on the proxy metrics.
#
# Output: data/bands/per-position/edge.json
#
# Usage:
#   Rscript data/R/bands/per-position-edge.R [--seasons 2020:2024]

suppressPackageStartupMessages({
  library(nflreadr)
  library(dplyr)
})

script_file <- (function() {
  args <- commandArgs(trailingOnly = FALSE)
  f <- grep("^--file=", args, value = TRUE)
  if (length(f) > 0) normalizePath(sub("^--file=", "", f[1]), mustWork = FALSE) else NULL
})()
source(file.path(dirname(script_file), "..", "lib.R"))

args <- commandArgs(trailingOnly = TRUE)
seasons <- parse_seasons(args)

cat("Loading weekly player stats for seasons:",
    paste(range(seasons), collapse = "-"), "\n")

# load_player_stats returns every stat category in one frame; the legacy
# stat_type arg is deprecated in nflreadr 1.5+. Filtering on `position`
# and the def_* columns is how we isolate edge defenders.
weekly <- nflreadr::load_player_stats(seasons)

edge_weekly <- weekly |>
  filter(season_type == "REG", position %in% c("DE", "OLB"))

# Aggregate weekly rows into per-player-season totals. Keep only seasons
# where the player (a) met a pass-rush production threshold and (b)
# played in >= 10 games — this combination filters out run-stuffing DEs
# and coverage-first OLBs and keeps the population close to NFL
# starting-caliber edge rushers.
edge_season <- edge_weekly |>
  group_by(player_id, player_display_name, season) |>
  summarise(
    games     = n(),
    sacks     = sum(def_sacks, na.rm = TRUE),
    qb_hits   = sum(def_qb_hits, na.rm = TRUE),
    tfl       = sum(def_tackles_for_loss, na.rm = TRUE),
    .groups   = "drop"
  ) |>
  mutate(
    sacks_per_game    = ifelse(games > 0, sacks / games, NA_real_),
    qb_hits_per_game  = ifelse(games > 0, qb_hits / games, NA_real_),
    tfl_per_game      = ifelse(games > 0, tfl / games, NA_real_),
    # Composite ranking stat: equally weighted sacks + qb_hits + tfl per
    # game. Not a real pass-rush grade — see PROXY METRICS header.
    rush_composite    = ifelse(games > 0,
                                (sacks + qb_hits + tfl) / games,
                                NA_real_)
  ) |>
  # Pass-rush production floor separates edge rushers from run-stuffing
  # DEs and coverage OLBs. 10 combined sacks+qb_hits across a season is
  # roughly the bottom of NFL starter-level edge play.
  filter(sacks + qb_hits >= 10, games >= 10)

cat("EDGE-seasons after production+games filter:", nrow(edge_season), "\n")

# Rank by composite and assign percentile bands on the filtered
# population. Bands follow the scheme from issue #496: top 10% elite,
# next 20% good, middle 40% average, next 20% weak, bottom 10%
# replacement.
edge_ranked <- edge_season |>
  arrange(desc(rush_composite)) |>
  mutate(
    pct = (row_number() - 0.5) / n(),
    band = case_when(
      pct <= 0.10 ~ "elite",
      pct <= 0.30 ~ "good",
      pct <= 0.70 ~ "average",
      pct <= 0.90 ~ "weak",
      TRUE        ~ "replacement"
    )
  )

metric_keys <- c(
  "sacks_per_game",
  "qb_hits_per_game",
  "tfl_per_game"
)

band_order <- c("elite", "good", "average", "weak", "replacement")

band_summary <- function(rows) {
  metrics <- list()
  for (key in metric_keys) {
    vals <- rows[[key]]
    vals <- vals[!is.na(vals)]
    metrics[[key]] <- list(
      n = length(vals),
      mean = mean(vals),
      sd = stats::sd(vals)
    )
  }
  list(
    n = nrow(rows),
    metrics = metrics
  )
}

bands <- list()
for (band_name in band_order) {
  rows <- edge_ranked |> filter(band == band_name)
  bands[[band_name]] <- band_summary(rows)
}

out <- list(
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  seasons = as.integer(seasons),
  position = "EDGE",
  qualifier = paste0(
    "regular-season DE/OLB-seasons with season sacks+qb_hits >= 10 and ",
    "games_played >= 10"
  ),
  ranking_stat = "rush_composite ((sacks + qb_hits + tfl) / games)",
  notes = paste0(
    "PROXY METRICS — v1 per issue #496. nflreadr does not carry PFF ",
    "pass-rush or run-defense grades, so this fixture uses box-score ",
    "proxies only: sacks_per_game, qb_hits_per_game, tfl_per_game. ",
    "Starter population = DE/OLB with season sacks+qb_hits >= 10 and ",
    "games_played >= 10 as a snap-count proxy (snap counts live in a ",
    "separate nflverse release keyed on pfr_player_id, which this ",
    "script intentionally does not join against — keeps the pipeline ",
    "single-source and cheap to regenerate). Ranked by composite ",
    "(sacks+qb_hits+tfl)/game then carved into percentile bands ",
    "(elite: top 10%, good: 10-30%, average: 30-70%, weak: 70-90%, ",
    "replacement: bottom 10%). Follow-up: swap composite for PFF ",
    "pass-rush grade or ESPN pass-rush-win-rate when available."
  ),
  bands = bands
)

out_path <- file.path(
  repo_root(), "data", "bands", "per-position", "edge.json"
)
dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
writeLines(
  jsonlite::toJSON(out, auto_unbox = TRUE, pretty = TRUE, digits = 4,
                   null = "null"),
  out_path
)
cat("Wrote", out_path, "\n")
