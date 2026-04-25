package app.zoneblitz.gamesimulator.roster;

import java.util.Objects;

/**
 * A coach whose offensive and defensive tendencies drive the decision layer, paired with a {@link
 * CoachQuality} that grades how reliably they land on the right call. Tendencies are
 * <em>style</em>, quality is <em>execution</em>; the two are independent axes.
 *
 * <p>In this sim a single {@code Coach} carries both sides because at the level of granularity we
 * model (pass/run, concept mix, blitz rate) the head coach's philosophy dominates; if
 * coordinator-specific modeling becomes valuable later, split into separate {@code OC}/{@code DC}
 * refs on {@link app.zoneblitz.gamesimulator.GameInputs}.
 */
public record Coach(
    CoachId id,
    String displayName,
    CoachTendencies offense,
    DefensiveCoachTendencies defense,
    CoachQuality quality) {

  public Coach {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(displayName, "displayName");
    Objects.requireNonNull(offense, "offense");
    Objects.requireNonNull(defense, "defense");
    Objects.requireNonNull(quality, "quality");
  }

  /** League-average coach (50 on every axis on all components). */
  public static Coach average(CoachId id, String displayName) {
    return new Coach(
        id,
        displayName,
        CoachTendencies.average(),
        DefensiveCoachTendencies.average(),
        CoachQuality.average());
  }
}
