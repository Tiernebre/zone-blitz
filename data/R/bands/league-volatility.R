#!/usr/bin/env Rscript
# league-volatility.R — league-level competitive churn bands.
#
# Derives four families of priors from the NFL schedule archive:
#   1. YoY win-total correlation (Pearson) across the window — how sticky
#      is team quality from one season to the next?
#   2. P(make playoffs | made playoffs previous year) — dynasty persistence.
#   3. P(worst-to-first) and P(first-to-worst) per division-season — the
#      headline regression-to-mean rate the league markets heavily.
#   4. Playoff advancement rates by seed — conditional P(win WC),
#      P(win DIV), P(win CONF), P(win SB) per seed slot. The field expanded
#      from 6 to 7 seeds per conference starting in 2020, so seeds 1..6
#      span the whole window while seed 7 is only observable post-2020.
#
# Standings are derived from regular-season schedules: a team's record is
# computed from the sign of `result = home_score - away_score`, with ties
# counted as half-wins for win-pct (ordering only). Playoff seeding is read
# from the post-season bracket itself — the WC round is seeds 2..7 (or 2..6
# pre-2020), and the DIV round tells us the top seed(s) getting a bye. This
# avoids reimplementing tiebreakers while still respecting the real ladder
# each team walked.
#
# Franchise continuity (STL -> LAR, SD -> LAC, OAK -> LV) is normalised via
# `load_teams()` so a relocated team doesn't register as "new" when we line
# up Y and Y-1 records. LAR / LAC / LV canonical abbreviations are used
# throughout.
#
# Usage:
#   Rscript data/R/bands/league-volatility.R [--seasons 2005:2024]

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
# Default window for this band is 2005:2024 (20 seasons) to capture parity
# across multiple CBAs and the 2020 playoff expansion.
seasons <- if (any(args == "--seasons")) parse_seasons(args) else 2005:2024

cat("League-volatility window:", min(seasons), "-", max(seasons), "\n")

# ---- Franchise normalisation -------------------------------------------------

franchise_remap <- c(
  "STL" = "LAR", "SL"  = "LAR", "RAM" = "LAR",
  "SD"  = "LAC",
  "OAK" = "LV"
)

canonical_team <- function(x) {
  ifelse(x %in% names(franchise_remap), franchise_remap[x], x)
}

teams <- nflreadr::load_teams() |>
  mutate(team_abbr = canonical_team(team_abbr)) |>
  distinct(team_abbr, team_conf, team_division)

cat("Loading schedules...\n")
sched <- nflreadr::load_schedules(seasons) |>
  filter(!is.na(home_score), !is.na(away_score)) |>
  mutate(
    home_team = canonical_team(home_team),
    away_team = canonical_team(away_team)
  )

# ---- Regular-season standings ------------------------------------------------

reg <- sched |> filter(game_type == "REG")

long_reg <- bind_rows(
  reg |>
    transmute(
      season,
      team     = home_team,
      points_for     = home_score,
      points_against = away_score,
      margin   = home_score - away_score
    ),
  reg |>
    transmute(
      season,
      team     = away_team,
      points_for     = away_score,
      points_against = home_score,
      margin   = away_score - home_score
    )
)

standings <- long_reg |>
  group_by(season, team) |>
  summarise(
    games  = n(),
    wins   = sum(margin > 0),
    losses = sum(margin < 0),
    ties   = sum(margin == 0),
    points_for     = sum(points_for),
    points_against = sum(points_against),
    .groups = "drop"
  ) |>
  mutate(
    win_pct = (wins + 0.5 * ties) / games,
    point_diff = points_for - points_against
  ) |>
  left_join(teams, by = c("team" = "team_abbr"))

cat("Standings rows:", nrow(standings), "\n")

# ---- 1. YoY win-total correlation -------------------------------------------

