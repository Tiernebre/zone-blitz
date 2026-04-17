#!/usr/bin/env Rscript
# draft-position-distribution.R — positional distribution of NFL draft picks.
#
# Answers: how often does each position get drafted in each round? The sim's
# draft-class generator needs a prior for positional scarcity in the draft
# itself so it does not over-produce round-1 RBs or under-produce OL across
# rounds.
#
# Outputs:
#   1. Per round × position — picks per draft (mean/sd/p10/p50/p90), share
#      of round.
#   2. Positional frequency across the full draft (avg QBs/EDGEs/OTs per year).
#   3. Top-of-draft concentration — share of top-10 / top-32 / top-64 picks
#      going to each position.
#
# Usage:
#   Rscript data/R/bands/draft-position-distribution.R [--seasons 2015:2024]

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

# ---------------------------------------------------------------------------
# Load and normalize
# ---------------------------------------------------------------------------
cat("Loading draft picks for seasons:", paste(range(seasons), collapse = "-"), "\n")
picks_raw <- nflreadr::load_draft_picks(seasons)

# Canonical position group: lean on PFR's `position` (specific) and `side`
# (O/D/ST) to build the sim's vocabulary. EDGE is inferred from DE plus 3-4
# OLB listings (a persistent thorn in NFL data — PFR tags some 3-4 rush
# backers as OLB and some as DE).
canonical_draft_position <- function(position, category, side) {
  p <- toupper(position)
  c <- toupper(category)
  case_when(
    p == "QB"                                          ~ "QB",
    p %in% c("RB", "FB", "HB")                         ~ "RB",
    p == "WR"                                          ~ "WR",
    p == "TE"                                          ~ "TE",
    p %in% c("T", "OT", "LT", "RT")                    ~ "OT",
    p %in% c("G", "OG", "LG", "RG")                    ~ "OG",
    p == "C"                                           ~ "OC",
    p == "OL" & c == "OL"                              ~ "OL",   # generic
    p == "DE"                                          ~ "EDGE",
    # 3-4 rush backers are frequently tagged OLB but fit EDGE role
    p == "OLB"                                         ~ "EDGE_or_LB",
    p %in% c("DT", "NT")                               ~ "iDL",
    p == "DL" & side == "D"                            ~ "iDL",  # generic D-line
    p %in% c("LB", "ILB", "MLB")                       ~ "LB",
    p == "CB"                                          ~ "CB",
    p %in% c("S", "FS", "SS", "SAF")                   ~ "S",
    p == "DB" & side == "D"                            ~ "DB",   # generic DB
    p == "K"                                           ~ "K",
    p == "P"                                           ~ "P",
    p == "LS"                                          ~ "LS",
    TRUE                                               ~ "other"
  )
}

picks <- picks_raw |>
  mutate(pos = canonical_draft_position(position, category, side)) |>
  filter(!is.na(round), round >= 1, round <= 7)

# ---------------------------------------------------------------------------
# 1. Per round × position — picks per draft
# ---------------------------------------------------------------------------
per_draft <- picks |>
  group_by(season, round, pos) |>
  summarise(n = n(), .groups = "drop")

# Fill grid so a round × position with zero picks in some drafts still shows.
all_positions <- sort(unique(picks$pos))
grid <- tidyr::crossing(
  season = unique(picks$season),
  round  = 1:7,
  pos    = all_positions
)
per_draft_filled <- grid |>
  left_join(per_draft, by = c("season", "round", "pos")) |>
  mutate(n = ifelse(is.na(n), 0L, n))

# Round totals per season (denominator for round-share).
round_totals <- picks |>
  group_by(season, round) |>
  summarise(round_total = n(), .groups = "drop")

per_draft_shares <- per_draft_filled |>
  inner_join(round_totals, by = c("season", "round")) |>
  mutate(share = n / round_total)

round_position <- per_draft_shares |>
  group_by(round, pos) |>
  summarise(
    picks_mean = mean(n),
    picks_sd   = sd(n),
    picks_p10  = as.numeric(quantile(n, 0.10)),
    picks_p50  = as.numeric(quantile(n, 0.50)),
    picks_p90  = as.numeric(quantile(n, 0.90)),
    share_mean = mean(share),
    share_sd   = sd(share),
    .groups = "drop"
  )

# Nest by round, then by position.
round_position_nested <- split(round_position, round_position$round) |>
  lapply(function(df) {
    df <- df[order(-df$picks_mean), ]
    setNames(
      lapply(seq_len(nrow(df)), function(i) {
        list(
          picks = list(
            mean = df$picks_mean[i], sd = df$picks_sd[i],
            p10 = df$picks_p10[i], p50 = df$picks_p50[i], p90 = df$picks_p90[i]
          ),
          share_of_round = list(
            mean = df$share_mean[i], sd = df$share_sd[i]
          )
        )
      }),
      df$pos
    )
  })
