#!/usr/bin/env Rscript
# surface-modifiers.R — turf vs grass modifier bands.
#
# Feeds M4 EnvironmentalModifiers. Splits pbp by field surface (grass vs
# various turf variants) and reports the offensive / kicking / injury-proxy
# rates the sim should nudge per-surface.
#
# Usage:
#   Rscript data/R/bands/surface-modifiers.R [--seasons 2020:2024]

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

# pbp.surface values (nflfastR): "grass", "fieldturf", "sportturf",
# "astroturf", "matrixturf", "a_turf", "astroplay", "".
plays <- pbp |>
  filter(season_type == "REG") |>
  mutate(
    surface_category = case_when(
      is.na(surface) | surface == ""           ~ "unknown",
      surface == "grass"                        ~ "grass",
      TRUE                                      ~ "turf"
    )
  )

slice_summary <- function(df) {
  passes <- df |> filter(qb_dropback == 1, qb_kneel == 0, qb_spike == 0,
                         is.na(two_point_conv_result))
  rushes <- df |> filter(rush == 1, qb_scramble == 0, qb_kneel == 0,
                         is.na(two_point_conv_result))
  fgs <- df |> filter(play_type == "field_goal", !is.na(field_goal_result))
  list(
    n_plays = nrow(df),
    n_games = length(unique(df$game_id)),
    pass = list(
      n = nrow(passes),
      completion_pct = mean(passes$complete_pass, na.rm = TRUE),
      yards_per_dropback = mean(passes$yards_gained, na.rm = TRUE),
      sack_rate = mean(passes$sack, na.rm = TRUE),
      fumble_rate = mean(passes$fumble, na.rm = TRUE)
    ),
    rush = list(
      n = nrow(rushes),
      yards_per_carry = mean(rushes$yards_gained, na.rm = TRUE),
      fumble_rate = mean(rushes$fumble, na.rm = TRUE),
      stuff_rate = mean(rushes$yards_gained <= 0, na.rm = TRUE),
      gain_10_plus_rate = mean(rushes$yards_gained >= 10, na.rm = TRUE)
    ),
    field_goal = list(
      n = nrow(fgs),
      make_rate = mean(fgs$field_goal_result == "made", na.rm = TRUE),
      mean_distance = mean(fgs$kick_distance, na.rm = TRUE)
    )
  )
}

categories <- unique(plays$surface_category)
by_category <- setNames(
  lapply(categories, function(cat_name) slice_summary(plays |> filter(surface_category == cat_name))),
  categories
)

by_surface_raw <- plays |>
  group_by(surface) |>
  summarise(n_plays = n(), n_games = length(unique(game_id)), .groups = "drop") |>
  arrange(desc(n_plays))

by_surface_raw_list <- setNames(
  lapply(seq_len(nrow(by_surface_raw)), function(i) {
    list(n_plays = by_surface_raw$n_plays[i], n_games = by_surface_raw$n_games[i])
  }),
  ifelse(is.na(by_surface_raw$surface) | by_surface_raw$surface == "",
         "unknown", by_surface_raw$surface)
)

summaries <- list(
  overall = slice_summary(plays),
  by_category = by_category,
  raw_surface_counts = by_surface_raw_list
)

out_path <- file.path(repo_root(), "data", "bands", "surface-modifiers.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Regular-season plays grouped by field surface. Category: grass = ",
    "pbp.surface == 'grass'; turf = all other non-empty surface values ",
    "(fieldturf, sportturf, astroturf, matrixturf, etc.); unknown = NA/''. ",
    "Each category reports pass (completion%, yards/dropback, sack%, ",
    "fumble%), rush (YPC, fumble%, stuff%, 10+%), and field goal (make ",
    "rate, mean distance). raw_surface_counts exposes the finer-grained ",
    "surface strings in case the sim wants turf-variant specificity."
  )
)

cat("Wrote", out_path, "\n")
