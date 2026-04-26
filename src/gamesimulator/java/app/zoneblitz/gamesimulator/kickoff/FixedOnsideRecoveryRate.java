package app.zoneblitz.gamesimulator.kickoff;

import app.zoneblitz.gamesimulator.roster.Team;

/**
 * Constant {@link OnsideRecoveryRate}. Default is {@value #DEFAULT_RATE} — the post-2018 NFL
 * baseline (nflfastR 2018-2023 declared onside kicks: 9.0% recovered by the kicking team). Used as
 * the leaf rate that attribute-aware decorators wrap.
 */
public final class FixedOnsideRecoveryRate implements OnsideRecoveryRate {

  public static final double DEFAULT_RATE = 0.10;

  private final double rate;

  public FixedOnsideRecoveryRate() {
    this(DEFAULT_RATE);
  }

  public FixedOnsideRecoveryRate(double rate) {
    if (rate < 0.0 || rate > 1.0) {
      throw new IllegalArgumentException("rate must be in [0, 1], got " + rate);
    }
    this.rate = rate;
  }

  @Override
  public double compute(Team kicking, Team receiving) {
    return rate;
  }
}