standings_pair <- standings |>
  select(season, team, wins, win_pct) |>
  inner_join(
    standings |>
      select(season, team, wins_next = wins, win_pct_next = win_pct) |>
      mutate(season = season - 1L),
    by = c("season", "team")
  )

# Only keep teams that played in consecutive seasons (trivially true post-1995)
yoy_correlation <- list(
  n_team_seasons = nrow(standings_pair),
  pearson_wins   = cor(standings_pair$wins, standings_pair$wins_next),
  pearson_win_pct = cor(standings_pair$win_pct, standings_pair$win_pct_next),
  # Rolling by era so callers can see the trend
  pearson_by_era = list(
    "2005_2009" = if (any(standings_pair$season %in% 2005:2008))
      cor(standings_pair$wins[standings_pair$season %in% 2005:2008],
          standings_pair$wins_next[standings_pair$season %in% 2005:2008]) else NA_real_,
    "2010_2014" = if (any(standings_pair$season %in% 2009:2013))
      cor(standings_pair$wins[standings_pair$season %in% 2009:2013],
          standings_pair$wins_next[standings_pair$season %in% 2009:2013]) else NA_real_,
    "2015_2019" = if (any(standings_pair$season %in% 2014:2018))
      cor(standings_pair$wins[standings_pair$season %in% 2014:2018],
          standings_pair$wins_next[standings_pair$season %in% 2014:2018]) else NA_real_,
    "2020_2024" = if (any(standings_pair$season %in% 2019:2023))
      cor(standings_pair$wins[standings_pair$season %in% 2019:2023],
          standings_pair$wins_next[standings_pair$season %in% 2019:2023]) else NA_real_
  )
)

# ---- 2. Playoff qualification persistence ------------------------------------
#
# A team is "in the playoffs" in season S if they appear as a participant in
# any post-season game in season S. We read that from game_type != "REG".

playoff_teams_by_season <- sched |>
  filter(game_type != "REG") |>
  transmute(season, team = home_team) |>
  bind_rows(
    sched |>
      filter(game_type != "REG") |>
      transmute(season, team = away_team)
  ) |>
  distinct(season, team) |>
  mutate(made_playoffs = 1L)

standings_with_playoffs <- standings |>
  left_join(playoff_teams_by_season, by = c("season", "team")) |>
  mutate(made_playoffs = ifelse(is.na(made_playoffs), 0L, made_playoffs))

playoff_pair <- standings_with_playoffs |>
  select(season, team, made_playoffs) |>
  inner_join(
    standings_with_playoffs |>
      select(season, team, made_playoffs_next = made_playoffs) |>
      mutate(season = season - 1L),
    by = c("season", "team")
  )

# Exclude the last season of the window (no "next" observation).
playoff_pair <- playoff_pair |> filter(season < max(seasons))

p_playoffs_given_playoffs <- list(
  n_transitions = nrow(playoff_pair),
  p_make_playoffs_overall = mean(playoff_pair$made_playoffs_next),
  p_make_playoffs_given_made = if (sum(playoff_pair$made_playoffs == 1) > 0)
    mean(playoff_pair$made_playoffs_next[playoff_pair$made_playoffs == 1]) else NA_real_,
  p_make_playoffs_given_missed = if (sum(playoff_pair$made_playoffs == 0) > 0)
    mean(playoff_pair$made_playoffs_next[playoff_pair$made_playoffs == 0]) else NA_real_
)

# ---- 3. Worst-to-first / first-to-worst by division -------------------------
#
# For each (season, division), rank teams by win_pct (ties broken by point
# differential, then points_for — a practical approximation to the NFL's
# division-tiebreaker stack; exact tiebreakers matter for playoff seeding but
# not for "was this team last or first in the division?" at the counting-stat
# level the band needs). Then join division ranks from Y and Y-1.

div_ranked <- standings |>
  filter(!is.na(team_division)) |>
  group_by(season, team_division) |>
  arrange(desc(win_pct), desc(point_diff), desc(points_for), .by_group = TRUE) |>
  mutate(
    div_rank     = row_number(),
    div_size     = n(),
    is_div_first = as.integer(div_rank == 1L),
    is_div_last  = as.integer(div_rank == div_size)
  ) |>
  ungroup()

