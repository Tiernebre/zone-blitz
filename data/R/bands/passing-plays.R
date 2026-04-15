#!/usr/bin/env Rscript
# passing-plays.R — per-play passing distributions.
#
# For calibrating the pass-play outcome tree in
# server/features/simulation/resolve-play.ts (synthesizeOutcome). Captures:
#
#   - Dropback outcome mix (completion, incompletion, sack, interception,
#     scramble) — the rates a sim pass play should resolve to.
#   - Yardage distributions by outcome — completion yards, sack yards,
#     air yards, yards after catch — to tune the yardage buckets in the
#     synthesizer.
#   - Big-play rate (20+ yard completions) per dropback.
#   - Outcome mix by down/distance context so the sim can reflect that
#     long-down dropbacks sack more and complete less.
#
# Usage:
#   Rscript data/R/bands/passing-plays.R [--seasons 2020:2024]

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

# A "dropback" is any pass play including sacks and scrambles — the QB
# intended to pass. This is the denominator the sim's pass branch needs.
dropbacks <- pbp |>
  filter(
    season_type == "REG",
    qb_dropback == 1,
    qb_kneel == 0,
    qb_spike == 0,
    is.na(two_point_conv_result)
  ) |>
  mutate(
    outcome = case_when(
      sack == 1                         ~ "sack",
      interception == 1                 ~ "interception",
      qb_scramble == 1                  ~ "scramble",
      complete_pass == 1                ~ "complete",
      incomplete_pass == 1              ~ "incomplete",
      TRUE                              ~ "other"
    ),
    down_distance_bucket = case_when(
      is.na(down)                       ~ "unknown",
      down == 1                         ~ "1st",
      down == 2 & ydstogo <= 3          ~ "2nd_short",
      down == 2 & ydstogo >= 7          ~ "2nd_long",
      down == 2                         ~ "2nd_medium",
      down == 3 & ydstogo <= 3          ~ "3rd_short",
      down == 3 & ydstogo >= 7          ~ "3rd_long",
      down == 3                         ~ "3rd_medium",
      down == 4                         ~ "4th",
      TRUE                              ~ "other"
    )
  )

cat("Dropbacks analyzed:", nrow(dropbacks), "\n")

# ---- Outcome mix ----------------------------------------------------------

outcome_counts <- dropbacks |>
  count(outcome) |>
  mutate(rate = n / sum(n))

outcome_mix <- setNames(
  lapply(seq_len(nrow(outcome_counts)), function(i) {
    list(n = outcome_counts$n[i], rate = outcome_counts$rate[i])
  }),
  outcome_counts$outcome
)

# ---- Outcome mix by down/distance ----------------------------------------

outcome_by_bucket <- dropbacks |>
  count(down_distance_bucket, outcome) |>
  group_by(down_distance_bucket) |>
  mutate(rate = n / sum(n)) |>
  ungroup()

outcome_mix_by_bucket <- split(outcome_by_bucket, outcome_by_bucket$down_distance_bucket) |>
  lapply(function(df) {
    setNames(
      lapply(seq_len(nrow(df)), function(i) {
        list(n = df$n[i], rate = df$rate[i])
      }),
      df$outcome
    )
  })

# ---- Yardage distributions by outcome ------------------------------------

yardage_distributions <- list(
  completion_yards       = distribution_summary(dropbacks$yards_gained[dropbacks$outcome == "complete"]),
  sack_yards             = distribution_summary(dropbacks$yards_gained[dropbacks$outcome == "sack"]),
  scramble_yards         = distribution_summary(dropbacks$yards_gained[dropbacks$outcome == "scramble"]),
  air_yards_all_targeted = distribution_summary(dropbacks$air_yards[!is.na(dropbacks$air_yards)]),
  air_yards_completions  = distribution_summary(dropbacks$air_yards[dropbacks$outcome == "complete"]),
  yac_completions        = distribution_summary(dropbacks$yards_after_catch[dropbacks$outcome == "complete"])
)

# ---- Big-play rate -------------------------------------------------------

big_play_20 <- dropbacks |>
  filter(outcome == "complete") |>
  summarise(
    completions = n(),
    big_plays_20 = sum(yards_gained >= 20, na.rm = TRUE),
    rate = big_plays_20 / completions
  )

big_play_40 <- dropbacks |>
  filter(outcome == "complete") |>
  summarise(
    completions = n(),
    big_plays_40 = sum(yards_gained >= 40, na.rm = TRUE),
    rate = big_plays_40 / completions
  )

# ---- Write the band ------------------------------------------------------

summaries <- list(
  outcome_mix = outcome_mix,
  outcome_mix_by_down_distance = outcome_mix_by_bucket,
  yardage = yardage_distributions,
  big_play_rate = list(
    twenty_plus_per_completion = list(
      completions = big_play_20$completions,
      big_plays = big_play_20$big_plays_20,
      rate = big_play_20$rate
    ),
    forty_plus_per_completion = list(
      completions = big_play_40$completions,
      big_plays = big_play_40$big_plays_40,
      rate = big_play_40$rate
    )
  )
)

out_path <- file.path(repo_root(), "data", "bands", "passing-plays.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Regular-season dropbacks only (qb_dropback == 1), excluding kneels, ",
    "spikes, and two-point conversions. Outcome is a mutually-exclusive ",
    "classification per dropback: sack > interception > scramble > complete ",
    "> incomplete. down_distance_bucket splits 2nd/3rd downs into short (<=3), ",
    "medium (4-6), long (>=7). Yardage distributions are conditional on the ",
    "outcome (e.g., completion_yards is only over completed passes)."
  )
)

cat("Wrote", out_path, "\n")
