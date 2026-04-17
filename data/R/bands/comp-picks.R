#!/usr/bin/env Rscript
# comp-picks.R — compensatory draft pick allocation bands.
#
# Compensatory picks (rounds 3–7, capped at 32 per draft league-wide since
# 2020) are awarded by the NFL to teams that suffer a net loss of qualifying
# UFAs the prior offseason. The canonical formula combines APY, snap %, and
# postseason honors but is not published; outcomes are observable through
# pick numbering and contracts data.
#
# Bands produced:
#   - comp_picks_per_team_per_draft: mean/sd/distribution (0..4+) across teams
#   - round_distribution: share of comp picks landing in each of rounds 3–7
#   - p_comp_given_net_loss_bucket: empirical P(team gets >=1 comp pick |
#       net qualifying UFA-loss bucket) from prior offseason
#   - special_comp_pick_frequency: picks above the 32-per-year league cap
#       (the "minority HC/GM hire" supplemental picks active since 2020)
#
# Data sources:
#   nflreadr::load_draft_picks()    — 1 row per drafted pick (rounds 1–7).
#     NOTE: the feed has NO explicit comp flag. We infer comp status from
#     pick ordinal position within the round: picks at ordinal position > 32
#     within rounds 3–7 are comp picks. Forfeited picks (rare) can undercount
#     slightly but don't inflate comp totals. Observed comp counts (31–38/yr
#     2020–2024) match league-reported totals.
#   nflreadr::load_contracts()      — OverTheCap contracts. Used to bucket
#     each team's prior-offseason "net qualifying UFA losses". The feed has
#     no date_signed and no UFA tag, so we approximate:
#       - A veteran UFA signing is a contract where year_signed > draft_year
#         AND the signing team differs from the player's most recent prior
#         contract team. "Qualifying" = APY >= $3M/yr, a coarse proxy for
#         the real formula's APY floor (actual floor is tier-indexed and
#         changes yearly; $3M is ~the minimum observed comp-qualifying APY).
#       - "Prior team" is the team on the player's immediately prior contract
#         (ordered by year_signed). Contracts where team spans multiple
#         franchises ("ARI/CIN") use the first token as the signing team.
#     Net loss = qualifying UFAs OUT − qualifying UFAs IN for a team in a
#     given offseason. Cancellation rules (equal-tier losses cancelling in
#     the formula) are NOT replicated — we bucket by net count only.
#
# Field-schema notes:
#   load_draft_picks() columns: season, round, pick, team, gsis_id,
#     pfr_player_id, position, category, side, age, to, allpro, probowls,
#     seasons_started, w_av, car_av, dr_av, games, ... (NO comp_pick field).
#   load_contracts() columns: player, position, team, year_signed, years,
#     value, apy, guaranteed, otc_id, gsis_id, draft_year, draft_round,
#     draft_team, ... (team is a NICKNAME like "Packers" or a SLASH string
#     like "GB/NYJ" for multi-team deals; draft_team is also a nickname).
#
# Usage:
#   Rscript data/R/bands/comp-picks.R [--seasons 2020:2024]
#
# The default window is 2020–2024: the 32-per-year league cap and the
# special minority-hire comp pick both start in 2020, and compensatory
# picks are awarded for the *prior* offseason, so the contracts window is
# shifted back one year internally.

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
seasons <- if (any(args == "--seasons")) parse_seasons(args) else 2020:2024

first_draft <- min(seasons)
last_draft  <- max(seasons)

cat("Draft seasons (comp picks awarded):", first_draft, "-", last_draft, "\n")

# ---------------------------------------------------------------------------
# 1. Load draft picks and flag comp picks by ordinal position within round.
# ---------------------------------------------------------------------------
cat("Loading draft picks...\n")
picks <- nflreadr::load_draft_picks(seq(first_draft, last_draft)) |>
  filter(!is.na(round), !is.na(pick)) |>
  arrange(season, round, pick) |>
  group_by(season, round) |>
  mutate(
    pos_in_round = row_number(),
    is_comp = round >= 3 & pos_in_round > 32
  ) |>
  ungroup()

