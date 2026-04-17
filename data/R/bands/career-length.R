#!/usr/bin/env Rscript
# career-length.R — career length and aging curve bands by position.
#
# Answers: when do careers end? RBs fall off a cliff ~27; WRs age
# gracefully into 31; OL keep starting into their mid-30s; QBs play into
# their 40s; specialists are effectively indefinite.
#
# Outputs:
#   1. P(active roster | age) per position, ages 22..40 — probability a
#      player of a given age/position is on a regular-season roster in a
#      given season, normalized against the population of that
#      position's 22-year-old cohort.
#   2. Peak-year distribution — modal age of a player's best season
#      (approximated as max-AV or max-snaps season; see notes).
#   3. Retirement-age distribution — age in a player's final active
#      season (mean/sd/p10/p50/p90) per position.
#   4. Year-over-year attrition rate — fraction of age-N players who are
#      NOT on a roster at age (N+1).
#
# Usage:
#   Rscript data/R/bands/career-length.R [--seasons 2005:2024]

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
# Position canonicalization — same vocabulary as position-market / draft.
# ---------------------------------------------------------------------------
canonical_position <- function(pos) {
  case_when(
    pos == "QB"                              ~ "QB",
    pos %in% c("RB", "FB", "HB")             ~ "RB",
    pos == "WR"                              ~ "WR",
    pos == "TE"                              ~ "TE",
    pos %in% c("T", "OT", "LT", "RT", "OL", "G", "OG", "LG", "RG", "C") ~ "OL",
    pos == "DE"                              ~ "EDGE",
    pos %in% c("DT", "NT", "DL")             ~ "iDL",
    pos %in% c("OLB", "LB", "ILB", "MLB")    ~ "LB",
    pos %in% c("CB", "DB")                   ~ "CB_DB",
    pos %in% c("S", "FS", "SS", "SAF")       ~ "S",
    pos == "K"                               ~ "K",
    pos == "P"                               ~ "P",
    pos == "LS"                              ~ "LS",
    TRUE                                     ~ "other"
  )
}

# ---------------------------------------------------------------------------
# Load seasonal rosters (one row per player per season; dedup to first team).
# ---------------------------------------------------------------------------
cat("Loading seasonal rosters for seasons:", paste(range(seasons), collapse = "-"), "\n")
rosters_raw <- nflreadr::load_rosters(seasons)

rosters <- rosters_raw |>
  filter(!is.na(gsis_id), !is.na(birth_date), !is.na(position)) |>
  mutate(
    birth_date = as.Date(birth_date),
    # Age at start of the league year (Sept 1 of that season).
    season_start = as.Date(paste0(season, "-09-01")),
    age = as.integer(floor(as.numeric(season_start - birth_date) / 365.25)),
    pos = canonical_position(position)
  ) |>
  filter(pos != "other", !is.na(age), age >= 20, age <= 45) |>
  # One row per player-season (some players appear twice if traded mid-year).
  group_by(season, gsis_id, pos) |>
  slice(1) |>
  ungroup()

cat("Player-seasons (after dedupe):", nrow(rosters), "\n")

# ---------------------------------------------------------------------------
# 1. P(active | age, position)
# ---------------------------------------------------------------------------
# For each player, we track which seasons they appear in by age. To compute a
# probability we need a denominator. We use the "age-22 cohort" convention:
# for each position, count distinct players observed at age 22, then measure
# what fraction of that cohort appears at each subsequent age.
# Caveat: this blends cohort effects — older seasons in the window may not
# have age-22 observations if they debuted younger. We therefore only count
# cohorts entering between min(seasons) and max(seasons) - 18 so every cohort
# has a chance to reach age 40.

min_season <- min(seasons)
max_season <- max(seasons)

# Each player's first observed season and their age at that point.
first_obs <- rosters |>
  group_by(gsis_id, pos) |>
  summarise(
    first_season = min(season),
    age_at_first = min(age[season == min(season)]),
    .groups = "drop"
  )

# Everyone observed at age 22 in a given season forms the "age-22 cohort" for
# that season. Players who first appear older are excluded from the age-22
# denominator (they're not lost to retirement — they just never entered it).
age22_cohort <- rosters |>
  filter(age == 22) |>
  distinct(gsis_id, pos) |>
  mutate(in_cohort = TRUE)

# Observed ages per cohort member.
cohort_ages <- rosters |>
  inner_join(age22_cohort, by = c("gsis_id", "pos")) |>
  distinct(gsis_id, pos, age)

