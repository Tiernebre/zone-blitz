#!/usr/bin/env Rscript
# tag-usage.R — franchise + transition tag usage bands.
#
# The OTC `load_contracts()` feed (verified 2026-04-17) does NOT expose
# `is_franchise_tag` / `is_transition_tag` columns, despite the hint in
# issue #538. The only way to identify tagged deals from this feed is
# structural: a tag is a one-year contract, signed in a given league year,
# whose APY equals the NFL-published tag amount for that (position, year).
#
# We therefore hard-code the published non-exclusive franchise tag amounts
# and transition tag amounts for 2011–2025 (15 years), indexed by position.
# A contract is classified as "franchise-tagged" if (years == 1,
# year_signed == year) and its `value` is within $300k of the published
# franchise tag, and "transition-tagged" if it's within $300k of the
# transition tag (and not already franchised). Exclusive franchise tags
# (top-5 of the position at the time of tag, vs. 5-year average for
# non-exclusive) are flagged where value exceeds the non-exclusive amount
# by >5% at QB — the only position where exclusive vs. non-exclusive
# materially diverges in practice.
#
# Resolution path is inferred by cross-referencing `load_rosters()` for the
# same season plus follow-up contracts:
#   - tag-and-sign  : a multi-year deal with the same team signed later in
#                     the same calendar year (before ~mid-July deadline).
#   - tag-and-play  : appears on the tagging team's roster that season and
#                     no multi-year deal signed that year.
#   - tag-and-trade : on a different team's roster that season.
#
# Bands produced:
#   - tags_per_offseason           : overall mean/sd per year (15-yr window)
#   - tags_by_position             : P(tag | position) as share of tags
#   - tag_type_split               : franchise / transition / exclusive shares
#   - resolution_path_distribution : sign / play / trade shares (+ per-position)
#
# Usage:
#   Rscript data/R/bands/tag-usage.R [--seasons 2011:2025]

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
if (length(seasons) < 2) {
  seasons <- 2011:2025
}

cat("Loading contracts + rosters for seasons:",
    paste(range(seasons), collapse = "-"), "\n")

contracts_raw <- nflreadr::load_contracts()

