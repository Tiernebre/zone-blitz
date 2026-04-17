#!/usr/bin/env Rscript
# udfa-market.R — UDFA signing volume + hit-rate bands by position group.
#
# ~20% of active NFL rosters are undrafted players. Without an explicit model
# for UDFA signing volume and hit-rate, sim rookie classes are draft-only and
# late-round picks are overvalued relative to priority-UDFA signings.
#
# This band answers:
#
#   1. How many UDFAs does a team sign per offseason (total + per position)?
#   2. What is P(multi-year starter | UDFA, position) — directly comparable to
#      draft-hit-rates.json round-7 buckets?
#   3. What is P(active Y2 roster | UDFA, position) — the lower bar since most
#      UDFAs are camp bodies who do not stick?
#
# Methodology
# -----------
# Undrafted population = players whose rookie/entry season fell in 2005:2024
# and whose gsis/pfr id does NOT appear anywhere in load_draft_picks(2005:2024).
# Each UDFA is attributed to the team they signed with as a rookie
# (`draft_club` column on load_rosters() — for UDFAs this is the initial UDFA
# signing team, the column is reused from the old "drafted_by" slot).
#
# Hit-rate definitions mirror the draft-hit-rates band (#513) so the rookie-
# class composition model can compare priority UDFAs to late-round picks on a
# like-for-like basis:
#
#   - p_started_16_in_3y   P(>= 16 starts across first 3 seasons)
#       A "start" = regular-season game with >= 50% of offense or defense snaps
#       (load_snap_counts()). Same definition used for drafted players.
#   - p_active_y2_roster   P(player appears on any weekly roster in UDFA year + 1)
#       The low bar for "stuck" — distinguishes priority UDFAs who make the
#       53-man from camp bodies cut before Week 1.
#   - p_out_of_league_by_y3 P(no weekly-roster rows in UDFA year + 3)
#
# Season window: 2013:2020 for hit-rate (needs load_snap_counts() coverage +
# a full 3/5-year runway) and 2005:2024 for the volume band (more seasons =
# tighter per-offseason mean/sd).
#
# Usage:
#   Rscript data/R/bands/udfa-market.R

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

volume_seasons   <- 2005:2024            # wide window for volume distributions
hitrate_seasons  <- 2013:2020            # narrower window: snap counts + runway
career_seasons   <- seq(min(hitrate_seasons), max(hitrate_seasons) + 5L)

position_group_of <- function(position) {
  case_when(
    position == "QB"                                   ~ "QB",
    position %in% c("RB", "FB", "HB")                  ~ "RB",
    position == "WR"                                   ~ "WR",
    position == "TE"                                   ~ "TE",
    position %in% c("OL", "T", "G", "C", "OT", "OG")   ~ "OL",
    position %in% c("DL", "DT", "DE", "NT")            ~ "DL",
    position %in% c("LB", "ILB", "OLB", "MLB", "EDGE") ~ "LB",
    position %in% c("CB", "DB")                        ~ "CB",
    position %in% c("S", "FS", "SS", "SAF")            ~ "S",
    position %in% c("K", "P", "LS")                    ~ "ST",
    TRUE                                               ~ "OTHER"
  )
}

# ---------------------------------------------------------------------------
# 1. Load all draft picks across 2005:2024 and build lookup sets for ids.
# ---------------------------------------------------------------------------

cat("Loading draft picks", min(volume_seasons), "-", max(volume_seasons), "...\n")
picks_all <- nflreadr::load_draft_picks(volume_seasons)

drafted_gsis <- unique(na.omit(picks_all$gsis_id))
drafted_pfr  <- unique(na.omit(picks_all$pfr_player_id))

cat("Drafted gsis ids:", length(drafted_gsis), "  pfr ids:", length(drafted_pfr), "\n")

# ---------------------------------------------------------------------------
# 2. Build the undrafted rookie population from load_rosters().
#
# load_rosters(season) returns one row per player-team-season (end-of-season
# snapshot). We keep the earliest (rookie) season per player to attribute the
# UDFA to their signing team and entry offseason.
# ---------------------------------------------------------------------------

cat("Loading season rosters (this pulls", length(volume_seasons), "seasons)...\n")
rosters <- nflreadr::load_rosters(volume_seasons)

cat("Roster rows:", nrow(rosters), "\n")