div_pair <- div_ranked |>
  select(season, team, team_division, div_rank, is_div_first, is_div_last, div_size) |>
  inner_join(
    div_ranked |>
      select(season, team,
             next_div_rank     = div_rank,
             next_is_div_first = is_div_first,
             next_is_div_last  = is_div_last,
             next_div_size     = div_size,
             next_division     = team_division) |>
      mutate(season = season - 1L),
    by = c("season", "team")
  ) |>
  filter(team_division == next_division)

# Per division-season rates: how often does the last-place team go first
# the following year? How often does the first-place team go last?
worst_to_first <- div_pair |>
  filter(is_div_last == 1L) |>
  summarise(
    n            = n(),
    worst_to_first = mean(next_is_div_first),
    worst_stays_worst = mean(next_is_div_last)
  )

first_to_worst <- div_pair |>
  filter(is_div_first == 1L) |>
  summarise(
    n             = n(),
    first_to_worst  = mean(next_is_div_last),
    first_stays_first = mean(next_is_div_first)
  )

division_churn <- list(
  n_division_seasons_paired = nrow(div_pair |> distinct(season, team_division)),
  p_worst_to_first      = worst_to_first$worst_to_first,
  n_worst_transitions   = worst_to_first$n,
  p_worst_stays_worst   = worst_to_first$worst_stays_worst,
  p_first_to_worst      = first_to_worst$first_to_worst,
  n_first_transitions   = first_to_worst$n,
  p_first_stays_first   = first_to_worst$first_stays_first
)

# ---- 4. Playoff advancement by seed -----------------------------------------
#
# Approach: for each post-season, identify each conference's seeded teams
# from the bracket, attach the round each team advanced past (WC / DIV /
# CONF / SB), then compute conditional advance rates per seed.
#
# Seeding derivation:
#   - 1-seed: the team that appears in DIV but not in WC (the bye team).
#     Post-2020 this is a single team per conference. Pre-2020 there were two
#     bye teams (1 and 2 seeds).
#   - Seeds below the byes: ordered by regular-season win_pct (tiebreakers:
#     point_diff, points_for) among WC participants. Perfect tiebreaker
#     replication is not required here — we're calibrating advancement per
#     seed bucket, not rewriting NFL Rule 13.

conf_for_team <- teams |> select(team_abbr, team_conf)

rounds_by_team <- sched |>
  filter(game_type != "REG") |>
  select(season, game_type, home_team, away_team) |>
  pivot_longer(cols = c(home_team, away_team), values_to = "team") |>
  distinct(season, game_type, team)

# Did a team win the game in question?
game_outcomes <- sched |>
  filter(game_type != "REG") |>
  transmute(
    season,
    game_type,
    winner = ifelse(home_score > away_score, home_team, away_team),
    loser  = ifelse(home_score > away_score, away_team, home_team)
  )

# A team "reached" a round if they appear in it; they "advanced past" a round
# if they won it.
advances <- game_outcomes |>
  pivot_longer(cols = c(winner, loser), names_to = "role", values_to = "team") |>
  mutate(won = role == "winner") |>
  select(season, game_type, team, won)

reach_matrix <- rounds_by_team |>
  mutate(reached = 1L) |>
  pivot_wider(names_from = game_type, values_from = reached, values_fill = 0L)

# Wins per round (a team may lose in a round — reached it without winning it).
win_matrix <- advances |>
  filter(won) |>
  mutate(won_round = 1L) |>
  select(season, team, game_type, won_round) |>
  pivot_wider(names_from = game_type, values_from = won_round, values_fill = 0L)

