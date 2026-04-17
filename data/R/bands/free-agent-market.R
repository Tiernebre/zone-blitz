#!/usr/bin/env Rscript
# free-agent-market.R — UFA market volume + AAV bands by position and tier.
#
# Sources nflreadr::load_contracts() (the OverTheCap feed) and filters to
# veteran free-agent signings: contracts where the signing team is NOT the
# drafting team (heuristic proxy for "external UFA" vs. re-sign/extension).
# Re-signings (own_team) are kept in a parallel branch so the sim can
# reproduce the observed own-team retention rate.
#
# Bands produced:
#   - ufas_signed_per_offseason (by position group + overall)
#   - aav_distribution_by_position_tier (top-10 / top-25 / top-50 / rest)
#   - resigning_rate (own-team retention vs. external signing split)
#   - contract_length_distribution (years signed, mean + percentiles)
#   - guarantee_share_distribution (guaranteed / value)
#
# Signing-timing waves (legal-tampering / first-2-weeks / remainder) are NOT
# computed here because the OTC feed exposes year_signed only, not date_signed.
# The sim should pull wave priors from data/docs/free-agent-market.md until a
# dated feed is sourced.
#
# Usage:
#   Rscript data/R/bands/free-agent-market.R [--seasons 2020:2024]

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

cat("Loading contracts (full history) for seasons:",
    paste(range(seasons), collapse = "-"), "\n")
contracts_raw <- nflreadr::load_contracts()

# ---------------------------------------------------------------------------
# 1. Filter to the target signing-year window and map positions into the
#    position groups the rest of the sim uses.
# ---------------------------------------------------------------------------
contracts <- contracts_raw |>
  filter(
    !is.na(year_signed),
    year_signed >= min(seasons),
    year_signed <= max(seasons),
    !is.na(value),
    !is.na(apy),
    years >= 1
  ) |>
  mutate(
    position_group = case_when(
      position == "QB"                       ~ "QB",
      position %in% c("RB", "FB")            ~ "RB",
      position == "WR"                       ~ "WR",
      position == "TE"                       ~ "TE",
      position %in% c("LT", "RT")            ~ "OT",
      position %in% c("LG", "RG", "C")       ~ "IOL",
      position %in% c("ED")                  ~ "EDGE",
      position == "IDL"                      ~ "IDL",
      position == "LB"                       ~ "LB",
      position == "CB"                       ~ "CB",
      position == "S"                        ~ "S",
      position %in% c("K", "P", "LS")        ~ "ST",
      TRUE                                   ~ "other"
    ),
    is_resign = !is.na(draft_team) & team == draft_team,
    is_external = !is.na(draft_team) & team != draft_team
  )

cat("Contract rows in window:", nrow(contracts), "\n")
cat("  re-signs (own team):   ", sum(contracts$is_resign), "\n")
cat("  external signings:     ", sum(contracts$is_external), "\n")

# ---------------------------------------------------------------------------
# 2. UFA external-signing volume per offseason (by position group + overall).
#    Here "UFA" means "contract where signing team != drafting team", which
#    is a reasonable proxy on this feed since it excludes rookie deals
#    (draft_team == team) and extensions (same team).
# ---------------------------------------------------------------------------
external <- contracts |> filter(is_external)

vol_by_year_pos <- external |>
  count(year_signed, position_group, name = "n")

vol_per_offseason_by_pos <- vol_by_year_pos |>
  group_by(position_group) |>
  summarise(
    seasons = n(),
    mean = mean(n),
    sd = sd(n),
    min = min(n),
    max = max(n),
    total = sum(n),
    .groups = "drop"
  ) |>
  arrange(desc(mean))

vol_by_pos_list <- setNames(
  lapply(seq_len(nrow(vol_per_offseason_by_pos)), function(i) {
    row <- vol_per_offseason_by_pos[i, ]
    list(
      seasons_sampled = row$seasons,
      mean_per_offseason = row$mean,
      sd = row$sd,
      min = row$min,
      max = row$max,
      total_in_window = row$total
    )
  }),
  vol_per_offseason_by_pos$position_group
)

vol_per_offseason_overall <- external |>
  count(year_signed, name = "n") |>
  pull(n) |>
  distribution_summary()

