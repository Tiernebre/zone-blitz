package app.zoneblitz.gamesimulator.scheme;

import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachArchetype;
import app.zoneblitz.gamesimulator.roster.CoachTendencies;
import app.zoneblitz.gamesimulator.roster.DefensiveCoachTendencies;
import java.util.Objects;

/**
 * Resolves a coaching staff into a {@link ResolvedScheme} using a fixed archetype-to-default-half
 * table plus tendency-derived selection within each half. Coordinator overrides their phase if they
 * hold the play-caller archetype variant; otherwise the head coach's archetype defaults are applied
 * (and "tendency-derived" entries fall back to scoring tendency axes against scheme profiles).
 *
 * <p>The mapping is intentionally simple in Phase 3 — a real calibration loop would tune the
 * tendency thresholds against historical play-call distributions. For now the rules read
 * intuitively: heavy passing + play-action ⇒ Air Raid; heavy run + gap concept ⇒ Smashmouth; etc.
 */
public final class DefaultSchemeResolver implements SchemeResolver {

  private final SchemeCatalog catalog;

  public DefaultSchemeResolver(SchemeCatalog catalog) {
    this.catalog = Objects.requireNonNull(catalog, "catalog");
  }

  @Override
  public ResolvedScheme resolve(Coach hc, Coach offensiveCoordinator, Coach defensiveCoordinator) {
    Objects.requireNonNull(hc, "headCoach");
    Objects.requireNonNull(offensiveCoordinator, "offensiveCoordinator");
    Objects.requireNonNull(defensiveCoordinator, "defensiveCoordinator");

    var offense = catalog.offense(pickOffense(hc, offensiveCoordinator));
    var defense = catalog.defense(pickDefense(hc, defensiveCoordinator));
    return new ResolvedScheme(offense, defense);
  }

  private static OffensiveSchemeId pickOffense(Coach hc, Coach oc) {
    if (oc != hc && oc.archetype() == CoachArchetype.OFFENSIVE_PLAY_CALLER) {
      return tendencyDerivedOffense(oc.offense());
    }
    return switch (hc.archetype()) {
      case OFFENSIVE_PLAY_CALLER, OFFENSIVE_GURU -> tendencyDerivedOffense(hc.offense());
      case DEFENSIVE_PLAY_CALLER -> OffensiveSchemeId.WEST_COAST;
      case DEFENSIVE_GURU -> OffensiveSchemeId.ERHARDT_PERKINS;
      case TACTICIAN, CEO, TEACHER, GENERALIST -> tendencyDerivedOffense(hc.offense());
    };
  }

  private static DefensiveSchemeId pickDefense(Coach hc, Coach dc) {
    if (dc != hc && dc.archetype() == CoachArchetype.DEFENSIVE_PLAY_CALLER) {
      return tendencyDerivedDefense(dc.defense());
    }
    return switch (hc.archetype()) {
      case DEFENSIVE_PLAY_CALLER, DEFENSIVE_GURU -> tendencyDerivedDefense(hc.defense());
      case OFFENSIVE_PLAY_CALLER -> DefensiveSchemeId.COVER_3_MATCH;
      case OFFENSIVE_GURU -> DefensiveSchemeId.FANGIO_LIGHT_BOX;
      case TACTICIAN, CEO, TEACHER, GENERALIST -> tendencyDerivedDefense(hc.defense());
    };
  }

  private static OffensiveSchemeId tendencyDerivedOffense(CoachTendencies t) {
    var passHeavy = t.passHeaviness() > 65;
    var passLite = t.passHeaviness() < 40;
    var paLover = t.playActionAffinity() > 65;
    var shotgunHeavy = t.shotgunPreference() > 65;
    var gapHeavy = t.gapRunPreference() > 60;

    if (passHeavy && paLover) return OffensiveSchemeId.AIR_RAID;
    if (passHeavy && shotgunHeavy) return OffensiveSchemeId.SPREAD_OPTION;
    if (passLite && gapHeavy) return OffensiveSchemeId.SMASHMOUTH;
    if (passLite) return OffensiveSchemeId.MCVAY_WIDE_ZONE;
    if (passHeavy) return OffensiveSchemeId.WEST_COAST;
    return OffensiveSchemeId.ERHARDT_PERKINS;
  }

  private static DefensiveSchemeId tendencyDerivedDefense(DefensiveCoachTendencies t) {
    var blitzHeavy = t.blitzFrequency() > 65;
    var manHeavy = t.manZoneBias() > 65;
    var twoHigh = t.coverageShellBias() < 40;
    var subHeavy = t.substitutionAggression() > 65;

    if (blitzHeavy) return DefensiveSchemeId.BUDDY_RYAN_46;
    if (manHeavy) return DefensiveSchemeId.COVER_2_PRESS;
    if (twoHigh && subHeavy) return DefensiveSchemeId.FANGIO_LIGHT_BOX;
    if (twoHigh) return DefensiveSchemeId.COVER_6_QUARTERS;
    if (manHeavy && t.coverageShellBias() > 60) return DefensiveSchemeId.TAMPA_2;
    return DefensiveSchemeId.COVER_3_MATCH;
  }
}
