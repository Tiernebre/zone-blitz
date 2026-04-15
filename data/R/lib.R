# Shared helpers for band-generation scripts.
# Source via: source(file.path(dirname(sys.frame(1)$ofile), "..", "lib.R"))

suppressPackageStartupMessages({
  library(dplyr)
  library(tidyr)
  library(jsonlite)
})

# Resolve repo root from this file's location so scripts work regardless of cwd.
`%||%` <- function(a, b) if (is.null(a)) b else a

# Locate the running script's path under Rscript. Returns NULL if sourced.
script_path <- function() {
  args <- commandArgs(trailingOnly = FALSE)
  file_arg <- grep("^--file=", args, value = TRUE)
  if (length(file_arg) == 0) return(NULL)
  normalizePath(sub("^--file=", "", file_arg[1]), mustWork = FALSE)
}

repo_root <- function() {
  start <- script_path() %||% getwd()
  here <- normalizePath(start, mustWork = FALSE)
  while (!file.exists(file.path(here, ".git")) && dirname(here) != here) {
    here <- dirname(here)
  }
  here
}

# Parse --seasons 2020:2024 or --seasons 2020,2021,2022 into an integer vector.
# Defaults to the last five completed NFL seasons.
parse_seasons <- function(args) {
  idx <- which(args == "--seasons")
  if (length(idx) == 0) {
    last_complete <- as.integer(format(Sys.Date(), "%Y")) - 1L
    return(seq(last_complete - 4L, last_complete))
  }
  spec <- args[idx + 1L]
  if (grepl(":", spec, fixed = TRUE)) {
    bounds <- as.integer(strsplit(spec, ":", fixed = TRUE)[[1]])
    return(seq(bounds[1], bounds[2]))
  }
  as.integer(strsplit(spec, ",", fixed = TRUE)[[1]])
}

# Percentile + summary bundle used by every band.
distribution_summary <- function(x) {
  x <- x[!is.na(x)]
  if (length(x) == 0) {
    return(list(n = 0L))
  }
  qs <- stats::quantile(x, probs = c(0.1, 0.25, 0.5, 0.75, 0.9), names = FALSE)
  list(
    n = length(x),
    mean = mean(x),
    sd = stats::sd(x),
    min = min(x),
    p10 = qs[1], p25 = qs[2], p50 = qs[3], p75 = qs[4], p90 = qs[5],
    max = max(x)
  )
}

# Write a band artifact with a consistent envelope: metadata + summaries.
write_band <- function(path, seasons, summaries, notes = NULL) {
  out <- list(
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    seasons = as.integer(seasons),
    notes = notes,
    bands = summaries
  )
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  writeLines(
    jsonlite::toJSON(out, auto_unbox = TRUE, pretty = TRUE, digits = 4, null = "null"),
    path
  )
  invisible(path)
}