# ---------------------------------------------------------------------------
# 3. AAV tier distribution per position.
#    Tiers are defined by rank on APY within the position group across the
#    whole window (so rookie scale + veteran-minimum noise is absorbed):
#       top_10  = top 10 APYs at that position
#       top_25  = ranks 11–25
#       top_50  = ranks 26–50
#       rest    = everyone else
#    For each tier we report mean/median APY and the APY floor (min) so the
#    sim's contract generator can sample per tier.
# ---------------------------------------------------------------------------
tier_bucket <- function(rank) {
  case_when(
    rank <= 10 ~ "top_10",
    rank <= 25 ~ "top_25",
    rank <= 50 ~ "top_50",
    TRUE       ~ "rest"
  )
}

# Rank over *all* contracts (including re-signs) to anchor the market; this
# matches how Spotrac / OTC leaderboards are presented.
position_tiers <- contracts |>
  group_by(position_group) |>
  mutate(apy_rank = rank(-apy, ties.method = "first")) |>
  ungroup() |>
  mutate(tier = tier_bucket(apy_rank))

aav_by_pos_tier <- position_tiers |>
  group_by(position_group, tier) |>
  summarise(
    n = n(),
    mean_apy = mean(apy),
    median_apy = median(apy),
    floor_apy = min(apy),
    ceiling_apy = max(apy),
    mean_value = mean(value),
    mean_years = mean(years),
    mean_guaranteed = mean(guaranteed, na.rm = TRUE),
    .groups = "drop"
  )

# Nest: position_group -> tier -> metrics
aav_nested <- split(aav_by_pos_tier, aav_by_pos_tier$position_group) |>
  lapply(function(df) {
    setNames(
      lapply(seq_len(nrow(df)), function(i) {
        list(
          n = df$n[i],
          mean_apy_millions = df$mean_apy[i],
          median_apy_millions = df$median_apy[i],
          floor_apy_millions = df$floor_apy[i],
          ceiling_apy_millions = df$ceiling_apy[i],
          mean_total_value_millions = df$mean_value[i],
          mean_years = df$mean_years[i],
          mean_guaranteed_millions = df$mean_guaranteed[i]
        )
      }),
      df$tier
    )
  })

# ---------------------------------------------------------------------------
# 4. Re-signing rate: share of veteran (non-rookie) contracts that go back
#    to the drafting team vs. move externally. We exclude rookie deals by
#    dropping years_signed == draft_year (a new drafted rookie's first deal).
# ---------------------------------------------------------------------------
vet_contracts <- contracts |>
  filter(
    !is.na(draft_year),
    year_signed > draft_year  # drop first (rookie) contracts
  )

resigning_split <- vet_contracts |>
  mutate(kind = ifelse(is_resign, "resign_own_team", "external_signing")) |>
  count(kind, name = "n") |>
  mutate(proportion = n / sum(n))

resigning_split_list <- setNames(
  lapply(seq_len(nrow(resigning_split)), function(i) {
    list(n = resigning_split$n[i], proportion = resigning_split$proportion[i])
  }),
  resigning_split$kind
)

# Re-signing rate per position
resigning_by_pos <- vet_contracts |>
  group_by(position_group) |>
  summarise(
    vet_contracts = n(),
    resigned_own = sum(is_resign),
    external = sum(is_external),
    resign_rate = resigned_own / n(),
    .groups = "drop"
  ) |>
  arrange(desc(resign_rate))

resigning_by_pos_list <- setNames(
  lapply(seq_len(nrow(resigning_by_pos)), function(i) {
    row <- resigning_by_pos[i, ]
    list(
      vet_contracts = row$vet_contracts,
      resigned_own = row$resigned_own,
      external = row$external,
      resign_rate = row$resign_rate
    )
  }),
  resigning_by_pos$position_group
)

# ---------------------------------------------------------------------------
# 5. Contract length + guarantee share (external signings only)
# ---------------------------------------------------------------------------
length_by_pos <- external |>
  group_by(position_group) |>
  summarise(
    n = n(),
    mean_years = mean(years),
    median_years = median(years),
    p10_years = stats::quantile(years, 0.1, names = FALSE),
    p90_years = stats::quantile(years, 0.9, names = FALSE),
    .groups = "drop"
  )

