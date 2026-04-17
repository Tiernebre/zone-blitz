#!/usr/bin/env Rscript
# draft-hit-rates.R — draft hit-rate bands by round x position group.
#
# For each round (1-7) x position group, compute the probability that a
# drafted player becomes a multi-year NFL starter. "Started" is defined by
# offense/defense snap share in a given game (>= 50% of snaps on that side
# of the ball). Metrics:
#
#   - p_started_16_in_3y    P(>= 16 starts across first 3 seasons post-draft)
#   - p_started_48_in_5y    P(>= 48 starts across first 5 seasons post-draft)
#   - p_all_pro_ever        P(at least one All-Pro selection in career)
#   - p_out_of_league_by_y3 P(no roster weeks in season year + 3)
#
# Sample-size per bucket is reported; buckets with n < 30 are flagged noisy
# in the accompanying doc.
#
# Sources:
#   nflreadr::load_draft_picks()    — draft rows + career summary
#   nflreadr::load_snap_counts()    — per-game snap pct (available 2013+)
#   nflreadr::load_rosters_weekly() — roster presence by season/week
#
# Default season window is 2013:2020 because load_snap_counts() data
# begins in 2013. Drafts prior to 2013 cannot be measured with the "starts
# in first 3 years" metric from snap counts and are excluded to keep the
# measurement definition consistent. 2020 is the latest draft with a full
# 5-year window (through 2024).
#
# Usage:
#   Rscript data/R/bands/draft-hit-rates.R [--seasons 2013:2020]

suppressPackageStartupMessages({
  library(nflreadr)
  library(dplyr)
  library(tidyr)
})

script_file <- (function() {
  args <- commandArgs(trailingOnly = FALSE)
  f <- grep("^--file=", args, value = TRUE)
  if (length(f) > 0) normalizePath(sub("^--file=", "", f[1]), mustWork = FALSE) else NULL
})()
source(file.path(dirname(script_file), "..", "lib.R"))

args <- commandArgs(trailingOnly = TRUE)
# Override default lib.R window: we need 2013:2020 for snap-count coverage.
seasons <- if (any(args == "--seasons")) parse_seasons(args) else 2013:2020

first_draft <- min(seasons)
last_draft  <- max(seasons)

# Careers can extend up to 5 seasons past the last draft for the 5y metric.
career_seasons <- seq(first_draft, last_draft + 5L)

cat("Draft years:", first_draft, "-", last_draft, "\n")
cat("Career seasons needed:", min(career_seasons), "-", max(career_seasons), "\n")

# ---- Load data --------------------------------------------------------------

cat("Loading draft picks...\n")
picks <- nflreadr::load_draft_picks(seasons) |>
  filter(!is.na(round), round >= 1, round <= 7) |>
  mutate(
    position_group = case_when(
      position == "QB"                                      ~ "QB",
      position %in% c("RB", "FB", "HB")                      ~ "RB",
      position == "WR"                                       ~ "WR",
      position == "TE"                                       ~ "TE",
      position %in% c("OL", "T", "G", "C", "OT", "OG")       ~ "OL",
      position %in% c("DL", "DT", "DE", "NT")                ~ "DL",
      position %in% c("LB", "ILB", "OLB", "MLB", "EDGE")     ~ "LB",
      position %in% c("CB", "DB")                            ~ "CB",
      position %in% c("S", "FS", "SS", "SAF")                ~ "S",
      position %in% c("K", "P", "LS")                        ~ "ST",
      TRUE                                                    ~ "OTHER"
    )
  )

cat("Picks after filter:", nrow(picks), "\n")

cat("Loading snap counts for career window...\n")
snaps <- nflreadr::load_snap_counts(career_seasons) |>
  filter(game_type == "REG") |>
  select(season, week, pfr_player_id, offense_pct, defense_pct) |>
  mutate(
    started = as.integer(
      (!is.na(offense_pct) & offense_pct >= 0.5) |
      (!is.na(defense_pct) & defense_pct >= 0.5)
    )
  )

cat("Snap rows:", nrow(snaps), "\n")

# Starts by player x season.
starts_by_player_season <- snaps |>
  group_by(pfr_player_id, season) |>
  summarise(starts = sum(started, na.rm = TRUE), .groups = "drop")