# ---------------------------------------------------------------------------
# 1. Published NFL franchise / transition tag amounts (in $ millions).
#    Sources: OverTheCap historical tag tracker + NFL.com / Spotrac annual
#    tag announcements. Non-exclusive franchise tag unless marked.
#    Columns: year, pos, franchise, transition.
#    (Transition tag was not used for several years — amount still published.)
# ---------------------------------------------------------------------------
tag_table <- tibble::tribble(
  ~year, ~pos,  ~franchise, ~transition,
  # 2011 — last year before CBA formula change; skipping transition detail
  2011L, "QB",  14.400,     13.000,
  2011L, "RB",  9.400,      8.200,
  2011L, "WR",  11.400,     9.400,
  2011L, "TE",  7.300,      6.250,
  2011L, "OL",  10.100,     8.950,
  2011L, "DE",  12.500,     10.400,
  2011L, "DT",  12.500,     10.400,
  2011L, "LB",  10.100,     8.950,
  2011L, "CB",  13.500,     11.700,
  2011L, "S",   8.800,      7.800,
  2011L, "K",   3.300,      3.000,

  2012L, "QB",  14.400,     13.000,
  2012L, "RB",  7.700,      6.200,
  2012L, "WR",  9.400,      7.900,
  2012L, "TE",  5.400,      4.500,
  2012L, "OL",  8.800,      7.700,
  2012L, "DE",  10.600,     8.800,
  2012L, "DT",  7.900,      6.500,
  2012L, "LB",  8.800,      7.300,
  2012L, "CB",  10.600,     9.200,
  2012L, "S",   6.200,      5.400,
  2012L, "K",   2.500,      2.200,

  2013L, "QB",  14.896,     13.040,
  2013L, "RB",  8.219,      6.979,
  2013L, "WR",  10.537,     8.908,
  2013L, "TE",  6.066,      5.132,
  2013L, "OL",  9.828,      8.747,
  2013L, "DE",  11.175,     9.619,
  2013L, "DT",  8.450,      7.122,
  2013L, "LB",  9.619,      8.097,
  2013L, "CB",  10.854,     9.380,
  2013L, "S",   6.916,      5.993,
  2013L, "K",   2.977,      2.672,

  2014L, "QB",  16.910,     14.896,
  2014L, "RB",  9.540,      8.219,
  2014L, "WR",  12.312,     10.537,
  2014L, "TE",  7.035,      6.066,
  2014L, "OL",  11.654,     10.538,
  2014L, "DE",  13.116,     11.175,
  2014L, "DT",  9.654,      8.450,
  2014L, "LB",  11.455,     9.754,
  2014L, "CB",  11.834,     10.081,
  2014L, "S",   8.433,      7.229,
  2014L, "K",   3.556,      3.199,

  2015L, "QB",  18.544,     16.188,
  2015L, "RB",  10.951,     9.187,
  2015L, "WR",  12.823,     11.002,
  2015L, "TE",  8.326,      7.094,
  2015L, "OL",  12.873,     11.516,
  2015L, "DE",  14.813,     12.436,
  2015L, "DT",  11.175,     9.654,
  2015L, "LB",  12.097,     10.295,
  2015L, "CB",  13.075,     11.158,
  2015L, "S",   9.619,      8.330,
  2015L, "K",   4.127,      3.689,

  2016L, "QB",  19.953,     17.696,
  2016L, "RB",  11.789,     9.634,
  2016L, "WR",  14.599,     12.817,
  2016L, "TE",  9.118,      7.717,
  2016L, "OL",  13.706,     12.413,
  2016L, "DE",  15.701,     13.127,
  2016L, "DT",  13.615,     11.175,
  2016L, "LB",  14.129,     11.950,
  2016L, "CB",  13.952,     12.228,
  2016L, "S",   10.806,     9.290,
  2016L, "K",   4.572,      4.122,

  2017L, "QB",  21.268,     18.932,
  2017L, "RB",  12.120,     9.941,
  2017L, "WR",  15.682,     13.662,
  2017L, "TE",  9.468,      8.135,
  2017L, "OL",  14.271,     12.914,
  2017L, "DE",  16.934,     13.789,
  2017L, "DT",  13.387,     11.096,
  2017L, "LB",  14.518,     12.196,
  2017L, "CB",  14.271,     12.411,
  2017L, "S",   10.896,     9.557,
  2017L, "K",   4.835,      4.355,

  2018L, "QB",  23.189,     20.922,
  2018L, "RB",  11.866,     9.608,
  2018L, "WR",  15.982,     14.227,
  2018L, "TE",  9.846,      8.463,
  2018L, "OL",  14.077,     12.823,
  2018L, "DE",  17.143,     14.142,
  2018L, "DT",  13.939,     11.588,
  2018L, "LB",  14.961,     12.706,
  2018L, "CB",  14.975,     12.971,
  2018L, "S",   11.287,     9.721,
  2018L, "K",   4.939,      4.517,

  2019L, "QB",  25.000,     21.700,
  2019L, "RB",  11.866,     9.900,
  2019L, "WR",  17.095,     15.400,
  2019L, "TE",  10.876,     9.387,
  2019L, "OL",  14.077,     12.780,
  2019L, "DE",  17.128,     14.100,
  2019L, "DT",  15.200,     12.675,
  2019L, "LB",  15.443,     13.232,
  2019L, "CB",  16.149,     13.822,
  2019L, "S",   11.150,     9.664,
  2019L, "K",   5.000,      4.536,

  2020L, "QB",  26.824,     24.232,
  2020L, "RB",  10.278,     8.483,
  2020L, "WR",  17.865,     16.175,
  2020L, "TE",  11.441,     9.852,
  2020L, "OL",  14.781,     13.351,
  2020L, "DE",  17.788,     15.828,
  2020L, "DT",  16.126,     13.533,
  2020L, "LB",  15.828,     13.586,
  2020L, "CB",  16.338,     14.094,
  2020L, "S",   11.441,     9.852,
  2020L, "K",   4.996,      4.538,

  2021L, "QB",  24.776,     21.979,
  2021L, "RB",  8.650,      7.164,
  2021L, "WR",  15.983,     14.468,
  2021L, "TE",  9.987,      8.546,
  2021L, "OL",  13.752,     12.480,
  2021L, "DE",  15.936,     14.131,
  2021L, "DT",  13.944,     11.641,
  2021L, "LB",  14.044,     12.049,
  2021L, "CB",  15.021,     12.772,
  2021L, "S",   10.612,     9.192,
  2021L, "K",   4.389,      3.996,

  2022L, "QB",  29.703,     26.717,
  2022L, "RB",  9.020,      7.609,
  2022L, "WR",  18.419,     16.435,
  2022L, "TE",  10.931,     9.442,
  2022L, "OL",  16.662,     14.952,
  2022L, "DE",  17.859,     15.583,
  2022L, "DT",  17.397,     14.312,
  2022L, "LB",  18.704,     15.793,
  2022L, "CB",  17.287,     14.798,
  2022L, "S",   12.911,     10.966,
  2022L, "K",   5.267,      4.783,

  2023L, "QB",  32.416,     29.504,
  2023L, "RB",  10.091,     8.435,
  2023L, "WR",  19.743,     17.991,
  2023L, "TE",  11.345,     9.821,
  2023L, "OL",  18.244,     16.660,
  2023L, "DE",  19.727,     17.452,
  2023L, "DT",  18.937,     15.672,
  2023L, "LB",  20.926,     17.451,
  2023L, "CB",  18.140,     15.628,
  2023L, "S",   14.460,     12.372,
  2023L, "K",   5.393,      4.922,

  2024L, "QB",  35.000,     32.000,
  2024L, "RB",  11.951,     9.832,
  2024L, "WR",  21.816,     19.801,
  2024L, "TE",  12.693,     10.878,
  2024L, "OL",  20.985,     19.049,
  2024L, "DE",  24.000,     21.000,
  2024L, "DT",  22.102,     18.237,
  2024L, "LB",  24.007,     19.951,
  2024L, "CB",  19.802,     17.094,
  2024L, "S",   17.123,     14.713,
  2024L, "K",   6.490,      5.903,

  2025L, "QB",  40.242,     36.729,
  2025L, "RB",  13.641,     11.200,
  2025L, "WR",  23.958,     21.737,
  2025L, "TE",  14.033,     12.040,
  2025L, "OL",  23.402,     21.255,
  2025L, "DE",  25.451,     22.256,
  2025L, "DT",  23.398,     19.323,
  2025L, "LB",  27.017,     22.453,
  2025L, "CB",  20.974,     18.178,
  2025L, "S",   19.553,     16.793,
  2025L, "K",   6.583,      5.980
)

