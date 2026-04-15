#!/usr/bin/env Rscript
# injuries.R — injury rate bands by position, severity, and category.
#
# Sources nflreadr::load_injuries() (official NFL injury reports) and
# nflreadr::load_rosters_weekly() to determine who actually missed games.
# Joins the two to derive severity from weeks missed rather than relying
# solely on game-status designations (Out/Doubtful/Questionable), which
# conflate reporting obligation with actual severity.
#
# Usage:
#   Rscript data/R/bands/injuries.R [--seasons 2020:2024]

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

cat("Loading injuries for seasons:", paste(range(seasons), collapse = "-"), "\n")
injuries_raw <- nflreadr::load_injuries(seasons)

cat("Loading weekly rosters for seasons:", paste(range(seasons), collapse = "-"), "\n")
rosters <- nflreadr::load_rosters_weekly(seasons)

# ---------------------------------------------------------------------------
# 1. Clean injury reports — keep only regular-season entries where the player
#    has an actual injury listed (not illness, personal, rest, etc.)
# ---------------------------------------------------------------------------

non_injury_patterns <- c(
  "illness", "rest", "not injury related", "personal", "veteran rest",
  "coach's decision"
)

injuries <- injuries_raw |>
  filter(
    game_type == "REG",
    !is.na(report_primary_injury),
    !tolower(report_primary_injury) %in% non_injury_patterns
  ) |>
  select(
    season, week, team, gsis_id, full_name, position,
    report_primary_injury, report_secondary_injury,
    report_status, practice_status
  )

cat("Injury report rows after filtering:", nrow(injuries), "\n")

# ---------------------------------------------------------------------------
# 2. Determine weeks missed per injury stint by joining to rosters.
#    A player is "active" if status == "ACT". We detect consecutive weeks
#    where a player on the injury report was NOT active.
# ---------------------------------------------------------------------------

active_weeks <- rosters |>
  filter(game_type == "REG", status == "ACT") |>
  select(season, week, gsis_id, team) |>
  distinct()

max_week_by_season <- rosters |>
  filter(game_type == "REG") |>
  group_by(season) |>
  summarise(max_week = max(week), .groups = "drop")

# Deduplicate injury reports to one entry per player per injury stint.
# A "stint" is a contiguous run of weeks on the injury report for the same
# primary injury.
injury_stints <- injuries |>
  arrange(gsis_id, season, week) |>
  group_by(gsis_id, season, report_primary_injury) |>
  mutate(
    gap = ifelse(row_number() == 1, 1, as.integer(week - lag(week) > 2)),
    stint_id = cumsum(gap)
  ) |>
  group_by(gsis_id, season, report_primary_injury, stint_id) |>
  summarise(
    team = first(team),
    position = first(position),
    full_name = first(full_name),
    first_week = min(week),
    last_week_on_report = max(week),
    report_secondary_injury = first(report_secondary_injury),
    worst_status = case_when(
      any(report_status == "Out", na.rm = TRUE) ~ "Out",
      any(report_status == "Doubtful", na.rm = TRUE) ~ "Doubtful",
      any(report_status == "Questionable", na.rm = TRUE) ~ "Questionable",
      TRUE ~ "Unknown"
    ),
    .groups = "drop"
  )

# Count weeks missed: for each stint, count how many weeks from first_week
# through the season end the player was NOT on the active roster.
# We expand each stint into its possible weeks, left-join to active_weeks,
# and count NAs.
stint_weeks <- injury_stints |>
  left_join(max_week_by_season, by = "season") |>
  rowwise() |>
  reframe(
    stint_key = paste(gsis_id, season, report_primary_injury, stint_id, sep = "::"),
    week = seq(first_week, max_week)
  )

stint_weeks <- stint_weeks |>
  mutate(
    gsis_id = sub("::.*", "", stint_key),
    season = as.integer(sub("^[^:]*::([^:]*)::.*", "\\1", stint_key))
  )

stint_active <- stint_weeks |>
  left_join(
    active_weeks |> mutate(is_active = TRUE),
    by = c("gsis_id", "season", "week")
  ) |>
  mutate(is_active = ifelse(is.na(is_active), FALSE, TRUE))

weeks_missed_df <- stint_active |>
  group_by(stint_key) |>
  summarise(weeks_missed = sum(!is_active), .groups = "drop")

# Rejoin to stints
injury_stints <- injury_stints |>
  mutate(stint_key = paste(gsis_id, season, report_primary_injury, stint_id, sep = "::")) |>
  left_join(weeks_missed_df, by = "stint_key") |>
  select(-stint_key)

cat("Injury stints identified:", nrow(injury_stints), "\n")

# ---------------------------------------------------------------------------
# 3. Classify severity from weeks missed
# ---------------------------------------------------------------------------
injury_stints <- injury_stints |>
  mutate(
    severity = case_when(
      weeks_missed == 0 ~ "0_games",
      weeks_missed == 1 ~ "1_game",
      weeks_missed >= 2 & weeks_missed <= 3 ~ "2_3_weeks",
      weeks_missed >= 4 & weeks_missed <= 7 ~ "4_7_weeks",
      weeks_missed >= 8 ~ "season_ending",
    )
  )

