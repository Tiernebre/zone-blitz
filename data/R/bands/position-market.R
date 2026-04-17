#!/usr/bin/env Rscript
# position-market.R — position market sizing bands.
#
# Answers "how many players of each position does the NFL carry?" across
# three views:
#   1. Active roster slots — avg/min/max per team per week (who's on the 53).
#   2. Meaningful contributors — players with >= 25% season snap share.
#   3. Clear starters — players with >= 70% season snap share.
# Plus league-wide totals so the sim knows scarcity (league-wide QB count,
# OL split by alignment, specialist counts, etc.).
#
# Feeds player-generation scarcity, league-init allocation, and depth-chart
# classification.
#
# Usage:
#   Rscript data/R/bands/position-market.R [--seasons 2020:2024]

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
seasons <- parse_seasons(args)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Canonicalize to the position set the sim tracks. OL is intentionally NOT
# split here; the LT/LG/C/RG/RT split is derived below from snap-counts which
# expose line side in many seasons (falls back to aggregate OL when missing).
canonical_position <- function(pos) {
  case_when(
    pos == "QB"                              ~ "QB",
    pos %in% c("RB", "FB", "HB")             ~ "RB",
    pos == "WR"                              ~ "WR",
    pos == "TE"                              ~ "TE",
    pos %in% c("T", "OT", "LT", "RT")        ~ "OT",
    pos %in% c("G", "OG", "LG", "RG")        ~ "OG",
    pos == "C"                               ~ "OC",
    pos %in% c("OL")                         ~ "OL",  # generic, rare
    pos %in% c("DE")                         ~ "EDGE",
    pos %in% c("DT", "NT")                   ~ "iDL",
    pos %in% c("DL")                         ~ "iDL", # generic
    pos %in% c("OLB")                        ~ "EDGE_or_LB",
    pos %in% c("LB", "ILB", "MLB")           ~ "LB",
    pos == "CB"                              ~ "CB",
    pos %in% c("S", "FS", "SS", "SAF")       ~ "S",
    pos %in% c("DB")                         ~ "DB",  # generic
    pos == "K"                               ~ "K",
    pos == "P"                               ~ "P",
    pos == "LS"                              ~ "LS",
    TRUE                                     ~ "other"
  )
}

# ---------------------------------------------------------------------------
# 1. Load data
# ---------------------------------------------------------------------------
cat("Loading weekly rosters for seasons:", paste(range(seasons), collapse = "-"), "\n")
rosters <- nflreadr::load_rosters_weekly(seasons)

cat("Loading snap counts for seasons:", paste(range(seasons), collapse = "-"), "\n")
snaps <- nflreadr::load_snap_counts(seasons)

# ---------------------------------------------------------------------------
# 2. Active roster composition — per team per week
# ---------------------------------------------------------------------------
active <- rosters |>
  filter(game_type == "REG", status == "ACT") |>
  mutate(pos = canonical_position(position)) |>
  filter(pos != "other")

# Per team-week counts by position
team_week_pos <- active |>
  group_by(season, week, team, pos) |>
  summarise(n = n_distinct(gsis_id), .groups = "drop")

# Fill in zero-count cells so positions with frequent zero weeks (e.g. no
# 3rd QB) are summarized honestly.
all_team_weeks <- active |> distinct(season, week, team)
all_positions <- sort(unique(active$pos))
grid <- tidyr::crossing(all_team_weeks, pos = all_positions)

team_week_filled <- grid |>
  left_join(team_week_pos, by = c("season", "week", "team", "pos")) |>
  mutate(n = ifelse(is.na(n), 0L, n))

roster_slots <- team_week_filled |>
  group_by(pos) |>
  summarise(
    n_team_weeks = n(),
    mean = mean(n),
    sd   = sd(n),
    min  = min(n),
    p10  = as.numeric(quantile(n, 0.10)),
    p50  = as.numeric(quantile(n, 0.50)),
    p90  = as.numeric(quantile(n, 0.90)),
    max  = max(n),
    .groups = "drop"
  ) |>
  arrange(desc(mean))

