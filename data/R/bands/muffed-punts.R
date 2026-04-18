#!/usr/bin/env Rscript
# muffed-punts.R — punt outcome distributions including muffs/recoveries.
#
# Feeds ST4 PuntModel. Captures outcome mix (touchback, fair catch, return,
# muff, downed, out of bounds, blocked), net punt yards, return yards, and
# muff-recovery outcomes.
#
# Usage:
#   Rscript data/R/bands/muffed-punts.R [--seasons 2020:2024]

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

cat("Loading pbp for seasons:", paste(range(seasons), collapse = "-"), "\n")
pbp <- nflreadr::load_pbp(seasons)

punts <- pbp |>
  filter(season_type == "REG", play_type == "punt") |>
  mutate(
    # nflfastR has columns: punt_blocked, touchback, fair_catch,
    # punt_downed, punt_out_of_bounds, fumble_forced (on receiver),
    # fumble_lost. A "muffed" punt is typically a receiver fumble on
    # punt play -> detected via fumble == 1 while return phase.
    outcome = case_when(
      punt_blocked == 1                                       ~ "blocked",
      !is.na(touchback) & touchback == 1                      ~ "touchback",
      !is.na(punt_fair_catch) & punt_fair_catch == 1          ~ "fair_catch",
      !is.na(punt_downed) & punt_downed == 1                  ~ "downed",
      !is.na(punt_out_of_bounds) & punt_out_of_bounds == 1    ~ "out_of_bounds",
      fumble == 1                                              ~ "muffed",
      !is.na(return_yards) & return_yards != 0                ~ "returned",
      TRUE                                                     ~ "other"
    )
  )

total <- nrow(punts)
cat("Punts analyzed:", total, "\n")

outcome_counts <- punts |>
  count(outcome) |>
  mutate(rate = n / sum(n))

outcome_mix <- setNames(
  lapply(seq_len(nrow(outcome_counts)), function(i) {
    list(n = outcome_counts$n[i], rate = outcome_counts$rate[i])
  }),
  outcome_counts$outcome
)

# Muff-specific: fumble == 1 on punts. Recovery split.
muffs <- punts |> filter(outcome == "muffed")
muff_detail <- list(
  n = nrow(muffs),
  rate_per_punt = nrow(muffs) / total,
  lost_rate = mean(muffs$fumble_lost, na.rm = TRUE),
  recovered_by_kicking_team_n = sum(muffs$fumble_lost == 1, na.rm = TRUE),
  recovered_by_receiving_team_n = sum(muffs$fumble_lost == 0, na.rm = TRUE)
)

# Distance/return summaries
distances <- distribution_summary(punts$kick_distance[!is.na(punts$kick_distance)])
return_yards <- distribution_summary(
  punts$return_yards[punts$outcome == "returned" & !is.na(punts$return_yards)]
)
net_yards <- distribution_summary(
  punts$kick_distance - ifelse(is.na(punts$return_yards), 0, punts$return_yards)
)

summaries <- list(
  overall = list(n_punts = total),
  outcome_mix = outcome_mix,
  muffs = muff_detail,
  kick_distance = distances,
  return_yards_on_returns = return_yards,
  net_yards = net_yards
)

out_path <- file.path(repo_root(), "data", "bands", "muffed-punts.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Regular-season punts only (play_type == 'punt'). Outcome is a ",
    "mutually-exclusive classification: blocked > touchback > fair_catch > ",
    "downed > out_of_bounds > muffed (fumble == 1) > returned (non-zero ",
    "return yards) > other. muffs.lost_rate = fumble_lost mean among muffs ",
    "(i.e. P(kicking team recovers | muff)). kick_distance is gross punt ",
    "distance; net_yards subtracts return yards (0 when no return)."
  )
)

cat("Wrote", out_path, "\n")