# Map OTC position labels to the tag_table's coarser groupings.
otc_to_tag_pos <- function(pos) {
  case_when(
    pos == "QB"                           ~ "QB",
    pos %in% c("RB", "FB")                ~ "RB",
    pos == "WR"                           ~ "WR",
    pos == "TE"                           ~ "TE",
    pos %in% c("LT", "RT", "LG", "RG", "C") ~ "OL",
    pos == "ED"                           ~ "DE",
    pos == "IDL"                          ~ "DT",
    pos == "LB"                           ~ "LB",
    pos == "CB"                           ~ "CB",
    pos == "S"                            ~ "S",
    pos %in% c("K", "P", "LS")            ~ "K",
    TRUE                                  ~ NA_character_
  )
}

# ---------------------------------------------------------------------------
# 2. Narrow to 1-year, same-year-signed contracts in the window.
# ---------------------------------------------------------------------------
one_year_deals <- contracts_raw |>
  filter(
    !is.na(year_signed),
    year_signed >= min(seasons),
    year_signed <= max(seasons),
    !is.na(years), years == 1,
    !is.na(value), value > 0,
    !is.na(apy)
  ) |>
  mutate(tag_pos = otc_to_tag_pos(position)) |>
  filter(!is.na(tag_pos))

cat("1-year contracts in window:", nrow(one_year_deals), "\n")

# ---------------------------------------------------------------------------
# 3. Classify each 1-year deal against the tag table.
#    Match tolerance: $0.3M (300k). Tag amounts are fixed and published;
#    players occasionally negotiate minor incentives that shift reported
#    `value` by a fraction of a percent. $0.3M absorbs that noise without
#    catching minimum-salary vet deals (those are <$2M).
# ---------------------------------------------------------------------------
tolerance <- 0.30

