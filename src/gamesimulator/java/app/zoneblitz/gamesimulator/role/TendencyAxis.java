package app.zoneblitz.gamesimulator.role;

import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import java.util.function.ToIntFunction;

/**
 * Axis identifier for the eight {@link Tendencies} attributes. Used by {@link RoleDemand} to weight
 * behavioral contributions per role.
 */
public enum TendencyAxis implements AttributeAxis {
  COMPOSURE(Tendencies::composure),
  DISCIPLINE(Tendencies::discipline),
  FOOTBALL_IQ(Tendencies::footballIq),
  PROCESSING(Tendencies::processing),
  TOUGHNESS(Tendencies::toughness),
  CLUTCH(Tendencies::clutch),
  CONSISTENCY(Tendencies::consistency),
  MOTOR(Tendencies::motor);

  private final ToIntFunction<Tendencies> extractor;

  TendencyAxis(ToIntFunction<Tendencies> extractor) {
    this.extractor = extractor;
  }

  public int extract(Tendencies tendencies) {
    return extractor.applyAsInt(tendencies);
  }

  @Override
  public String code() {
    return "TENDENCY_" + name();
  }

  @Override
  public int extract(Player player) {
    return extract(player.tendencies());
  }
}
