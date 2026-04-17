#!/usr/bin/env Rscript
# per-position-s.R — NFL safety (S) percentile-band reference.
#
# Pulls weekly defensive stats from load_player_stats, aggregates to
# per-safety-season lines, filters to starters (season games >= 10 AND
# total tackles >= 40 — snap counts aren't in load_player_stats, so we
# proxy with games + tackle volume), ranks by a playmaker composite
# (INTs + PBUs + forced fumbles + sacks per game), and carves the
# population into five percentile bands.
#
# Caveat: nflreadr's per-player weekly defense feed does NOT expose
# targets-allowed, completion-allowed%, or yards-allowed-per-target on
# a per-safety basis — those stats require a play-by-play join with a
# target-defender field that isn't in this release. The four metrics
# below are the defensible per-season numbers we can read directly:
# tackles/game, INT rate, PBU rate, forced-fumble rate. Downstream
# slices that need coverage-yield metrics will need a pbp-level R
# script; this one deliberately stays at the per-player-week grain to
# keep the fixture reproducible.
#
# Output: data/bands/per-position/s.json
#
# Usage:
#   Rscript data/R/bands/per-position-s.R [--seasons 2020:2024]

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

cat("Loading weekly defensive player stats for seasons:",
    paste(range(seasons), collapse = "-"), "\n")

weekly <- nflreadr::load_player_stats(seasons, stat_type = "defense")

# nflreadr collapses FS/SS into a single "S" position_group; keep the
# filter permissive so reclassified safeties (e.g., nickel or big-slot
# hybrids tagged as "DB") still flow through.
s_weekly <- weekly |>
  filter(
    season_type == "REG",
    position %in% c("S", "FS", "SS") |
      position_group %in% c("S", "DB", "SAF")
  ) |>
  # Restrict to rows that logged any defensive activity — avoids
  # sweeping in special-teams-only appearances.
  filter(
    !is.na(def_tackles_solo),
    def_tackles_solo + def_tackle_assists +
      def_pass_defended + def_interceptions > 0
  )

s_season <- s_weekly |>
  group_by(player_id, player_display_name, season) |>
  summarise(
    games           = n(),
    solo_tackles    = sum(def_tackles_solo, na.rm = TRUE),
    assist_tackles  = sum(def_tackle_assists, na.rm = TRUE),
    tackles_for_loss = sum(def_tackles_for_loss, na.rm = TRUE),
    ints            = sum(def_interceptions, na.rm = TRUE),
    pbus            = sum(def_pass_defended, na.rm = TRUE),
    sacks           = sum(def_sacks, na.rm = TRUE),
    forced_fumbles  = sum(def_fumbles_forced, na.rm = TRUE),
    .groups         = "drop"
  ) |>
  mutate(
    total_tackles       = solo_tackles + assist_tackles,
    tackles_per_game    = ifelse(games > 0, total_tackles / games, NA_real_),
    int_rate            = ifelse(games > 0, ints / games, NA_real_),
    pbu_rate            = ifelse(games > 0, pbus / games, NA_real_),
    forced_fumble_rate  = ifelse(games > 0, forced_fumbles / games, NA_real_),
    # Playmaker composite — rewards ball production over raw tackle
    # volume so a box safety who racks up tackles near the LOS doesn't
    # outrank a deep ball-hawk. Sacks added because modern safeties
    # blitz frequently and the column is already summed.
    playmaker_per_game  = ifelse(games > 0,
      (ints + pbus + forced_fumbles + sacks) / games, NA_real_)
  ) |>
  filter(games >= 10, total_tackles >= 40) # starter proxy

cat("S-seasons after starter filter:", nrow(s_season), "\n")

# Rank by playmaker composite then carve into percentile bands.
s_ranked <- s_season |>
  arrange(desc(playmaker_per_game)) |>
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
  "tackles_per_game",
  "int_rate",
  "pbu_rate",
  "forced_fumble_rate"
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
  rows <- s_ranked |> filter(band == band_name)
  bands[[band_name]] <- band_summary(rows)
}

out <- list(
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  seasons = as.integer(seasons),
  position = "S",
  qualifier = "regular-season S-seasons with >=10 games and >=40 total tackles",
  ranking_stat = "playmaker_per_game ((INTs + PBUs + forced fumbles + sacks) / games)",
  notes = paste0(
    "Starter safety seasons 2020-2024, ranked by playmaker composite ",
    "(INT + PBU + FF + sack per game) then carved into percentile bands ",
    "(elite: top 10%, good: 10-30%, average: 30-70%, weak: 70-90%, ",
    "replacement: bottom 10%). KNOWN GAP: nflreadr's per-player defense ",
    "feed does not expose targets-allowed or completion-allowed% per ",
    "safety, so the band set is limited to volume rates (tackles/game, ",
    "INT/game, PBU/game, forced-fumble/game). A coverage-yield band ",
    "would require a pbp target-defender join, which is out of scope ",
    "for this slice."
  ),
  bands = bands
)

out_path <- file.path(
  repo_root(), "data", "bands", "per-position", "s.json"
)
dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
writeLines(
  jsonlite::toJSON(out, auto_unbox = TRUE, pretty = TRUE, digits = 4,
                   null = "null"),
  out_path
)
cat("Wrote", out_path, "\n")
