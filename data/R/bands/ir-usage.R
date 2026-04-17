#!/usr/bin/env Rscript
# ir-usage.R — IR placement + return-to-active rate bands.
#
# Answers the in-season roster-slot pressure question that injury bands
# alone don't capture: how often teams actually move a player to IR /
# IR-R / PUP / NFI, and — for the designated-to-return group — how often
# that player comes back during the same season, and after how many
# weeks.
#
# The sim uses these to drive waiver-claim and practice-squad-elevation
# activity (a team is far more likely to churn its 53 in a week where
# somebody lands on IR than in a week where somebody is merely Q/D on
# the injury report).
#
# Source: nflreadr::load_rosters_weekly(). The top-level `status` field
# collapses everything injury-related into "RES" pre-2019; the finer
# `status_description_abbr` code (R01 = Reserve/Injured, R23 =
# Designated-for-return, R04/R06 = PUP variants, R27 = NFI, R40 =
# Reserve/NFI) only populates reliably from 2020 onward. To get a
# meaningful IR / IR-R / PUP / NFI split we restrict to 2020-2024 and
# flag the earlier-seasons caveat in the notes.
#
# Usage:
#   Rscript data/R/bands/ir-usage.R [--seasons 2020:2024]

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
# Default to the window where status_description_abbr is populated.
seasons <- if (any(args == "--seasons")) parse_seasons(args) else 2020:2024

cat("Loading weekly rosters for seasons:",
    paste(range(seasons), collapse = "-"), "\n")
rosters <- nflreadr::load_rosters_weekly(seasons) |>
  filter(game_type == "REG")

# ---------------------------------------------------------------------------
# 1. Classify each weekly row into an IR bucket.
#
#    IR          — Reserve/Injured, season-ending (R01).
#    IR_R        — Reserve/Injured, Designated for Return (R23, R30).
#    PUP         — Physically-Unable-to-Perform reserve list (R04, R06).
#    NFI         — Non-Football Injury/Illness (R27, R40).
#    ACT         — Active (A01) or inactive-for-game (I01/I02) — both
#                  count as "on the active 53", which is what matters
#                  for IR-return eligibility.
#    OTHER       — practice squad (P*), cut (W*), retired (R02), etc.
# ---------------------------------------------------------------------------
rosters <- rosters |>
  mutate(
    ir_bucket = case_when(
      status_description_abbr == "R01"                ~ "IR",
      status_description_abbr %in% c("R23", "R30")    ~ "IR_R",
      status_description_abbr %in% c("R04", "R06")    ~ "PUP",
      status_description_abbr %in% c("R27", "R40")    ~ "NFI",
      status_description_abbr %in% c("A01", "I01", "I02") ~ "ACT",
      TRUE                                            ~ "OTHER"
    )
  )

cat("Rows by ir_bucket:\n")
print(rosters |> count(ir_bucket) |> arrange(desc(n)))

# ---------------------------------------------------------------------------
# 2. Position canonicalization — same vocabulary as injuries.json / career.
# ---------------------------------------------------------------------------
canonical_position <- function(pos) {
  case_when(
    pos == "QB"                                                 ~ "QB",
    pos %in% c("RB", "FB", "HB")                                ~ "RB",
    pos == "WR"                                                 ~ "WR",
    pos == "TE"                                                 ~ "TE",
    pos %in% c("T", "OT", "LT", "RT", "OL", "G", "OG", "LG",
               "RG", "C")                                       ~ "OL",
    pos == "DE"                                                 ~ "EDGE",
    pos %in% c("DT", "NT", "DL")                                ~ "iDL",
    pos %in% c("OLB", "LB", "ILB", "MLB")                       ~ "LB",
    pos %in% c("CB", "DB")                                      ~ "CB_DB",
    pos %in% c("S", "FS", "SS", "SAF")                          ~ "S",
    pos == "K"                                                  ~ "K",
    pos == "P"                                                  ~ "P",
    pos == "LS"                                                 ~ "LS",
    TRUE                                                        ~ "other"
  )
}
rosters <- rosters |> mutate(pos_group = canonical_position(position))

