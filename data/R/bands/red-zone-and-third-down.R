#!/usr/bin/env Rscript
# red-zone-and-third-down.R — headline efficiency bands.
#
# The two most-cited offensive-efficiency stats in NFL analysis are
# red-zone TD rate and 3rd-down conversion rate. The sim currently has
# neither as a direct band — both are implicit outputs of the play
# synthesizer. Direct single-number bands let the calibration harness
# detect drift in one assertion instead of inferring from distribution
# shifts.
#
# Scope:
# - Red zone (yardline_100 <= 20): drive-level TD rate, inside-10 TD rate,
#   goal-to-go TD rate, play-level pass/run split, red-zone sack rate.
# - 3rd down: conversion rate by distance bucket, pass rate by distance
#   bucket, sack rate on 3rd-down dropbacks.
# - 4th-and-short go-for-it conversion is covered by `situational.json`
#   (field_zone x distance grid); this band includes a cross-link note
#   rather than duplicating.
#
# Usage:
#   Rscript data/R/bands/red-zone-and-third-down.R [--seasons 2020:2024]

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

# ---- Common offense filter ------------------------------------------------
# Regular season, offensive play with an identifiable posteam, excluding
# kneels, spikes, and two-point conversion plays.
offense <- pbp |>
  filter(
    season_type == "REG",
    !is.na(posteam),
    !is.na(play_type),
    play_type %in% c("pass", "run"),
    qb_kneel == 0,
    qb_spike == 0,
    is.na(two_point_conv_result)
  )

# =========================================================================
# Red zone
# =========================================================================

# ---- Drive-level red-zone TD rate ----------------------------------------
# A drive "reaches" the red zone if any play in the drive has yardline_100
# <= 20 (and the drive was for the team with the ball). TD rate = drive
# ended in offensive TD / drives that reached the red zone.
#
# We use `drive` + `game_id` + `posteam` as a drive key. `fixed_drive` is
# offense-indexed; `fixed_drive_result` holds the terminal result.

drive_rows <- pbp |>
  filter(
    season_type == "REG",
    !is.na(posteam),
    !is.na(fixed_drive),
    !is.na(yardline_100)
  )

red_zone_drives <- drive_rows |>
  group_by(game_id, posteam, fixed_drive) |>
  summarise(
    reached_rz = any(yardline_100 <= 20, na.rm = TRUE),
    reached_10 = any(yardline_100 <= 10, na.rm = TRUE),
    reached_gtg = any(goal_to_go == 1 & yardline_100 <= 10, na.rm = TRUE),
    result = dplyr::first(fixed_drive_result),
    .groups = "drop"
  ) |>
  mutate(
    td = as.integer(result == "Touchdown")
  )

rz_overall <- red_zone_drives |> filter(reached_rz)
rz_inside_10 <- red_zone_drives |> filter(reached_10)
rz_gtg <- red_zone_drives |> filter(reached_gtg)

cat("Red-zone drives:", nrow(rz_overall), "\n")

drive_td_rate <- function(df) {
  list(
    n = nrow(df),
    touchdowns = sum(df$td, na.rm = TRUE),
    rate = if (nrow(df) > 0) mean(df$td, na.rm = TRUE) else NA_real_
  )
}

red_zone_td_rate <- list(
  reach_red_zone = drive_td_rate(rz_overall),
  reach_inside_10 = drive_td_rate(rz_inside_10),
  reach_goal_to_go = drive_td_rate(rz_gtg)
)

# ---- Play-level red-zone pass/run split + sack rate ----------------------

rz_plays <- offense |>
  filter(!is.na(yardline_100), yardline_100 <= 20) |>
  mutate(
    called_pass = as.integer(
      play_type == "pass" | (!is.na(qb_dropback) & qb_dropback == 1)
    ),
    is_sack = as.integer(!is.na(sack) & sack == 1)
  )

rz_dropbacks <- rz_plays |> filter(called_pass == 1)

red_zone_play_mix <- list(
  n = nrow(rz_plays),
  called_pass = sum(rz_plays$called_pass),
  pass_rate = if (nrow(rz_plays) > 0) mean(rz_plays$called_pass) else NA_real_,
  run_rate = if (nrow(rz_plays) > 0) 1 - mean(rz_plays$called_pass) else NA_real_
)

red_zone_sack_rate <- list(
  n = nrow(rz_dropbacks),
  sacks = sum(rz_dropbacks$is_sack),
  rate = if (nrow(rz_dropbacks) > 0) mean(rz_dropbacks$is_sack) else NA_real_
)

# =========================================================================
# 3rd down
# =========================================================================

