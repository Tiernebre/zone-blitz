package app.zoneblitz.league.hiring.generation;

/** Triangular-style contract-length band in whole years: min ≤ mode ≤ max. */
record ContractLengthBand(int min, int mode, int max) {
  ContractLengthBand {
    if (min > mode || mode > max) {
      throw new IllegalArgumentException(
          "expected min <= mode <= max, got min=%d mode=%d max=%d".formatted(min, mode, max));
    }
    if (min <= 0) {
      throw new IllegalArgumentException("min must be > 0, was: " + min);
    }
  }
}
