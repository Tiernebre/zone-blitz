#!/usr/bin/env Rscript
# hail-mary.R — deep desperation pass outcome rates.
#
# Feeds the sim's end-of-half/end-of-game desperation branch. A "hail mary"
# is operationally defined as: pass attempt with air_yards >= 40 on a
# dropback thrown when the clock/score demands a big play. Because true
# hail marys are rare, we use a 10-season window.
#
# Usage:
#   Rscript data/R/bands/hail-mary.R [--seasons 2015:2024]

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
# Default to 10 seasons for hail mary (rare event)
seasons <- if (length(args) == 0) 2015:2024 else parse_seasons(args)

cat("Loading pbp for seasons:", paste(range(seasons), collapse = "-"), "\n")
pbp <- nflreadr::load_pbp(seasons)

# Broad deep-shot pool: air_yards >= 40
deep <- pbp |>
  filter(
    season_type == "REG",
    qb_dropback == 1,
    !is.na(air_yards),
    air_yards >= 40,
    qb_kneel == 0, qb_spike == 0,
    is.na(two_point_conv_result)
  ) |>
  mutate(
    outcome = case_when(
      sack == 1                 ~ "sack",
      interception == 1         ~ "interception",
      complete_pass == 1        ~ "complete",
      incomplete_pass == 1      ~ "incomplete",
      TRUE                      ~ "other"
    ),
    is_desperation = (
      (!is.na(game_seconds_remaining) & game_seconds_remaining <= 30) |
      (!is.na(half_seconds_remaining) & half_seconds_remaining <= 10)
    )
  )

cat("Deep attempts (air_yards>=40):", nrow(deep), "\n")

# All deep shots
all_deep_counts <- deep |> count(outcome) |> mutate(rate = n / sum(n))
all_deep <- setNames(
  lapply(seq_len(nrow(all_deep_counts)), function(i) {
    list(n = all_deep_counts$n[i], rate = all_deep_counts$rate[i])
  }),
  all_deep_counts$outcome
)

# Desperation subset: end of half or game
desp <- deep |> filter(is_desperation)
cat("Desperation deep attempts:", nrow(desp), "\n")
desp_counts <- desp |> count(outcome) |> mutate(rate = n / sum(n))
desp_mix <- setNames(
  lapply(seq_len(nrow(desp_counts)), function(i) {
    list(n = desp_counts$n[i], rate = desp_counts$rate[i])
  }),
  desp_counts$outcome
)

# Yardage on completions
completion_yards <- distribution_summary(
  deep$yards_gained[deep$outcome == "complete"]
)
air_yards_dist <- distribution_summary(deep$air_yards)
td_rate_deep <- mean(deep$touchdown, na.rm = TRUE)
td_rate_desp <- mean(desp$touchdown, na.rm = TRUE)

summaries <- list(
  deep_shots = list(
    n = nrow(deep),
    outcome_mix = all_deep,
    completion_yards = completion_yards,
    air_yards = air_yards_dist,
    touchdown_rate = td_rate_deep
  ),
  desperation = list(
    n = nrow(desp),
    outcome_mix = desp_mix,
    touchdown_rate = td_rate_desp,
    notes = "Subset of deep shots thrown with game_seconds_remaining <= 30 or half_seconds_remaining <= 10 — the end-of-half/game hail mary window."
  )
)

out_path <- file.path(repo_root(), "data", "bands", "hail-mary.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Regular-season dropbacks with air_yards >= 40. `deep_shots` is the ",
    "full population (every 40+ air-yard attempt, irrespective of clock). ",
    "`desperation` subsets to the true end-of-half/end-of-game window ",
    "(game_seconds_remaining <= 30 or half_seconds_remaining <= 10), ",
    "which is the sim's hail mary branch. outcome is mutually exclusive: ",
    "sack > interception > complete > incomplete. 10-season window used ",
    "(hail marys are rare — narrower windows produce unstable rates)."
  )
)

cat("Wrote", out_path, "\n")