third_down <- offense |>
  filter(down == 3) |>
  mutate(
    called_pass = as.integer(
      play_type == "pass" | (!is.na(qb_dropback) & qb_dropback == 1)
    ),
    is_sack = as.integer(!is.na(sack) & sack == 1),
    converted = as.integer(!is.na(third_down_converted) & third_down_converted == 1),
    distance_bucket = case_when(
      ydstogo <= 2                   ~ "short_1_2",
      ydstogo <= 5                   ~ "medium_3_5",
      ydstogo <= 9                   ~ "long_6_9",
      TRUE                           ~ "very_long_10_plus"
    )
  )

cat("3rd-down plays:", nrow(third_down), "\n")

bucket_summary <- function(df, field, value_col = "rate") {
  rows <- df |>
    group_by(distance_bucket) |>
    summarise(
      n = n(),
      numerator = sum(.data[[field]]),
      rate = mean(.data[[field]]),
      .groups = "drop"
    )
  setNames(
    lapply(seq_len(nrow(rows)), function(i) {
      list(n = rows$n[i], numerator = rows$numerator[i], rate = rows$rate[i])
    }),
    rows$distance_bucket
  )
}

third_down_conversion_overall <- list(
  n = nrow(third_down),
  converted = sum(third_down$converted),
  rate = if (nrow(third_down) > 0) mean(third_down$converted) else NA_real_
)

third_down_conversion_by_distance <- bucket_summary(third_down, "converted")

third_down_pass_rate_overall <- list(
  n = nrow(third_down),
  called_pass = sum(third_down$called_pass),
  rate = if (nrow(third_down) > 0) mean(third_down$called_pass) else NA_real_
)

third_down_pass_rate_by_distance <- bucket_summary(third_down, "called_pass")

# Sack rate on 3rd-down dropbacks
third_down_dropbacks <- third_down |> filter(called_pass == 1)

third_down_sack_rate_overall <- list(
  n = nrow(third_down_dropbacks),
  sacks = sum(third_down_dropbacks$is_sack),
  rate = if (nrow(third_down_dropbacks) > 0) mean(third_down_dropbacks$is_sack) else NA_real_
)

third_down_sack_rate_by_distance <- bucket_summary(third_down_dropbacks, "is_sack")

# =========================================================================
# Assemble and write
# =========================================================================

summaries <- list(
  red_zone = list(
    touchdown_rate = red_zone_td_rate,
    play_mix = red_zone_play_mix,
    sack_rate_on_dropbacks = red_zone_sack_rate
  ),
  third_down = list(
    conversion_rate = list(
      overall = third_down_conversion_overall,
      by_distance = third_down_conversion_by_distance
    ),
    pass_rate = list(
      overall = third_down_pass_rate_overall,
      by_distance = third_down_pass_rate_by_distance
    ),
    sack_rate_on_dropbacks = list(
      overall = third_down_sack_rate_overall,
      by_distance = third_down_sack_rate_by_distance
    )
  ),
  fourth_down_short_reference = list(
    note = paste0(
      "4th-and-short go-for-it conversion is covered in ",
      "data/bands/situational.json under ",
      "fourth_down_conversion_rate.by_field_zone_and_distance. ",
      "Not duplicated here to avoid drift between the two artifacts."
    )
  )
)

out_path <- file.path(repo_root(), "data", "bands", "red-zone-and-third-down.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Regular-season plays only. ",
    "Red-zone touchdown rate is drive-indexed: a drive counts once if any ",
    "snap on that offensive drive reaches yardline_100 <= 20 (or <= 10 for ",
    "inside_10, or goal_to_go for reach_goal_to_go). `touchdowns` = drives ",
    "whose fixed_drive_result == 'Touchdown'. ",
    "Red-zone play mix is play-indexed over the same filter as ",
    "play-call-tendencies (play_type in {pass, run}, excluding kneels / ",
    "spikes / two-point conversions). `called_pass` = play_type == 'pass' ",
    "OR qb_dropback == 1 (counts sacks and scrambles as called passes). ",
    "Red-zone sack rate = sacks / dropbacks. ",
    "3rd-down distance buckets: short (1-2), medium (3-5), long (6-9), ",
    "very_long (10+). Conversion rate uses `third_down_converted`; ",
    "pass rate uses the same called_pass definition; sack rate denominator ",
    "is 3rd-down dropbacks only. ",
    "4th-and-short conversion is intentionally not duplicated here — see ",
    "data/bands/situational.json. ",
    "Measured 2020-2024 rates (for quick calibration-harness sanity check): ",
    "red-zone drive TD rate ~60%, inside-10 TD rate ~68%, goal-to-go TD rate ~73%, ",
    "red-zone pass rate ~54%, red-zone sack rate ~5.7%, 3rd-down conversion ~40%, ",
    "3rd-and-short (1-2) ~65%, 3rd-and-very-long (10+) ~19%."
  )
)

cat("Wrote", out_path, "\n")
