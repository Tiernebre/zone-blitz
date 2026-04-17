#!/usr/bin/env Rscript
# play-call-tendencies.R — pass/run play-call rates by situation.
#
# Captures how pass rate shifts with down, distance, score differential,
# time remaining, and field zone. Feeds the sim's offensive play-selection
# AI so pass/run splits respond to game script (comeback mode, clock-kill,
# 3rd-and-long, red-zone goal-to-go).
#
# Pass/run denominator = play_type in {pass, run}, excluding kneels, spikes,
# and two-point conversion plays. A "called pass" uses qb_dropback (which
# counts sacks and scrambles as called passes) so that pressure-affected
# outcomes still land in the pass bucket.
#
# Usage:
#   Rscript data/R/bands/play-call-tendencies.R [--seasons 2020:2024]

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

# ---- Base filter: offensive snaps that count as pass or run ---------------
# qb_dropback == 1 captures called passes that end in a sack or scramble;
# play_type captures the actual outcome (pass / run).
plays <- pbp |>
  filter(
    season_type == "REG",
    !is.na(play_type),
    play_type %in% c("pass", "run"),
    qb_kneel == 0,
    qb_spike == 0,
    is.na(two_point_conv_result)
  ) |>
  mutate(
    called_pass = as.integer(
      play_type == "pass" | (!is.na(qb_dropback) & qb_dropback == 1)
    ),
    down_label = case_when(
      down == 1 ~ "1st",
      down == 2 ~ "2nd",
      down == 3 ~ "3rd",
      down == 4 ~ "4th",
      TRUE ~ NA_character_
    ),
    distance_bucket = case_when(
      ydstogo <= 2                   ~ "short_1_2",
      ydstogo <= 6                   ~ "medium_3_6",
      ydstogo <= 10                  ~ "long_7_10",
      TRUE                           ~ "very_long_11_plus"
    ),
    score_diff_bucket = case_when(
      is.na(score_differential)      ~ "unknown",
      score_differential <= -15      ~ "trailing_15_plus",
      score_differential <= -8       ~ "trailing_8_to_14",
      score_differential <= -1       ~ "trailing_1_to_7",
      score_differential == 0        ~ "tied",
      score_differential <= 7        ~ "leading_1_to_7",
      score_differential <= 14       ~ "leading_8_to_14",
      TRUE                           ~ "leading_15_plus"
    ),
    time_bucket = case_when(
      is.na(game_seconds_remaining)                              ~ "unknown",
      qtr == 2 & half_seconds_remaining <= 120                   ~ "two_min_h1",
      qtr == 4 & half_seconds_remaining <= 300                   ~ "under_5_min_q4",
      qtr == 4 & half_seconds_remaining <= 120                   ~ "two_min_q4",
      qtr >= 4                                                   ~ "q4_early",
      qtr == 3                                                   ~ "q3",
      qtr == 2                                                   ~ "q2",
      qtr == 1                                                   ~ "q1",
      TRUE                                                       ~ "other"
    ),
    field_zone = case_when(
      is.na(yardline_100)            ~ "unknown",
      yardline_100 > 80              ~ "own_deep",
      yardline_100 > 60              ~ "own_side",
      yardline_100 > 40              ~ "midfield",
      yardline_100 > 20              ~ "opp_side",
      yardline_100 > 10              ~ "red_zone_outer",
      yardline_100 > 4               ~ "red_zone_inner",
      TRUE                           ~ "goal_to_go"
    )
  ) |>
  filter(!is.na(down_label))

cat("Plays analyzed:", nrow(plays), "\n")

# ---- Helper: summarise a grouping into a nested list --------------------

summarise_pass_rate <- function(df, ...) {
  groups <- enquos(...)
  df |>
    group_by(!!!groups) |>
    summarise(
      n = n(),
      rate = mean(called_pass),
      called_pass = sum(called_pass),
      .groups = "drop"
    )
}

nest_by <- function(df, keys) {
  # Turn a tidy summary into nested named lists in the order of `keys`.
  if (length(keys) == 0) {
    return(lapply(seq_len(nrow(df)), function(i) {
      list(n = df$n[i], called_pass = df$called_pass[i], rate = df$rate[i])
    })[[1]])
  }
  first <- keys[[1]]
  rest <- keys[-1]
  splits <- split(df, df[[first]])
  setNames(
    lapply(splits, function(sub) {
      if (length(rest) == 0) {
        list(
          n = sub$n[1],
          called_pass = sub$called_pass[1],
          rate = sub$rate[1]
        )
      } else {
        nest_by(sub, rest)
      }
    }),
    names(splits)
  )
}