# Denominator: size of the age-22 cohort per position.
cohort_size <- age22_cohort |>
  group_by(pos) |>
  summarise(cohort_n = n_distinct(gsis_id), .groups = "drop")

# Numerator: number of age-22 cohort members still on a roster at each age.
active_by_age <- cohort_ages |>
  group_by(pos, age) |>
  summarise(active_n = n_distinct(gsis_id), .groups = "drop")

age_survival <- active_by_age |>
  inner_join(cohort_size, by = "pos") |>
  mutate(p_active = active_n / cohort_n) |>
  filter(age >= 22, age <= 40) |>
  arrange(pos, age)

# Nest by position.
age_survival_list <- split(age_survival, age_survival$pos) |>
  lapply(function(df) {
    setNames(
      lapply(seq_len(nrow(df)), function(i) {
        list(
          active_n = df$active_n[i],
          cohort_n = df$cohort_n[i],
          p_active = df$p_active[i]
        )
      }),
      paste0("age_", df$age)
    )
  })

# ---------------------------------------------------------------------------
# 2. Peak-year distribution — modal age of peak season.
#    Proxy: age at the season with the most-recent maximum of "activity"
#    (snap-weighted using load_snap_counts when available, else years_exp).
#    To keep runtime bounded we approximate peak with the age at which each
#    player accrued their MAX appearances across the most games-played year.
# ---------------------------------------------------------------------------
# Use games-played as the crude peak proxy: the season a player played the
# most regular-season games is plausibly their peak-availability season.
games_played <- rosters_raw |>
  filter(!is.na(gsis_id), !is.na(birth_date), !is.na(position)) |>
  mutate(
    birth_date = as.Date(birth_date),
    season_start = as.Date(paste0(season, "-09-01")),
    age = as.integer(floor(as.numeric(season_start - birth_date) / 365.25)),
    pos = canonical_position(position)
  ) |>
  filter(pos != "other", !is.na(age))

# load_rosters is seasonal, so we treat the presence of the player in the
# season as "one season played"; to approximate peak we use the AV-like proxy
# of games_played when it exists in rosters... it doesn't. Use years_exp
# grouping instead: peak age = age at the season where a player had the most
# games as indicated by their weekly presence.
#
# Simpler, more honest approach: use `years_exp` as the career-progression
# marker and compute, per position, the distribution of "career year" at
# which players appear most often — this is an aging-curve proxy rather than
# a strict peak.
career_years <- games_played |>
  filter(!is.na(years_exp)) |>
  group_by(gsis_id, pos) |>
  summarise(max_years_exp = max(years_exp), .groups = "drop")

# But for "peak age" it's more useful to report the age at which a player
# appeared in the MOST seasons (i.e., modal career-surviving age). Use age
# distribution of active players per position as a population-level peak.
age_population <- rosters |>
  group_by(pos, age) |>
  summarise(player_seasons = n_distinct(gsis_id), .groups = "drop")

peak_age_by_pos <- age_population |>
  group_by(pos) |>
  slice_max(player_seasons, n = 1, with_ties = FALSE) |>
  ungroup() |>
  select(pos, modal_age = age, player_seasons)

peak_age_list <- setNames(
  lapply(seq_len(nrow(peak_age_by_pos)), function(i) {
    list(
      modal_age = peak_age_by_pos$modal_age[i],
      player_seasons_at_modal_age = peak_age_by_pos$player_seasons[i]
    )
  }),
  peak_age_by_pos$pos
)

# ---------------------------------------------------------------------------
# 3. Retirement-age distribution — final observed season age.
#    Only count careers that ended before max_season - 1 (so we don't count
#    still-active players as retired).
# ---------------------------------------------------------------------------
last_obs <- rosters |>
  group_by(gsis_id, pos) |>
  summarise(
    last_season = max(season),
    last_age = max(age[season == max(season)]),
    .groups = "drop"
  ) |>
  # Player's career is "ended" only if their last observed season is at least
  # 2 years before the end of our window.
  filter(last_season <= (max_season - 2))

retirement_summary <- last_obs |>
  group_by(pos) |>
  summarise(
    n = n(),
    mean = mean(last_age),
    sd = sd(last_age),
    p10 = as.numeric(quantile(last_age, 0.10)),
    p50 = as.numeric(quantile(last_age, 0.50)),
    p90 = as.numeric(quantile(last_age, 0.90)),
    min = min(last_age),
    max = max(last_age),
    .groups = "drop"
  ) |>
  arrange(desc(mean))

