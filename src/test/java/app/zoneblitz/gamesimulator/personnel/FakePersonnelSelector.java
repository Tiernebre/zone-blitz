package app.zoneblitz.gamesimulator.personnel;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.Objects;

/**
 * Test double: returns pre-built {@link OffensivePersonnel} / {@link DefensivePersonnel} regardless
 * of the supplied {@link Team} or {@link PlayCaller.PlayCall}. Useful in tests that exercise
 * simulator wiring without caring about depth-chart selection.
 */
public final class FakePersonnelSelector implements PersonnelSelector {

  private final OffensivePersonnel offense;
  private final DefensivePersonnel defense;

  public FakePersonnelSelector(OffensivePersonnel offense, DefensivePersonnel defense) {
    this.offense = Objects.requireNonNull(offense, "offense");
    this.defense = Objects.requireNonNull(defense, "defense");
  }

  @Override
  public OffensivePersonnel selectOffense(
      PlayCaller.PlayCall call, GameState state, Team offenseTeam) {
    return offense;
  }

  @Override
  public DefensivePersonnel selectDefense(
      PlayCaller.PlayCall call,
      OffensivePersonnel offensePersonnel,
      GameState state,
      Team defenseTeam) {
    return defense;
  }
}