cat("Loading weekly rosters (for out-of-league detection)...\n")
rosters <- nflreadr::load_rosters_weekly(career_seasons) |>
  filter(game_type == "REG", !is.na(pfr_id)) |>
  select(season, week, pfr_id)

# Presence: a player is "in the league" in a season if they appear on any
# weekly roster that season.
presence <- rosters |>
  distinct(pfr_id, season) |>
  mutate(in_league = 1L)

# ---- Join to picks -----------------------------------------------------------

compute_metrics <- function(pick_row) {
  pid         <- pick_row$pfr_player_id
  draft_year  <- pick_row$season

  first_3 <- draft_year + 0:2
  first_5 <- draft_year + 0:4

  starts_3 <- starts_by_player_season |>
    filter(pfr_player_id == pid, season %in% first_3) |>
    summarise(total = sum(starts)) |>
    pull(total)
  if (length(starts_3) == 0 || is.na(starts_3)) starts_3 <- 0L

  starts_5 <- starts_by_player_season |>
    filter(pfr_player_id == pid, season %in% first_5) |>
    summarise(total = sum(starts)) |>
    pull(total)
  if (length(starts_5) == 0 || is.na(starts_5)) starts_5 <- 0L

  year_3 <- draft_year + 3L
  in_year_3 <- presence |>
    filter(pfr_id == pid, season == year_3) |>
    nrow() > 0

  list(
    starts_3 = starts_3,
    starts_5 = starts_5,
    in_year_3 = in_year_3
  )
}

# Vectorised version via joins — much faster than per-row lookup.
cat("Computing per-pick starts and presence metrics...\n")

pick_seasons_3 <- picks |>
  mutate(row_id = row_number()) |>
  select(row_id, pfr_player_id, draft_year = season) |>
  crossing(offset = 0:2) |>
  mutate(season = draft_year + offset)

starts_3y <- pick_seasons_3 |>
  left_join(starts_by_player_season, by = c("pfr_player_id", "season")) |>
  mutate(starts = ifelse(is.na(starts), 0L, starts)) |>
  group_by(row_id) |>
  summarise(starts_3 = sum(starts), .groups = "drop")

pick_seasons_5 <- picks |>
  mutate(row_id = row_number()) |>
  select(row_id, pfr_player_id, draft_year = season) |>
  crossing(offset = 0:4) |>
  mutate(season = draft_year + offset)

starts_5y <- pick_seasons_5 |>
  left_join(starts_by_player_season, by = c("pfr_player_id", "season")) |>
  mutate(starts = ifelse(is.na(starts), 0L, starts)) |>
  group_by(row_id) |>
  summarise(starts_5 = sum(starts), .groups = "drop")

presence_y3 <- picks |>
  mutate(row_id = row_number(), year_3 = season + 3L) |>
  left_join(presence, by = c("pfr_player_id" = "pfr_id", "year_3" = "season")) |>
  mutate(in_year_3 = ifelse(is.na(in_league), 0L, 1L)) |>
  select(row_id, in_year_3)

picks_with_metrics <- picks |>
  mutate(
    row_id = row_number(),
    has_5y_window = season + 4L <= max(career_seasons)
  ) |>
  left_join(starts_3y, by = "row_id") |>
  left_join(starts_5y, by = "row_id") |>
  left_join(presence_y3, by = "row_id") |>
  mutate(
    allpro_count      = ifelse(is.na(allpro), 0L, allpro),
    started_16_in_3y  = as.integer(starts_3 >= 16),
    started_48_in_5y  = as.integer(starts_5 >= 48),
    all_pro_ever      = as.integer(allpro_count >= 1),
    out_of_league_y3  = as.integer(in_year_3 == 0)
  )

cat("Picks with metrics:", nrow(picks_with_metrics), "\n")

# ---- Aggregate by round x position ------------------------------------------

summarise_bucket <- function(df) {
  n_total <- nrow(df)

  # For the 5-year metric, drop picks that don't have a full 5-year window.
  df5 <- df |> filter(has_5y_window)

  list(
    n                    = n_total,
    n_with_5y_window     = nrow(df5),
    p_started_16_in_3y   = if (n_total > 0) mean(df$started_16_in_3y) else NA_real_,
    p_started_48_in_5y   = if (nrow(df5) > 0) mean(df5$started_48_in_5y) else NA_real_,
    p_all_pro_ever       = if (n_total > 0) mean(df$all_pro_ever) else NA_real_,
    p_out_of_league_by_y3 = if (n_total > 0) mean(df$out_of_league_y3) else NA_real_,
    sample_warning       = n_total < 30
  )
}