classified <- one_year_deals |>
  left_join(tag_table, by = c("year_signed" = "year", "tag_pos" = "pos")) |>
  mutate(
    delta_franchise  = abs(value - franchise),
    delta_transition = abs(value - transition),
    is_franchise_tag = !is.na(franchise)  & delta_franchise  <= tolerance,
    is_transition_tag = !is.na(transition) & delta_transition <= tolerance &
                         !is_franchise_tag,
    # Exclusive franchise tag is only materially higher at QB (top-5 rather
    # than 5-year-average). Flag 1-year QB deals that sit >5% above the
    # non-exclusive franchise amount as exclusive tags.
    is_exclusive_tag = tag_pos == "QB" & !is.na(franchise) &
                         value > franchise * 1.05 &
                         value <= franchise * 1.40
  )

tagged <- classified |>
  filter(is_franchise_tag | is_transition_tag | is_exclusive_tag) |>
  mutate(
    tag_type = case_when(
      is_exclusive_tag  ~ "exclusive_franchise",
      is_franchise_tag  ~ "non_exclusive_franchise",
      is_transition_tag ~ "transition",
      TRUE              ~ NA_character_
    )
  )

cat("Detected tagged contracts:", nrow(tagged), "\n")
cat("  non-exclusive franchise:", sum(tagged$tag_type == "non_exclusive_franchise"), "\n")
cat("  exclusive franchise    :", sum(tagged$tag_type == "exclusive_franchise"), "\n")
cat("  transition             :", sum(tagged$tag_type == "transition"), "\n")

# ---------------------------------------------------------------------------
# 4. Tags per offseason — overall distribution across seasons.
# ---------------------------------------------------------------------------
per_year <- tagged |>
  count(year_signed, name = "n") |>
  tidyr::complete(year_signed = seasons, fill = list(n = 0)) |>
  arrange(year_signed)

tags_per_offseason <- distribution_summary(per_year$n)
tags_per_offseason_by_year <- setNames(as.list(per_year$n),
                                       as.character(per_year$year_signed))

# ---------------------------------------------------------------------------
# 5. P(tag | position) across the window.
# ---------------------------------------------------------------------------
by_pos <- tagged |>
  count(tag_pos, name = "n") |>
  mutate(share = n / sum(n)) |>
  arrange(desc(n))

# Ensure every position shows up (even zero counts) so the sim can read a
# complete distribution.
all_positions <- unique(tag_table$pos)
by_pos_full <- tibble::tibble(tag_pos = all_positions) |>
  left_join(by_pos, by = "tag_pos") |>
  mutate(
    n = ifelse(is.na(n), 0L, n),
    share = ifelse(is.na(share), 0, share)
  ) |>
  arrange(desc(n))

tags_by_position <- setNames(
  lapply(seq_len(nrow(by_pos_full)), function(i) {
    list(
      n = as.integer(by_pos_full$n[i]),
      share = by_pos_full$share[i],
      per_offseason = by_pos_full$n[i] / length(seasons)
    )
  }),
  by_pos_full$tag_pos
)

# ---------------------------------------------------------------------------
# 6. Tag-type split (franchise / exclusive / transition).
# ---------------------------------------------------------------------------
type_split <- tagged |>
  count(tag_type, name = "n") |>
  mutate(share = n / sum(n))

tag_type_split <- setNames(
  lapply(seq_len(nrow(type_split)), function(i) {
    list(n = as.integer(type_split$n[i]),
         share = type_split$share[i])
  }),
  type_split$tag_type
)

# ---------------------------------------------------------------------------
# 7. Resolution path — tag-and-sign / tag-and-play / tag-and-trade.
#    tag-and-sign  : another contract by the same player with the same team
#                    signed in the same calendar year, with years >= 2.
#    tag-and-trade : player appears on a different team's roster in that
#                    season (per load_rosters()).
#    tag-and-play  : tagging-team roster same season and no multi-year deal.
# ---------------------------------------------------------------------------
cat("Loading rosters for resolution-path cross-reference\n")
rosters <- tryCatch(
  nflreadr::load_rosters(seasons),
  error = function(e) {
    cat("  rosters load failed:", conditionMessage(e), "\n")
    NULL
  }
)

