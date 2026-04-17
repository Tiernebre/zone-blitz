#!/usr/bin/env Rscript
# per-position-iol.R — NFL interior-OL (C, G) percentile-band reference.
#
# LIMITATION — PFF GAP: nflreadr does not carry PFF block/pressure grades
# for interior offensive linemen. True IOL performance data (true pass
# set pressure rate, reach-block success, pull-technique grades, etc.)
# lives behind paywalled providers. This script therefore builds a V1
# reference out of *team-level proxies* allocated to the starting
# interior line. Treat the bands as directional, not authoritative — any
# calibration report against them should call out that the ranking stat
# is a team proxy, not a per-player grade.
#
# What we do build:
#   - load_pbp → filter interior rushes (run_gap in c("guard","middle"))
#     and compute per-team-season `team_stuff_rate_inside` (rushes for
#     <= 0 yards / interior rushes). Lower is better for the offense.
#   - load_pbp dropbacks → per-team-season `team_sack_allowed_rate`
#     (sack / dropback). The full offensive line owns protection, so
#     this isn't IOL-exclusive; we inherit it as a shared proxy until a
#     true IOL pressure metric is available.
#   - load_snap_counts → per-player C/G starter-seasons filtered by
#     offensive snap share (>= 0.5 offense_pct on >= 12 games). The
#     weekly player-stats offense file only emits IOL rows on games
#     where the player committed a penalty, so it's useless for
#     establishing "starter" — snap counts are the source of truth.
#   - load_player_stats (offense) for C/G positions → per-player
#     `penalties_per_game`. The `penalties` column IS populated for OL
#     rows when they committed a penalty, so per-player penalty rate
#     is a real (non-proxy) signal for this slice — treat it as the
#     only band metric that isn't shared across the team.
#
# Ranking + bands:
#   - Starter threshold: player-season games >= 12 in positions c("C","G","OG","OL").
#   - Composite rank = z-score mean of the two team proxies (lower is
#     better), broadcast per starter. All C/G starters on the same team
#     share the same proxy rank, which is the calibration gap we
#     explicitly accept for V1.
#   - Five percentile bands (elite top 10%, good 10-30%, average 30-70%,
#     weak 70-90%, replacement bottom 10%).
#
# Output: data/bands/per-position/iol.json
#
# Usage:
#   Rscript data/R/bands/per-position-iol.R [--seasons 2020:2024]

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

cat("Loading pbp + player stats for seasons:",
    paste(range(seasons), collapse = "-"), "\n")

pbp <- nflreadr::load_pbp(seasons)

# ---- Team proxy 1: interior stuff rate -------------------------------------

interior_runs <- pbp |>
  filter(
    season_type == "REG",
    rush == 1,
    qb_scramble == 0,
    qb_kneel == 0,
    is.na(two_point_conv_result),
    !is.na(run_gap),
    run_gap %in% c("guard", "middle")
  )

team_stuff <- interior_runs |>
  group_by(posteam, season) |>
  summarise(
    n_interior_runs = n(),
    stuffs = sum(yards_gained <= 0, na.rm = TRUE),
    team_stuff_rate_inside = ifelse(n() > 0, stuffs / n(), NA_real_),
    .groups = "drop"
  ) |>
  rename(team = posteam)

# ---- Team proxy 2: sack-allowed rate ---------------------------------------

# Dropbacks = plays where pass == 1 OR qb_scramble == 1. Sack attribution
# is shared across the whole OL, but interior linemen own the A/B-gap
# pocket, so we use this as an IOL proxy until per-lineman pressure
# data is available.
dropbacks <- pbp |>
  filter(
    season_type == "REG",
    (pass == 1 | qb_scramble == 1),
    qb_kneel == 0,
    qb_spike == 0
  )

team_sacks <- dropbacks |>
  group_by(posteam, season) |>
  summarise(
    dropbacks = n(),
    sacks = sum(sack == 1, na.rm = TRUE),
    team_sack_allowed_rate = ifelse(n() > 0, sacks / n(), NA_real_),
    .groups = "drop"
  ) |>
  rename(team = posteam)

# ---- Per-player starter filter --------------------------------------------

snaps <- nflreadr::load_snap_counts(seasons)

# Interior OL positions surface as "C", "G", or "OG". "OL" can appear
# as a generic tag for depth players; we include it to catch rostered
# IOL who only appear on special jumbo packages. 50% offensive snap
# share on a given week counts as a "start" for calibration purposes
# (matches how PFF tags snap-based eligibility).
iol_snaps <- snaps |>
  filter(
    game_type == "REG",
    position %in% c("C", "G", "OG", "OL"),
    !is.na(offense_pct),
    offense_pct >= 0.5
  )

