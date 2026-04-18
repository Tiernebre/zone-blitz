#!/usr/bin/env Rscript
# weather-modifiers.R — weather effect bands on passing / rushing / kicking.
#
# Feeds M4 EnvironmentalModifiers. Splits pbp by a weather category derived
# from pbp's `roof` column plus schedule weather metadata (temp, wind). For
# each category we report the key offensive + kicking rates the sim should
# nudge.
#
# Usage:
#   Rscript data/R/bands/weather-modifiers.R [--seasons 2020:2024]

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
schedules <- nflreadr::load_schedules(seasons)

# Join schedule weather onto pbp. pbp already has `roof`, `temp`, `wind` —
# use those directly; schedule is only a fallback for missing wind.
wx <- pbp |>
  filter(season_type == "REG") |>
  left_join(
    schedules |> select(game_id, sched_wind = wind, sched_temp = temp),
    by = "game_id"
  ) |>
  mutate(
    wind_val = coalesce(as.numeric(wind), as.numeric(sched_wind)),
    temp_val = coalesce(as.numeric(temp), as.numeric(sched_temp)),
    wx_category = case_when(
      roof %in% c("dome", "closed")                    ~ "dome",
      !is.na(wind_val) & wind_val >= 15                ~ "windy",
      !is.na(temp_val) & temp_val <= 32                ~ "cold",
      roof %in% c("outdoors", "open")                  ~ "outdoor_fair",
      TRUE                                              ~ "unknown"
    )
  )

# Helper: compute rates for one slice
slice_summary <- function(df) {
  passes <- df |> filter(qb_dropback == 1, qb_kneel == 0, qb_spike == 0,
                         is.na(two_point_conv_result))
  rushes <- df |> filter(rush == 1, qb_scramble == 0, qb_kneel == 0,
                         is.na(two_point_conv_result))
  fgs <- df |> filter(play_type == "field_goal", !is.na(field_goal_result))
  punts <- df |> filter(play_type == "punt")

  list(
    n_plays = nrow(df),
    n_games = length(unique(df$game_id)),
    pass = list(
      n = nrow(passes),
      completion_pct = mean(passes$complete_pass, na.rm = TRUE),
      yards_per_dropback = mean(passes$yards_gained, na.rm = TRUE),
      sack_rate = mean(passes$sack, na.rm = TRUE),
      int_rate = mean(passes$interception, na.rm = TRUE),
      mean_air_yards = mean(passes$air_yards, na.rm = TRUE)
    ),
    rush = list(
      n = nrow(rushes),
      yards_per_carry = mean(rushes$yards_gained, na.rm = TRUE),
      fumble_rate = mean(rushes$fumble, na.rm = TRUE),
      stuff_rate = mean(rushes$yards_gained <= 0, na.rm = TRUE)
    ),
    field_goal = list(
      n = nrow(fgs),
      make_rate = mean(fgs$field_goal_result == "made", na.rm = TRUE),
      mean_distance = mean(fgs$kick_distance, na.rm = TRUE)
    ),
    punt = list(
      n = nrow(punts),
      mean_distance = mean(punts$kick_distance, na.rm = TRUE)
    )
  )
}

categories <- unique(wx$wx_category)
by_category <- setNames(
  lapply(categories, function(cat_name) slice_summary(wx |> filter(wx_category == cat_name))),
  categories
)

# Overall baseline for reference
overall <- slice_summary(wx)

summaries <- list(
  overall = overall,
  by_category = by_category
)

out_path <- file.path(repo_root(), "data", "bands", "weather-modifiers.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Regular-season plays, split by weather category derived from pbp.roof ",
    "+ pbp.wind + pbp.temp (with nflreadr load_schedules() as fallback for ",
    "wind/temp). Categories: dome (roof in {dome, closed}), windy (wind >= ",
    "15mph), cold (temp <= 32F and not dome/windy), outdoor_fair (remaining ",
    "outdoors/open), unknown (missing roof/weather). Each category reports ",
    "pass (completion%, yards/dropback, sack%, int%, air yards), rush ",
    "(YPC, fumble%, stuff%), field goal (make rate, mean distance), punt ",
    "(mean distance). Overall baseline included for delta comparison."
  )
)

cat("Wrote", out_path, "\n")
