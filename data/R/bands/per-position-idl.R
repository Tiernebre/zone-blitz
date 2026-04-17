#!/usr/bin/env Rscript
# per-position-idl.R — NFL interior-DL (DT/NT) percentile-band reference.
#
# ** PROXY-METRIC CAVEAT **
# nflreadr (and the public nflverse stream more broadly) does NOT carry PFF
# pass-rush or run-defense grades. Those are the grades that actually
# separate a dominant interior DL (Aaron Donald / Chris Jones) from a
# rotational plugger who posts similar box-score numbers on a worse front.
# This v1 band uses counting stats only — sacks, QB hits, TFLs, and total
# tackles — as proxies for "how disruptive was this interior DL this
# season?". That has several known limitations that calibration consumers
# need to keep in mind:
#   * A stout 1-tech NT who eats double teams and frees up the LBs will
#     look statistically indistinguishable from a replacement-level DT,
#     because eating blocks doesn't show up in the box score.
#   * Pass-rush win rate is invisible: pressures that don't finish as
#     sacks or QB hits disappear entirely.
#   * EDGE rushers and off-ball LBs pad their tackle/TFL totals for free
#     on runs that bounce outside; the IDL only gets credited when they
#     finish the play, so the interior tackle counts under-represent
#     actual run-stopping contribution.
# Upgrade path: once we have a PFF-grade licensing story (or a decent
# public approximation — ESPN pass-rush win rate, PFR adv-def splits, etc.)
# this script should switch its ranking stat from the counting-stat
# composite to a grade-based one and re-carve the bands. Documented on
# the PR that introduced this file so follow-up work can find it.
#
# What this script does:
#   - Pulls weekly defensive player stats from load_player_stats.
#   - Filters to position %in% c("DT", "NT"). nflverse uses NT as a
#     distinct label from DT so both need to be included.
#   - Aggregates to per-IDL-season totals. Starter threshold uses snap
#     counts ( >= 400 defensive snaps, roughly 24 snaps/game over a 17
#     game season) rather than raw games played; counting-stat totals
#     need a minimum workload denominator to not be dominated by backups
#     who caught one sack in a cameo appearance.
#   - Computes per-game rates (sacks_per_game, qb_hits_per_game,
#     tfl_per_game, tackles_per_game) because the sim emits per-game
#     samples and the NFL reference should live at the same grain.
#   - Ranks by a z-scored composite of those four per-game rates. A
#     composite is necessary because no single counting stat cleanly
#     separates tiers the way EPA/play does for QB — sacks reward
#     pass-rush specialists, tackles reward space eaters, and neither
#     on its own would bucket the Aaron Donalds above the Jonathan
#     Allens.
#   - Carves the starter population into five percentile bands
#     (elite / good / average / weak / replacement) and reports mean+sd
#     per metric.
#
# Output: data/bands/per-position/idl.json
#
# Usage:
#   Rscript data/R/bands/per-position-idl.R [--seasons 2020:2024]

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

weekly <- nflreadr::load_player_stats(seasons, stat_type = "defense")

# Snap counts aren't in load_player_stats — they come from the
# load_snap_counts loader. Pull them so we can apply a starter
# filter that's more discriminating than "played >= N games".
cat("Loading snap counts\n")
snaps <- nflreadr::load_snap_counts(seasons) |>
  filter(game_type == "REG") |>
  group_by(pfr_player_id, season) |>
  summarise(
    def_snaps = sum(defense_snaps, na.rm = TRUE),
    games     = n(),
    .groups   = "drop"
  )

idl_weekly <- weekly |>
  filter(season_type == "REG", position %in% c("DT", "NT"))

# Aggregate weekly rows into per-IDL-season totals. Every metric below
# uses "per game" as its cadence — see top-of-file note on sim grain.
idl_season <- idl_weekly |>
  group_by(player_id, player_display_name, position, season) |>
  summarise(
    weeks_played      = n(),
    tackles_solo      = sum(def_tackles_solo, na.rm = TRUE),
    tackles_assisted  = sum(def_tackle_assists, na.rm = TRUE),
    tackles_for_loss  = sum(def_tackles_for_loss, na.rm = TRUE),
    sacks             = sum(def_sacks, na.rm = TRUE),
    qb_hits           = sum(def_qb_hits, na.rm = TRUE),
    .groups           = "drop"
  ) |>
  mutate(
    tackles_total = tackles_solo + tackles_assisted
  )

