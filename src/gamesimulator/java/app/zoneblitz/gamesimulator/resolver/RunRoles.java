package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.roster.Player;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Per-snap role buckets for run-play matchup aggregates.
 *
 * <p>Mirrors {@link PassRoles} on the run side: a designated ball carrier plus three role buckets
 * feeding the clamped physical/skill matchup. Run defense is intentionally one aggregate —
 * block-shedding at the line of scrimmage and second-level tackling share players on nearly every
 * snap, so splitting them by player is artificial. The aggregate skill axis blends both.
 *
 * <p>Role is assigned by the offensive play call, not the depth chart: a lead-blocking TE lands in
 * {@link #runBlockers} rather than continuing to play its pass-role, and a nickel corner filling a
 * gap lands in {@link #runDefenders}.
 *
 * @param ballCarrier the player receiving the handoff (or keeping it on a QB run); empty only if
 *     the offense has no rushing-eligible player on the field
 * @param runBlockers blockers engaged at and beyond the line of scrimmage (OL, FB, lead TE)
 * @param runDefenders front-seven and box defenders tasked with defeating blocks and making the
 *     tackle
 */
public record RunRoles(
    Optional<Player> ballCarrier, List<Player> runBlockers, List<Player> runDefenders) {

  public RunRoles {
    Objects.requireNonNull(ballCarrier, "ballCarrier");
    Objects.requireNonNull(runBlockers, "runBlockers");
    Objects.requireNonNull(runDefenders, "runDefenders");
    runBlockers = List.copyOf(runBlockers);
    runDefenders = List.copyOf(runDefenders);
  }
}
