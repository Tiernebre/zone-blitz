#!/usr/bin/env Rscript
# contract-structure.R — length / guarantee / cap-hit shape bands.
#
# Real NFL contracts are shaped: descending guarantee, signing bonus
# prorated over the term, back-loaded cap hits in years 3+, and increasing
# use of void years. The sim's offer generator and cap AI both need these
# shapes to simulate cut/restructure decisions credibly.
#
# Bands produced:
#   - length_by_position_tier  (mean / distribution of years at signing)
#   - guarantee_share_by_position_tier  (guaranteed / value)
#   - signing_bonus_share_by_position_tier  (prorated_bonus y1 * years / value)
#   - cap_hit_shape_by_position_tier  (cap-hit-year-N / total cap, for N in 1:5)
#   - void_year_usage_rate_by_position  (share of deals whose 'years' column
#     contains a team-recorded void-year entry — see note)
#
# Usage:
#   Rscript data/R/bands/contract-structure.R [--seasons 2020:2024]

suppressPackageStartupMessages({
  library(nflreadr)
  library(dplyr)
  library(tidyr)
  library(purrr)
})

script_file <- (function() {
  args <- commandArgs(trailingOnly = FALSE)
  f <- grep("^--file=", args, value = TRUE)
  if (length(f) > 0) normalizePath(sub("^--file=", "", f[1]), mustWork = FALSE) else NULL
})()
source(file.path(dirname(script_file), "..", "lib.R"))

args <- commandArgs(trailingOnly = TRUE)
seasons <- parse_seasons(args)

cat("Loading contracts for seasons:", paste(range(seasons), collapse = "-"), "\n")
contracts_raw <- nflreadr::load_contracts()

# ---------------------------------------------------------------------------
# 1. Window + position grouping + AAV tier assignment
# ---------------------------------------------------------------------------
contracts <- contracts_raw |>
  filter(
    !is.na(year_signed),
    year_signed >= min(seasons),
    year_signed <= max(seasons),
    !is.na(value), value > 0,
    !is.na(apy),
    !is.na(years), years >= 1
  ) |>
  mutate(
    position_group = case_when(
      position == "QB"                       ~ "QB",
      position %in% c("RB", "FB")            ~ "RB",
      position == "WR"                       ~ "WR",
      position == "TE"                       ~ "TE",
      position %in% c("LT", "RT")            ~ "OT",
      position %in% c("LG", "RG", "C")       ~ "IOL",
      position == "ED"                       ~ "EDGE",
      position == "IDL"                      ~ "IDL",
      position == "LB"                       ~ "LB",
      position == "CB"                       ~ "CB",
      position == "S"                        ~ "S",
      position %in% c("K", "P", "LS")        ~ "ST",
      TRUE                                   ~ "other"
    )
  )

tier_bucket <- function(rank) {
  case_when(
    rank <= 10 ~ "top_10",
    rank <= 25 ~ "top_25",
    rank <= 50 ~ "top_50",
    TRUE       ~ "rest"
  )
}

contracts <- contracts |>
  group_by(position_group) |>
  mutate(apy_rank = rank(-apy, ties.method = "first")) |>
  ungroup() |>
  mutate(tier = tier_bucket(apy_rank))

cat("Contracts in window:", nrow(contracts), "\n")

# ---------------------------------------------------------------------------
# 2. Length + guarantee share per position × tier
# ---------------------------------------------------------------------------
length_tier <- contracts |>
  group_by(position_group, tier) |>
  summarise(
    n = n(),
    mean_years = mean(years),
    median_years = median(years),
    p10_years = stats::quantile(years, 0.1, names = FALSE),
    p90_years = stats::quantile(years, 0.9, names = FALSE),
    .groups = "drop"
  )

guar_tier <- contracts |>
  filter(!is.na(guaranteed)) |>
  mutate(share = pmin(guaranteed / value, 1)) |>
  group_by(position_group, tier) |>
  summarise(
    n = n(),
    mean_share = mean(share),
    median_share = median(share),
    p10_share = stats::quantile(share, 0.1, names = FALSE),
    p90_share = stats::quantile(share, 0.9, names = FALSE),
    .groups = "drop"
  )

nest_by_pos_tier <- function(df, value_fn) {
  split(df, df$position_group) |>
    lapply(function(sub) {
      setNames(
        lapply(seq_len(nrow(sub)), function(i) value_fn(sub[i, ])),
        sub$tier
      )
    })
}

length_nested <- nest_by_pos_tier(length_tier, function(row) {
  list(
    n = row$n,
    mean_years = row$mean_years,
    median_years = row$median_years,
    p10_years = row$p10_years,
    p90_years = row$p90_years
  )
})

guar_nested <- nest_by_pos_tier(guar_tier, function(row) {
  list(
    n = row$n,
    mean_share = row$mean_share,
    median_share = row$median_share,
    p10_share = row$p10_share,
    p90_share = row$p90_share
  )
})

