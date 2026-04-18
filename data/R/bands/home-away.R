#!/usr/bin/env Rscript
# home-away.R — home-field advantage bands.
#
# Feeds M4 EnvironmentalModifiers. Per-team-side (home vs away) offensive
# rates plus game-level win %, points, and cover rate. Calibration target
# for the sim's home-field nudge.
#
# Usage:
#   Rscript data/R/bands/home-away.R [--seasons 2020:2024]

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

cat("Loading pbp/schedules for seasons:", paste(range(seasons), collapse = "-"), "\n")
pbp <- nflreadr::load_pbp(seasons)
schedules <- nflreadr::load_schedules(seasons) |> filter(game_type == "REG")

plays <- pbp |>
  filter(season_type == "REG", !is.na(posteam)) |>
  mutate(side = if_else(posteam == home_team, "home", "away"))

slice_summary <- function(df) {
  passes <- df |> filter(qb_dropback == 1, qb_kneel == 0, qb_spike == 0,
                         is.na(two_point_conv_result))
  rushes <- df |> filter(rush == 1, qb_scramble == 0, qb_kneel == 0,
                         is.na(two_point_conv_result))
  list(
    n_plays = nrow(df),
    pass = list(
      n = nrow(passes),
      completion_pct = mean(passes$complete_pass, na.rm = TRUE),
      yards_per_dropback = mean(passes$yards_gained, na.rm = TRUE),
      sack_rate = mean(passes$sack, na.rm = TRUE),
      int_rate = mean(passes$interception, na.rm = TRUE)
    ),
    rush = list(
      n = nrow(rushes),
      yards_per_carry = mean(rushes$yards_gained, na.rm = TRUE),
      stuff_rate = mean(rushes$yards_gained <= 0, na.rm = TRUE)
    )
  )
}

by_side <- list(
  home = slice_summary(plays |> filter(side == "home")),
  away = slice_summary(plays |> filter(side == "away"))
)

# Game-level: win rate, points
sched <- schedules |>
  filter(!is.na(home_score), !is.na(away_score)) |>
  mutate(
    home_win = home_score > away_score,
    tie = home_score == away_score
  )

n_games <- nrow(sched)
game_level <- list(
  n_games = n_games,
  home_win_rate = mean(sched$home_win),
  tie_rate = mean(sched$tie),
  home_mean_points = mean(sched$home_score),
  away_mean_points = mean(sched$away_score),
  home_points_minus_away = mean(sched$home_score - sched$away_score),
  home_total_points_sd = stats::sd(sched$home_score),
  away_total_points_sd = stats::sd(sched$away_score)
)

summaries <- list(
  by_side = by_side,
  game_level = game_level,
  home_field_deltas = list(
    completion_pct_delta = by_side$home$pass$completion_pct - by_side$away$pass$completion_pct,
    yards_per_dropback_delta = by_side$home$pass$yards_per_dropback - by_side$away$pass$yards_per_dropback,
    sack_rate_delta = by_side$home$pass$sack_rate - by_side$away$pass$sack_rate,
    yards_per_carry_delta = by_side$home$rush$yards_per_carry - by_side$away$rush$yards_per_carry,
    mean_points_delta = game_level$home_mean_points - game_level$away_mean_points
  )
)

out_path <- file.path(repo_root(), "data", "bands", "home-away.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Regular-season home vs away splits. Play-level slice uses posteam == ",
    "home_team to tag side. Game-level aggregates come from ",
    "load_schedules() (home_score, away_score). home_field_deltas are ",
    "home minus away — the canonical 'home field advantage' modifier set."
  )
)

cat("Wrote", out_path, "\n")
