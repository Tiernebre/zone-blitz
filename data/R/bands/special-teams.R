#!/usr/bin/env Rscript
# special-teams.R — special-teams outcome distributions.
#
# Produces calibration bands for:
#   - Field goal success rate by distance bucket (<30, 30-39, 40-49, 50+)
#   - Punt outcomes (gross yards, touchback rate, fair catch rate, inside-20,
#     blocked rate, return yards)
#   - Kickoff outcomes (touchback rate, return yards, return TD rate, OOB rate)
#   - Blocked kick rates (FG, punt, extra point)
#   - Return TD rates per team per season (punt and kickoff)
#
# Usage:
#   Rscript data/R/bands/special-teams.R [--seasons 2020:2024]

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

reg <- pbp |> filter(season_type == "REG")

# ---- Field goals by distance bucket ----------------------------------------

field_goals <- reg |>
  filter(play_type == "field_goal", !is.na(kick_distance)) |>
  mutate(
    distance_bucket = case_when(
      kick_distance < 30  ~ "under_30",
      kick_distance <= 39 ~ "30_39",
      kick_distance <= 49 ~ "40_49",
      kick_distance >= 50 ~ "50_plus"
    )
  )

cat("Field goal attempts:", nrow(field_goals), "\n")

fg_by_bucket <- field_goals |>
  group_by(distance_bucket) |>
  summarise(
    attempts = n(),
    made     = sum(field_goal_result == "made", na.rm = TRUE),
    missed   = sum(field_goal_result == "missed", na.rm = TRUE),
    blocked  = sum(field_goal_result == "blocked", na.rm = TRUE),
    success_rate = made / attempts,
    blocked_rate = blocked / attempts,
    .groups = "drop"
  )

fg_success_by_bucket <- setNames(
  lapply(seq_len(nrow(fg_by_bucket)), function(i) {
    list(
      attempts     = fg_by_bucket$attempts[i],
      made         = fg_by_bucket$made[i],
      missed       = fg_by_bucket$missed[i],
      blocked      = fg_by_bucket$blocked[i],
      success_rate = fg_by_bucket$success_rate[i],
      blocked_rate = fg_by_bucket$blocked_rate[i]
    )
  }),
  fg_by_bucket$distance_bucket
)

fg_overall <- field_goals |>
  summarise(
    attempts     = n(),
    made         = sum(field_goal_result == "made", na.rm = TRUE),
    missed       = sum(field_goal_result == "missed", na.rm = TRUE),
    blocked      = sum(field_goal_result == "blocked", na.rm = TRUE),
    success_rate = made / attempts,
    blocked_rate = blocked / attempts
  )

fg_kick_distance <- distribution_summary(field_goals$kick_distance)

# ---- Punts -----------------------------------------------------------------

punts <- reg |>
  filter(play_type == "punt")

cat("Punt attempts:", nrow(punts), "\n")

punt_gross_yards <- distribution_summary(punts$kick_distance[!is.na(punts$kick_distance)])

punt_total <- nrow(punts)
punt_touchbacks   <- sum(punts$touchback == 1, na.rm = TRUE)
punt_fair_catches <- sum(punts$punt_fair_catch == 1, na.rm = TRUE)
punt_inside_20    <- sum(punts$punt_inside_twenty == 1, na.rm = TRUE)
punt_blocked_n    <- sum(punts$punt_blocked == 1, na.rm = TRUE)
punt_out_of_bounds <- sum(punts$punt_out_of_bounds == 1, na.rm = TRUE)
punt_downed       <- sum(punts$punt_downed == 1, na.rm = TRUE)
punt_in_endzone   <- sum(punts$punt_in_endzone == 1, na.rm = TRUE)

punt_returned <- punts |>
  filter(
    punt_blocked != 1 | is.na(punt_blocked),
    punt_fair_catch != 1 | is.na(punt_fair_catch),
    touchback != 1 | is.na(touchback),
    !is.na(return_yards),
    return_yards != 0 | (!is.na(punt_returner_player_id))
  )

punt_return_yards <- distribution_summary(punt_returned$return_yards)
punt_return_tds   <- sum(punts$return_touchdown == 1, na.rm = TRUE)

punt_outcomes <- list(
  attempts          = punt_total,
  gross_yards       = punt_gross_yards,
  touchback_rate    = punt_touchbacks / punt_total,
  fair_catch_rate   = punt_fair_catches / punt_total,
  inside_20_rate    = punt_inside_20 / punt_total,
  blocked_rate      = punt_blocked_n / punt_total,
  out_of_bounds_rate = punt_out_of_bounds / punt_total,
  downed_rate       = punt_downed / punt_total,
  return_yards      = punt_return_yards,
  return_td_rate    = punt_return_tds / punt_total,
  return_td_total   = punt_return_tds
)

# ---- Kickoffs --------------------------------------------------------------

kickoffs <- reg |>
  filter(play_type == "kickoff")

cat("Kickoff attempts:", nrow(kickoffs), "\n")

ko_total       <- nrow(kickoffs)
ko_touchbacks  <- sum(kickoffs$touchback == 1, na.rm = TRUE)
ko_oob         <- sum(kickoffs$kickoff_out_of_bounds == 1, na.rm = TRUE)
ko_fair_catch  <- sum(kickoffs$kickoff_fair_catch == 1, na.rm = TRUE)
ko_return_tds  <- sum(kickoffs$return_touchdown == 1, na.rm = TRUE)
ko_onside_recovery <- sum(kickoffs$own_kickoff_recovery == 1, na.rm = TRUE)