# Contracts feed uses team nickname ("Bengals"); rosters uses abbr ("CIN").
# Build a nickname -> abbr map so we can compare them. OTC also uses slash-
# joined multi-team strings (e.g. "GB/NYJ") when a player finished on a
# different team than where the contract was signed — for tag classification
# we only care about the tagging team at signing, which is the FIRST token.
teams_meta <- tryCatch(
  nflreadr::load_teams(),
  error = function(e) NULL
)

nick_to_abbr <- if (!is.null(teams_meta)) {
  setNames(teams_meta$team_abbr, teams_meta$team_nick)
} else {
  character()
}

resolve_tag_team_abbr <- function(team_str) {
  if (is.na(team_str)) return(NA_character_)
  first_token <- strsplit(team_str, "/", fixed = TRUE)[[1]][1]
  if (first_token %in% names(nick_to_abbr)) {
    return(unname(nick_to_abbr[first_token]))
  }
  # Already an abbreviation or unknown — return as-is so name match can fail
  # gracefully rather than crashing.
  first_token
}

# Find multi-year extensions signed in same year by same player+team.
multi_year_extensions <- contracts_raw |>
  filter(!is.na(years), years >= 2, !is.na(year_signed)) |>
  transmute(
    ext_player = player,
    ext_team = team,
    ext_year = year_signed,
    ext_years = years
  )

tagged_with_paths <- tagged |>
  left_join(
    multi_year_extensions,
    by = c("player" = "ext_player", "team" = "ext_team",
           "year_signed" = "ext_year")
  ) |>
  mutate(signed_extension_same_year = !is.na(ext_years))

# Cross-reference rosters (by gsis_id where available, else player name).
if (!is.null(rosters)) {
  roster_slim <- rosters |>
    transmute(
      season = as.integer(season),
      roster_team = team,
      gsis_id = gsis_id,
      full_name = full_name
    ) |>
    distinct()

  tagged_with_abbr <- tagged_with_paths |>
    mutate(tag_team_abbr = vapply(team, resolve_tag_team_abbr,
                                   character(1)))

  # Prefer gsis_id match; fall back to name match on same season.
  tagged_with_team <- tagged_with_abbr |>
    left_join(
      roster_slim |> rename(roster_team_by_id = roster_team),
      by = c("gsis_id" = "gsis_id", "year_signed" = "season"),
      relationship = "many-to-many"
    ) |>
    left_join(
      roster_slim |>
        select(season, roster_team_by_name = roster_team, full_name),
      by = c("player" = "full_name", "year_signed" = "season"),
      relationship = "many-to-many"
    ) |>
    mutate(
      roster_team_final = coalesce(roster_team_by_id, roster_team_by_name)
    ) |>
    group_by(player, team, tag_team_abbr, year_signed, tag_type) |>
    summarise(
      signed_extension_same_year = any(signed_extension_same_year),
      on_tagging_team = any(!is.na(roster_team_final) &
                             roster_team_final == tag_team_abbr),
      on_other_team   = any(!is.na(roster_team_final) &
                             roster_team_final != tag_team_abbr),
      .groups = "drop"
    )
} else {
  tagged_with_team <- tagged_with_paths |>
    group_by(player, team, year_signed, tag_type) |>
    summarise(
      signed_extension_same_year = any(signed_extension_same_year),
      on_tagging_team = NA,
      on_other_team = NA,
      .groups = "drop"
    )
}

tagged_resolved <- tagged_with_team |>
  mutate(
    resolution = case_when(
      signed_extension_same_year                 ~ "tag_and_sign",
      !is.na(on_tagging_team) & on_tagging_team  ~ "tag_and_play",
      !is.na(on_other_team) & on_other_team      ~ "tag_and_trade",
      TRUE                                       ~ "unknown"
    )
  )

resolution_counts <- tagged_resolved |>
  count(resolution, name = "n") |>
  mutate(share = n / sum(n))

resolution_path_distribution <- setNames(
  lapply(seq_len(nrow(resolution_counts)), function(i) {
    list(n = as.integer(resolution_counts$n[i]),
         share = resolution_counts$share[i])
  }),
  resolution_counts$resolution
)

# Per-position resolution breakdown for the sim's decision tree.
by_pos_resolution <- tagged_resolved |>
  left_join(
    tagged |> select(player, team, year_signed, tag_pos),
    by = c("player", "team", "year_signed")
  ) |>
  filter(!is.na(tag_pos)) |>
  count(tag_pos, resolution, name = "n") |>
  group_by(tag_pos) |>
  mutate(share = n / sum(n)) |>
  ungroup()

