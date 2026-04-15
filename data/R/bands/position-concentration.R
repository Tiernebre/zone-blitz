#!/usr/bin/env Rscript
# position-concentration.R — per-position stat concentration bands.
#
# Computes how much of a team's season totals flow to the top-1, top-3,
# and top-5 players at each position group. This captures the "star
# concentration" pattern the sim's assignment logic must reproduce:
# RB1 carries the load, WR1/WR2 soak most targets, etc.
#
# Metrics:
#   - RB carry share (top-1/3/5 % of team carries)
#   - RB target share
#   - WR target share
#   - TE target share
#   - QB attempt share (starter vs. backup)
#   - LB tackle share
#   - CB snap share (from load_snap_counts)
#
# Usage:
#   Rscript data/R/bands/position-concentration.R [--seasons 2020:2024]

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

cat("Loading player stats for seasons:", paste(range(seasons), collapse = "-"), "\n")
player_stats <- nflreadr::load_player_stats(seasons)

reg_stats <- player_stats |>
  filter(season_type == "REG")

cat("Regular-season player-week rows:", nrow(reg_stats), "\n")

# Aggregate to per-player per-team-season totals.
player_season <- reg_stats |>
  group_by(season, team, player_id, player_name, position, position_group) |>
  summarise(
    carries         = sum(carries, na.rm = TRUE),
    targets         = sum(targets, na.rm = TRUE),
    receptions      = sum(receptions, na.rm = TRUE),
    pass_attempts   = sum(attempts, na.rm = TRUE),
    tackles         = sum(def_tackles_solo, na.rm = TRUE) +
                      sum(def_tackles_with_assist, na.rm = TRUE),
    .groups = "drop"
  )

# --- Helper: compute top-k share for a metric within a position group --------
#
# For each team-season, ranks players by the metric descending, then computes
# the share of the team-season total going to the top-1, top-3, and top-5.
# Returns one row per team-season with share columns.
compute_topk_share <- function(data, pos_filter, metric_col, min_team_total = 10) {
  pos_data <- data |>
    filter(position_group %in% pos_filter, .data[[metric_col]] > 0)

  team_totals <- pos_data |>
    group_by(season, team) |>
    summarise(team_total = sum(.data[[metric_col]], na.rm = TRUE), .groups = "drop") |>
    filter(team_total >= min_team_total)

  ranked <- pos_data |>
    inner_join(team_totals, by = c("season", "team")) |>
    group_by(season, team) |>
    arrange(desc(.data[[metric_col]]), .by_group = TRUE) |>
    mutate(rank = row_number()) |>
    ungroup()

  ranked |>
    group_by(season, team, team_total) |>
    summarise(
      top1 = sum(.data[[metric_col]][rank <= 1], na.rm = TRUE),
      top3 = sum(.data[[metric_col]][rank <= 3], na.rm = TRUE),
      top5 = sum(.data[[metric_col]][rank <= 5], na.rm = TRUE),
      .groups = "drop"
    ) |>
    mutate(
      top1_share = top1 / team_total,
      top3_share = top3 / team_total,
      top5_share = top5 / team_total
    )
}

# --- Offensive concentration -------------------------------------------------

cat("Computing RB carry share...\n")
rb_carry <- compute_topk_share(player_season, "RB", "carries")

cat("Computing RB target share...\n")
rb_target <- compute_topk_share(player_season, "RB", "targets")

cat("Computing WR target share...\n")
wr_target <- compute_topk_share(player_season, "WR", "targets")

cat("Computing TE target share...\n")
te_target <- compute_topk_share(player_season, "TE", "targets")

cat("Computing QB attempt share...\n")
qb_attempt <- compute_topk_share(player_season, "QB", "pass_attempts", min_team_total = 100)

# --- Defensive concentration -------------------------------------------------

cat("Computing LB tackle share...\n")
lb_tackle <- compute_topk_share(player_season, "LB", "tackles")

# --- CB snap share from load_snap_counts() -----------------------------------