cat("Picks loaded:", nrow(picks), "  comp picks:", sum(picks$is_comp), "\n")

# ---------------------------------------------------------------------------
# 2. Comp picks per team per draft — distribution over {0,1,2,3,4+}.
# ---------------------------------------------------------------------------
teams_all <- nflreadr::load_teams() |>
  filter(team_abbr %in% unique(picks$team)) |>
  pull(team_abbr)

comp_by_team_season <- picks |>
  group_by(season, team) |>
  summarise(comp_count = sum(is_comp), .groups = "drop")

# Ensure every (season, team) combo is represented (teams with 0 comps).
all_team_seasons <- expand.grid(
  season = seq(first_draft, last_draft),
  team = unique(picks$team),
  stringsAsFactors = FALSE
)
comp_by_team_season <- all_team_seasons |>
  left_join(comp_by_team_season, by = c("season", "team")) |>
  mutate(comp_count = ifelse(is.na(comp_count), 0L, comp_count))

per_team_summary <- distribution_summary(comp_by_team_season$comp_count)

# Histogram bucket 0,1,2,3,4+.
bucket <- function(n) {
  dplyr::case_when(
    n == 0 ~ "0",
    n == 1 ~ "1",
    n == 2 ~ "2",
    n == 3 ~ "3",
    TRUE   ~ "4+"
  )
}
hist_tbl <- comp_by_team_season |>
  mutate(b = bucket(comp_count)) |>
  count(b) |>
  mutate(proportion = n / sum(n))

hist_list <- setNames(
  lapply(seq_len(nrow(hist_tbl)), function(i) {
    list(n = hist_tbl$n[i], proportion = hist_tbl$proportion[i])
  }),
  hist_tbl$b
)

# ---------------------------------------------------------------------------
# 3. Round distribution of comp picks.
# ---------------------------------------------------------------------------
round_tbl <- picks |>
  filter(is_comp) |>
  count(round) |>
  mutate(proportion = n / sum(n))

round_list <- setNames(
  lapply(seq_len(nrow(round_tbl)), function(i) {
    list(n = round_tbl$n[i], proportion = round_tbl$proportion[i])
  }),
  as.character(round_tbl$round)
)

# Round distribution per draft year (for checking year-over-year drift).
round_by_season <- picks |>
  filter(is_comp) |>
  count(season, round) |>
  pivot_wider(names_from = round, values_from = n, values_fill = 0) |>
  arrange(season)

round_by_season_list <- setNames(
  lapply(seq_len(nrow(round_by_season)), function(i) {
    row <- as.list(round_by_season[i, ])
    row$season <- NULL
    list(
      total = sum(unlist(row)),
      by_round = row
    )
  }),
  as.character(round_by_season$season)
)

# ---------------------------------------------------------------------------
# 4. P(comp pick | net UFA-loss bucket) from prior offseason contracts.
# ---------------------------------------------------------------------------
cat("Loading contracts for prior-offseason UFA bucketing...\n")
contracts_raw <- nflreadr::load_contracts()

# Normalize team nickname → team abbreviation.
team_map <- nflreadr::load_teams() |>
  select(team_abbr, team_nick)
nick_to_abbr <- setNames(team_map$team_abbr, team_map$team_nick)

normalize_team <- function(x) {
  # For slash strings take the first token (the signing team).
  first_tok <- sub("/.*$", "", x)
  out <- nick_to_abbr[first_tok]
  # If the token was already a 2–4 char abbr, keep it.
  out <- ifelse(is.na(out) & nchar(first_tok) <= 4, first_tok, out)
  unname(out)
}

contracts <- contracts_raw |>
  filter(
    !is.na(year_signed), !is.na(apy), !is.na(years),
    years >= 1, apy > 0
  ) |>
  mutate(
    signing_team = normalize_team(team),
    prior_team_draft = normalize_team(draft_team)
  )

