#!/usr/bin/env Rscript
# per-position-ot.R — NFL OT percentile-band reference (PROXY METRICS).
#
# ============================================================================
# IMPORTANT LIMITATION: nflreadr DOES NOT carry PFF block/pressure grades.
# ============================================================================
# OL performance is typically measured via PFF pass-block/run-block grades,
# pressures allowed, and pressure rate — none of which are surfaced through
# nflreadr's public play-by-play or player-stats tables. This script therefore
# produces a v1 **proxy** band using:
#
#   * team_sack_allowed_rate — team-season sacks / dropbacks. Proxy for OT
#     pass-protection quality, but commingles IOL protection, QB pocket
#     discipline, scheme, and receiver separation. Both starting tackles on
#     a team get the same team value.
#
#   * team_rush_ypc — team-season rushing yards / carries. Proxy for OL
#     run-blocking; commingles RB talent, scheme, and defensive quality.
#     Also shared across both tackles.
#
#   * penalties_per_game — cleanly per-player. Derived from pbp by counting
#     accepted penalties against a given tackle's gsis_id. This is the only
#     metric that cleanly isolates an individual OT, and even then OT
#     penalties (false starts, holdings) correlate only loosely with
#     block quality.
#
#   * starts_per_season — games with >= 40 offensive snaps (snap-count
#     proxy for a starting appearance). Sanity check; not a skill metric.
#
# Starters are identified via load_snap_counts (position == "T") filtered
# to players with >= 600 offensive snaps in the season. Tackles are then
# joined to load_rosters (position == "OL" & depth_chart_position == "T")
# to pick up gsis_id for penalty attribution, and to load_pbp-derived
# team proxies.
#
# Bands are carved by a **composite rank**: mean of three z-scores for
# (lower-is-better) team_sack_allowed_rate, (higher-is-better)
# team_rush_ypc, and (lower-is-better) penalties_per_game. Ranks run from
# elite (best composite) to replacement.
#
# When downstream consumers inspect this fixture, they MUST treat it as a
# weak v1 calibration reference. Proper OT bands require ingesting PFF
# grades or similar per-player tracking data (TruMedia, SIS, NGS charting).
#
# Output: data/bands/per-position/ot.json
#
# Usage:
#   Rscript data/R/bands/per-position-ot.R [--seasons 2020:2024]

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

cat("Loading pbp, snap counts, and rosters for seasons:",
    paste(range(seasons), collapse = "-"), "\n")

# ---- 1. Team-season protection + run proxies from pbp ---------------------
pbp <- nflreadr::load_pbp(seasons)

team_proxies <- pbp |>
  filter(season_type == "REG", !is.na(posteam)) |>
  mutate(
    is_dropback = !is.na(pass_attempt) & (pass_attempt == 1 | sack == 1),
    is_sack     = !is.na(sack) & sack == 1,
    is_rush     = !is.na(rush_attempt) & rush_attempt == 1 &
                  (is.na(qb_scramble) | qb_scramble == 0)
  ) |>
  group_by(posteam, season) |>
  summarise(
    dropbacks   = sum(is_dropback, na.rm = TRUE),
    sacks       = sum(is_sack, na.rm = TRUE),
    rushes      = sum(is_rush, na.rm = TRUE),
    rush_yards  = sum(ifelse(is_rush, yards_gained, 0), na.rm = TRUE),
    .groups     = "drop"
  ) |>
  mutate(
    team_sack_allowed_rate = ifelse(dropbacks > 0, sacks / dropbacks, NA_real_),
    team_rush_ypc          = ifelse(rushes > 0, rush_yards / rushes, NA_real_)
  ) |>
  rename(team = posteam)

cat("Team-seasons with proxies:", nrow(team_proxies), "\n")

# ---- 2. Per-player penalties from pbp (gsis_id keyed) ----------------------
pbp_penalties <- pbp |>
  filter(season_type == "REG", penalty == 1, !is.na(penalty_player_id)) |>
  group_by(penalty_player_id, season) |>
  summarise(penalties = dplyr::n(), .groups = "drop") |>
  rename(gsis_id = penalty_player_id)

# ---- 3. Starting tackles via load_snap_counts -----------------------------
snaps <- nflreadr::load_snap_counts(seasons)

ot_snap_season <- snaps |>
  filter(game_type == "REG", position == "T") |>
  group_by(pfr_player_id, player, season, team) |>
  summarise(
    # Compute starts *before* collapsing offense_snaps so the comparison
    # still sees the weekly snap count, not the grouped sum.
    starts_per_season = sum(offense_snaps >= 40, na.rm = TRUE),
    total_offense_snaps = sum(offense_snaps, na.rm = TRUE),
    games = dplyr::n(),
    .groups = "drop"
  ) |>
  filter(total_offense_snaps >= 600) # starter threshold

