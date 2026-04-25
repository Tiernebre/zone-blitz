package app.zoneblitz.gamesimulator.role;

import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.function.ToIntFunction;

/**
 * Axis identifier for the eight {@link Physical} attributes. Used by {@link RoleDemand} to weight
 * physical contributions per role without relying on string keys.
 */
public enum PhysicalAxis implements AttributeAxis {
  SPEED(Physical::speed),
  ACCELERATION(Physical::acceleration),
  AGILITY(Physical::agility),
  STRENGTH(Physical::strength),
  POWER(Physical::power),
  BEND(Physical::bend),
  STAMINA(Physical::stamina),
  EXPLOSIVENESS(Physical::explosiveness);

  private final ToIntFunction<Physical> extractor;

  PhysicalAxis(ToIntFunction<Physical> extractor) {
    this.extractor = extractor;
  }

  public int extract(Physical physical) {
    return extractor.applyAsInt(physical);
  }

  @Override
  public String code() {
    return "PHYSICAL_" + name();
  }

  @Override
  public int extract(Player player) {
    return extract(player.physical());
  }
}