roster_slots_list <- setNames(
  lapply(seq_len(nrow(roster_slots)), function(i) {
    r <- roster_slots[i, ]
    list(
      n_team_weeks = r$n_team_weeks,
      mean = r$mean, sd = r$sd, min = r$min,
      p10 = r$p10, p50 = r$p50, p90 = r$p90, max = r$max
    )
  }),
  roster_slots$pos
)

# ---------------------------------------------------------------------------
# 3. Snap-share thresholds — per season, per team
# ---------------------------------------------------------------------------
# Offense / defense snap totals per team-season (sum of team-game snaps).
reg_snaps <- snaps |>
  filter(game_type == "REG") |>
  mutate(pos = canonical_position(position)) |>
  filter(pos != "other")

# For each team-season, find team offensive and defensive snap totals.
team_snap_totals <- reg_snaps |>
  group_by(season, team) |>
  summarise(
    team_off_snaps = sum(offense_snaps, na.rm = TRUE),
    team_def_snaps = sum(defense_snaps, na.rm = TRUE),
    team_st_snaps  = sum(st_snaps, na.rm = TRUE),
    .groups = "drop"
  ) |>
  # Divide by 11 to get the per-side team snap count (since 11 guys on each
  # snap contribute 11 rows to the aggregate).
  mutate(
    team_off_snaps = team_off_snaps / 11,
    team_def_snaps = team_def_snaps / 11
  )

player_season_snaps <- reg_snaps |>
  group_by(season, team, pfr_player_id, player, pos) |>
  summarise(
    off_snaps = sum(offense_snaps, na.rm = TRUE),
    def_snaps = sum(defense_snaps, na.rm = TRUE),
    st_snaps  = sum(st_snaps, na.rm = TRUE),
    .groups = "drop"
  ) |>
  inner_join(team_snap_totals, by = c("season", "team")) |>
  mutate(
    off_share = ifelse(team_off_snaps > 0, off_snaps / team_off_snaps, 0),
    def_share = ifelse(team_def_snaps > 0, def_snaps / team_def_snaps, 0),
    snap_share = pmax(off_share, def_share)
  )

# Position groups that play offense / defense — determines which share we use.
off_positions <- c("QB", "RB", "WR", "TE", "OT", "OG", "OC", "OL")
def_positions <- c("EDGE", "iDL", "LB", "EDGE_or_LB", "CB", "S", "DB")

player_season_snaps <- player_season_snaps |>
  mutate(
    primary_share = case_when(
      pos %in% off_positions ~ off_share,
      pos %in% def_positions ~ def_share,
      TRUE                   ~ 0
    )
  )

# Meaningful (>= 25%) and starter (>= 70%) — offense / defense players only.
meaningful <- player_season_snaps |>
  filter(pos %in% c(off_positions, def_positions)) |>
  mutate(
    is_meaningful = primary_share >= 0.25,
    is_starter    = primary_share >= 0.70
  )

meaningful_counts <- meaningful |>
  group_by(season, team, pos) |>
  summarise(
    meaningful_players = sum(is_meaningful),
    starter_players    = sum(is_starter),
    .groups = "drop"
  )

# Fill zeros.
off_def_positions <- sort(unique(meaningful$pos))
meaningful_grid <- tidyr::crossing(
  meaningful |> distinct(season, team),
  pos = off_def_positions
)

meaningful_filled <- meaningful_grid |>
  left_join(meaningful_counts, by = c("season", "team", "pos")) |>
  mutate(
    meaningful_players = ifelse(is.na(meaningful_players), 0L, meaningful_players),
    starter_players    = ifelse(is.na(starter_players),    0L, starter_players)
  )

