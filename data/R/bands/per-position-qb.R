#!/usr/bin/env Rscript
# per-position-qb.R — NFL QB percentile-band reference.
#
# Pulls weekly QB stats from load_player_stats, aggregates to per-QB-season
# lines, filters to starters (season attempts >= 200), ranks by qb_epa/play,
# and carves the population into five percentile bands (elite / good /
# average / weak / replacement). For each band, reports mean + sd + n on the
# metrics we can stably measure for QB performance at the season level.
#
# Output: data/bands/per-position/qb.json
#
# Usage:
#   Rscript data/R/bands/per-position-qb.R [--seasons 2020:2024]

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

qb_weekly <- weekly |>
  filter(season_type == "REG", position == "QB", attempts > 0)

# Aggregate weekly rows into per-QB-season totals. We want season-level
# rate stats (completion %, YPA, TD%, INT%, sack%) because the sim
# emits per-game samples that we then bucket -- season rates have enough
# denominator to rank QBs cleanly against each other.
qb_season <- qb_weekly |>
  group_by(player_id, player_display_name, season) |>
  summarise(
    games       = n(),
    attempts    = sum(attempts, na.rm = TRUE),
    completions = sum(completions, na.rm = TRUE),
    pass_yards  = sum(passing_yards, na.rm = TRUE),
    pass_tds    = sum(passing_tds, na.rm = TRUE),
    ints        = sum(passing_interceptions, na.rm = TRUE),
    sacks       = sum(sacks_suffered, na.rm = TRUE),
    sack_yards  = sum(sack_yards_lost, na.rm = TRUE),
    epa_total   = sum(passing_epa, na.rm = TRUE),
    .groups     = "drop"
  ) |>
  mutate(
    # Denominator for completion%/YPA/TD%/INT% is attempts (excludes sacks),
    # matching how the sim's existing team-game calibration computes them.
    completion_pct = ifelse(attempts > 0, completions / attempts, NA_real_),
    yards_per_attempt = ifelse(attempts > 0, pass_yards / attempts, NA_real_),
    td_rate  = ifelse(attempts > 0, pass_tds / attempts, NA_real_),
    int_rate = ifelse(attempts > 0, ints / attempts, NA_real_),
    # Sack rate uses dropbacks (attempts + sacks) as denominator, which is
    # the standard definition and avoids crediting sacks to attempts.
    sack_rate = ifelse((attempts + sacks) > 0,
                       sacks / (attempts + sacks), NA_real_),
    epa_per_play = ifelse((attempts + sacks) > 0,
                          epa_total / (attempts + sacks), NA_real_)
  ) |>
  filter(attempts >= 200) # starter threshold

cat("QB-seasons after starter filter:", nrow(qb_season), "\n")

# Rank by EPA/play and assign percentile bands on the filtered starter
# population. Bands follow the scheme from issue #496: top 10% elite,
# next 20% good, middle 40% average, next 20% weak, bottom 10% replacement.
qb_ranked <- qb_season |>
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
  "completion_pct",
  "yards_per_attempt",
  "td_rate",
  "int_rate",
  "sack_rate"
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
  rows <- qb_ranked |> filter(band == band_name)
  bands[[band_name]] <- band_summary(rows)
}

out <- list(
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  seasons = as.integer(seasons),
  position = "QB",
  qualifier = "regular-season QB-seasons with >=200 attempts",
  ranking_stat = "epa_per_play (dropback EPA / (attempts + sacks))",
  notes = paste0(
    "Starter QB-seasons 2020-2024, ranked by EPA/play then carved into ",
    "percentile bands (elite: top 10%, good: 10-30%, average: 30-70%, ",
    "weak: 70-90%, replacement: bottom 10%). Each band reports mean+sd ",
    "per metric across the QB-seasons in that band. Completion%, YPA, ",
    "TD%, INT% use attempts as denominator; sack_rate uses dropbacks."
  ),
  bands = bands
)

out_path <- file.path(
  repo_root(), "data", "bands", "per-position", "qb.json"
)
dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
writeLines(
  jsonlite::toJSON(out, auto_unbox = TRUE, pretty = TRUE, digits = 4,
                   null = "null"),
  out_path
)
cat("Wrote", out_path, "\n")
