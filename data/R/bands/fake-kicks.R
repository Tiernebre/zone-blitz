#!/usr/bin/env Rscript
# fake-kicks.R — fake punt & fake field goal rates and success.
#
# Feeds ST1 FieldGoalModel and ST4 PuntModel decision branches. Fakes are
# rare so we widen to a 10-season window.
#
# Usage:
#   Rscript data/R/bands/fake-kicks.R [--seasons 2015:2024]

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
seasons <- if (length(args) == 0) 2015:2024 else parse_seasons(args)

cat("Loading pbp for seasons:", paste(range(seasons), collapse = "-"), "\n")
pbp <- nflreadr::load_pbp(seasons)

# nflfastR flags: `aborted_play`, and play_type_nfl occasionally tags fakes.
# Most reliable heuristic: a down == 4 play where the pre-snap formation is
# punt or FG but the play_type ends up pass or run. Unfortunately pbp does
# not retain formation. Fallback: search play description for "fake" or
# "punter" / "kicker" as ball carrier.

fourth_downs <- pbp |>
  filter(season_type == "REG", down == 4, !is.na(play_type))

# Fake punt: play_type_nfl contains "PUNT" or desc mentions "punts" formation but play_type is pass/run
# Use description text as heuristic.
desc <- tolower(fourth_downs$desc)
fake_punt_flag <- grepl("fake punt|fake.*punt", desc) |
                   (grepl("punter", desc) & fourth_downs$play_type %in% c("pass", "run"))
fake_fg_flag <- grepl("fake field goal|fake.*field goal|fake fg", desc) |
                 (grepl("holder", desc) & fourth_downs$play_type %in% c("pass", "run"))

fourth_downs <- fourth_downs |>
  mutate(
    is_fake_punt = fake_punt_flag,
    is_fake_fg = fake_fg_flag,
    is_fake = fake_punt_flag | fake_fg_flag
  )

# Denominators: all punt attempts and FG attempts on 4th down (counts the
# "could have faked" plays).
punts_all <- fourth_downs |> filter(play_type == "punt" | is_fake_punt)
fgs_all <- fourth_downs |> filter(play_type == "field_goal" | is_fake_fg)

cat("Punt-situation plays:", nrow(punts_all), "fake_punts:", sum(punts_all$is_fake_punt), "\n")
cat("FG-situation plays:", nrow(fgs_all), "fake_fgs:", sum(fgs_all$is_fake_fg), "\n")

fake_punts <- punts_all |> filter(is_fake_punt)
fake_fgs <- fgs_all |> filter(is_fake_fg)

fake_punt_block <- list(
  n_fakes = nrow(fake_punts),
  n_punt_situations = nrow(punts_all),
  rate = nrow(fake_punts) / max(nrow(punts_all), 1),
  first_down_success_rate = mean(fake_punts$first_down == 1, na.rm = TRUE),
  mean_yards_gained = mean(fake_punts$yards_gained, na.rm = TRUE),
  touchdown_rate = mean(fake_punts$touchdown, na.rm = TRUE)
)

fake_fg_block <- list(
  n_fakes = nrow(fake_fgs),
  n_fg_situations = nrow(fgs_all),
  rate = nrow(fake_fgs) / max(nrow(fgs_all), 1),
  first_down_success_rate = mean(fake_fgs$first_down == 1, na.rm = TRUE),
  mean_yards_gained = mean(fake_fgs$yards_gained, na.rm = TRUE),
  touchdown_rate = mean(fake_fgs$touchdown, na.rm = TRUE)
)

summaries <- list(
  fake_punts = fake_punt_block,
  fake_field_goals = fake_fg_block
)

out_path <- file.path(repo_root(), "data", "bands", "fake-kicks.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Regular-season 4th-down plays over 10 seasons (fakes are rare). Fake ",
    "detection is heuristic on pbp.desc: matches 'fake punt' / 'fake field ",
    "goal' text or a pass/run executed by the punter/holder on a 4th-down ",
    "punt/FG situation. Denominator is all 4th-down plays where a ",
    "punt/FG was lined up (punt attempts + fake punts, FG attempts + fake ",
    "FGs). first_down_success_rate is the conversion rate on the fake."
  )
)

cat("Wrote", out_path, "\n")