# For each (player, year_signed) determine the prior-contract team. Sort the
# player's contracts by year_signed and take the previous row's signing_team.
# When no prior contract exists, fall back to the drafting team.
player_history <- contracts |>
  arrange(otc_id, year_signed) |>
  group_by(otc_id) |>
  mutate(
    prev_team = lag(signing_team),
    prev_year = lag(year_signed)
  ) |>
  ungroup() |>
  mutate(
    from_team = ifelse(is.na(prev_team), prior_team_draft, prev_team),
    is_team_change = !is.na(from_team) & !is.na(signing_team) & from_team != signing_team,
    is_vet_signing = (!is.na(draft_year) & year_signed > draft_year) |
                      !is.na(prev_team),
    is_qualifying = apy >= 3.0  # USD millions; coarse APY floor proxy
  )

# Comp picks in draft year Y are awarded for UFA activity in year (Y-1).
# So we bucket by (year_signed = draft_season - 1).
ufa_moves <- player_history |>
  filter(is_team_change, is_vet_signing, is_qualifying) |>
  select(year_signed, from_team, signing_team, apy)

# Losses OUT per (year_signed, team).
losses_out <- ufa_moves |>
  count(year_signed, from_team, name = "losses") |>
  rename(team = from_team)

# Gains IN per (year_signed, team).
gains_in <- ufa_moves |>
  count(year_signed, signing_team, name = "gains") |>
  rename(team = signing_team)

net_by_team_year <- full_join(losses_out, gains_in,
                              by = c("year_signed", "team")) |>
  mutate(
    losses = ifelse(is.na(losses), 0L, losses),
    gains = ifelse(is.na(gains), 0L, gains),
    net_loss = losses - gains
  )

# Join comp-pick counts (draft_season) with prior-year UFA activity.
comp_vs_ufa <- comp_by_team_season |>
  mutate(prior_year = season - 1L) |>
  left_join(
    net_by_team_year |>
      rename(prior_year = year_signed, prior_losses = losses,
             prior_gains = gains, prior_net_loss = net_loss),
    by = c("team", "prior_year")
  ) |>
  mutate(
    prior_losses = ifelse(is.na(prior_losses), 0L, prior_losses),
    prior_gains = ifelse(is.na(prior_gains), 0L, prior_gains),
    prior_net_loss = ifelse(is.na(prior_net_loss), 0L, prior_net_loss),
    has_comp = comp_count >= 1
  )

net_bucket <- function(n) {
  dplyr::case_when(
    n <= -1 ~ "net_gain",
    n == 0  ~ "even",
    n == 1  ~ "net_loss_1",
    n == 2  ~ "net_loss_2",
    n == 3  ~ "net_loss_3",
    TRUE    ~ "net_loss_4_plus"
  )
}

p_comp_by_bucket_tbl <- comp_vs_ufa |>
  mutate(bucket = net_bucket(prior_net_loss)) |>
  group_by(bucket) |>
  summarise(
    n_team_seasons = n(),
    team_seasons_with_comp = sum(has_comp),
    p_comp = mean(has_comp),
    mean_comp_count = mean(comp_count),
    .groups = "drop"
  )

bucket_order <- c("net_gain", "even", "net_loss_1", "net_loss_2",
                  "net_loss_3", "net_loss_4_plus")
p_comp_by_bucket_tbl <- p_comp_by_bucket_tbl |>
  mutate(bucket = factor(bucket, levels = bucket_order)) |>
  arrange(bucket) |>
  mutate(bucket = as.character(bucket))

p_comp_by_bucket_list <- setNames(
  lapply(seq_len(nrow(p_comp_by_bucket_tbl)), function(i) {
    row <- p_comp_by_bucket_tbl[i, ]
    list(
      n_team_seasons = row$n_team_seasons,
      team_seasons_with_comp = row$team_seasons_with_comp,
      p_comp = row$p_comp,
      mean_comp_count = row$mean_comp_count
    )
  }),
  p_comp_by_bucket_tbl$bucket
)

