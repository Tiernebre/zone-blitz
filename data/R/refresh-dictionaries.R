#!/usr/bin/env Rscript
# Regenerate the nflfastr skill's dictionary reference files from the
# installed nflreadr version. Run whenever nflreadr is upgraded so the
# skill's field/stats tables stay in sync.
#
# Output:
#   ~/.claude/skills/nflfastr/reference/dictionary-pbp.md
#   ~/.claude/skills/nflfastr/reference/dictionary-player-stats.md

suppressPackageStartupMessages(library(nflreadr))

skill_ref <- file.path(Sys.getenv("HOME"), ".claude", "skills", "nflfastr", "reference")
dir.create(skill_ref, recursive = TRUE, showWarnings = FALSE)

write_table <- function(df, path, title, source_url, col_order) {
  df <- df[, col_order, drop = FALSE]
  header <- c(
    sprintf("# %s", title),
    "",
    sprintf("Source: %s", source_url),
    sprintf("Generated: %s (nflreadr %s)",
            format(Sys.time(), "%Y-%m-%d"),
            as.character(packageVersion("nflreadr"))),
    sprintf("Total fields: %d", nrow(df)),
    "",
    paste0("| ", paste(col_order, collapse = " | "), " |"),
    paste0("|", paste(rep("---", length(col_order)), collapse = "|"), "|")
  )
  rows <- apply(df, 1, function(r) {
    cells <- vapply(r, function(x) {
      if (is.na(x)) return("")
      x <- gsub("\\|", "\\\\|", as.character(x))
      x <- gsub("\n", " ", x)
      x
    }, character(1))
    paste0("| ", paste(cells, collapse = " | "), " |")
  })
  writeLines(c(header, rows), path)
  cat("Wrote", path, "(", nrow(df), "fields )\n")
}

write_table(
  nflreadr::dictionary_pbp,
  file.path(skill_ref, "dictionary-pbp.md"),
  "nflfastR Play-by-Play Field Dictionary",
  "https://nflfastr.com/articles/field_descriptions.html",
  c("Field", "Type", "Description")
)

write_table(
  nflreadr::dictionary_player_stats,
  file.path(skill_ref, "dictionary-player-stats.md"),
  "nflfastR Player Stats Variable Dictionary",
  "https://nflfastr.com/articles/stats_variables.html",
  c("field", "data_type", "description")
)
