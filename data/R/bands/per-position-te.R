#!/usr/bin/env Rscript
# per-position-te.R — NFL TE percentile-band reference.
#
# Pulls weekly TE stats from load_player_stats, aggregates to per-TE-season
# lines, filters to starters (season targets >= 30), ranks by receiving
# EPA/target, and carves the population into five percentile bands (elite /
# good / average / weak / replacement). For each band, reports mean + sd + n
# on the headline TE receiving metrics tracked by the sim.
#
# Output: data/bands/per-position/te.json
#
# Usage:
#   Rscript data/R/bands/per-position-te.R [--seasons 2020:2024]

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

te_weekly <- weekly |>
  filter(season_type == "REG", position == "TE", targets > 0)

# Aggregate weekly rows into per-TE-season totals. Starter threshold is
# 30 targets over a season — roughly two targets per game at the low
# end, which excludes rotational blocking TEs who don't factor into
# the receiving calibration we're measuring.
te_season <- te_weekly |>
  group_by(player_id, player_display_name, season) |>
  summarise(
    games         = n(),
    targets       = sum(targets, na.rm = TRUE),
    receptions    = sum(receptions, na.rm = TRUE),
    rec_yards     = sum(receiving_yards, na.rm = TRUE),
    rec_tds       = sum(receiving_tds, na.rm = TRUE),
    epa_total     = sum(receiving_epa, na.rm = TRUE),
    .groups       = "drop"
  ) |>
  mutate(
    catch_rate          = ifelse(targets > 0, receptions / targets, NA_real_),
    yards_per_reception = ifelse(receptions > 0,
                                 rec_yards / receptions, NA_real_),
    yards_per_target    = ifelse(targets > 0,
                                 rec_yards / targets, NA_real_),
    td_rate             = ifelse(targets > 0, rec_tds / targets, NA_real_),
    yards_per_game      = ifelse(games > 0, rec_yards / games, NA_real_),
    epa_per_target      = ifelse(targets > 0,
                                 epa_total / targets, NA_real_)
  ) |>
  filter(targets >= 30) # starter threshold: ~2 targets/game over 17 weeks

cat("TE-seasons after starter filter:", nrow(te_season), "\n")

# Rank by receiving EPA/target and assign percentile bands on the
# filtered starter population. Bands follow the scheme from issue #496:
# top 10% elite, next 20% good, middle 40% average, next 20% weak,
# bottom 10% replacement.
te_ranked <- te_season |>
  arrange(desc(epa_per_target)) |>
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
  "catch_rate",
  "yards_per_reception",
  "yards_per_target",
  "td_rate",
  "yards_per_game"
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
  rows <- te_ranked |> filter(band == band_name)
  bands[[band_name]] <- band_summary(rows)
}

out <- list(
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  seasons = as.integer(seasons),
  position = "TE",
  qualifier = "regular-season TE-seasons with >=30 targets",
  ranking_stat = "epa_per_target (receiving EPA / targets)",
  notes = paste0(
    "Starter TE-seasons 2020-2024, ranked by receiving EPA/target then ",
    "carved into percentile bands (elite: top 10%, good: 10-30%, average: ",
    "30-70%, weak: 70-90%, replacement: bottom 10%). Each band reports ",
    "mean+sd per metric across the TE-seasons in that band. catch_rate, ",
    "yards_per_target, and td_rate use targets as denominator; ",
    "yards_per_reception uses receptions; yards_per_game uses games ",
    "played. Rushing/blocking production is intentionally excluded from ",
    "the ranking stat — the sim's TE attribution covers receiving only."
  ),
  bands = bands
)

out_path <- file.path(
  repo_root(), "data", "bands", "per-position", "te.json"
)
dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
writeLines(
  jsonlite::toJSON(out, auto_unbox = TRUE, pretty = TRUE, digits = 4,
                   null = "null"),
  out_path
)
cat("Wrote", out_path, "\n")