names(round_position_nested) <- paste0("round_", names(round_position_nested))

# ---------------------------------------------------------------------------
# 2. Positional frequency — full draft totals per year
# ---------------------------------------------------------------------------
full_draft <- picks |>
  group_by(season, pos) |>
  summarise(n = n(), .groups = "drop")

full_draft_grid <- tidyr::crossing(
  season = unique(picks$season),
  pos    = all_positions
) |>
  left_join(full_draft, by = c("season", "pos")) |>
  mutate(n = ifelse(is.na(n), 0L, n))

draft_totals_per_season <- picks |>
  group_by(season) |>
  summarise(total = n(), .groups = "drop")

full_draft_shares <- full_draft_grid |>
  inner_join(draft_totals_per_season, by = "season") |>
  mutate(share = n / total)

full_draft_summary <- full_draft_shares |>
  group_by(pos) |>
  summarise(
    picks_per_draft_mean = mean(n),
    picks_per_draft_sd   = sd(n),
    picks_per_draft_p10  = as.numeric(quantile(n, 0.10)),
    picks_per_draft_p50  = as.numeric(quantile(n, 0.50)),
    picks_per_draft_p90  = as.numeric(quantile(n, 0.90)),
    share_of_draft_mean  = mean(share),
    .groups = "drop"
  ) |>
  arrange(desc(picks_per_draft_mean))

full_draft_list <- setNames(
  lapply(seq_len(nrow(full_draft_summary)), function(i) {
    r <- full_draft_summary[i, ]
    list(
      picks_per_draft = list(
        mean = r$picks_per_draft_mean, sd = r$picks_per_draft_sd,
        p10 = r$picks_per_draft_p10, p50 = r$picks_per_draft_p50,
        p90 = r$picks_per_draft_p90
      ),
      share_of_draft = r$share_of_draft_mean
    )
  }),
  full_draft_summary$pos
)

# ---------------------------------------------------------------------------
# 3. Top-of-draft concentration — share of top-10, top-32, top-64 picks.
# ---------------------------------------------------------------------------
top_concentration <- function(picks_df, cutoff) {
  picks_df |>
    filter(pick <= cutoff) |>
    group_by(pos) |>
    summarise(n = n(), .groups = "drop") |>
    mutate(share = n / sum(n)) |>
    arrange(desc(share))
}

top_shares_list <- function(cutoff) {
  df <- top_concentration(picks, cutoff)
  setNames(
    lapply(seq_len(nrow(df)), function(i) {
      list(n = df$n[i], share = df$share[i])
    }),
    df$pos
  )
}

top_concentration_bands <- list(
  top_10 = top_shares_list(10),
  top_32 = top_shares_list(32),
  top_64 = top_shares_list(64)
)

# ---------------------------------------------------------------------------
# 4. Write
# ---------------------------------------------------------------------------
summaries <- list(
  by_round_and_position = round_position_nested,
  per_draft_totals      = full_draft_list,
  top_of_draft_concentration = top_concentration_bands
)

out_path <- file.path(repo_root(), "data", "bands", "draft-position-distribution.json")

write_band(
  out_path,
  seasons,
  summaries,
  notes = paste0(
    "NFL draft positional distribution. Source: load_draft_picks(). ",
    "Position canonicalization: RB includes FB/HB; OT merges T/OT/LT/RT; ",
    "OG merges G/OG/LG/RG; OC is center; EDGE is DE; iDL is DT/NT/generic DL; ",
    "OLB reported separately as 'EDGE_or_LB' because PFR tags both 3-4 rush ",
    "backers and off-ball OLBs under the same label. ",
    "Per round × position: picks_per_draft and share_of_round are distributions ",
    "across the drafts in the season window (one observation per draft). ",
    "Top-of-draft concentration is computed across all drafts in the window ",
    "pooled (share = n_at_pos / n_at_cutoff summed across drafts). ",
    "Rounds outside 1-7 (supplemental / rare) are dropped."
  )
)

cat("Wrote", out_path, "\n")

# --- Debug print
cat("\n=== Top-10 picks by position (pooled across drafts) ===\n")
for (p in names(top_concentration_bands$top_10)) {
  r <- top_concentration_bands$top_10[[p]]
  cat("  ", sprintf("%-14s n=%3d  share=%.3f\n", p, r$n, r$share))
}
cat("\n=== Picks per draft (full draft) ===\n")
for (p in names(full_draft_list)) {
  r <- full_draft_list[[p]]
  cat("  ", sprintf("%-14s mean=%5.2f  share=%.3f\n", p, r$picks_per_draft$mean, r$share_of_draft))
}
