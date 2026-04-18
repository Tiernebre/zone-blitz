package app.zoneblitz.gamesimulator.formation;

/**
 * The defensive coverage call on a passing play. Each shell has a deterministic {@link
 * CoverageType}, so {@code CoverageType} is not stored alongside — it's computed by {@link
 * #type()}.
 *
 * <p>Values mirror the PFF labels carried in the Big Data Bowl 2023 data: Cover-0/1 are pure man,
 * Cover-2/3/Quarters/6 are zone shells, 2-Man is man-under with two-deep zone, and {@code OTHER}
 * captures specialty calls (bracket, prevent, goal-line) that the sim doesn't model distinctly.
 */
public enum CoverageShell {
  COVER_0(CoverageType.MAN),
  COVER_1(CoverageType.MAN),
  TWO_MAN(CoverageType.MAN),
  COVER_2(CoverageType.ZONE),
  COVER_3(CoverageType.ZONE),
  COVER_6(CoverageType.ZONE),
  QUARTERS(CoverageType.ZONE),
  OTHER(CoverageType.OTHER);

  private final CoverageType type;

  CoverageShell(CoverageType type) {
    this.type = type;
  }

  public CoverageType type() {
    return type;
  }
}
