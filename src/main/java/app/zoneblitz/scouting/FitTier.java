package app.zoneblitz.scouting;

/**
 * Scheme-relative fit tier — A is top-decile, D is bottom-tercile, computed as the player's
 * percentile rank against the supplied comparison pool. Tiers are not transferable across schemes —
 * an A-tier {@code BOX_S} in one scheme could be C-tier in another.
 */
public enum FitTier {
  A,
  B,
  C,
  D;

  public static FitTier fromPercentile(double percentile) {
    if (percentile >= 0.90) return A;
    if (percentile >= 0.65) return B;
    if (percentile >= 0.30) return C;
    return D;
  }
}