# ---------------------------------------------------------------------------
# 3. Per-contract cap-hit shape and signing-bonus share.
#    Walk the nested `cols` tibbles. For each contract:
#      - drop the "Total" row
#      - order the rows chronologically starting at year_signed
#      - normalise each cap_number by the contract's total cap (sum)
#      - keep up to 5 years (ignores void-year padding beyond 5)
#      - compute signing-bonus share as (year-1 prorated_bonus * years) / value
#        (proxy for "signing bonus" — OTC amortises the signing bonus evenly
#        across the contract via prorated_bonus)
# ---------------------------------------------------------------------------
safe_num <- function(x) suppressWarnings(as.numeric(x))

extract_shape <- function(tbl, year_signed_val, contract_years) {
  if (is.null(tbl) || !is.data.frame(tbl)) {
    return(list(shape = rep(NA_real_, 5), signing_bonus_share = NA_real_, has_void = FALSE))
  }
  rows <- tbl |>
    filter(year != "Total") |>
    mutate(year_i = safe_num(year)) |>
    filter(!is.na(year_i)) |>
    arrange(year_i)

  if (nrow(rows) == 0) {
    return(list(shape = rep(NA_real_, 5), signing_bonus_share = NA_real_, has_void = FALSE))
  }

  # The OTC nested `cols` table is the player's full cap ledger (merges
  # rookie deal + extensions into one timeline). Isolate the signed
  # contract's years: year_signed .. year_signed + years - 1. Rows beyond
  # that are either a subsequent signing OR void-year padding — we treat
  # any rows with a nonzero cap_number beyond the stated term AND before
  # the next contract start as void-year cap padding, but because we don't
  # know the next-signing boundary from this feed, void detection here is
  # a weak heuristic and is noted as such in the doc.
  term_end <- year_signed_val + contract_years - 1
  in_term <- rows |> filter(year_i >= year_signed_val, year_i <= term_end)
  if (nrow(in_term) == 0) {
    return(list(shape = rep(NA_real_, 5), signing_bonus_share = NA_real_, has_void = FALSE))
  }

  caps <- in_term$cap_number
  total_cap <- sum(caps, na.rm = TRUE)
  shape <- rep(NA_real_, 5)
  if (total_cap > 0) {
    take <- pmin(length(caps), 5)
    shape[seq_len(take)] <- caps[seq_len(take)] / total_cap
  }

  # Signing-bonus proxy: year-1 prorated_bonus * (contract length). OTC
  # amortises the signing bonus evenly across the deal, so year-1
  # prorated_bonus x years recovers the up-front bonus.
  year1_prorated <- in_term$prorated_bonus[1]
  sb_share <- NA_real_
  if (!is.na(year1_prorated) && contract_years > 0 && total_cap > 0) {
    sb_share <- (year1_prorated * contract_years) / total_cap
  }

  # Void-year heuristic: rows strictly beyond term_end carry a nonzero
  # prorated_bonus (the signature of void-year cash acceleration). This
  # is weak because subsequent signings will also show prorated_bonus on
  # those years; we flag it anyway and caveat the aggregate.
  tail_rows <- rows |> filter(year_i > term_end)
  has_void <- nrow(tail_rows) > 0 &&
    any(!is.na(tail_rows$prorated_bonus) & tail_rows$prorated_bonus > 0 &
          (is.na(tail_rows$base_salary) | tail_rows$base_salary == 0))

  list(shape = shape, signing_bonus_share = sb_share, has_void = has_void)
}

cat("Walking nested cap-hit tables for", nrow(contracts), "contracts...\n")

shapes <- purrr::pmap(
  list(contracts$cols, contracts$year_signed, contracts$years),
  extract_shape
)

shape_mat <- do.call(rbind, lapply(shapes, function(s) s$shape))
contracts$cap_y1 <- shape_mat[, 1]
contracts$cap_y2 <- shape_mat[, 2]
contracts$cap_y3 <- shape_mat[, 3]
contracts$cap_y4 <- shape_mat[, 4]
contracts$cap_y5 <- shape_mat[, 5]
contracts$signing_bonus_share <- vapply(shapes, function(s) s$signing_bonus_share, numeric(1))
contracts$has_void <- vapply(shapes, function(s) s$has_void, logical(1))

# ---------------------------------------------------------------------------
# 4. Aggregate cap-hit shape per position × tier
# ---------------------------------------------------------------------------
shape_tier <- contracts |>
  group_by(position_group, tier) |>
  summarise(
    n = sum(!is.na(cap_y1)),
    mean_cap_y1 = mean(cap_y1, na.rm = TRUE),
    mean_cap_y2 = mean(cap_y2, na.rm = TRUE),
    mean_cap_y3 = mean(cap_y3, na.rm = TRUE),
    mean_cap_y4 = mean(cap_y4, na.rm = TRUE),
    mean_cap_y5 = mean(cap_y5, na.rm = TRUE),
    .groups = "drop"
  )

