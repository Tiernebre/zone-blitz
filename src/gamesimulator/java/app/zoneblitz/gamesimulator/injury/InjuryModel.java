package app.zoneblitz.gamesimulator.injury;

import app.zoneblitz.gamesimulator.environment.Surface;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.resolver.PlayOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.List;

/**
 * Draws zero or more {@link InjuryDraw}s for the players exposed to contact on a single resolved
 * scrimmage snap. Implementations are responsible for the per-snap base rate, position multipliers,
 * contact-type modifiers, the {@link Surface} modifier (turf elevates rate slightly), and the
 * player attribute coupling (toughness, agility, strength, awareness, and similar axes modulate the
 * per-exposure rate).
 *
 * <p>Implementations must be deterministic given {@code (rng, outcome, personnel)}. A snap with no
 * injury returns an empty list.
 */
public interface InjuryModel {

  /**
   * Draw injuries for one resolved snap.
   *
   * @param outcome the resolver's intermediate outcome (drives which contact buckets fire)
   * @param offense offensive personnel on the snap
   * @param defense defensive personnel on the snap
   * @param offenseSide which {@link Side} was on offense
   * @param surface playing surface — turf elevates the base rate slightly
   * @param rng random source scoped to this snap
   * @return ordered list of injuries (offense first then defense); empty if none fired
   */
  List<InjuryDraw> draw(
      PlayOutcome outcome,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      Side offenseSide,
      Surface surface,
      RandomSource rng);
}