# ---------------------------------------------------------------------------
# 3. Detect placement + return events via week-over-week status diffs.
#
#    For each (player, season, team) we order by week and look for
#    bucket transitions:
#      prev ∈ {ACT, OTHER, NA}  ->  curr ∈ {IR, IR_R, PUP, NFI}
#        = PLACEMENT onto that list.
#      prev == IR_R             ->  curr == ACT
#        = RETURN-to-active from the designated-for-return list.
#
#    We intentionally ignore intra-IR transitions (e.g. IR -> IR_R
#    happens rarely but wouldn't be a new placement) and ignore cuts
#    (OTHER -> OTHER).
# ---------------------------------------------------------------------------
player_season <- rosters |>
  filter(!is.na(gsis_id)) |>
  arrange(gsis_id, season, week) |>
  group_by(gsis_id, season) |>
  mutate(
    prev_bucket = lag(ir_bucket),
    prev_week   = lag(week)
  ) |>
  ungroup()

placements <- player_season |>
  filter(
    ir_bucket %in% c("IR", "IR_R", "PUP", "NFI"),
    (is.na(prev_bucket) | prev_bucket %in% c("ACT", "OTHER")) |
      (prev_bucket %in% c("IR", "IR_R", "PUP", "NFI") &
         prev_bucket != ir_bucket)
  ) |>
  # Drop the "already on the list in week 1" rows where prev_bucket is
  # NA — those aren't in-season placements, they're pre-season carries.
  # But we *do* keep them if the player was on ACT in an earlier week,
  # which the arrange/lag already handles. Here we explicitly drop the
  # pre-season carries (prev_bucket == NA & week == min(week)).
  filter(!(is.na(prev_bucket) & week == 1))

cat("\nTotal in-season placement events:", nrow(placements), "\n")
print(placements |> count(ir_bucket))

# ---------------------------------------------------------------------------
# 4. Placements per team per season — mean/sd/p10-p90, overall and by
#    bucket.
# ---------------------------------------------------------------------------
teams_seasons <- rosters |> distinct(season, team)

per_team_season_total <- placements |>
  count(season, team, name = "placements") |>
  right_join(teams_seasons, by = c("season", "team")) |>
  mutate(placements = coalesce(placements, 0L))

placements_per_team_season <-
  distribution_summary(per_team_season_total$placements)

per_team_season_by_bucket <- expand_grid(
    teams_seasons,
    ir_bucket = c("IR", "IR_R", "PUP", "NFI")
  ) |>
  left_join(
    placements |> count(season, team, ir_bucket, name = "placements"),
    by = c("season", "team", "ir_bucket")
  ) |>
  mutate(placements = coalesce(placements, 0L))

placements_by_bucket <- per_team_season_by_bucket |>
  group_by(ir_bucket) |>
  group_modify(~ as_tibble(distribution_summary(.x$placements))) |>
  ungroup()

placements_by_bucket_list <- setNames(
  lapply(seq_len(nrow(placements_by_bucket)), function(i) {
    row <- placements_by_bucket[i, ]
    as.list(row)[-1]  # strip ir_bucket column
  }),
  placements_by_bucket$ir_bucket
)

# ---------------------------------------------------------------------------
# 5. P(return-to-active | IR placement), within the same season.
#
#    Caveat: the nflverse weekly snapshot rarely surfaces the formal
#    "designated-for-return" (R23) designation — most activated players
#    flip straight from R01 to A01 in the week they're restored to the
#    53. So we treat *every* IR (R01) placement as a potential return
#    candidate and measure the share that actually flips back to ACT
#    within the same season. This matches the post-2020 rule era where
#    up to 8 players/season can be designated-for-return from IR.
#
#    Weeks-on-IR = first ACT week - placement week (weeks of absence
#    before return, integer; 1 means activated the very next game).
# ---------------------------------------------------------------------------
ir_placements <- placements |>
  filter(ir_bucket == "IR") |>
  transmute(gsis_id, season, team, placement_week = week,
            position = pos_group)

act_weeks <- rosters |>
  filter(ir_bucket == "ACT", !is.na(gsis_id)) |>
  select(gsis_id, season, act_week = week)

# Find first ACT week strictly after placement_week per stint.
returns <- ir_placements |>
  left_join(act_weeks, by = c("gsis_id", "season"),
            relationship = "many-to-many") |>
  mutate(act_week = if_else(!is.na(act_week) & act_week > placement_week,
                            act_week, NA_real_)) |>
  group_by(gsis_id, season, placement_week, team, position) |>
  summarise(
    first_return_week = suppressWarnings(min(act_week, na.rm = TRUE)),
    .groups = "drop"
  )

ir_with_return <- ir_placements |>
  left_join(returns,
            by = c("gsis_id", "season", "placement_week",
                   "team", "position")) |>
  mutate(
    returned = is.finite(first_return_week),
    weeks_on_ir = if_else(returned,
                          first_return_week - placement_week,
                          NA_real_)
  )