length_by_pos_list <- setNames(
  lapply(seq_len(nrow(length_by_pos)), function(i) {
    row <- length_by_pos[i, ]
    list(
      n = row$n,
      mean_years = row$mean_years,
      median_years = row$median_years,
      p10_years = row$p10_years,
      p90_years = row$p90_years
    )
  }),
  length_by_pos$position_group
)

guar_share <- external |>
  filter(!is.na(guaranteed), value > 0) |>
  mutate(share = pmin(guaranteed / value, 1))

guar_by_pos <- guar_share |>
  group_by(position_group) |>
  summarise(
    n = n(),
    mean_share = mean(share),
    median_share = median(share),
    p10_share = stats::quantile(share, 0.1, names = FALSE),
    p90_share = stats::quantile(share, 0.9, names = FALSE),
    .groups = "drop"
  )

guar_by_pos_list <- setNames(
  lapply(seq_len(nrow(guar_by_pos)), function(i) {
    row <- guar_by_pos[i, ]
    list(
      n = row$n,
      mean_guarantee_share = row$mean_share,
      median_guarantee_share = row$median_share,
      p10_guarantee_share = row$p10_share,
      p90_guarantee_share = row$p90_share
    )
  }),
  guar_by_pos$position_group
)

# ---------------------------------------------------------------------------
# 6. Signing-timing waves — qualitative pointer.
#    The OTC feed does not expose date_signed. Until a dated feed is added,
#    the waves band is documented in data/docs/free-agent-market.md and
#    only the structural skeleton is carried here.
# ---------------------------------------------------------------------------
signing_timing_waves <- list(
  source = "data/docs/free-agent-market.md",
  note = paste0(
    "OTC feed exposes year_signed only. Wave rates (legal tampering / ",
    "first 2 weeks / April bargain / June post-draft) are documented in ",
    "the research doc and should be sampled from there until a dated ",
    "feed is integrated."
  )
)

# ---------------------------------------------------------------------------
# 7. Assemble and write
# ---------------------------------------------------------------------------
summaries <- list(
  ufas_signed_per_offseason = list(
    overall = vol_per_offseason_overall,
    by_position_group = vol_by_pos_list
  ),
  aav_distribution_by_position_tier = aav_nested,
  resigning_rate = list(
    overall = resigning_split_list,
    by_position_group = resigning_by_pos_list
  ),
  contract_length_years_external = length_by_pos_list,
  guarantee_share_external = guar_by_pos_list,
  signing_timing_waves = signing_timing_waves
)

out_path <- file.path(repo_root(), "data", "bands", "free-agent-market.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "OTC contracts feed (nflreadr::load_contracts()) filtered to signings ",
    "with year_signed in the season window. 'External signing' = team != ",
    "draft_team; 're-sign own team' = team == draft_team (excluding first-year ",
    "rookie contracts where year_signed == draft_year). ",
    "AAV tiers ranked within position_group across the full window: top_10, ",
    "top_25 (11-25), top_50 (26-50), rest. APY and values are reported in ",
    "millions of nominal dollars (not cap-pct). ",
    "Position groups: QB, RB (incl FB), WR, TE, OT (LT/RT), IOL (LG/RG/C), ",
    "EDGE (ED), IDL, LB, CB, S, ST (K/P/LS). ",
    "Signing-timing waves are documented in data/docs/free-agent-market.md ",
    "because the feed lacks date_signed."
  )
)

cat("Wrote", out_path, "\n")

# Quick summary
cat("\n=== Quick Summary ===\n")
cat("External UFA signings per offseason (overall): mean",
    round(vol_per_offseason_overall$mean, 0), "sd", round(vol_per_offseason_overall$sd, 0), "\n")
cat("\nExternal signings per offseason by position group (mean):\n")
for (pg in names(vol_by_pos_list)) {
  cat(sprintf("  %-6s %.1f (sd %.1f)\n", pg,
              vol_by_pos_list[[pg]]$mean_per_offseason,
              vol_by_pos_list[[pg]]$sd %||% NA_real_))
}
cat("\nRe-signing rate (own-team) by position group:\n")
for (pg in names(resigning_by_pos_list)) {
  cat(sprintf("  %-6s %.1f%%  (%d re-signed / %d vet contracts)\n",
              pg,
              100 * resigning_by_pos_list[[pg]]$resign_rate,
              resigning_by_pos_list[[pg]]$resigned_own,
              resigning_by_pos_list[[pg]]$vet_contracts))
}
