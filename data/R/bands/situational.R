#!/usr/bin/env Rscript
# situational.R — situational decision rates for sim calibration.
#
# Captures the rates at which NFL teams make and convert key situational
# decisions: 4th-down go-for-it, 2-point conversions, and onside kicks.
# These feed the sim's game-management AI so coaches go for it, attempt
# two-point conversions, and onside kick at realistic rates.
#
# Usage:
#   Rscript data/R/bands/situational.R [--seasons 2020:2024]

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

# ---- 4th-down go-for-it ----------------------------------------------------

fourth_downs <- pbp |>
  filter(
    season_type == "REG",
    down == 4,
    !is.na(play_type),
    play_type %in% c("pass", "run", "punt", "field_goal"),
    qb_kneel == 0,
    qb_spike == 0,
    is.na(two_point_conv_result)
  ) |>
  mutate(
    went_for_it = as.integer(play_type %in% c("pass", "run")),
    field_zone = case_when(
      yardline_100 > 60              ~ "own_deep",
      yardline_100 > 50              ~ "own_40_to_50",
      yardline_100 > 40              ~ "opp_40_to_50",
      yardline_100 > 30              ~ "opp_30_to_40",
      yardline_100 > 20              ~ "opp_red_zone_outer",
      TRUE                           ~ "opp_red_zone_inner"
    ),
    distance_bucket = case_when(
      ydstogo <= 2                   ~ "short_1_2",
      ydstogo <= 5                   ~ "medium_3_5",
      TRUE                           ~ "long_6_plus"
    )
  )

cat("4th-down plays analyzed:", nrow(fourth_downs), "\n")

fourth_down_go_rate_overall <- list(
  n = nrow(fourth_downs),
  go_for_it = sum(fourth_downs$went_for_it),
  rate = mean(fourth_downs$went_for_it)
)

fourth_down_by_zone_distance <- fourth_downs |>
  group_by(field_zone, distance_bucket) |>
  summarise(
    n = n(),
    go_for_it = sum(went_for_it),
    rate = mean(went_for_it),
    .groups = "drop"
  )

go_rate_by_zone_distance <- split(
  fourth_down_by_zone_distance,
  fourth_down_by_zone_distance$field_zone
) |>
  lapply(function(df) {
    setNames(
      lapply(seq_len(nrow(df)), function(i) {
        list(n = df$n[i], go_for_it = df$go_for_it[i], rate = df$rate[i])
      }),
      df$distance_bucket
    )
  })

# ---- 4th-down conversion rate -----------------------------------------------

fourth_down_attempts <- fourth_downs |>
  filter(went_for_it == 1)

conversion_overall <- list(
  n = nrow(fourth_down_attempts),
  converted = sum(fourth_down_attempts$fourth_down_converted, na.rm = TRUE),
  rate = mean(fourth_down_attempts$fourth_down_converted, na.rm = TRUE)
)

conversion_by_zone_distance <- fourth_down_attempts |>
  group_by(field_zone, distance_bucket) |>
  summarise(
    n = n(),
    converted = sum(fourth_down_converted, na.rm = TRUE),
    rate = mean(fourth_down_converted, na.rm = TRUE),
    .groups = "drop"
  )

conv_rate_by_zone_distance <- split(
  conversion_by_zone_distance,
  conversion_by_zone_distance$field_zone
) |>
  lapply(function(df) {
    setNames(
      lapply(seq_len(nrow(df)), function(i) {
        list(n = df$n[i], converted = df$converted[i], rate = df$rate[i])
      }),
      df$distance_bucket
    )
  })

# ---- 2-point conversion attempts --------------------------------------------

touchdowns <- pbp |>
  filter(
    season_type == "REG",
    touchdown == 1,
    !is.na(posteam)
  )

pat_plays <- pbp |>
  filter(
    season_type == "REG",
    extra_point_attempt == 1 | two_point_attempt == 1
  ) |>
  mutate(
    is_two_point = as.integer(two_point_attempt == 1),
    score_diff_at_td = score_differential,
    score_diff_bucket = case_when(
      is.na(score_diff_at_td)        ~ "unknown",
      score_diff_at_td <= -15         ~ "down_15_plus",
      score_diff_at_td <= -11         ~ "down_11_to_14",
      score_diff_at_td <= -8          ~ "down_8_to_10",
      score_diff_at_td <= -4          ~ "down_4_to_7",
      score_diff_at_td <= -1          ~ "down_1_to_3",
      score_diff_at_td == 0           ~ "tied",
      score_diff_at_td <= 3           ~ "up_1_to_3",
      score_diff_at_td <= 7           ~ "up_4_to_7",
      score_diff_at_td <= 10          ~ "up_8_to_10",
      score_diff_at_td <= 14          ~ "up_11_to_14",
      TRUE                            ~ "up_15_plus"
    )
  )

cat("PAT plays analyzed:", nrow(pat_plays), "\n")

two_point_attempt_rate_overall <- list(
  n = nrow(pat_plays),
  two_point_attempts = sum(pat_plays$is_two_point),
  rate = mean(pat_plays$is_two_point)
)