p_return <- list(
  placements = nrow(ir_with_return),
  returned   = sum(ir_with_return$returned),
  p_return   = mean(ir_with_return$returned)
)

weeks_on_ir <- distribution_summary(
  ir_with_return$weeks_on_ir[ir_with_return$returned]
)

# ---------------------------------------------------------------------------
# 6. Position distribution of placements (proportion of all IR-family
#    placements).
# ---------------------------------------------------------------------------
pos_counts <- placements |>
  count(pos_group, name = "count") |>
  mutate(proportion = count / sum(count)) |>
  arrange(desc(proportion))

pos_list <- setNames(
  lapply(seq_len(nrow(pos_counts)), function(i) {
    row <- pos_counts[i, ]
    list(count = row$count, proportion = row$proportion)
  }),
  pos_counts$pos_group
)

# Per-bucket position distribution (helps the sim pick realistic targets
# when it decides "a PUP candidate" vs "a season-ending IR").
pos_by_bucket <- placements |>
  count(ir_bucket, pos_group, name = "count") |>
  group_by(ir_bucket) |>
  mutate(proportion = count / sum(count)) |>
  ungroup()

pos_by_bucket_list <- lapply(
  split(pos_by_bucket, pos_by_bucket$ir_bucket),
  function(df) {
    df <- df |> arrange(desc(proportion))
    setNames(
      lapply(seq_len(nrow(df)), function(i) {
        list(count = df$count[i], proportion = df$proportion[i])
      }),
      df$pos_group
    )
  }
)

# ---------------------------------------------------------------------------
# 7. Assemble + write output.
# ---------------------------------------------------------------------------
summaries <- list(
  placements_per_team_season        = placements_per_team_season,
  placements_per_team_season_by_bucket = placements_by_bucket_list,
  ir_return_rate                    = p_return,
  weeks_on_ir_before_return         = weeks_on_ir,
  position_distribution_all_placements = pos_list,
  position_distribution_by_bucket   = pos_by_bucket_list
)

out_path <- file.path(repo_root(), "data", "bands", "ir-usage.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "IR usage bands derived from nflreadr::load_rosters_weekly(). ",
    "Regular season only. IR buckets are keyed on the ",
    "`status_description_abbr` code — R01=IR (season-ending), ",
    "R23/R30=IR-R (designated to return), R04/R06=PUP, ",
    "R27/R40=NFI. Placement events are week-over-week transitions ",
    "from an active or practice/other bucket into an IR-family ",
    "bucket; pre-season carries (already on the list in week 1 ",
    "with no prior ACT row) are excluded. Return events are ",
    "IR -> first subsequent ACT week in the same season (the ",
    "weekly snapshot rarely surfaces the transient R23 ",
    "designated-for-return tag, so we treat every R01 placement ",
    "as a potential return candidate). ",
    "The fine-grained abbr only populates reliably from 2020 on ",
    "(the pre-2019 `status` field collapses all reserve types to ",
    "\"RES\"), so this band is restricted to 2020-2024. Position ",
    "groups: QB, RB (incl FB/HB), WR, TE, OL, EDGE (DE), iDL ",
    "(DT/NT/DL), LB, CB_DB, S, K, P, LS."
  )
)

cat("Wrote", out_path, "\n")

# ---------------------------------------------------------------------------
# 8. Console summary for verification.
# ---------------------------------------------------------------------------
cat("\n=== Quick Summary ===\n")
cat("IR-family placements per team-season: mean",
    round(placements_per_team_season$mean, 1),
    "sd", round(placements_per_team_season$sd, 1),
    "p10-p90",
    round(placements_per_team_season$p10, 0), "-",
    round(placements_per_team_season$p90, 0), "\n")
cat("\nPer-bucket mean placements per team-season:\n")
for (b in names(placements_by_bucket_list)) {
  cat("  ", b, ":", round(placements_by_bucket_list[[b]]$mean, 2), "\n")
}
cat("\nP(return-to-active | IR):",
    round(p_return$p_return * 100, 1), "%  (",
    p_return$returned, "/", p_return$placements, ")\n", sep = "")
cat("Weeks on IR before return: mean",
    round(weeks_on_ir$mean %||% NA, 1),
    "p50", round(weeks_on_ir$p50 %||% NA, 1), "\n")
cat("\nTop placement positions:\n")
for (p in head(names(pos_list), 8)) {
  cat("  ", p, ":", round(pos_list[[p]]$proportion * 100, 1), "%\n")
}
