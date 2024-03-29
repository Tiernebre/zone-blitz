package com.tiernebre.game_simulation.play.field_goal.result;

import com.tiernebre.game_simulation.dto.Player;

public final class FieldGoalAttemptResult extends FieldGoalResult {

  private final int distance;
  private final boolean accurate;

  public FieldGoalAttemptResult(Player kicker, int distance, boolean accurate) {
    super(kicker);
    this.distance = distance;
    this.accurate = accurate;
  }

  public int distance() {
    return distance;
  }

  public boolean accurate() {
    return accurate;
  }
}