cat("OT player-seasons with >=600 snaps:", nrow(ot_snap_season), "\n")

# ---- 4. Join players table (gsis_id <-> pfr_id crosswalk) for penalties ---
# load_rosters does not populate pfr_id; load_players is the canonical
# crosswalk. It's season-agnostic, so we join only by pfr_id.
players_crosswalk <- nflreadr::load_players() |>
  filter(!is.na(pfr_id), !is.na(gsis_id)) |>
  select(gsis_id, pfr_id, full_name = display_name) |>
  distinct(pfr_id, .keep_all = TRUE) |>
  rename(pfr_player_id = pfr_id)

ot_season <- ot_snap_season |>
  left_join(players_crosswalk, by = "pfr_player_id") |>
  left_join(pbp_penalties, by = c("season", "gsis_id")) |>
  mutate(
    penalties = replace_na(penalties, 0L),
    penalties_per_game = ifelse(games > 0, penalties / games, NA_real_)
  ) |>
  left_join(team_proxies, by = c("team", "season"))

cat("OT player-seasons after joins:", nrow(ot_season), "\n")
cat("  with gsis_id resolved:", sum(!is.na(ot_season$gsis_id)), "\n")
cat("  with team proxies:",
    sum(!is.na(ot_season$team_sack_allowed_rate)), "\n")

ot_season <- ot_season |>
  filter(!is.na(team_sack_allowed_rate),
         !is.na(team_rush_ypc),
         !is.na(penalties_per_game))

if (nrow(ot_season) < 20) {
  stop(paste0(
    "Too few OT player-seasons (", nrow(ot_season),
    ") — schema drift in snap counts or rosters? Check position filters."
  ))
}

# ---- 5. Composite rank + percentile bands ---------------------------------
# Lower-is-better metrics get their z-score negated so a single "bigger =
# better" composite sorts once.
ot_ranked <- ot_season |>
  mutate(
    z_sack       = -as.numeric(scale(team_sack_allowed_rate)),
    z_rush_ypc   =  as.numeric(scale(team_rush_ypc)),
    z_penalties  = -as.numeric(scale(penalties_per_game)),
    composite    = (z_sack + z_rush_ypc + z_penalties) / 3
  ) |>
  arrange(desc(composite)) |>
  mutate(
    pct = (row_number() - 0.5) / dplyr::n(),
    band = case_when(
      pct <= 0.10 ~ "elite",
      pct <= 0.30 ~ "good",
      pct <= 0.70 ~ "average",
      pct <= 0.90 ~ "weak",
      TRUE        ~ "replacement"
    )
  )

metric_keys <- c(
  "team_sack_allowed_rate",
  "team_rush_ypc",
  "penalties_per_game",
  "starts_per_season"
)

band_order <- c("elite", "good", "average", "weak", "replacement")

band_summary <- function(rows) {
  metrics <- list()
  for (key in metric_keys) {
    vals <- rows[[key]]
    vals <- vals[!is.na(vals)]
    metrics[[key]] <- list(
      n = length(vals),
      mean = mean(vals),
      sd = stats::sd(vals)
    )
  }
  list(
    n = nrow(rows),
    metrics = metrics
  )
}

bands <- list()
for (band_name in band_order) {
  rows <- ot_ranked |> filter(band == band_name)
  bands[[band_name]] <- band_summary(rows)
}

out <- list(
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  seasons = as.integer(seasons),
  position = "OT",
  qualifier = "regular-season OT player-seasons with >=600 offensive snaps",
  ranking_stat = paste0(
    "composite of (-)team_sack_allowed_rate, team_rush_ypc, ",
    "(-)penalties_per_game (z-score mean)"
  ),
  notes = paste0(
    "PROXY METRICS v1 — nflreadr does not expose PFF block/pressure grades, ",
    "so OT quality here is inferred from team-level protection/run proxies ",
    "(sacks allowed / rush YPC) shared by both starting tackles on a team, ",
    "plus a clean per-player penalties_per_game metric. This fixture is a ",
    "structural placeholder: z-score and band-classification logic is sound, ",
    "but per-bucket means commingle IOL/QB/scheme effects and should be ",
    "treated as a weak v1 calibration reference. Proper OT bands require ",
    "per-player block grades from PFF or tracking data. Starter filter: ",
    "player-seasons with >=600 offensive snaps at position==T in ",
    "load_snap_counts. Bands: elite top 10%, good 10-30%, average 30-70%, ",
    "weak 70-90%, replacement bottom 10% by composite score."
  ),
  bands = bands
)

out_path <- file.path(
  repo_root(), "data", "bands", "per-position", "ot.json"
)
dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
writeLines(
  jsonlite::toJSON(out, auto_unbox = TRUE, pretty = TRUE, digits = 4,
                   null = "null"),
  out_path
)
cat("Wrote", out_path, "\n")
