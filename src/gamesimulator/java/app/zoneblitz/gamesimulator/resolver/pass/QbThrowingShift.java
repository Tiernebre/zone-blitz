package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.resolver.pass.MatchupPassResolver.PassMatchupShift;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.role.OffensiveRole;
import app.zoneblitz.gamesimulator.roster.Skill;

/**
 * QB throwing-attribute shift. Adds a per-concept matchup nudge driven by the quarterback's
 * accuracy and arm-strength skill axes. Independent of role-keyed talent shifts so a great-arm,
 * accurate QB lifts every concept regardless of receiver/coverage matchup.
 *
 * <p>Concept-conditioned blend:
 *
 * <ul>
 *   <li>{@link PassConcept#QUICK_GAME}, {@link PassConcept#SCREEN}, {@link PassConcept#RPO} — pure
 *       short accuracy.
 *   <li>{@link PassConcept#PLAY_ACTION} — short/deep blend (50/50) plus full arm-strength.
 *   <li>{@link PassConcept#HAIL_MARY} — pure deep accuracy plus full arm-strength.
 *   <li>{@link PassConcept#DROPBACK} — short/deep blend (60/40) plus a small arm-strength lift.
 * </ul>
 *
 * <p>Result is centered on zero (an average-50 QB returns 0.0) and scaled by {@link #ENVELOPE} so a
 * perfect-100 QB on a deep concept contributes at most ±{@value #ENVELOPE} to the composite shift —
 * meaningful but not dominant relative to a saturated role-keyed delta.
 */
public final class QbThrowingShift implements PassMatchupShift {

  /** Maximum absolute contribution at perfect-100 (or zero-rated) QB attributes. */
  public static final double ENVELOPE = 0.20;

  @Override
  public double compute(PassMatchupContext context, RandomSource rng) {
    var qb = context.assignment().offense().players().get(OffensiveRole.QB_POCKET);
    if (qb == null) {
      qb = context.assignment().offense().players().get(OffensiveRole.QB_MOVEMENT);
    }
    if (qb == null) {
      return 0.0;
    }
    var skill = qb.skill();
    var raw =
        switch (context.concept()) {
          case QUICK_GAME, SCREEN, RPO -> centered(skill.shortAccuracy());
          case PLAY_ACTION -> 0.5 * accuracyBlend(skill, 0.5) + 0.5 * centered(skill.armStrength());
          case HAIL_MARY ->
              0.5 * centered(skill.deepAccuracy()) + 0.5 * centered(skill.armStrength());
          case DROPBACK -> 0.85 * accuracyBlend(skill, 0.6) + 0.15 * centered(skill.armStrength());
        };
    return ENVELOPE * raw;
  }

  private static double accuracyBlend(Skill skill, double shortWeight) {
    return shortWeight * centered(skill.shortAccuracy())
        + (1.0 - shortWeight) * centered(skill.deepAccuracy());
  }

  private static double centered(int zeroToHundred) {
    return (zeroToHundred / 100.0 - 0.5) * 2.0;
  }
}