ko_returned <- kickoffs |>
  filter(
    touchback != 1 | is.na(touchback),
    !is.na(return_yards),
    own_kickoff_recovery != 1 | is.na(own_kickoff_recovery)
  )

ko_return_yards_dist <- distribution_summary(ko_returned$return_yards)
ko_kick_distance     <- distribution_summary(kickoffs$kick_distance[!is.na(kickoffs$kick_distance)])

kickoff_outcomes <- list(
  attempts             = ko_total,
  kick_distance        = ko_kick_distance,
  touchback_rate       = ko_touchbacks / ko_total,
  fair_catch_rate      = ko_fair_catch / ko_total,
  out_of_bounds_rate   = ko_oob / ko_total,
  return_yards         = ko_return_yards_dist,
  return_td_rate       = ko_return_tds / ko_total,
  return_td_total      = ko_return_tds,
  onside_recovery_rate = ko_onside_recovery / ko_total
)

# ---- Extra points ----------------------------------------------------------

extra_points <- reg |>
  filter(play_type == "extra_point")

cat("Extra point attempts:", nrow(extra_points), "\n")

xp_total   <- nrow(extra_points)
xp_good    <- sum(extra_points$extra_point_result == "good", na.rm = TRUE)
xp_failed  <- sum(extra_points$extra_point_result == "failed", na.rm = TRUE)
xp_blocked <- sum(extra_points$extra_point_result == "blocked", na.rm = TRUE)
xp_aborted <- sum(extra_points$extra_point_result == "aborted", na.rm = TRUE)

extra_point_outcomes <- list(
  attempts     = xp_total,
  good         = xp_good,
  failed       = xp_failed,
  blocked      = xp_blocked,
  aborted      = xp_aborted,
  success_rate = xp_good / xp_total,
  blocked_rate = xp_blocked / xp_total
)

# ---- Blocked kick rates (unified) ------------------------------------------

blocked_kicks <- list(
  field_goal = list(
    attempts     = nrow(field_goals),
    blocked      = fg_overall$blocked,
    blocked_rate = fg_overall$blocked_rate
  ),
  punt = list(
    attempts     = punt_total,
    blocked      = punt_blocked_n,
    blocked_rate = punt_blocked_n / punt_total
  ),
  extra_point = list(
    attempts     = xp_total,
    blocked      = xp_blocked,
    blocked_rate = xp_blocked / xp_total
  )
)

# ---- Return TDs per team per season ----------------------------------------

punt_return_td_by_team <- reg |>
  filter(play_type == "punt", return_touchdown == 1) |>
  count(season, return_team, name = "punt_return_tds") |>
  ungroup()

ko_return_td_by_team <- reg |>
  filter(play_type == "kickoff", return_touchdown == 1) |>
  count(season, return_team, name = "kickoff_return_tds") |>
  ungroup()

all_team_seasons <- reg |>
  filter(play_type %in% c("punt", "kickoff")) |>
  distinct(season, return_team) |>
  filter(!is.na(return_team))

return_tds_per_team_season <- all_team_seasons |>
  left_join(punt_return_td_by_team, by = c("season", "return_team")) |>
  left_join(ko_return_td_by_team, by = c("season", "return_team")) |>
  mutate(
    punt_return_tds    = ifelse(is.na(punt_return_tds), 0L, punt_return_tds),
    kickoff_return_tds = ifelse(is.na(kickoff_return_tds), 0L, kickoff_return_tds),
    total_return_tds   = punt_return_tds + kickoff_return_tds
  )

return_td_distributions <- list(
  punt_return_tds_per_team_season    = distribution_summary(return_tds_per_team_season$punt_return_tds),
  kickoff_return_tds_per_team_season = distribution_summary(return_tds_per_team_season$kickoff_return_tds),
  total_return_tds_per_team_season   = distribution_summary(return_tds_per_team_season$total_return_tds)
)

# ---- Write the band ---------------------------------------------------------

summaries <- list(
  field_goals     = list(
    overall         = list(
      attempts     = fg_overall$attempts,
      made         = fg_overall$made,
      missed       = fg_overall$missed,
      blocked      = fg_overall$blocked,
      success_rate = fg_overall$success_rate,
      blocked_rate = fg_overall$blocked_rate
    ),
    kick_distance   = fg_kick_distance,
    by_distance     = fg_success_by_bucket
  ),
  punts           = punt_outcomes,
  kickoffs        = kickoff_outcomes,
  extra_points    = extra_point_outcomes,
  blocked_kicks   = blocked_kicks,
  return_tds      = return_td_distributions
)

out_path <- file.path(repo_root(), "data", "bands", "special-teams.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Regular-season special-teams plays only. Field goals bucketed by ",
    "kick_distance (<30, 30-39, 40-49, 50+). Punt net yards approximated ",
    "via gross yards minus return yards for returned punts. Kickoff touchback ",
    "rate includes fair catches. Return TD rates computed both per-play and ",
    "per-team-per-season. Blocked kick rates cover FG, punt, and extra point. ",
    "Note: 2024 kickoff rule changes may affect kickoff distributions in that ",
    "season relative to 2020-2023."
  )
)

cat("Wrote", out_path, "\n")