# Harmonise column presence (some seasons may lack SB column name collisions).
for (col in c("WC", "DIV", "CON", "SB")) {
  if (!col %in% names(reach_matrix)) reach_matrix[[col]] <- 0L
  if (!col %in% names(win_matrix))   win_matrix[[col]]   <- 0L
}

playoff_field <- reach_matrix |>
  rename(
    reached_wc  = WC,
    reached_div = DIV,
    reached_con = CON,
    reached_sb  = SB
  ) |>
  left_join(
    win_matrix |>
      rename(
        won_wc  = WC,
        won_div = DIV,
        won_con = CON,
        won_sb  = SB
      ),
    by = c("season", "team")
  ) |>
  mutate(across(starts_with("won_"), ~ ifelse(is.na(.), 0L, .)))

# Seed assignment.
standings_seed_input <- standings |>
  select(season, team, team_conf, win_pct, point_diff, points_for)

seed_records <- playoff_field |>
  left_join(standings_seed_input, by = c("season", "team")) |>
  filter(!is.na(team_conf))

seed_records <- seed_records |>
  mutate(has_bye = reached_div == 1L & reached_wc == 0L) |>
  group_by(season, team_conf) |>
  arrange(desc(has_bye), desc(win_pct), desc(point_diff), desc(points_for), .by_group = TRUE) |>
  mutate(seed = row_number()) |>
  ungroup()

# Per-seed advancement probabilities.
# P(win WC | seed) — seed must reach WC (so skip the byes for this metric).
# P(win DIV | seed) — conditional on reaching DIV.
# P(win CONF | seed) — conditional on reaching CONF championship.
# P(win SB | seed) — conditional on reaching SB.
seed_summary <- seed_records |>
  group_by(seed) |>
  summarise(
    n                 = n(),
    reached_wc_n      = sum(reached_wc),
    reached_div_n     = sum(reached_div),
    reached_con_n     = sum(reached_con),
    reached_sb_n      = sum(reached_sb),
    p_win_wc          = if (sum(reached_wc) > 0) sum(won_wc) / sum(reached_wc) else NA_real_,
    p_win_div         = if (sum(reached_div) > 0) sum(won_div) / sum(reached_div) else NA_real_,
    p_win_con         = if (sum(reached_con) > 0) sum(won_con) / sum(reached_con) else NA_real_,
    p_win_sb          = if (sum(reached_sb) > 0) sum(won_sb) / sum(reached_sb) else NA_real_,
    # Unconditional: from this seed in any year, what's P(reach SB)?
    p_reach_sb        = sum(reached_sb) / n(),
    p_win_sb_from_seed = sum(won_sb) / n(),
    .groups = "drop"
  ) |>
  arrange(seed)

# Also split by era (pre-2020: 6 seeds, 2 byes; 2020+: 7 seeds, 1 bye).
seed_summary_modern <- seed_records |>
  filter(season >= 2020) |>
  group_by(seed) |>
  summarise(
    n                 = n(),
    p_win_wc          = if (sum(reached_wc) > 0) sum(won_wc) / sum(reached_wc) else NA_real_,
    p_win_div         = if (sum(reached_div) > 0) sum(won_div) / sum(reached_div) else NA_real_,
    p_win_con         = if (sum(reached_con) > 0) sum(won_con) / sum(reached_con) else NA_real_,
    p_win_sb          = if (sum(reached_sb) > 0) sum(won_sb) / sum(reached_sb) else NA_real_,
    p_reach_sb        = sum(reached_sb) / n(),
    p_win_sb_from_seed = sum(won_sb) / n(),
    .groups = "drop"
  ) |>
  arrange(seed)

seed_summary_legacy <- seed_records |>
  filter(season < 2020) |>
  group_by(seed) |>
  summarise(
    n                 = n(),
    p_win_wc          = if (sum(reached_wc) > 0) sum(won_wc) / sum(reached_wc) else NA_real_,
    p_win_div         = if (sum(reached_div) > 0) sum(won_div) / sum(reached_div) else NA_real_,
    p_win_con         = if (sum(reached_con) > 0) sum(won_con) / sum(reached_con) else NA_real_,
    p_win_sb          = if (sum(reached_sb) > 0) sum(won_sb) / sum(reached_sb) else NA_real_,
    p_reach_sb        = sum(reached_sb) / n(),
    p_win_sb_from_seed = sum(won_sb) / n(),
    .groups = "drop"
  ) |>
  arrange(seed)