contributor_summary <- meaningful_filled |>
  group_by(pos) |>
  summarise(
    n_team_seasons = n(),
    meaningful_mean = mean(meaningful_players),
    meaningful_sd   = sd(meaningful_players),
    meaningful_p10  = as.numeric(quantile(meaningful_players, 0.10)),
    meaningful_p50  = as.numeric(quantile(meaningful_players, 0.50)),
    meaningful_p90  = as.numeric(quantile(meaningful_players, 0.90)),
    starter_mean    = mean(starter_players),
    starter_sd      = sd(starter_players),
    starter_p10     = as.numeric(quantile(starter_players, 0.10)),
    starter_p50     = as.numeric(quantile(starter_players, 0.50)),
    starter_p90     = as.numeric(quantile(starter_players, 0.90)),
    .groups = "drop"
  ) |>
  arrange(desc(meaningful_mean))

contributor_list <- setNames(
  lapply(seq_len(nrow(contributor_summary)), function(i) {
    r <- contributor_summary[i, ]
    list(
      n_team_seasons = r$n_team_seasons,
      meaningful_25pct = list(
        mean = r$meaningful_mean, sd = r$meaningful_sd,
        p10 = r$meaningful_p10, p50 = r$meaningful_p50, p90 = r$meaningful_p90
      ),
      starter_70pct = list(
        mean = r$starter_mean, sd = r$starter_sd,
        p10 = r$starter_p10, p50 = r$starter_p50, p90 = r$starter_p90
      )
    )
  }),
  contributor_summary$pos
)

# ---------------------------------------------------------------------------
# 4. League-wide totals — unique players active per season, per position.
# ---------------------------------------------------------------------------
league_by_season <- active |>
  group_by(season, pos) |>
  summarise(unique_players = n_distinct(gsis_id), .groups = "drop")

league_summary <- league_by_season |>
  group_by(pos) |>
  summarise(
    mean_players_per_season = mean(unique_players),
    sd_players_per_season   = sd(unique_players),
    min_players_per_season  = min(unique_players),
    max_players_per_season  = max(unique_players),
    .groups = "drop"
  ) |>
  arrange(desc(mean_players_per_season))

league_list <- setNames(
  lapply(seq_len(nrow(league_summary)), function(i) {
    r <- league_summary[i, ]
    list(
      mean = r$mean_players_per_season,
      sd   = r$sd_players_per_season,
      min  = r$min_players_per_season,
      max  = r$max_players_per_season
    )
  }),
  league_summary$pos
)

# ---------------------------------------------------------------------------
# 5. Write
# ---------------------------------------------------------------------------
summaries <- list(
  roster_slots_per_team_week = roster_slots_list,
  contributors_per_team_season = contributor_list,
  unique_players_per_season_league_wide = league_list
)

out_path <- file.path(repo_root(), "data", "bands", "position-market.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Position market sizing. Regular season only. Derived from ",
    "load_rosters_weekly() and load_snap_counts(). ",
    "Position canonicalization collapses variants: RB includes FB/HB; OT merges ",
    "T/OT/LT/RT; OG merges G/OG/LG/RG; OC is center; EDGE is DE; iDL is DT/NT; ",
    "OLB is reported separately ('EDGE_or_LB') because teams use the tag for ",
    "both 3-4 rush backers and 4-3 WILLs. ",
    "Roster slots measure active-roster (status == 'ACT') counts per team-week. ",
    "Contributor counts use snap share: offense players use offense_snaps / ",
    "(team_offense_snaps / 11); defense players use defense_snaps / ",
    "(team_defense_snaps / 11). Meaningful = season snap share >= 25%; ",
    "starter = >= 70%. ",
    "League-wide counts are unique gsis_ids active in at least one regular-season ",
    "week per season."
  )
)

cat("Wrote", out_path, "\n")

cat("\n=== Roster slots per team-week (mean) ===\n")
for (p in roster_slots$pos) {
  cat("  ", sprintf("%-14s %4.2f\n", p, roster_slots_list[[p]]$mean))
}
cat("\n=== Starters per team-season (mean, >= 70% snap share) ===\n")
for (p in contributor_summary$pos) {
  cat("  ", sprintf("%-14s %4.2f\n", p, contributor_list[[p]]$starter_70pct$mean))
}