# ---------------------------------------------------------------------------
# 4. Classify injury category from report_primary_injury
# ---------------------------------------------------------------------------
injury_stints <- injury_stints |>
  mutate(
    category = case_when(
      grepl("hamstring|groin|calf|quad|achilles|muscle", tolower(report_primary_injury)) ~ "soft_tissue",
      grepl("concussion", tolower(report_primary_injury)) ~ "concussion",
      grepl("knee|acl|mcl|meniscus|pcl", tolower(report_primary_injury)) ~ "knee",
      grepl("ankle", tolower(report_primary_injury)) ~ "ankle",
      grepl("shoulder|pectoral|rotator", tolower(report_primary_injury)) ~ "shoulder",
      grepl("back|spine|neck|cervical|lumbar", tolower(report_primary_injury)) ~ "back_neck",
      grepl("foot|toe|plantar|lisfranc", tolower(report_primary_injury)) ~ "foot",
      grepl("hand|wrist|finger|thumb|elbow|arm", tolower(report_primary_injury)) ~ "upper_extremity",
      grepl("hip|pelvis", tolower(report_primary_injury)) ~ "hip",
      grepl("rib|chest|abdomen|oblique", tolower(report_primary_injury)) ~ "torso",
      grepl("head|eye|jaw|facial|ear", tolower(report_primary_injury)) ~ "head_face",
      TRUE ~ "other"
    )
  )

# ---------------------------------------------------------------------------
# 5. Map positions to position groups
# ---------------------------------------------------------------------------
injury_stints <- injury_stints |>
  mutate(
    position_group = case_when(
      position == "QB" ~ "QB",
      position %in% c("RB", "FB") ~ "RB",
      position %in% c("WR") ~ "WR",
      position %in% c("TE") ~ "TE",
      position %in% c("OL", "T", "G", "C", "OT", "OG") ~ "OL",
      position %in% c("DL", "DT", "DE", "NT") ~ "DL",
      position %in% c("LB", "ILB", "OLB", "MLB") ~ "LB",
      position %in% c("DB", "CB", "S", "FS", "SS") ~ "DB",
      position %in% c("K", "P", "LS") ~ "ST",
      TRUE ~ "other"
    )
  )

# ---------------------------------------------------------------------------
# 6. Compute band metrics
# ---------------------------------------------------------------------------

# 6a. Injuries per team per game (all severities)
# Count unique injury stints starting per team per week
team_week_injuries <- injury_stints |>
  group_by(season, first_week, team) |>
  summarise(injuries = n_distinct(gsis_id), .groups = "drop")

# Fill in team-weeks with zero injuries
all_team_weeks <- rosters |>
  filter(game_type == "REG", status == "ACT") |>
  select(season, week, team) |>
  distinct()

team_week_full <- all_team_weeks |>
  left_join(
    team_week_injuries,
    by = c("season", "week" = "first_week", "team")
  ) |>
  mutate(injuries = ifelse(is.na(injuries), 0L, injuries))

injuries_per_team_game <- distribution_summary(team_week_full$injuries)

# 6b. Season-ending injury rate as % of active roster per team per season
season_ending <- injury_stints |>
  filter(severity == "season_ending") |>
  group_by(season, team) |>
  summarise(se_count = n_distinct(gsis_id), .groups = "drop")

roster_size_by_team_season <- rosters |>
  filter(game_type == "REG", status == "ACT") |>
  group_by(season, team) |>
  summarise(roster_size = n_distinct(gsis_id), .groups = "drop")

se_rate <- roster_size_by_team_season |>
  left_join(season_ending, by = c("season", "team")) |>
  mutate(
    se_count = ifelse(is.na(se_count), 0L, se_count),
    se_pct = se_count / roster_size
  )

season_ending_rate <- distribution_summary(se_rate$se_pct)

# 6c. Position-specific injury rate (injuries per player per season)
injuries_by_pos <- injury_stints |>
  group_by(season, position_group) |>
  summarise(injury_count = n(), .groups = "drop")

players_by_pos <- rosters |>
  filter(game_type == "REG", status == "ACT") |>
  mutate(
    position_group = case_when(
      position == "QB" ~ "QB",
      position %in% c("RB", "FB") ~ "RB",
      position %in% c("WR") ~ "WR",
      position %in% c("TE") ~ "TE",
      position %in% c("OL", "T", "G", "C", "OT", "OG") ~ "OL",
      position %in% c("DL", "DT", "DE", "NT") ~ "DL",
      position %in% c("LB", "ILB", "OLB", "MLB") ~ "LB",
      position %in% c("DB", "CB", "S", "FS", "SS") ~ "DB",
      position %in% c("K", "P", "LS") ~ "ST",
      TRUE ~ "other"
    )
  ) |>
  group_by(season, position_group) |>
  summarise(player_count = n_distinct(gsis_id), .groups = "drop")

