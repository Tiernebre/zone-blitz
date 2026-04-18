package app.zoneblitz.gamesimulator.personnel;

/**
 * NFL offensive personnel groupings. Naming follows the standard convention: the first digit is the
 * number of running backs (RB + FB), the second is the number of tight ends; wide receivers fill
 * the remaining skill spots after the fixed 1 QB and 5 OL (or 6 OL in jumbo).
 *
 * <p>The standard family covers every {@code (RB, TE)} combination that fits 11 − 1 QB − 5 OL = 5
 * skill spots. The jumbo family swaps the fifth skill spot for a sixth offensive lineman, covering
 * every {@code (RB, TE)} combination that fits 11 − 1 QB − 6 OL = 4 skill spots.
 *
 * <p>Each constant carries the expected per-position counts; {@link OffensivePersonnel} enforces
 * them at construction.
 */
public enum OffensivePackage {
  P_00(0, 0, 5, 5),
  P_01(0, 1, 4, 5),
  P_02(0, 2, 3, 5),
  P_03(0, 3, 2, 5),
  P_10(1, 0, 4, 5),
  P_11(1, 1, 3, 5),
  P_12(1, 2, 2, 5),
  P_13(1, 3, 1, 5),
  P_20(2, 0, 3, 5),
  P_21(2, 1, 2, 5),
  P_22(2, 2, 1, 5),
  P_23(2, 3, 0, 5),
  P_30(3, 0, 2, 5),
  P_31(3, 1, 1, 5),
  P_32(3, 2, 0, 5),
  JUMBO_6OL_04(0, 4, 0, 6),
  JUMBO_6OL_13(1, 3, 0, 6),
  JUMBO_6OL_22(2, 2, 0, 6),
  JUMBO_6OL_31(3, 1, 0, 6),
  JUMBO_6OL_40(4, 0, 0, 6),
  JUMBO_6OL_12(1, 2, 1, 6),
  JUMBO_6OL_21(2, 1, 1, 6);

  private final int rbs;
  private final int tes;
  private final int wrs;
  private final int offensiveLinemen;

  OffensivePackage(int rbs, int tes, int wrs, int offensiveLinemen) {
    this.rbs = rbs;
    this.tes = tes;
    this.wrs = wrs;
    this.offensiveLinemen = offensiveLinemen;
  }

  public int quarterbacks() {
    return 1;
  }

  public int rbs() {
    return rbs;
  }

  public int tes() {
    return tes;
  }

  public int wrs() {
    return wrs;
  }

  public int offensiveLinemen() {
    return offensiveLinemen;
  }
}
