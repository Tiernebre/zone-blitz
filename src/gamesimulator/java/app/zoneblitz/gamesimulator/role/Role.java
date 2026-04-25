package app.zoneblitz.gamesimulator.role;

import app.zoneblitz.gamesimulator.roster.Position;

/**
 * A per-snap role on the field. Roles are finer-grained than {@link Position} so the engine can ask
 * different questions of a {@code BOX_S} versus a {@code DEEP_S}, or a {@code SLOT_WR} versus an
 * {@code X_WR}, even when the underlying position is the same.
 *
 * <p>Implementations are sealed across the offense/defense split — {@link OffensiveRole} and {@link
 * DefensiveRole}. {@link #code()} is the stable string key used by band-file lookups; {@link
 * #basePosition()} is the {@link Position} family a player must belong to in order to be eligible
 * for the role.
 */
public sealed interface Role permits OffensiveRole, DefensiveRole {

  String code();

  Position basePosition();
}