# ---------------------------------------------------------------------------
# 5. Special comp pick frequency (picks above the 32-per-year league cap).
#    Since 2020 the league awards additional "resolution JC-2A" picks to
#    teams that develop and promote minority HC/GM candidates, in rounds 3–4.
#    These sit OUTSIDE the 32-pick cap. We approximate their count as
#    (comp_total_this_year - 32); the 2023 supplemental 3rd-for-international
#    pathway picks also show up here.
# ---------------------------------------------------------------------------
comp_per_year <- picks |>
  group_by(season) |>
  summarise(
    total_comp = sum(is_comp),
    .groups = "drop"
  ) |>
  mutate(
    special_comp = pmax(total_comp - 32L, 0L)
  )

special_list <- setNames(
  lapply(seq_len(nrow(comp_per_year)), function(i) {
    row <- comp_per_year[i, ]
    list(
      total_comp = row$total_comp,
      inferred_special_comp = row$special_comp
    )
  }),
  as.character(comp_per_year$season)
)

special_summary <- list(
  mean_total_comp_per_year = mean(comp_per_year$total_comp),
  mean_special_comp_per_year = mean(comp_per_year$special_comp),
  years_with_special_comp = sum(comp_per_year$special_comp > 0),
  years_sampled = nrow(comp_per_year)
)

# ---------------------------------------------------------------------------
# 6. Assemble and write.
# ---------------------------------------------------------------------------
summaries <- list(
  comp_picks_per_team_per_draft = list(
    summary = per_team_summary,
    distribution = hist_list,
    n_team_seasons = nrow(comp_by_team_season)
  ),
  round_distribution = list(
    overall = round_list,
    by_season = round_by_season_list
  ),
  p_comp_given_net_loss_bucket = p_comp_by_bucket_list,
  special_comp_pick_frequency = list(
    overall = special_summary,
    by_season = special_list
  )
)

out_path <- file.path(repo_root(), "data", "bands", "comp-picks.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "Compensatory draft pick bands from nflreadr::load_draft_picks() joined ",
    "to nflreadr::load_contracts() for prior-offseason UFA activity. ",
    "load_draft_picks() has NO comp flag; picks are flagged comp when their ",
    "ordinal position within a round exceeds 32 (for rounds 3-7). Observed ",
    "comp totals (31-38/yr for 2020-2024) match league-reported counts. ",
    "The 32-per-year league cap started in 2020; special minority-hire ",
    "comp picks sit above the cap and are inferred as total_comp minus 32. ",
    "UFA net-loss bucketing uses contracts with year_signed > draft_year ",
    "AND signing team != prior team (lag over load_contracts() rows), with ",
    "a coarse qualifying floor of APY >= $3M/yr. The NFL's actual formula ",
    "is APY + snap% + postseason-honors tiered and cancels losses against ",
    "gains within the same tier; the bucketing here is by net count only ",
    "and is an approximation for the sim. Team strings are normalized via ",
    "load_teams() nickname->abbr; slash strings (e.g. 'ARI/CIN') take the ",
    "first token as the signing team."
  )
)

cat("Wrote", out_path, "\n")

# Quick summary
cat("\n=== Comp picks per team per draft ===\n")
cat("mean =", round(per_team_summary$mean, 2),
    " sd =", round(per_team_summary$sd, 2),
    " max =", per_team_summary$max, "\n")
cat("Distribution:\n")
for (b in names(hist_list)) {
  cat(sprintf("  %-4s %4d  %.3f\n", b, hist_list[[b]]$n,
              hist_list[[b]]$proportion))
}
cat("\nRound distribution (overall):\n")
for (r in names(round_list)) {
  cat(sprintf("  R%s  n=%d  p=%.3f\n", r, round_list[[r]]$n,
              round_list[[r]]$proportion))
}
cat("\nP(>=1 comp pick | prior-year net UFA-loss bucket):\n")
for (b in names(p_comp_by_bucket_list)) {
  m <- p_comp_by_bucket_list[[b]]
  cat(sprintf("  %-16s n=%3d  p_comp=%.3f  mean_count=%.2f\n",
              b, m$n_team_seasons, m$p_comp, m$mean_comp_count))
}
cat("\nTotals per year (comp + inferred special):\n")
for (y in names(special_list)) {
  cat(sprintf("  %s: total=%d  special=%d\n", y,
              special_list[[y]]$total_comp,
              special_list[[y]]$inferred_special_comp))
}
