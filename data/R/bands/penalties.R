#!/usr/bin/env Rscript
# penalties.R — penalty distributions by type, side, and situation.
#
# Feeds the sim's PenaltyModel (M2). For every scrimmage play we record
# whether a penalty was called, which type, which side (offense/defense),
# and the yards assessed. The sim samples from this distribution to
# generate realistic penalty rates and yardages.
#
# Usage:
#   Rscript data/R/bands/penalties.R [--seasons 2020:2024]

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

# Plays we consider: regular-season scrimmage + special-teams plays where
# penalties can happen, excluding no-plays that are pure admin (timeouts, etc).
# We keep pass, run, punt, field_goal, kickoff, extra_point.
plays <- pbp |>
  filter(
    season_type == "REG",
    play_type %in% c("pass", "run", "punt", "field_goal", "kickoff", "extra_point", "no_play"),
    qb_kneel == 0,
    qb_spike == 0,
    is.na(two_point_conv_result)
  )

total_plays <- nrow(plays)
cat("Plays analyzed:", total_plays, "\n")

penalty_plays <- plays |> filter(penalty == 1, !is.na(penalty_type))
total_penalty_plays <- nrow(penalty_plays)
cat("Penalty plays:", total_penalty_plays, "\n")

# ---- Overall rate --------------------------------------------------------

overall <- list(
  n_plays = total_plays,
  n_penalty_plays = total_penalty_plays,
  rate = total_penalty_plays / total_plays
)

# ---- By play category side (infer offense/defense heuristically) ----------
# penalty_team vs posteam tells us side.
penalty_plays <- penalty_plays |>
  mutate(
    side = case_when(
      is.na(penalty_team)    ~ "unknown",
      penalty_team == posteam ~ "offense",
      penalty_team == defteam ~ "defense",
      TRUE                    ~ "other"
    )
  )

side_counts <- penalty_plays |>
  count(side) |>
  mutate(rate_of_penalties = n / sum(n))

by_side <- setNames(
  lapply(seq_len(nrow(side_counts)), function(i) {
    list(
      n = side_counts$n[i],
      rate_of_penalties = side_counts$rate_of_penalties[i],
      rate_per_play = side_counts$n[i] / total_plays
    )
  }),
  side_counts$side
)

# ---- By penalty type -----------------------------------------------------

type_summary <- penalty_plays |>
  group_by(penalty_type) |>
  summarise(
    n = n(),
    mean_yards = mean(penalty_yards, na.rm = TRUE),
    sd_yards = stats::sd(penalty_yards, na.rm = TRUE),
    offense_n = sum(side == "offense"),
    defense_n = sum(side == "defense"),
    .groups = "drop"
  ) |>
  arrange(desc(n)) |>
  mutate(
    rate_per_play = n / total_plays,
    share_of_penalties = n / total_penalty_plays
  )

by_type <- setNames(
  lapply(seq_len(nrow(type_summary)), function(i) {
    list(
      n = type_summary$n[i],
      rate_per_play = type_summary$rate_per_play[i],
      share_of_penalties = type_summary$share_of_penalties[i],
      mean_yards = type_summary$mean_yards[i],
      sd_yards = type_summary$sd_yards[i],
      offense_n = type_summary$offense_n[i],
      defense_n = type_summary$defense_n[i]
    )
  }),
  type_summary$penalty_type
)

# ---- By play type --------------------------------------------------------

per_play_type <- plays |>
  group_by(play_type) |>
  summarise(
    n_plays = n(),
    n_penalty_plays = sum(penalty == 1, na.rm = TRUE),
    rate = n_penalty_plays / n_plays,
    .groups = "drop"
  )

by_play_type <- setNames(
  lapply(seq_len(nrow(per_play_type)), function(i) {
    list(
      n_plays = per_play_type$n_plays[i],
      n_penalty_plays = per_play_type$n_penalty_plays[i],
      rate = per_play_type$rate[i]
    )
  }),
  per_play_type$play_type
)

# ---- Yards distribution over all penalties --------------------------------

yards_distribution <- distribution_summary(
  penalty_plays$penalty_yards[!is.na(penalty_plays$penalty_yards)]
)

# ---- Write ---------------------------------------------------------------

summaries <- list(
  overall = overall,
  by_side = by_side,
  by_play_type = by_play_type,
  by_type = by_type,
  yards = yards_distribution
)

out_path <- file.path(repo_root(), "data", "bands", "penalties.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Regular-season plays where a penalty could be called: pass, run, punt, ",
    "field_goal, kickoff, extra_point, and no_play (pre-snap dead-ball ",
    "penalties like false start / offside). Excludes kneels, spikes, two-point ",
    "conversions. Rate is per-play (penalty plays / total plays). Penalty ",
    "type uses nflfastR penalty_type. Side derived from penalty_team vs ",
    "posteam/defteam; 'unknown' rows are penalties with NA penalty_team ",
    "(mostly dead-ball fouls). yards distribution covers all penalty plays ",
    "with non-NA penalty_yards."
  )
)

cat("Wrote", out_path, "\n")
