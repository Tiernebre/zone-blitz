package app.zoneblitz.league.hiring;

/**
 * Triangular-style guarantee-percentage band expressed as a fraction in [0, 1]: min ≤ typical ≤
 * max.
 */
record GuaranteePctBand(double min, double typical, double max) {
  GuaranteePctBand {
    if (min < 0.0 || max > 1.0) {
      throw new IllegalArgumentException(
          "expected values in [0, 1], got min=%f max=%f".formatted(min, max));
    }
    if (min > typical || typical > max) {
      throw new IllegalArgumentException(
          "expected min <= typical <= max, got min=%f typical=%f max=%f"
              .formatted(min, typical, max));
    }
  }
}