pos_rate <- injuries_by_pos |>
  inner_join(players_by_pos, by = c("season", "position_group")) |>
  mutate(rate = injury_count / player_count)

position_injury_rates <- pos_rate |>
  group_by(position_group) |>
  summarise(
    seasons = n(),
    mean_rate = mean(rate),
    sd_rate = sd(rate),
    min_rate = min(rate),
    max_rate = max(rate),
    mean_injuries_per_season = mean(injury_count),
    mean_players = mean(player_count),
    .groups = "drop"
  ) |>
  arrange(desc(mean_rate))

pos_rate_list <- setNames(
  lapply(seq_len(nrow(position_injury_rates)), function(i) {
    row <- position_injury_rates[i, ]
    list(
      mean_rate = row$mean_rate,
      sd = row$sd_rate,
      min = row$min_rate,
      max = row$max_rate,
      mean_injuries_per_season = row$mean_injuries_per_season,
      mean_players_per_season = row$mean_players
    )
  }),
  position_injury_rates$position_group
)

# 6d. Injury category distribution (proportion of all injury stints)
category_counts <- injury_stints |>
  count(category, name = "count") |>
  mutate(proportion = count / sum(count)) |>
  arrange(desc(proportion))

category_list <- setNames(
  lapply(seq_len(nrow(category_counts)), function(i) {
    row <- category_counts[i, ]
    list(count = row$count, proportion = row$proportion)
  }),
  category_counts$category
)

# 6e. Severity split (proportion of all injury stints)
severity_counts <- injury_stints |>
  count(severity, name = "count") |>
  mutate(proportion = count / sum(count)) |>
  arrange(factor(severity, levels = c("0_games", "1_game", "2_3_weeks", "4_7_weeks", "season_ending")))

severity_list <- setNames(
  lapply(seq_len(nrow(severity_counts)), function(i) {
    row <- severity_counts[i, ]
    list(count = row$count, proportion = row$proportion)
  }),
  severity_counts$severity
)

# 6f. Re-injury rate — players who had >1 stint for the same injury type
# in the same season
re_injuries <- injury_stints |>
  group_by(gsis_id, season, report_primary_injury) |>
  summarise(stints = n(), .groups = "drop") |>
  filter(stints > 1)

total_injured_player_seasons <- injury_stints |>
  distinct(gsis_id, season) |>
  nrow()

re_injury_player_seasons <- re_injuries |>
  distinct(gsis_id, season) |>
  nrow()

re_injury_rate <- list(
  re_injured_player_seasons = re_injury_player_seasons,
  total_injured_player_seasons = total_injured_player_seasons,
  rate = re_injury_player_seasons / total_injured_player_seasons
)

# ---------------------------------------------------------------------------
# 7. Assemble and write output
# ---------------------------------------------------------------------------
summaries <- list(
  injuries_per_team_game = injuries_per_team_game,
  season_ending_rate_pct_of_roster = season_ending_rate,
  position_injury_rates = pos_rate_list,
  injury_category_distribution = category_list,
  severity_distribution = severity_list,
  re_injury_rate = re_injury_rate
)

out_path <- file.path(repo_root(), "data", "bands", "injuries.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Injury bands derived from nflreadr::load_injuries() joined to ",
    "nflreadr::load_rosters_weekly(). Regular season only. ",
    "Severity classified by actual weeks missed (roster absence), not game-status ",
    "designation. Season-ending = 8+ weeks missed. ",
    "Non-injury reports (illness, rest, personal) excluded. ",
    "Position groups: QB, RB (incl FB), WR, TE, OL, DL, LB, DB, ST (K/P/LS). ",
    "Re-injury rate = proportion of injured player-seasons with >1 stint for ",
    "the same injury type within a season."
  )
)

cat("Wrote", out_path, "\n")

# Print a quick summary for verification
cat("\n=== Quick Summary ===\n")
cat("Injuries per team per game — mean:", round(injuries_per_team_game$mean, 2),
    "sd:", round(injuries_per_team_game$sd, 2), "\n")
cat("Season-ending rate — mean:", round(season_ending_rate$mean * 100, 1), "%\n")
cat("\nPosition rates (injuries per player per season):\n")
for (pg in names(pos_rate_list)) {
  cat("  ", pg, ":", round(pos_rate_list[[pg]]$mean_rate, 3), "\n")
}
cat("\nCategory distribution:\n")
for (cat_name in names(category_list)) {
  cat("  ", cat_name, ":", round(category_list[[cat_name]]$proportion * 100, 1), "%\n")
}
cat("\nSeverity distribution:\n")
for (sev in names(severity_list)) {
  cat("  ", sev, ":", round(severity_list[[sev]]$proportion * 100, 1), "%\n")
}
cat("\nRe-injury rate:", round(re_injury_rate$rate * 100, 1), "%\n")
