package app.zoneblitz.gamesimulator.scheme;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachArchetype;
import app.zoneblitz.gamesimulator.roster.CoachId;
import app.zoneblitz.gamesimulator.roster.CoachQuality;
import app.zoneblitz.gamesimulator.roster.CoachTendencies;
import app.zoneblitz.gamesimulator.roster.DefensiveCoachTendencies;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DefaultSchemeResolverTests {

  private final DefaultSchemeResolver resolver =
      new DefaultSchemeResolver(new BuiltinSchemeCatalog());

  @Test
  void resolve_passHeavyOffensivePlayCallerProducesAirRaid() {
    var hc = coach(CoachArchetype.OFFENSIVE_PLAY_CALLER, passHeavyTendencies(), neutralDefense());

    var resolved = resolver.resolve(hc, hc, hc);

    assertThat(resolved.offense().id()).isEqualTo(OffensiveSchemeId.AIR_RAID);
  }

  @Test
  void resolve_runHeavyOffensiveGuruProducesSmashmouth() {
    var hc = coach(CoachArchetype.OFFENSIVE_GURU, runHeavyGapTendencies(), neutralDefense());

    var resolved = resolver.resolve(hc, hc, hc);

    assertThat(resolved.offense().id()).isEqualTo(OffensiveSchemeId.SMASHMOUTH);
  }

  @Test
  void resolve_defensivePlayCallerHcDefaultsOffenseToWestCoast() {
    var hc = coach(CoachArchetype.DEFENSIVE_PLAY_CALLER, neutralOffense(), neutralDefense());

    var resolved = resolver.resolve(hc, hc, hc);

    assertThat(resolved.offense().id()).isEqualTo(OffensiveSchemeId.WEST_COAST);
  }

  @Test
  void resolve_blitzHeavyDefensivePlayCallerProducesBuddyRyan() {
    var hc = coach(CoachArchetype.DEFENSIVE_PLAY_CALLER, neutralOffense(), blitzHeavyDefense());

    var resolved = resolver.resolve(hc, hc, hc);

    assertThat(resolved.defense().id()).isEqualTo(DefensiveSchemeId.BUDDY_RYAN_46);
  }

  @Test
  void resolve_offensivePlayCallerCoordinatorOverridesHcDefault() {
    var hc = coach(CoachArchetype.DEFENSIVE_GURU, neutralOffense(), neutralDefense());
    var oc = coach(CoachArchetype.OFFENSIVE_PLAY_CALLER, passHeavyTendencies(), neutralDefense());

    var resolved = resolver.resolve(hc, oc, hc);

    assertThat(resolved.offense().id()).isEqualTo(OffensiveSchemeId.AIR_RAID);
  }

  @Test
  void resolve_defensivePlayCallerCoordinatorOverridesHcDefault() {
    var hc = coach(CoachArchetype.OFFENSIVE_GURU, neutralOffense(), neutralDefense());
    var dc = coach(CoachArchetype.DEFENSIVE_PLAY_CALLER, neutralOffense(), blitzHeavyDefense());

    var resolved = resolver.resolve(hc, hc, dc);

    assertThat(resolved.defense().id()).isEqualTo(DefensiveSchemeId.BUDDY_RYAN_46);
  }

  @Test
  void resolve_generalistHcUsesTendencyDerivedSchemes() {
    var hc = coach(CoachArchetype.GENERALIST, passHeavyTendencies(), neutralDefense());

    var resolved = resolver.resolve(hc, hc, hc);

    assertThat(resolved.offense().id()).isEqualTo(OffensiveSchemeId.AIR_RAID);
  }

  private static Coach coach(
      CoachArchetype archetype, CoachTendencies offense, DefensiveCoachTendencies defense) {
    return new Coach(
        new CoachId(new UUID(1L, archetype.ordinal())),
        archetype.name(),
        archetype,
        offense,
        defense,
        CoachQuality.average());
  }

  private static CoachTendencies passHeavyTendencies() {
    return new CoachTendencies(80, 60, 50, 70, 50, 50, 40, 60, 50, 50);
  }

  private static CoachTendencies runHeavyGapTendencies() {
    return new CoachTendencies(30, 50, 50, 40, 30, 30, 70, 30, 50, 50);
  }

  private static CoachTendencies neutralOffense() {
    return CoachTendencies.average();
  }

  private static DefensiveCoachTendencies neutralDefense() {
    return DefensiveCoachTendencies.average();
  }

  private static DefensiveCoachTendencies blitzHeavyDefense() {
    return new DefensiveCoachTendencies(80, 70, 50, 50, 50, 70, 50, 50);
  }
}
