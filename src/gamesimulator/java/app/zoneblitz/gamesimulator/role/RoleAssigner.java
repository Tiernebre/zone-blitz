package app.zoneblitz.gamesimulator.role;

import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;

/**
 * Assigns the per-snap fine-grained role for every player on the field. Replaces the legacy
 * position-bucketed assignment with role-keyed mapping (e.g. {@code BOX_S} vs {@code DEEP_S}
 * instead of "all safeties go in the coverage bucket").
 *
 * <p>Pure given its inputs — no RNG, no state mutation. Tied to a specific {@code (OffensiveScheme,
 * DefensiveScheme)} pair via construction so per-snap calls don't re-resolve scheme data.
 */
public interface RoleAssigner {

  RoleAssignmentPair assign(
      PlayCaller.PlayCall call, OffensivePersonnel offense, DefensivePersonnel defense);
}