# ---- Overall baseline ------------------------------------------------------

overall <- list(
  n = nrow(plays),
  called_pass = sum(plays$called_pass),
  rate = mean(plays$called_pass)
)

# ---- By down --------------------------------------------------------------

by_down <- plays |>
  summarise_pass_rate(down_label) |>
  nest_by(list("down_label"))

# ---- By down x distance ---------------------------------------------------

by_down_distance <- plays |>
  summarise_pass_rate(down_label, distance_bucket) |>
  nest_by(list("down_label", "distance_bucket"))

# ---- By score differential x time ----------------------------------------

by_score_time <- plays |>
  summarise_pass_rate(score_diff_bucket, time_bucket) |>
  nest_by(list("score_diff_bucket", "time_bucket"))

# ---- By field zone --------------------------------------------------------

by_field_zone <- plays |>
  summarise_pass_rate(field_zone) |>
  nest_by(list("field_zone"))

# ---- Key headline slices (the "big 6" callouts from the issue) -----------
#
# Each of these is a narrow, named cell that the calibration harness can
# assert directly rather than walking the nested grid.

slice_rate <- function(df) {
  list(
    n = nrow(df),
    called_pass = sum(df$called_pass),
    rate = if (nrow(df) > 0) mean(df$called_pass) else NA_real_
  )
}

headline_slices <- list(
  trailing_7_plus_late_q4 = slice_rate(
    plays |> filter(
      score_differential <= -7,
      qtr == 4,
      half_seconds_remaining <= 300
    )
  ),
  leading_14_plus_q4 = slice_rate(
    plays |> filter(
      score_differential >= 14,
      qtr == 4
    )
  ),
  third_and_long_7_plus = slice_rate(
    plays |> filter(down == 3, ydstogo >= 7)
  ),
  third_and_short_1_2 = slice_rate(
    plays |> filter(down == 3, ydstogo <= 2)
  ),
  red_zone_goal_to_go = slice_rate(
    plays |> filter(yardline_100 <= 10, goal_to_go == 1)
  ),
  two_min_drill_h1 = slice_rate(
    plays |> filter(qtr == 2, half_seconds_remaining <= 120)
  ),
  two_min_drill_q4 = slice_rate(
    plays |> filter(qtr == 4, half_seconds_remaining <= 120)
  )
)

# ---- Assemble and write ---------------------------------------------------

summaries <- list(
  pass_rate_overall = overall,
  pass_rate_by_down = by_down,
  pass_rate_by_down_and_distance = by_down_distance,
  pass_rate_by_score_diff_and_time = by_score_time,
  pass_rate_by_field_zone = by_field_zone,
  pass_rate_headline_slices = headline_slices
)

out_path <- file.path(repo_root(), "data", "bands", "play-call-tendencies.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Regular-season plays only. Pass/run denominator = play_type in ",
    "{pass, run}, excluding kneels, spikes, and two-point conversions. ",
    "`called_pass` counts any snap where the outcome is a pass OR qb_dropback == 1 ",
    "(so sacks and scrambles land in the pass bucket — they represent called ",
    "passes whose outcome was affected by pressure). ",
    "Distance buckets: short (1-2), medium (3-6), long (7-10), very_long (11+). ",
    "Score differential buckets (from offense perspective): trailing_15_plus, ",
    "trailing_8_to_14, trailing_1_to_7, tied, leading_1_to_7, leading_8_to_14, ",
    "leading_15_plus. Time buckets prioritise the late-game windows that matter ",
    "most for clock management: two_min_h1, two_min_q4, under_5_min_q4, ",
    "q4_early, q3, q2, q1. Field zones: own_deep (>80), own_side (61-80), ",
    "midfield (41-60), opp_side (21-40), red_zone_outer (11-20), ",
    "red_zone_inner (5-10), goal_to_go (<=4). ",
    "`headline_slices` are pre-computed named cells for the big 6 tendencies ",
    "the calibration harness cares about: trailing 7+ late Q4 (expect ~85% pass), ",
    "leading 14+ Q4 (expect ~30% pass, clock kill), 3rd-and-long 7+ (expect ~90%), ",
    "3rd-and-short 1-2, red-zone goal-to-go (expect ~45%), and the two 2-minute drills."
  )
)

cat("Wrote", out_path, "\n")
