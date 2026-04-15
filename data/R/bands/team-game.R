#!/usr/bin/env Rscript
# team-game.R — per-team-per-game offensive aggregates.
#
# For each (season, week, team) triple, reduces the play-by-play stream into
# a single row of counting stats, then summarizes the distribution of each
# metric across all team-games in the window.
#
# Usage:
#   Rscript data/R/bands/team-game.R [--seasons 2020:2024]

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

# Filter to regular-season, meaningful offensive plays (pass/rush) so rates
# aren't polluted by kneels, spikes, aborted snaps, two-point tries.
offense_plays <- pbp |>
  filter(
    season_type == "REG",
    play_type %in% c("pass", "run"),
    is.na(two_point_conv_result),
    qb_kneel == 0,
    qb_spike == 0
  )

team_game <- offense_plays |>
  group_by(season, week, game_id, posteam) |>
  summarise(
    plays            = n(),
    pass_attempts    = sum(play_type == "pass", na.rm = TRUE),
    rush_attempts    = sum(play_type == "run", na.rm = TRUE),
    completions      = sum(complete_pass == 1, na.rm = TRUE),
    pass_yards       = sum(passing_yards, na.rm = TRUE),
    rush_yards       = sum(rushing_yards, na.rm = TRUE),
    sacks_taken      = sum(sack == 1, na.rm = TRUE),
    interceptions    = sum(interception == 1, na.rm = TRUE),
    fumbles_lost     = sum(fumble_lost == 1, na.rm = TRUE),
    penalties        = sum(penalty == 1, na.rm = TRUE),
    .groups          = "drop"
  ) |>
  mutate(
    pass_rate        = pass_attempts / plays,
    rush_rate        = rush_attempts / plays,
    completion_pct   = ifelse(pass_attempts > 0, completions / pass_attempts, NA_real_),
    yards_per_attempt = ifelse(pass_attempts > 0, pass_yards / pass_attempts, NA_real_),
    yards_per_carry  = ifelse(rush_attempts > 0, rush_yards / rush_attempts, NA_real_),
    turnovers        = interceptions + fumbles_lost
  )

cat("Team-games aggregated:", nrow(team_game), "\n")

metrics <- list(
  plays            = team_game$plays,
  pass_attempts    = team_game$pass_attempts,
  rush_attempts    = team_game$rush_attempts,
  pass_rate        = team_game$pass_rate,
  rush_rate        = team_game$rush_rate,
  completion_pct   = team_game$completion_pct,
  yards_per_attempt = team_game$yards_per_attempt,
  yards_per_carry  = team_game$yards_per_carry,
  pass_yards       = team_game$pass_yards,
  rush_yards       = team_game$rush_yards,
  sacks_taken      = team_game$sacks_taken,
  interceptions    = team_game$interceptions,
  fumbles_lost     = team_game$fumbles_lost,
  turnovers        = team_game$turnovers,
  penalties        = team_game$penalties
)

summaries <- lapply(metrics, distribution_summary)

out_path <- file.path(
  repo_root(), "data", "bands", "team-game.json"
)

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Regular-season team-games only. Offensive plays restricted to play_type ",
    "in {pass, run}, excluding kneels, spikes, and two-point conversion attempts. ",
    "Each metric summary is a distribution across team-games in the window."
  )
)

cat("Wrote", out_path, "\n")
