#!/usr/bin/env Rscript
# rushing-plays.R — per-play rushing distributions.
#
# For calibrating the rush branch of the sim's synthesizer. Captures:
#
#   - Overall rush yardage distribution.
#   - Yardage by down/distance and by field zone (backed-up, midfield,
#     red zone) so the sim can reflect that red-zone runs look different.
#   - Big-play rate (10+, 20+, 40+ yard gains) per rush.
#   - Stuff rate (0 or negative yard runs) per rush.
#   - Fumble rate per rush and per rush TD.
#
# Note: splitting QB designed runs from RB/WR runs requires a roster position
# join — see issue #248 (position stat concentration) for that work.
#
# Usage:
#   Rscript data/R/bands/rushing-plays.R [--seasons 2020:2024]

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

# Rushes include designed QB runs but exclude scrambles (those are pass plays).
# Kneels and spikes are excluded even though kneels are technically rushes.
rushes <- pbp |>
  filter(
    season_type == "REG",
    rush == 1,
    qb_scramble == 0,
    qb_kneel == 0,
    is.na(two_point_conv_result)
  ) |>
  mutate(
    down_distance_bucket = case_when(
      is.na(down)                       ~ "unknown",
      down == 1                         ~ "1st",
      down == 2 & ydstogo <= 3          ~ "2nd_short",
      down == 2 & ydstogo >= 7          ~ "2nd_long",
      down == 2                         ~ "2nd_medium",
      down == 3 & ydstogo <= 3          ~ "3rd_short",
      down == 3 & ydstogo >= 7          ~ "3rd_long",
      down == 3                         ~ "3rd_medium",
      down == 4 & ydstogo <= 2          ~ "4th_short",
      down == 4                         ~ "4th_long",
      TRUE                              ~ "other"
    ),
    field_zone = case_when(
      is.na(yardline_100)               ~ "unknown",
      yardline_100 >= 90                ~ "own_deep",
      yardline_100 >= 50                ~ "own_side",
      yardline_100 >= 20                ~ "opp_side",
      yardline_100 >= 10                ~ "red_zone_outer",
      TRUE                              ~ "red_zone_inner"
    )
  )

cat("Rushes analyzed:", nrow(rushes), "\n")

# ---- Overall yardage distribution -----------------------------------------

overall <- distribution_summary(rushes$yards_gained)

# ---- By down/distance -----------------------------------------------------

by_bucket <- split(rushes$yards_gained, rushes$down_distance_bucket) |>
  lapply(distribution_summary)

# ---- By field zone --------------------------------------------------------

by_zone <- split(rushes$yards_gained, rushes$field_zone) |>
  lapply(distribution_summary)

# ---- Big-play and stuff rates --------------------------------------------

rate_stats <- rushes |>
  summarise(
    n             = n(),
    stuffs        = sum(yards_gained <= 0, na.rm = TRUE),
    gains_5plus   = sum(yards_gained >= 5, na.rm = TRUE),
    gains_10plus  = sum(yards_gained >= 10, na.rm = TRUE),
    gains_20plus  = sum(yards_gained >= 20, na.rm = TRUE),
    gains_40plus  = sum(yards_gained >= 40, na.rm = TRUE),
    touchdowns    = sum(rush_touchdown == 1, na.rm = TRUE),
    fumbles       = sum(fumble == 1, na.rm = TRUE),
    fumbles_lost  = sum(fumble_lost == 1, na.rm = TRUE)
  )

rates <- list(
  n_rushes                   = rate_stats$n,
  stuff_rate                 = rate_stats$stuffs / rate_stats$n,
  gain_5_plus_rate           = rate_stats$gains_5plus / rate_stats$n,
  gain_10_plus_rate          = rate_stats$gains_10plus / rate_stats$n,
  gain_20_plus_rate          = rate_stats$gains_20plus / rate_stats$n,
  gain_40_plus_rate          = rate_stats$gains_40plus / rate_stats$n,
  touchdown_rate             = rate_stats$touchdowns / rate_stats$n,
  fumble_rate                = rate_stats$fumbles / rate_stats$n,
  fumble_lost_rate           = rate_stats$fumbles_lost / rate_stats$n
)

# ---- Write the band ------------------------------------------------------

summaries <- list(
  overall = overall,
  by_down_distance = by_bucket,
  by_field_zone = by_zone,
  rates = rates
)

out_path <- file.path(repo_root(), "data", "bands", "rushing-plays.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Regular-season rushes only (rush == 1), excluding QB scrambles (those ",
    "are classified as dropbacks in passing-plays.json), kneels, and two-",
    "point conversions. down_distance_bucket splits non-1st downs into short ",
    "(<=3 or <=2 on 4th), medium (4-6), long (>=7). field_zone uses ",
    "yardline_100 (yards from opponent endzone): own_deep >=90, own_side ",
    "50-89, opp_side 20-49, red_zone_outer 10-19, red_zone_inner <10. ",
    "rates are per-rush fractions over the full window."
  )
)

cat("Wrote", out_path, "\n")
