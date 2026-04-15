#!/usr/bin/env Rscript
# Verify the nflverse toolchain is installed and print versions.
# Run this once after cloning to confirm the R environment is ready.

required <- c("nflreadr", "dplyr", "tidyr", "arrow", "jsonlite")

missing <- required[!vapply(required, requireNamespace, logical(1), quietly = TRUE)]

if (length(missing) > 0) {
  cat("Missing packages:", paste(missing, collapse = ", "), "\n")
  cat("Install with:\n")
  cat(sprintf(
    '  Rscript -e \'install.packages(c(%s), repos="https://cloud.r-project.org")\'\n',
    paste(sprintf('"%s"', missing), collapse = ", ")
  ))
  quit(status = 1)
}

cat("R:", R.version.string, "\n")
for (p in required) {
  cat(sprintf("  %-10s %s\n", p, as.character(packageVersion(p))))
}

find_repo_root <- function(start = getwd()) {
  here <- normalizePath(start, mustWork = FALSE)
  while (!file.exists(file.path(here, ".git")) && dirname(here) != here) {
    here <- dirname(here)
  }
  here
}

cache_dir <- file.path(find_repo_root(), "data", "cache")
if (!dir.exists(cache_dir)) dir.create(cache_dir, recursive = TRUE)
cat("\nCache dir:", cache_dir, "\n")
cat("OK — environment ready.\n")