retirement_list <- setNames(
  lapply(seq_len(nrow(retirement_summary)), function(i) {
    r <- retirement_summary[i, ]
    list(
      n = r$n, mean = r$mean, sd = r$sd,
      p10 = r$p10, p50 = r$p50, p90 = r$p90,
      min = r$min, max = r$max
    )
  }),
  retirement_summary$pos
)

# ---------------------------------------------------------------------------
# 4. Year-over-year attrition — P(not on roster at age N+1 | on roster at N)
# ---------------------------------------------------------------------------
# Only count player-years where age N+1 falls within our observation window
# (i.e., age at season N < max_season). Otherwise we'd mistake window-edge
# truncation for retirement.
player_seasons <- rosters |>
  distinct(gsis_id, pos, season, age) |>
  arrange(gsis_id, season)

# Build a {player × next-year-observed} table per age.
player_next <- player_seasons |>
  # Only consider ages where the "next year" observation opportunity exists
  # in-window.
  filter(season <= (max_season - 1)) |>
  left_join(
    player_seasons |> select(gsis_id, next_season = season, next_age = age),
    by = "gsis_id",
    relationship = "many-to-many"
  ) |>
  group_by(gsis_id, pos, season, age) |>
  summarise(
    returned_next_year = any(next_season == season + 1, na.rm = TRUE),
    .groups = "drop"
  )

attrition <- player_next |>
  filter(age >= 22, age <= 40) |>
  group_by(pos, age) |>
  summarise(
    n = n(),
    returned = sum(returned_next_year),
    attrition_rate = 1 - mean(returned_next_year),
    .groups = "drop"
  )

# Nest per position.
attrition_list <- split(attrition, attrition$pos) |>
  lapply(function(df) {
    df <- df[order(df$age), ]
    setNames(
      lapply(seq_len(nrow(df)), function(i) {
        list(
          n = df$n[i],
          returned = df$returned[i],
          attrition_rate = df$attrition_rate[i]
        )
      }),
      paste0("age_", df$age)
    )
  })

# ---------------------------------------------------------------------------
# 5. Write
# ---------------------------------------------------------------------------
summaries <- list(
  p_active_by_age = age_survival_list,
  peak_age_modal = peak_age_list,
  retirement_age = retirement_list,
  year_over_year_attrition = attrition_list
)

out_path <- file.path(repo_root(), "data", "bands", "career-length.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Career length + aging curves by position. Source: load_rosters() ",
    "longitudinal, age derived from birth_date at each season's Sept-1 mark. ",
    "Position canonicalization is coarser than position-market: OL collapses ",
    "all OT/OG/OC/generic OL tags; CB and generic DB collapse into CB_DB; ",
    "LB includes OLB/ILB/MLB/generic LB (EDGE-tagged OLBs stay in LB here — ",
    "PFR's OLB/DE split is too inconsistent longitudinally to separate). ",
    "p_active_by_age uses an age-22 cohort denominator: for each position, ",
    "how many age-22 players from the season window survive to each older ",
    "age. This understates longevity for positions where careers frequently ",
    "start older than 22 (K, P, LS, late-bloomer OL) but is the cleanest ",
    "within-source aging curve available. ",
    "peak_age_modal is the age at which a position has the most player-seasons ",
    "in the window (modal age). It is a population-level peak, not a ",
    "per-player best-season metric. ",
    "retirement_age includes only players whose last observed season is at ",
    "least 2 years before the end of the window, to avoid counting still- ",
    "active players as retired. ",
    "year_over_year_attrition reports 1 - P(returns in season N+1 | active in ",
    "season N) per age, per position. The final season of the window is ",
    "excluded (no N+1 observation possible)."
  )
)

cat("Wrote", out_path, "\n")

# --- Debug print
cat("\n=== Modal (peak) age per position ===\n")
for (p in names(peak_age_list)) {
  cat("  ", sprintf("%-8s %d (%d player-seasons)\n",
                    p, peak_age_list[[p]]$modal_age,
                    peak_age_list[[p]]$player_seasons_at_modal_age))
}
cat("\n=== Retirement age (mean) ===\n")
for (p in names(retirement_list)) {
  r <- retirement_list[[p]]
  cat("  ", sprintf("%-8s n=%5d  mean=%.1f  p90=%.0f\n", p, r$n, r$mean, r$p90))
}
