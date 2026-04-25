package app.zoneblitz.gamesimulator.role;

import app.zoneblitz.gamesimulator.roster.Player;

/**
 * Unified identifier across the three attribute families (physical, skill, tendency). Lets the
 * generation layer reference any of the 31 axes by a single typed handle — necessary for
 * cross-family correlations (e.g., {@code speed × motor}) and for building the per-position
 * covariance matrices the Cholesky sampler consumes.
 *
 * <p>Each family enum implements this; {@link #code()} is unique across all three so a flat
 * registry can resolve a JSON axis name to the right enum constant.
 */
public sealed interface AttributeAxis permits PhysicalAxis, SkillAxis, TendencyAxis {

  String code();

  int extract(Player player);
}