# Join snap counts via gsis_it_id -> pfr_player_id mapping. load_players
# gives us the crosswalk.
cat("Loading player crosswalk\n")
players <- nflreadr::load_players() |>
  select(gsis_id, pfr_id)

idl_season <- idl_season |>
  left_join(players, by = c("player_id" = "gsis_id")) |>
  left_join(snaps, by = c("pfr_id" = "pfr_player_id", "season" = "season")) |>
  mutate(
    # Fall back to weeks_played when snap counts are missing so we don't
    # silently drop a player — flag them via def_snaps = NA instead so
    # the starter filter excludes them explicitly.
    games = ifelse(is.na(games), weeks_played, games)
  ) |>
  filter(!is.na(def_snaps), def_snaps >= 400, games > 0)

cat("IDL-seasons after starter filter (def_snaps >= 400):",
    nrow(idl_season), "\n")

idl_season <- idl_season |>
  mutate(
    sacks_per_game    = sacks / games,
    qb_hits_per_game  = qb_hits / games,
    tfl_per_game      = tackles_for_loss / games,
    tackles_per_game  = tackles_total / games
  )

# Composite ranking: z-score each per-game rate across the starter pop,
# then sum. Equal weights — no principled reason to weight sacks above
# TFLs when we're already admitting this is a proxy. Documented so it
# can be swapped for PFF grades later.
zscore <- function(x) {
  mu <- mean(x, na.rm = TRUE)
  sd <- stats::sd(x, na.rm = TRUE)
  if (is.na(sd) || sd == 0) return(rep(0, length(x)))
  (x - mu) / sd
}

idl_ranked <- idl_season |>
  mutate(
    composite = zscore(sacks_per_game) +
                zscore(qb_hits_per_game) +
                zscore(tfl_per_game) +
                zscore(tackles_per_game)
  ) |>
  arrange(desc(composite)) |>
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
  "tfl_per_game",
  "tackles_per_game"
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
  rows <- idl_ranked |> filter(band == band_name)
  bands[[band_name]] <- band_summary(rows)
}

out <- list(
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  seasons = as.integer(seasons),
  position = "IDL",
  qualifier = "regular-season DT/NT-seasons with >=400 defensive snaps",
  ranking_stat = "composite z-score of sacks/gm + qb_hits/gm + tfl/gm + tackles/gm",
  notes = paste0(
    "PROXY-METRIC v1 — nflreadr does not carry PFF pass-rush / run-defense ",
    "grades, so this band ranks interior DL (DT + NT) by a counting-stat ",
    "composite instead of true disruption rate. Known gaps: space-eating ",
    "1-tech NTs who draw double teams will under-score versus 3-techs who ",
    "finish tackles; pressures that don't finish as sacks/QB-hits are ",
    "invisible. Starter threshold is >=400 regular-season defensive snaps ",
    "(via load_snap_counts). Ranking composite is the z-score sum of ",
    "sacks/game + qb_hits/game + tfl/game + tackles/game across the ",
    "starter population. Bands are percentile carves of that composite ",
    "(elite: top 10%, good: 10-30%, average: 30-70%, weak: 70-90%, ",
    "replacement: bottom 10%). Each band reports mean+sd per metric over ",
    "the IDL-seasons in that band. Upgrade path once PFF grades are ",
    "available: swap the ranking stat for grade and re-carve."
  ),
  bands = bands
)

out_path <- file.path(
  repo_root(), "data", "bands", "per-position", "idl.json"
)
dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
writeLines(
  jsonlite::toJSON(out, auto_unbox = TRUE, pretty = TRUE, digits = 4,
                   null = "null"),
  out_path
)
cat("Wrote", out_path, "\n")
