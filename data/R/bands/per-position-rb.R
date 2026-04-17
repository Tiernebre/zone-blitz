#!/usr/bin/env Rscript
# per-position-rb.R — NFL RB percentile-band reference.
#
# Pulls weekly RB stats from load_player_stats, aggregates to per-RB-season
# lines, filters to starters (season carries >= 100), ranks by rushing
# EPA/play, and carves the population into five percentile bands (elite /
# good / average / weak / replacement). For each band, reports mean + sd + n
# on the headline RB metrics tracked by the sim.
#
# Output: data/bands/per-position/rb.json
#
# Usage:
#   Rscript data/R/bands/per-position-rb.R [--seasons 2020:2024]

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

weekly <- nflreadr::load_player_stats(seasons, stat_type = "offense")

rb_weekly <- weekly |>
  filter(season_type == "REG", position == "RB", carries > 0)

# Aggregate weekly rows into per-RB-season totals. The sim samples on a
# per-game cadence and then rolls up to per-bucket means, so the NFL
# reference also lives at the per-season grain: season rates + per-game
# averages are stable enough to rank RBs cleanly against each other.
rb_season <- rb_weekly |>
  group_by(player_id, player_display_name, season) |>
  summarise(
    games       = n(),
    carries     = sum(carries, na.rm = TRUE),
    rush_yards  = sum(rushing_yards, na.rm = TRUE),
    rush_tds    = sum(rushing_tds, na.rm = TRUE),
    fumbles     = sum(rushing_fumbles_lost, na.rm = TRUE),
    epa_total   = sum(rushing_epa, na.rm = TRUE),
    .groups     = "drop"
  ) |>
  mutate(
    yards_per_carry = ifelse(carries > 0, rush_yards / carries, NA_real_),
    rush_td_rate    = ifelse(carries > 0, rush_tds / carries, NA_real_),
    yards_per_game  = ifelse(games > 0, rush_yards / games, NA_real_),
    fumble_rate     = ifelse(carries > 0, fumbles / carries, NA_real_),
    epa_per_play    = ifelse(carries > 0, epa_total / carries, NA_real_)
  ) |>
  filter(carries >= 100) # starter threshold: ~6 carries/game over 17 weeks

cat("RB-seasons after starter filter:", nrow(rb_season), "\n")

# Rank by EPA/play and assign percentile bands on the filtered starter
# population. Bands follow the scheme from issue #496: top 10% elite,
# next 20% good, middle 40% average, next 20% weak, bottom 10% replacement.
rb_ranked <- rb_season |>
  arrange(desc(epa_per_play)) |>
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
  "yards_per_carry",
  "rush_td_rate",
  "yards_per_game",
  "fumble_rate"
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
  rows <- rb_ranked |> filter(band == band_name)
  bands[[band_name]] <- band_summary(rows)
}

out <- list(
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  seasons = as.integer(seasons),
  position = "RB",
  qualifier = "regular-season RB-seasons with >=100 carries",
  ranking_stat = "epa_per_play (rushing EPA / carries)",
  notes = paste0(
    "Starter RB-seasons 2020-2024, ranked by rushing EPA/play then carved ",
    "into percentile bands (elite: top 10%, good: 10-30%, average: 30-70%, ",
    "weak: 70-90%, replacement: bottom 10%). Each band reports mean+sd per ",
    "metric across the RB-seasons in that band. YPC, rush_td_rate, and ",
    "fumble_rate use carries as denominator; yards_per_game uses games ",
    "played. Receiving production is intentionally excluded from the ",
    "ranking stat — the sim's RB attribution covers rush attempts only."
  ),
  bands = bands
)

out_path <- file.path(
  repo_root(), "data", "bands", "per-position", "rb.json"
)
dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
writeLines(
  jsonlite::toJSON(out, auto_unbox = TRUE, pretty = TRUE, digits = 4,
                   null = "null"),
  out_path
)
cat("Wrote", out_path, "\n")
