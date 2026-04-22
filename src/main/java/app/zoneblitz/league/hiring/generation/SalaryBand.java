package app.zoneblitz.league.hiring.generation;

/**
 * Annual salary band in whole USD dollars (not cents): p10 ≤ p50 ≤ p90 ≤ ceiling. Callers that need
 * cents convert at the boundary.
 */
record SalaryBand(long p10, long p50, long p90, long ceiling) {
  SalaryBand {
    if (p10 > p50 || p50 > p90 || p90 > ceiling) {
      throw new IllegalArgumentException(
          "expected p10 <= p50 <= p90 <= ceiling, got p10=%d p50=%d p90=%d ceiling=%d"
              .formatted(p10, p50, p90, ceiling));
    }
    if (p10 <= 0) {
      throw new IllegalArgumentException("p10 must be > 0, was: " + p10);
    }
  }
}