shape_nested <- nest_by_pos_tier(shape_tier, function(row) {
  list(
    n = row$n,
    mean_pct_year_1 = row$mean_cap_y1,
    mean_pct_year_2 = row$mean_cap_y2,
    mean_pct_year_3 = row$mean_cap_y3,
    mean_pct_year_4 = row$mean_cap_y4,
    mean_pct_year_5 = row$mean_cap_y5
  )
})

# ---------------------------------------------------------------------------
# 5. Signing-bonus share per position × tier
# ---------------------------------------------------------------------------
sb_tier <- contracts |>
  filter(!is.na(signing_bonus_share), is.finite(signing_bonus_share)) |>
  mutate(signing_bonus_share = pmin(signing_bonus_share, 1)) |>
  group_by(position_group, tier) |>
  summarise(
    n = n(),
    mean_share = mean(signing_bonus_share),
    median_share = median(signing_bonus_share),
    p10_share = stats::quantile(signing_bonus_share, 0.1, names = FALSE),
    p90_share = stats::quantile(signing_bonus_share, 0.9, names = FALSE),
    .groups = "drop"
  )

sb_nested <- nest_by_pos_tier(sb_tier, function(row) {
  list(
    n = row$n,
    mean_signing_bonus_share = row$mean_share,
    median_signing_bonus_share = row$median_share,
    p10_signing_bonus_share = row$p10_share,
    p90_signing_bonus_share = row$p90_share
  )
})

# ---------------------------------------------------------------------------
# 6. Void-year usage rate per position
# ---------------------------------------------------------------------------
void_by_pos <- contracts |>
  group_by(position_group) |>
  summarise(
    n = n(),
    with_void = sum(has_void, na.rm = TRUE),
    rate = mean(has_void, na.rm = TRUE),
    .groups = "drop"
  ) |>
  arrange(desc(rate))

void_by_pos_list <- setNames(
  lapply(seq_len(nrow(void_by_pos)), function(i) {
    list(
      n = void_by_pos$n[i],
      with_void = void_by_pos$with_void[i],
      rate = void_by_pos$rate[i]
    )
  }),
  void_by_pos$position_group
)

# ---------------------------------------------------------------------------
# 7. Restructure frequency — not derivable from this feed.
#    The nflreadr contracts feed is one row per contract-as-signed; it does
#    not mark restructure events. OTC's "transactions" UI has them but is
#    behind the site. We note the gap here so the sim pulls restructure
#    priors from the research doc.
# ---------------------------------------------------------------------------
restructure_frequency <- list(
  source = "data/docs/contract-structure.md",
  note = paste0(
    "OTC's nflreadr feed is a snapshot of each signed contract and does ",
    "not mark restructures. Restructure frequency priors live in the ",
    "research doc until a transactions feed is wired in."
  )
)

# ---------------------------------------------------------------------------
# 8. Write
# ---------------------------------------------------------------------------
summaries <- list(
  length_by_position_tier = length_nested,
  guarantee_share_by_position_tier = guar_nested,
  signing_bonus_share_by_position_tier = sb_nested,
  cap_hit_shape_by_position_tier = shape_nested,
  void_year_usage_rate_by_position = void_by_pos_list,
  restructure_frequency = restructure_frequency
)

out_path <- file.path(repo_root(), "data", "bands", "contract-structure.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "OTC contracts feed (nflreadr::load_contracts()) filtered to year_signed ",
    "in the season window. AAV tiers ranked within position_group across the ",
    "full window: top_10, top_25 (11-25), top_50 (26-50), rest. ",
    "Cap-hit shape normalises each contract year's cap_number by the sum of ",
    "cap_numbers across the contract (years 1-5, truncated). ",
    "Signing-bonus share = (year-1 prorated_bonus x contract years) / total cap. ",
    "Void-year flag = at least one cap row exists beyond year_signed + years - 1. ",
    "Restructure frequency is documented in data/docs/contract-structure.md; the ",
    "feed does not mark restructures."
  )
)

cat("Wrote", out_path, "\n")

# Quick summary
cat("\n=== Quick Summary ===\n")
cat("Top-10 tier mean years + guarantee share by position:\n")
for (pg in names(length_nested)) {
  top <- length_nested[[pg]]$top_10
  gtop <- guar_nested[[pg]]$top_10
  if (!is.null(top) && !is.null(gtop)) {
    cat(sprintf("  %-6s years=%.2f  guarantee=%.1f%%  (n=%d)\n",
                pg, top$mean_years, 100 * gtop$mean_share, top$n))
  }
}
cat("\nVoid-year usage rate by position:\n")
for (pg in names(void_by_pos_list)) {
  cat(sprintf("  %-6s %.1f%% (%d / %d)\n",
              pg,
              100 * void_by_pos_list[[pg]]$rate,
              void_by_pos_list[[pg]]$with_void,
              void_by_pos_list[[pg]]$n))
}