# Best pfr_id per player. load_rosters() leaves pfr_id NA for most rows at
# certain positions (OL especially — <1% populated), so bridge gsis_id ->
# pfr_id through load_players() first, then fall back to any pfr_id seen in
# the roster history.
cat("Loading player crossref (load_players)...\n")
players_xref <- nflreadr::load_players() |>
  filter(!is.na(gsis_id), !is.na(pfr_id), pfr_id != "") |>
  distinct(gsis_id, pfr_id) |>
  rename(pfr_id_players = pfr_id)

pfr_lookup_roster <- rosters |>
  filter(!is.na(gsis_id), !is.na(pfr_id), pfr_id != "") |>
  distinct(gsis_id, pfr_id) |>
  group_by(gsis_id) |>
  slice(1L) |>
  ungroup() |>
  rename(pfr_id_roster = pfr_id)

pfr_lookup <- players_xref |>
  full_join(pfr_lookup_roster, by = "gsis_id") |>
  mutate(pfr_id_best = coalesce(pfr_id_players, pfr_id_roster)) |>
  select(gsis_id, pfr_id_best)

# One row per player (earliest season). Keep entry_year / rookie_year /
# draft_club (which for UDFAs is the team that signed them).
rookie_rows <- rosters |>
  filter(!is.na(gsis_id)) |>
  mutate(
    entry_year = coalesce(entry_year, rookie_year, season)
  ) |>
  filter(entry_year >= min(volume_seasons), entry_year <= max(volume_seasons)) |>
  group_by(gsis_id) |>
  arrange(season, .by_group = TRUE) |>
  slice(1L) |>
  ungroup() |>
  left_join(pfr_lookup, by = "gsis_id") |>
  mutate(
    pfr_id = coalesce(pfr_id, pfr_id_best),
    position_group = position_group_of(position)
  ) |>
  select(-pfr_id_best)

# UDFA = rookie-entry player whose ids do NOT appear in load_draft_picks.
udfas <- rookie_rows |>
  filter(
    !(gsis_id %in% drafted_gsis),
    is.na(pfr_id) | !(pfr_id %in% drafted_pfr),
    # Sanity: drop rows that DO have a draft_number (feed inconsistency).
    is.na(draft_number) | draft_number == 0
  )

cat("Rookie rows (season grain):", nrow(rookie_rows), "\n")
cat("UDFA rows after left-anti-join:", nrow(udfas), "\n")

# ---------------------------------------------------------------------------
# 3. UDFA signings per team per offseason (total + per-position).
#
#    Attribution: draft_club on the UDFA's earliest roster row. For pre-2010
#    rows where draft_club is NA, fall back to `team` (the team the player
#    was on that season).
# ---------------------------------------------------------------------------

udfas_with_team <- udfas |>
  mutate(signing_team = coalesce(draft_club, team)) |>
  filter(!is.na(signing_team))

cat("UDFAs with signing team:", nrow(udfas_with_team), "\n")

# Full grid of (entry_year x team) so teams that signed zero UDFAs at a
# position still contribute a zero to the mean / sd.
all_teams <- sort(unique(rosters$team[!is.na(rosters$team) & rosters$team != ""]))
team_year_grid <- expand_grid(
  entry_year = volume_seasons,
  signing_team = all_teams
)

totals_per_team_year <- udfas_with_team |>
  count(entry_year, signing_team, name = "n") |>
  right_join(team_year_grid, by = c("entry_year", "signing_team")) |>
  mutate(n = ifelse(is.na(n), 0L, n))

total_summary <- distribution_summary(totals_per_team_year$n)

by_position_team_year <- udfas_with_team |>
  count(entry_year, signing_team, position_group, name = "n")

position_groups <- sort(unique(udfas_with_team$position_group))

by_position_summary <- setNames(
  lapply(position_groups, function(pg) {
    pg_grid <- team_year_grid |> mutate(position_group = pg)
    pg_counts <- by_position_team_year |>
      filter(position_group == pg) |>
      right_join(pg_grid, by = c("entry_year", "signing_team", "position_group")) |>
      mutate(n = ifelse(is.na(n), 0L, n))
    distribution_summary(pg_counts$n)
  }),
  position_groups
)

# Year-by-year league totals — useful for spotting supply shocks (e.g. 2020
# bump from COVID-year undrafted stashes).
league_totals_by_year <- udfas_with_team |>
  count(entry_year, name = "n") |>
  arrange(entry_year)

league_totals_list <- setNames(
  as.list(league_totals_by_year$n),
  as.character(league_totals_by_year$entry_year)
)

# ---------------------------------------------------------------------------
# 4. Hit-rate computation on the 2013:2020 UDFA cohort.
#
#    Mirror draft-hit-rates.R: join to load_snap_counts() for starts and to
#    load_rosters_weekly() for league-presence.
# ---------------------------------------------------------------------------