iol_season <- iol_snaps |>
  group_by(pfr_player_id, player, team, season) |>
  summarise(
    starts_per_season = n(),
    .groups = "drop"
  ) |>
  filter(starts_per_season >= 12) # starter threshold (~12 of 17 games)

cat("IOL starter-seasons after snap filter:", nrow(iol_season), "\n")

# Per-player penalties come from the weekly offense stats file —
# linemen only appear there when they commit a penalty, so joining on
# (player, team, season) and defaulting missing rows to 0 gives the
# right per-game rate.
weekly <- nflreadr::load_player_stats(seasons)

iol_penalties <- weekly |>
  filter(
    season_type == "REG",
    position %in% c("C", "G", "OG", "OL")
  ) |>
  group_by(player_display_name, team, season) |>
  summarise(
    penalties_total = sum(penalties, na.rm = TRUE),
    .groups = "drop"
  ) |>
  rename(player = player_display_name)

iol_season <- iol_season |>
  left_join(iol_penalties, by = c("player", "team", "season")) |>
  mutate(
    penalties_total = ifelse(is.na(penalties_total), 0, penalties_total),
    penalties_per_game = penalties_total / starts_per_season
  )

# ---- Join proxies + rank ---------------------------------------------------

iol_ranked <- iol_season |>
  left_join(team_stuff, by = c("team", "season")) |>
  left_join(team_sacks, by = c("team", "season")) |>
  filter(
    !is.na(team_stuff_rate_inside),
    !is.na(team_sack_allowed_rate)
  )

cat("IOL starter-seasons with proxy coverage:", nrow(iol_ranked), "\n")

# Z-score each proxy across the starter population (lower = better for
# both metrics), average, then rank ascending (best composite first).
zscore <- function(x) {
  m <- mean(x, na.rm = TRUE)
  s <- stats::sd(x, na.rm = TRUE)
  if (is.na(s) || s == 0) return(rep(0, length(x)))
  (x - m) / s
}

iol_ranked <- iol_ranked |>
  mutate(
    z_stuff = zscore(team_stuff_rate_inside),
    z_sack = zscore(team_sack_allowed_rate),
    # Lower proxy values are better for the offense, so invert the z
    # score sign to keep "higher composite = better IOL".
    composite = -(z_stuff + z_sack) / 2
  ) |>
  arrange(desc(composite)) |>
  mutate(
    pct = (row_number() - 0.5) / n(),
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
  "team_stuff_rate_inside",
  "penalties_per_game",
  "starts_per_season"
)

band_order <- c("elite", "good", "average", "weak", "replacement")

band_summary <- function(rows) {
  metrics <- list()
  for (key in metric_keys) {
    vals <- rows[[key]]
    vals <- vals[!is.na(vals)]
    if (length(vals) == 0) {
      metrics[[key]] <- list(n = 0, mean = 0, sd = 0)
    } else {
      metrics[[key]] <- list(
        n = length(vals),
        mean = mean(vals),
        sd = if (length(vals) > 1) stats::sd(vals) else 0
      )
    }
  }
  list(
    n = nrow(rows),
    metrics = metrics
  )
}

bands <- list()
for (band_name in band_order) {
  rows <- iol_ranked |> filter(band == band_name)
  bands[[band_name]] <- band_summary(rows)
}

out <- list(
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  seasons = as.integer(seasons),
  position = "IOL",
  qualifier = "regular-season IOL starter-seasons (C/G/OG/OL, games >= 12)",
  ranking_stat = paste0(
    "composite z-score of team_stuff_rate_inside (rushes <=0 yds / ",
    "interior rushes) + team_sack_allowed_rate (sacks / dropback); ",
    "both proxied at the team level and broadcast to starters. Lower ",
    "proxy value = better IOL, so the composite inverts sign."
  ),
  notes = paste0(
    "PROXY-METRIC LIMITATION: nflreadr does not carry PFF pressure ",
    "or block-grade data for interior offensive linemen. The bands ",
    "are built from team-level proxies (interior stuff rate + ",
    "team sack allowed rate) allocated to each team's IOL starters. ",
    "All C/G starters on the same team share the same proxy rank, so ",
    "this fixture cannot distinguish a great guard next to a weak ",
    "center on the same line. penalties_per_game IS per-player (from ",
    "nflreadr weekly penalties column) and is the one non-proxy ",
    "metric here. Treat band separation on the team-proxy metrics as ",
    "directional. Replace this with PFF grades (or a matchup-level ",
    "pressure feed) when available."
  ),
  bands = bands
)

out_path <- file.path(
  repo_root(), "data", "bands", "per-position", "iol.json"
)
dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
writeLines(
  jsonlite::toJSON(out, auto_unbox = TRUE, pretty = TRUE, digits = 4,
                   null = "null"),
  out_path
)
cat("Wrote", out_path, "\n")
