#!/usr/bin/env Rscript
# per-position-penalty-rates.R — per-position penalty-type frequency bands.
#
# Feeds M2 PenaltyModel so a sim can roll the correct penalty type given
# which position group committed it. Output lands in
# data/bands/per-position/penalty-rates.json so it co-locates with the
# other per-position bands without mutating the snap-qualified player-
# season files (which are independently maintained).
#
# Usage:
#   Rscript data/R/bands/per-position-penalty-rates.R [--seasons 2020:2024]

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

cat("Loading pbp + rosters for seasons:", paste(range(seasons), collapse = "-"), "\n")
pbp <- nflreadr::load_pbp(seasons)
rosters <- nflreadr::load_rosters(seasons) |>
  select(season, gsis_id, position) |>
  distinct()

# Penalty plays with a named penalty player.
pen <- pbp |>
  filter(season_type == "REG", penalty == 1, !is.na(penalty_player_id),
         !is.na(penalty_type)) |>
  select(season, penalty_player_id, penalty_type, penalty_yards)

cat("Penalty player-plays:", nrow(pen), "\n")

# Join to roster position
pen_pos <- pen |>
  left_join(rosters, by = c("season" = "season", "penalty_player_id" = "gsis_id")) |>
  mutate(position = coalesce(position, "UNKNOWN"))

# Bucket positions into coarse groups the sim cares about.
pen_pos <- pen_pos |>
  mutate(
    position_group = case_when(
      position == "QB"                          ~ "QB",
      position == "RB"                          ~ "RB",
      position == "FB"                          ~ "RB",
      position == "WR"                          ~ "WR",
      position == "TE"                          ~ "TE",
      position %in% c("T", "OT")                 ~ "OT",
      position %in% c("G", "OG", "C", "OL")      ~ "IOL",
      position %in% c("DE", "OLB", "EDGE")       ~ "EDGE",
      position %in% c("DT", "NT", "DL")          ~ "IDL",
      position %in% c("LB", "ILB", "MLB")        ~ "LB",
      position %in% c("CB", "DB")                ~ "CB",
      position %in% c("S", "SS", "FS", "SAF")    ~ "S",
      position %in% c("K", "P", "LS", "KR", "PR") ~ "ST",
      TRUE                                        ~ "OTHER"
    )
  )

total_by_group <- pen_pos |>
  count(position_group, name = "n_penalties")

by_group <- pen_pos |>
  count(position_group, penalty_type) |>
  group_by(position_group) |>
  mutate(share = n / sum(n)) |>
  ungroup()

build_group <- function(gname) {
  rows <- by_group |> filter(position_group == gname) |> arrange(desc(n))
  penalties_list <- setNames(
    lapply(seq_len(nrow(rows)), function(i) {
      list(n = rows$n[i], share = rows$share[i])
    }),
    rows$penalty_type
  )
  group_total <- total_by_group$n_penalties[total_by_group$position_group == gname]
  mean_yds <- pen_pos |>
    filter(position_group == gname) |>
    summarise(mean_yards = mean(penalty_yards, na.rm = TRUE)) |>
    pull(mean_yards)
  list(
    n_penalties = group_total,
    mean_yards = mean_yds,
    by_type = penalties_list
  )
}

groups <- setdiff(unique(pen_pos$position_group), NA)
position_groups <- setNames(lapply(groups, build_group), groups)

summaries <- list(
  total_penalties_with_player = nrow(pen_pos),
  position_groups = position_groups
)

out_path <- file.path(repo_root(), "data", "bands", "per-position", "penalty-rates.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Regular-season penalties with a named penalty_player_id, joined to ",
    "load_rosters() to tag position. Positions are bucketed into sim ",
    "groups: QB, RB (incl FB), WR, TE, OT, IOL (G/C), EDGE (DE/OLB), IDL ",
    "(DT/NT), LB (ILB/MLB), CB, S, ST (K/P/LS/returners), OTHER/UNKNOWN. ",
    "For each group: n_penalties, mean penalty_yards, and share by ",
    "penalty_type. Penalties with NA penalty_player_id (team/dead-ball ",
    "fouls) are excluded — those live in data/bands/penalties.json."
  )
)

cat("Wrote", out_path, "\n")