hitrate_udfas <- udfas |>
  filter(
    !is.na(pfr_id),                           # needed to join snap counts
    coalesce(entry_year, rookie_year) >= min(hitrate_seasons),
    coalesce(entry_year, rookie_year) <= max(hitrate_seasons)
  ) |>
  mutate(udfa_year = coalesce(entry_year, rookie_year))

cat("UDFAs with pfr_id in", min(hitrate_seasons), "-", max(hitrate_seasons), ":",
    nrow(hitrate_udfas), "\n")

cat("Loading snap counts", min(career_seasons), "-", max(career_seasons), "...\n")
snaps <- nflreadr::load_snap_counts(career_seasons) |>
  filter(game_type == "REG") |>
  select(season, week, pfr_player_id, offense_pct, defense_pct) |>
  mutate(
    started = as.integer(
      (!is.na(offense_pct) & offense_pct >= 0.5) |
      (!is.na(defense_pct) & defense_pct >= 0.5)
    )
  )

starts_by_player_season <- snaps |>
  group_by(pfr_player_id, season) |>
  summarise(starts = sum(started, na.rm = TRUE), .groups = "drop")

cat("Loading weekly rosters", min(career_seasons), "-", max(career_seasons), "...\n")
rosters_weekly <- nflreadr::load_rosters_weekly(career_seasons) |>
  filter(game_type == "REG", !is.na(gsis_id)) |>
  select(season, week, gsis_id)

presence <- rosters_weekly |>
  distinct(gsis_id, season) |>
  mutate(in_league = 1L)

# First-3-year starts per UDFA
starts_3y <- hitrate_udfas |>
  mutate(row_id = row_number()) |>
  select(row_id, pfr_id, udfa_year) |>
  crossing(offset = 0:2) |>
  mutate(season = udfa_year + offset) |>
  left_join(starts_by_player_season,
            by = c("pfr_id" = "pfr_player_id", "season" = "season")) |>
  mutate(starts = ifelse(is.na(starts), 0L, starts)) |>
  group_by(row_id) |>
  summarise(starts_3 = sum(starts), .groups = "drop")

# Year-2 roster presence (udfa_year + 1 = first sophomore season)
presence_y2 <- hitrate_udfas |>
  mutate(row_id = row_number(), year_2 = udfa_year + 1L) |>
  select(row_id, gsis_id, year_2) |>
  left_join(presence, by = c("gsis_id" = "gsis_id", "year_2" = "season")) |>
  mutate(in_year_2 = ifelse(is.na(in_league), 0L, 1L)) |>
  select(row_id, in_year_2)

presence_y3 <- hitrate_udfas |>
  mutate(row_id = row_number(), year_3 = udfa_year + 3L) |>
  select(row_id, gsis_id, year_3) |>
  left_join(presence, by = c("gsis_id" = "gsis_id", "year_3" = "season")) |>
  mutate(in_year_3 = ifelse(is.na(in_league), 0L, 1L)) |>
  select(row_id, in_year_3)

hitrate_udfas <- hitrate_udfas |>
  mutate(row_id = row_number()) |>
  left_join(starts_3y, by = "row_id") |>
  left_join(presence_y2, by = "row_id") |>
  left_join(presence_y3, by = "row_id") |>
  mutate(
    starts_3          = ifelse(is.na(starts_3), 0L, starts_3),
    started_16_in_3y  = as.integer(starts_3 >= 16),
    active_y2_roster  = as.integer(in_year_2 == 1),
    out_of_league_y3  = as.integer(in_year_3 == 0)
  )

cat("Hit-rate cohort size:", nrow(hitrate_udfas), "\n")

summarise_hitrate <- function(df) {
  n_total <- nrow(df)
  list(
    n                     = n_total,
    p_started_16_in_3y    = if (n_total > 0) mean(df$started_16_in_3y) else NA_real_,
    p_active_y2_roster    = if (n_total > 0) mean(df$active_y2_roster) else NA_real_,
    p_out_of_league_by_y3 = if (n_total > 0) mean(df$out_of_league_y3) else NA_real_,
    sample_warning        = n_total < 30
  )
}

hitrate_overall <- summarise_hitrate(hitrate_udfas)

hitrate_by_position <- hitrate_udfas |>
  group_by(position_group) |>
  group_split() |>
  lapply(function(df) {
    list(position_group = df$position_group[1], metrics = summarise_hitrate(df))
  })

hitrate_by_position_map <- list()
for (entry in hitrate_by_position) {
  hitrate_by_position_map[[entry$position_group]] <- entry$metrics
}