na_to_null <- function(x) {
  if (is.list(x)) {
    lapply(x, na_to_null)
  } else if (length(x) == 1 && is.na(x)) {
    NULL
  } else {
    x
  }
}

seed_to_list <- function(df) {
  out <- list()
  for (i in seq_len(nrow(df))) {
    row <- as.list(df[i, setdiff(names(df), "seed")])
    out[[as.character(df$seed[i])]] <- na_to_null(row)
  }
  out
}

playoff_advancement <- list(
  overall      = seed_to_list(seed_summary),
  since_2020   = seed_to_list(seed_summary_modern),
  before_2020  = seed_to_list(seed_summary_legacy)
)

# ---- Bundle and write --------------------------------------------------------

summaries <- na_to_null(list(
  yoy_correlation           = yoy_correlation,
  playoff_persistence       = p_playoffs_given_playoffs,
  division_churn            = division_churn,
  playoff_advancement_by_seed = playoff_advancement
))

out_path <- file.path(repo_root(), "data", "bands", "league-volatility.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "League-level volatility priors derived from nflreadr::load_schedules(). ",
    "Standings are computed from game results (sign of home_score - away_score); ",
    "ties count as half-wins for win_pct ordering only. Playoff qualification is ",
    "membership in any post-season game for the season. Division churn ranks teams ",
    "within division by (win_pct, point_diff, points_for) — a practical ",
    "approximation to NFL tiebreakers sufficient for first/last identification. ",
    "Playoff seeding is derived from the bracket itself: the bye team(s) in each ",
    "conference (reached DIV without WC) take the top seed(s); remaining ",
    "participants are seeded by regular-season record. Franchise continuity is ",
    "normalised via load_teams() — STL->LAR, SD->LAC, OAK->LV — so a relocated ",
    "team does not register as a new franchise when pairing Y and Y-1. ",
    "Seeds 1..6 are observed throughout; seed 7 only exists since 2020 when ",
    "the playoff field expanded and the top seed lost its second bye."
  )
)

cat("Wrote", out_path, "\n")

# ---- Console sanity print ----------------------------------------------------

cat("\n=== YoY win correlation ===\n")
cat("n team-seasons =", yoy_correlation$n_team_seasons, "\n")
cat("pearson(wins)   =", round(yoy_correlation$pearson_wins, 3), "\n")
cat("pearson(win%)   =", round(yoy_correlation$pearson_win_pct, 3), "\n")
for (era in names(yoy_correlation$pearson_by_era)) {
  v <- yoy_correlation$pearson_by_era[[era]]
  cat(sprintf("  %s: %.3f\n", era, v))
}

cat("\n=== Playoff persistence ===\n")
cat("P(playoffs | playoffs Y-1) =", round(p_playoffs_given_playoffs$p_make_playoffs_given_made, 3), "\n")
cat("P(playoffs | missed Y-1)   =", round(p_playoffs_given_playoffs$p_make_playoffs_given_missed, 3), "\n")

cat("\n=== Division churn ===\n")
cat("P(worst -> first) =", round(division_churn$p_worst_to_first, 3),
    sprintf("(n=%d)\n", division_churn$n_worst_transitions))
cat("P(first -> worst) =", round(division_churn$p_first_to_worst, 3),
    sprintf("(n=%d)\n", division_churn$n_first_transitions))

cat("\n=== Playoff advancement (overall) ===\n")
print(seed_summary, n = 10)
cat("\n=== Playoff advancement (since 2020) ===\n")
print(seed_summary_modern, n = 10)
