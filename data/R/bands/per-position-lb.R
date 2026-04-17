#!/usr/bin/env Rscript
# per-position-lb.R — NFL LB percentile-band reference.
#
# Pulls weekly defensive stats from load_player_stats, aggregates to
# per-LB-season lines, filters to off-ball LB starters, ranks by a
# composite tackle-production score, and carves the population into
# five percentile bands (elite / good / average / weak / replacement).
#
# LB is a noisier bucket than QB/RB because the position straddles
# two NFL archetypes: off-ball ILB/MLB whose production is tackles +
# TFLs + PBUs, and edge OLBs whose production is sacks + QB hits.
# Zone Blitz keeps edge players in the `EDGE` neutral bucket, so this
# slice calibrates against off-ball LBs only — we exclude any OLB
# season with sacks/game >= 0.4 to drop pass-rush-first players whose
# tackle lines would drag every band downward.
#
# Output: data/bands/per-position/lb.json
#
# Usage:
#   Rscript data/R/bands/per-position-lb.R [--seasons 2020:2024]

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

cat("Loading weekly defensive stats for seasons:",
    paste(range(seasons), collapse = "-"), "\n")

weekly <- nflreadr::load_player_stats(seasons, stat_type = "defense")

lb_weekly <- weekly |>
  filter(
    season_type == "REG",
    position %in% c("LB", "ILB", "OLB", "MLB")
  )

# Aggregate weekly rows into per-LB-season totals. We want per-game
# rate stats (tackles/game, TFLs/game, PBUs/game) because the sim
# emits per-game samples and we bucket on the starter's season-long
# production rates.
lb_season <- lb_weekly |>
  group_by(player_id, player_display_name, position, season) |>
  summarise(
    games         = n(),
    tackles_solo  = sum(def_tackles_solo, na.rm = TRUE),
    tackle_assists = sum(def_tackle_assists, na.rm = TRUE),
    tfl           = sum(def_tackles_for_loss, na.rm = TRUE),
    sacks         = sum(def_sacks, na.rm = TRUE),
    pbu           = sum(def_pass_defended, na.rm = TRUE),
    .groups       = "drop"
  ) |>
  mutate(
    total_tackles = tackles_solo + tackle_assists,
    tackles_per_game = ifelse(games > 0, total_tackles / games, NA_real_),
    tfl_per_game    = ifelse(games > 0, tfl / games, NA_real_),
    solo_tackle_rate = ifelse(total_tackles > 0,
                              tackles_solo / total_tackles, NA_real_),
    pbu_per_game    = ifelse(games > 0, pbu / games, NA_real_),
    sacks_per_game  = ifelse(games > 0, sacks / games, NA_real_)
  ) |>
  # Starter threshold: appeared in >= 10 games with >= 40 total tackles
  # on the season. The tackle floor filters the "starter by position"
  # rows who were actually rotational (special teams only, spot starts
  # due to injury) and keeps the sample honest to true starters.
  filter(games >= 10, total_tackles >= 40) |>
  # Exclude edge-rushing OLBs whose role is pass-rush, not off-ball
  # coverage/run-fit. Their stat line (heavy sacks, light PBUs) would
  # be modelled by the EDGE neutral bucket in the sim, not the LB one.
  filter(!(position == "OLB" & sacks_per_game >= 0.4))

cat("LB-seasons after starter filter:", nrow(lb_season), "\n")

# Rank by a composite production score (tackles/gm + 2 * TFL/gm +
# 2 * PBU/gm). TFL and PBU are weighted higher than raw tackles
# because they separate playmakers from volume tacklers — an LB who
# piles up 8 tackles/gm behind the line of scrimmage is much more
# valuable than one who makes the same tackles four yards downfield.
lb_ranked <- lb_season |>
  mutate(
    composite = tackles_per_game + 2 * tfl_per_game + 2 * pbu_per_game
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
  "tackles_per_game",
  "tfl_per_game",
  "solo_tackle_rate",
  "pbu_per_game"
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
  rows <- lb_ranked |> filter(band == band_name)
  bands[[band_name]] <- band_summary(rows)
}

out <- list(
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  seasons = as.integer(seasons),
  position = "LB",
  qualifier = "regular-season LB-seasons, >=10 games, >=40 total tackles, excluding OLBs with >=0.4 sacks/game",
  ranking_stat = "composite (tackles/gm + 2 * TFL/gm + 2 * PBU/gm)",
  notes = paste0(
    "Starter off-ball LB-seasons 2020-2024, ranked by a tackle + TFL ",
    "+ PBU composite then carved into percentile bands (elite: top ",
    "10%, good: 10-30%, average: 30-70%, weak: 70-90%, replacement: ",
    "bottom 10%). Each band reports mean+sd per metric across the ",
    "LB-seasons in that band. Edge-rushing OLBs (sacks/game >= 0.4) ",
    "are excluded because Zone Blitz models them in the EDGE bucket."
  ),
  bands = bands
)

out_path <- file.path(
  repo_root(), "data", "bands", "per-position", "lb.json"
)
dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
writeLines(
  jsonlite::toJSON(out, auto_unbox = TRUE, pretty = TRUE, digits = 4,
                   null = "null"),
  out_path
)
cat("Wrote", out_path, "\n")