# ---------------------------------------------------------------------------
# 5. Position-share breakdown (what fraction of UDFAs sign at each position).
# ---------------------------------------------------------------------------

position_shares <- udfas_with_team |>
  count(position_group, name = "n") |>
  mutate(share = n / sum(n)) |>
  arrange(desc(share))

position_share_list <- setNames(
  lapply(seq_len(nrow(position_shares)), function(i) {
    list(
      n = position_shares$n[i],
      share = position_shares$share[i]
    )
  }),
  position_shares$position_group
)

# ---------------------------------------------------------------------------
# 6. Assemble + write.
# ---------------------------------------------------------------------------

summaries <- list(
  signings_per_team_per_offseason = list(
    seasons_window = range(volume_seasons),
    total = total_summary,
    by_position_group = by_position_summary
  ),
  league_total_by_year = league_totals_list,
  position_share = position_share_list,
  hit_rate = list(
    seasons_window = range(hitrate_seasons),
    overall = hitrate_overall,
    by_position_group = hitrate_by_position_map
  )
)

out_path <- file.path(repo_root(), "data", "bands", "udfa-market.json")

write_band(
  out_path,
  volume_seasons,
  summaries,
  notes = paste0(
    "UDFA market bands. Undrafted population built from ",
    "load_rosters(2005:2024) left-anti-joined to load_draft_picks(2005:2024) ",
    "on gsis_id (primary) and pfr_id (fallback). UDFA attribution: earliest ",
    "roster row per player, signing team = draft_club (fallback: team). ",
    "signings_per_team_per_offseason is computed over a full (season x team) ",
    "grid so teams that signed zero at a position contribute zeroes; ",
    "distributions report mean/sd/p10-p90 over team-seasons. ",
    "hit_rate window is 2013:2020 (snap-count coverage + 5y runway): ",
    "p_started_16_in_3y uses load_snap_counts() with starts defined as ",
    ">= 50% offense or defense snaps in a REG game (same rule as ",
    "draft-hit-rates.json). p_active_y2_roster = appears on any weekly ",
    "roster row in udfa_year + 1. p_out_of_league_by_y3 = no weekly rows in ",
    "udfa_year + 3. Position groups match draft-hit-rates: QB, RB (incl FB/HB), ",
    "WR, TE, OL, DL, LB (incl EDGE/OLB), CB, S, ST (K/P/LS)."
  )
)

cat("Wrote", out_path, "\n")

# ---------------------------------------------------------------------------
# 7. Quick textual summary for eyeballing.
# ---------------------------------------------------------------------------

cat("\n=== UDFA signings per team per offseason (total) ===\n")
cat(sprintf("  n team-seasons = %d  mean = %.2f  sd = %.2f  p10 = %.1f  p50 = %.1f  p90 = %.1f\n",
            total_summary$n, total_summary$mean, total_summary$sd,
            total_summary$p10, total_summary$p50, total_summary$p90))

cat("\n=== Per-position mean signings per team per offseason ===\n")
for (pg in names(by_position_summary)) {
  m <- by_position_summary[[pg]]
  cat(sprintf("  %-6s mean=%.2f  sd=%.2f  p90=%.1f\n",
              pg, m$mean %||% NA_real_, m$sd %||% NA_real_, m$p90 %||% NA_real_))
}

cat("\n=== Hit-rate overall (", min(hitrate_seasons), "-", max(hitrate_seasons), ") ===\n")
cat(sprintf("  n = %d  p_started_16_in_3y = %.3f  p_active_y2 = %.3f  p_out_y3 = %.3f\n",
            hitrate_overall$n,
            hitrate_overall$p_started_16_in_3y,
            hitrate_overall$p_active_y2_roster,
            hitrate_overall$p_out_of_league_by_y3))

cat("\n=== Hit-rate by position group ===\n")
for (pg in names(hitrate_by_position_map)) {
  m <- hitrate_by_position_map[[pg]]
  cat(sprintf("  %-6s n=%4d  p16/3y=%.3f  p_active_y2=%.3f  p_out_y3=%.3f%s\n",
              pg, m$n, m$p_started_16_in_3y, m$p_active_y2_roster,
              m$p_out_of_league_by_y3,
              ifelse(isTRUE(m$sample_warning), "  (n<30)", "")))
}

cat("\n=== Position share of UDFA signings ===\n")
for (pg in names(position_share_list)) {
  ps <- position_share_list[[pg]]
  cat(sprintf("  %-6s n=%5d  %.1f%%\n", pg, ps$n, 100 * ps$share))
}