two_point_by_score_diff <- pat_plays |>
  group_by(score_diff_bucket) |>
  summarise(
    n = n(),
    two_point_attempts = sum(is_two_point),
    rate = mean(is_two_point),
    .groups = "drop"
  )

two_point_attempt_by_bucket <- setNames(
  lapply(seq_len(nrow(two_point_by_score_diff)), function(i) {
    list(
      n = two_point_by_score_diff$n[i],
      two_point_attempts = two_point_by_score_diff$two_point_attempts[i],
      rate = two_point_by_score_diff$rate[i]
    )
  }),
  two_point_by_score_diff$score_diff_bucket
)

# ---- 2-point conversion success rate ----------------------------------------

two_point_plays <- pat_plays |>
  filter(is_two_point == 1) |>
  mutate(
    success = as.integer(two_point_conv_result == "success")
  )

two_point_success_overall <- list(
  n = nrow(two_point_plays),
  successes = sum(two_point_plays$success, na.rm = TRUE),
  rate = mean(two_point_plays$success, na.rm = TRUE)
)

# ---- Onside kick attempts ----------------------------------------------------

kickoffs <- pbp |>
  filter(
    season_type == "REG",
    kickoff_attempt == 1,
    !is.na(posteam)
  ) |>
  mutate(
    is_onside = as.integer(own_kickoff_recovery == 1 | kick_distance < 25),
    recovered = as.integer(own_kickoff_recovery == 1),
    quarter = as.integer(qtr),
    game_secs = game_seconds_remaining,
    last_5_min_4q = as.integer(quarter == 4 & game_secs <= 300),
    kicking_team_diff = -score_differential,
    situation = case_when(
      last_5_min_4q == 1 & kicking_team_diff <= -9  ~ "late_4q_trailing_9_plus",
      last_5_min_4q == 1 & kicking_team_diff <= -1   ~ "late_4q_trailing_1_to_8",
      last_5_min_4q == 1 & kicking_team_diff == 0    ~ "late_4q_tied",
      last_5_min_4q == 1                              ~ "late_4q_leading",
      TRUE                                            ~ "other"
    )
  )

cat("Kickoffs analyzed:", nrow(kickoffs), "\n")

onside_attempt_overall <- list(
  n = nrow(kickoffs),
  onside_attempts = sum(kickoffs$is_onside, na.rm = TRUE),
  rate = mean(kickoffs$is_onside, na.rm = TRUE)
)

onside_by_situation <- kickoffs |>
  group_by(situation) |>
  summarise(
    n = n(),
    onside_attempts = sum(is_onside, na.rm = TRUE),
    rate = mean(is_onside, na.rm = TRUE),
    .groups = "drop"
  )

onside_attempt_by_situation <- setNames(
  lapply(seq_len(nrow(onside_by_situation)), function(i) {
    list(
      n = onside_by_situation$n[i],
      onside_attempts = onside_by_situation$onside_attempts[i],
      rate = onside_by_situation$rate[i]
    )
  }),
  onside_by_situation$situation
)

# ---- Onside kick recovery rate -----------------------------------------------

onside_kicks <- kickoffs |>
  filter(is_onside == 1)

onside_recovery_overall <- list(
  n = nrow(onside_kicks),
  recoveries = sum(onside_kicks$recovered, na.rm = TRUE),
  rate = if (nrow(onside_kicks) > 0) mean(onside_kicks$recovered, na.rm = TRUE) else NA_real_
)

# ---- Write the band ----------------------------------------------------------

summaries <- list(
  fourth_down_go_rate = list(
    overall = fourth_down_go_rate_overall,
    by_field_zone_and_distance = go_rate_by_zone_distance
  ),
  fourth_down_conversion_rate = list(
    overall = conversion_overall,
    by_field_zone_and_distance = conv_rate_by_zone_distance
  ),
  two_point_attempt_rate = list(
    overall = two_point_attempt_rate_overall,
    by_score_differential = two_point_attempt_by_bucket
  ),
  two_point_success_rate = two_point_success_overall,
  onside_kick_attempt_rate = list(
    overall = onside_attempt_overall,
    by_situation = onside_attempt_by_situation
  ),
  onside_kick_recovery_rate = onside_recovery_overall
)

out_path <- file.path(repo_root(), "data", "bands", "situational.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Regular-season plays only. ",
    "4th-down go-for-it: play_type in {pass, run} on down == 4, excluding kneels, ",
    "spikes, and two-point conversions; denominator includes punt and field_goal plays. ",
    "Field zones: own_deep (yardline_100 > 60), own_40_to_50 (51-60), opp_40_to_50 (41-50), ",
    "opp_30_to_40 (31-40), opp_red_zone_outer (21-30), opp_red_zone_inner (1-20). ",
    "Distance buckets: short (1-2), medium (3-5), long (6+). ",
    "2-point attempts: extra_point_attempt or two_point_attempt plays bucketed by ",
    "score_differential at the time of the PAT. ",
    "Onside kicks: kickoffs with kick_distance < 25 or own_kickoff_recovery == 1; ",
    "situation split by last 5 min of 4th quarter and score differential."
  )
)

cat("Wrote", out_path, "\n")
