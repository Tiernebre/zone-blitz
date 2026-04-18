package app.zoneblitz.gamesimulator.roster;

import java.util.Objects;

/**
 * A coach (head coach, coordinator) whose tendencies drive the decision layer. Scheme and tendency
 * attributes will be added by the decision-layer tasks (D1+).
 */
public record Coach(CoachId id, String displayName) {

  public Coach {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(displayName, "displayName");
  }
}