# Per round x position_group
by_round_position <- picks_with_metrics |>
  group_by(round, position_group) |>
  group_split() |>
  lapply(function(df) {
    list(
      round = df$round[1],
      position_group = df$position_group[1],
      metrics = summarise_bucket(df)
    )
  })

# Nest into round -> position_group -> metrics map.
round_map <- list()
for (entry in by_round_position) {
  r_key <- as.character(entry$round)
  if (is.null(round_map[[r_key]])) round_map[[r_key]] <- list()
  round_map[[r_key]][[entry$position_group]] <- entry$metrics
}

# Per round (overall)
by_round <- picks_with_metrics |>
  group_by(round) |>
  group_split() |>
  lapply(function(df) {
    list(round = df$round[1], metrics = summarise_bucket(df))
  })

round_overall_map <- list()
for (entry in by_round) {
  round_overall_map[[as.character(entry$round)]] <- entry$metrics
}

# Per position (overall across rounds)
by_position <- picks_with_metrics |>
  group_by(position_group) |>
  group_split() |>
  lapply(function(df) {
    list(position_group = df$position_group[1], metrics = summarise_bucket(df))
  })

position_overall_map <- list()
for (entry in by_position) {
  position_overall_map[[entry$position_group]] <- entry$metrics
}

overall <- summarise_bucket(picks_with_metrics)

# ---- Write band --------------------------------------------------------------

summaries <- list(
  overall = overall,
  by_round = round_overall_map,
  by_position = position_overall_map,
  by_round_and_position = round_map
)

out_path <- file.path(repo_root(), "data", "bands", "draft-hit-rates.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Draft hit-rate bands from load_draft_picks() joined to ",
    "load_snap_counts() and load_rosters_weekly(). ",
    "A 'start' is a regular-season game where the player played >= 50% of ",
    "offense or defense snaps. ",
    "p_started_16_in_3y is conditioned on the first three seasons starting ",
    "with the draft year (year 0,1,2). ",
    "p_started_48_in_5y is only computed for draft classes that have a full ",
    "5-year window of snap data available (see n_with_5y_window). ",
    "p_out_of_league_by_y3 = 1 if the player has no weekly-roster rows in ",
    "the season (draft_year + 3). ",
    "p_all_pro_ever counts any All-Pro selection in the player's career. ",
    "Position groups: QB, RB (incl FB/HB), WR, TE, OL, DL, LB (incl EDGE/OLB), ",
    "CB, S, ST (K/P/LS). Buckets with n < 30 carry a sample_warning flag. ",
    "Season window defaults to 2013:2020 because load_snap_counts() coverage ",
    "begins in 2013; earlier drafts cannot be measured with a consistent ",
    "starts-per-game definition."
  )
)

cat("Wrote", out_path, "\n")

# Quick textual summary for eyeballing.
cat("\n=== Overall ===\n")
cat("n =", overall$n, "\n")
cat("p_started_16_in_3y =", round(overall$p_started_16_in_3y, 3), "\n")
cat("p_started_48_in_5y =", round(overall$p_started_48_in_5y, 3),
    "(n5 =", overall$n_with_5y_window, ")\n")
cat("p_all_pro_ever =", round(overall$p_all_pro_ever, 3), "\n")
cat("p_out_of_league_by_y3 =", round(overall$p_out_of_league_by_y3, 3), "\n")

cat("\n=== By round (p_started_16_in_3y) ===\n")
for (r in sort(as.integer(names(round_overall_map)))) {
  m <- round_overall_map[[as.character(r)]]
  cat(sprintf("  Rd%d  n=%d  p16/3y=%.3f  p48/5y=%.3f  allpro=%.3f  ool3=%.3f\n",
              r, m$n, m$p_started_16_in_3y, m$p_started_48_in_5y,
              m$p_all_pro_ever, m$p_out_of_league_by_y3))
}
