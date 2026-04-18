package app.zoneblitz.gamesimulator.roster;

import java.util.Objects;

/**
 * A coach whose offensive and defensive tendencies drive the decision layer. In this sim a single
 * {@code Coach} carries both sides because at the level of granularity we model (pass/run, concept
 * mix, blitz rate) the head coach's philosophy dominates; if coordinator-specific modeling becomes
 * valuable later, split into separate {@code OC}/{@code DC} refs on {@link
 * app.zoneblitz.gamesimulator.GameInputs}.
 */
public record Coach(
    CoachId id, String displayName, CoachTendencies offense, DefensiveCoachTendencies defense) {

  public Coach {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(displayName, "displayName");
    Objects.requireNonNull(offense, "offense");
    Objects.requireNonNull(defense, "defense");
  }

  /** League-average coach (50 on every axis on both sides). */
  public static Coach average(CoachId id, String displayName) {
    return new Coach(
        id, displayName, CoachTendencies.average(), DefensiveCoachTendencies.average());
  }
}