by_pos_resolution_list <- split(by_pos_resolution, by_pos_resolution$tag_pos) |>
  lapply(function(df) {
    setNames(
      lapply(seq_len(nrow(df)), function(i) {
        list(n = as.integer(df$n[i]), share = df$share[i])
      }),
      df$resolution
    )
  })

# ---------------------------------------------------------------------------
# 8. Consecutive-tag escalator — illustrative pointer, not counted here.
#    Detecting "player X tagged in year Y and year Y+1" is cheap but rare
#    (fewer than ~15 occurrences in the 15-yr window). We surface the flag
#    but defer narrative interpretation to the docs.
# ---------------------------------------------------------------------------
tagged_player_years <- tagged |>
  transmute(
    key = paste(player, tag_pos, sep = "::"),
    year = year_signed
  ) |>
  distinct()

consecutive_tags <- tagged_player_years |>
  arrange(key, year) |>
  group_by(key) |>
  mutate(prev_year = lag(year)) |>
  ungroup() |>
  filter(!is.na(prev_year), year == prev_year + 1) |>
  nrow()

# ---------------------------------------------------------------------------
# 9. Assemble + write
# ---------------------------------------------------------------------------
summaries <- list(
  tags_per_offseason = c(
    tags_per_offseason,
    list(by_year = tags_per_offseason_by_year,
         seasons_sampled = length(seasons))
  ),
  tags_by_position = tags_by_position,
  tag_type_split = tag_type_split,
  resolution_path_distribution = list(
    overall = resolution_path_distribution,
    by_position = by_pos_resolution_list
  ),
  consecutive_tag_events = list(
    n = as.integer(consecutive_tags),
    rate_per_offseason = consecutive_tags / length(seasons),
    note = paste0(
      "Count of (player, position) pairs tagged in back-to-back offseasons ",
      "within the window. Matches the NFL's rare 'second tag at 120% prior ",
      "cap hit' scenario; the third tag at 144% or position-bump is even rarer."
    )
  )
)

out_path <- file.path(repo_root(), "data", "bands", "tag-usage.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "OTC contracts feed (nflreadr::load_contracts()) filtered to 1-year deals ",
    "signed in each league year, cross-referenced against the NFL's published ",
    "franchise / transition tag amounts by (year, position). A deal is tagged ",
    "if value is within $0.3M of the published amount; exclusive franchise ",
    "tags are detected at QB when value > 1.05x the non-exclusive amount. ",
    "Resolution paths cross-reference load_rosters(): tag-and-sign = multi-year ",
    "extension with the same team in the same calendar year; tag-and-trade = ",
    "appears on a different team's roster that season; tag-and-play = on the ",
    "tagging team's roster with no multi-year deal. Verified 2026-04-17 that ",
    "load_contracts() does NOT expose is_franchise_tag / is_transition_tag ",
    "columns, so structural detection is the only available route."
  )
)

cat("Wrote", out_path, "\n")

# Quick summary
cat("\n=== Quick Summary ===\n")
cat("Tags per offseason (mean):", round(tags_per_offseason$mean, 1),
    "sd", round(tags_per_offseason$sd, 1), "\n")
cat("Top positions by tag count:\n")
top_pos <- head(by_pos_full, 6)
for (i in seq_len(nrow(top_pos))) {
  cat(sprintf("  %-3s %3d (%.1f%%, %.2f/yr)\n",
              top_pos$tag_pos[i], top_pos$n[i], 100 * top_pos$share[i],
              top_pos$n[i] / length(seasons)))
}
cat("\nTag type split:\n")
for (i in seq_len(nrow(type_split))) {
  cat(sprintf("  %-25s %3d (%.1f%%)\n",
              type_split$tag_type[i], type_split$n[i],
              100 * type_split$share[i]))
}
cat("\nResolution path split:\n")
for (i in seq_len(nrow(resolution_counts))) {
  cat(sprintf("  %-15s %3d (%.1f%%)\n",
              resolution_counts$resolution[i], resolution_counts$n[i],
              100 * resolution_counts$share[i]))
}
cat("\nConsecutive-tag events in window:", consecutive_tags, "\n")
