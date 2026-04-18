#!/usr/bin/env Rscript
# play-duration.R — seconds-off-the-clock priors for sim clock calibration.
#
# For each play category the sim can resolve (run, pass complete, incomplete,
# sack, scramble, kneel, spike, FG, punt, kickoff, XP, penalty no-play), emit
# a distribution of clock seconds elapsed between this snap and the next snap
# in the same game. This feeds ClockModel in the sim so the game clock ticks
# at realistic rates per play type.
#
# Usage:
#   Rscript data/R/bands/play-duration.R [--seasons 2022:2024]

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
if (length(args) == 0) seasons <- 2022:2024  # default for this band

cat("Loading pbp for seasons:", paste(range(seasons), collapse = "-"), "\n")
pbp <- nflreadr::load_pbp(seasons)

# Elapsed = this play's game_seconds_remaining minus the next play's, within
# the same game. That captures the full inter-snap gap (play duration +
# pre-snap clock running), which is exactly what the sim's ClockModel needs.
elapsed_tbl <- pbp |>
  filter(season_type == "REG") |>
  arrange(game_id, fixed_drive, play_id) |>
  group_by(game_id) |>
  mutate(
    next_gsr = lead(game_seconds_remaining),
    elapsed  = game_seconds_remaining - next_gsr
  ) |>
  ungroup() |>
  filter(!is.na(elapsed), elapsed >= 0, elapsed <= 120) |>
  mutate(
    out_of_bounds = coalesce(out_of_bounds, 0L),
    category = case_when(
      qb_kneel == 1                                        ~ "kneel",
      qb_spike == 1                                        ~ "spike",
      penalty == 1 & play_type == "no_play"                ~ "penalty_no_play",
      play_type == "kickoff"                                ~ "kickoff",
      play_type == "punt"                                   ~ "punt",
      play_type == "field_goal"                             ~ "field_goal",
      play_type == "extra_point"                            ~ "extra_point",
      sack == 1                                             ~ "sack",
      qb_scramble == 1 & out_of_bounds == 1                 ~ "scramble_oob",
      qb_scramble == 1                                      ~ "scramble_inbounds",
      play_type == "pass" & incomplete_pass == 1            ~ "pass_incomplete",
      play_type == "pass" & interception == 1               ~ "pass_interception",
      play_type == "pass" & complete_pass == 1 & out_of_bounds == 1 ~ "pass_complete_oob",
      play_type == "pass" & complete_pass == 1              ~ "pass_complete_inbounds",
      play_type == "run"  & out_of_bounds == 1              ~ "run_oob",
      play_type == "run"                                    ~ "run_inbounds",
      TRUE                                                  ~ NA_character_
    )
  ) |>
  filter(!is.na(category))

cat("Plays categorized:", nrow(elapsed_tbl), "\n")

summaries <- setNames(
  lapply(
    split(elapsed_tbl$elapsed, elapsed_tbl$category),
    distribution_summary
  ),
  sort(unique(elapsed_tbl$category))
)

out_path <- file.path(repo_root(), "data", "bands", "play-duration.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Regular-season plays only. Elapsed = game_seconds_remaining[this play] - ",
    "game_seconds_remaining[next play in same game], filtered to [0, 120]. ",
    "Captures the full inter-snap gap (post-play dead-ball time + pre-snap ",
    "play clock) — exactly what the sim's ClockModel needs to subtract per snap. ",
    "Categories: run/pass split by in-bounds vs out-of-bounds; sacks, scrambles, ",
    "kneels, spikes, interceptions, and special teams (kickoff, punt, FG, XP) ",
    "broken out separately. Kickoffs and XPs show ~0 median because they bookend ",
    "period/score transitions where the clock doesn't accrue meaningfully between ",
    "the flagged play and the next snap."
  )
)

cat("Wrote", out_path, "\n")