cat("Loading snap counts for CB snap share...\n")
snaps <- nflreadr::load_snap_counts(seasons)

cb_snaps <- snaps |>
  filter(
    game_type == "REG",
    position %in% c("CB", "DB")
  ) |>
  group_by(season, team, player, pfr_player_id) |>
  summarise(
    defense_snaps = sum(defense_snaps, na.rm = TRUE),
    .groups = "drop"
  )

cb_team_totals <- cb_snaps |>
  group_by(season, team) |>
  summarise(team_total = sum(defense_snaps, na.rm = TRUE), .groups = "drop") |>
  filter(team_total > 0)

cb_ranked <- cb_snaps |>
  inner_join(cb_team_totals, by = c("season", "team")) |>
  group_by(season, team) |>
  arrange(desc(defense_snaps), .by_group = TRUE) |>
  mutate(rank = row_number()) |>
  ungroup()

cb_snap_share <- cb_ranked |>
  group_by(season, team, team_total) |>
  summarise(
    top1 = sum(defense_snaps[rank <= 1], na.rm = TRUE),
    top3 = sum(defense_snaps[rank <= 3], na.rm = TRUE),
    top5 = sum(defense_snaps[rank <= 5], na.rm = TRUE),
    .groups = "drop"
  ) |>
  mutate(
    top1_share = top1 / team_total,
    top3_share = top3 / team_total,
    top5_share = top5 / team_total
  )

# --- Build summaries ---------------------------------------------------------

summarize_shares <- function(df) {
  list(
    top1_share = distribution_summary(df$top1_share),
    top3_share = distribution_summary(df$top3_share),
    top5_share = distribution_summary(df$top5_share)
  )
}

summaries <- list(
  rb_carry_share  = summarize_shares(rb_carry),
  rb_target_share = summarize_shares(rb_target),
  wr_target_share = summarize_shares(wr_target),
  te_target_share = summarize_shares(te_target),
  qb_attempt_share = summarize_shares(qb_attempt),
  lb_tackle_share = summarize_shares(lb_tackle),
  cb_snap_share   = summarize_shares(cb_snap_share)
)

cat("Team-seasons per metric:\n")
cat("  RB carry:", nrow(rb_carry), "\n")
cat("  RB target:", nrow(rb_target), "\n")
cat("  WR target:", nrow(wr_target), "\n")
cat("  TE target:", nrow(te_target), "\n")
cat("  QB attempt:", nrow(qb_attempt), "\n")
cat("  LB tackle:", nrow(lb_tackle), "\n")
cat("  CB snap:", nrow(cb_snap_share), "\n")

out_path <- file.path(repo_root(), "data", "bands", "position-concentration.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Per-team-season position stat concentration. For each metric, players are ",
    "ranked within their position group by the counting stat (carries, targets, ",
    "pass attempts, tackles, or defensive snaps), and the share going to top-1, ",
    "top-3, and top-5 players is computed. ",
    "Mid-season QB changes are handled naturally: weekly stats are summed to ",
    "season totals per player, so a starter benched in week 8 accumulates only ",
    "8 weeks of attempts, and the replacement accumulates the rest. The QB ",
    "attempt share top-1 captures the starter's dominance (or lack thereof in ",
    "a committee/injury season). ",
    "Injured starters are handled the same way: a player who misses games ",
    "accumulates fewer counting stats, so their share drops and the backup's ",
    "share rises. This correctly reflects real NFL concentration variance — ",
    "healthy teams have higher top-1 concentration, injury-plagued teams have ",
    "more diffuse distributions. ",
    "CB snap share uses load_snap_counts() (defense_snaps column) rather than ",
    "load_participation() because snap counts are available for all seasons in ",
    "the window while participation data stopped updating after 2023. ",
    "Regular season only. Minimum team totals applied to filter out noise ",
    "(10 for most metrics, 100 for QB pass attempts)."
  )
)

cat("Wrote", out_path, "\n")
