package app.zoneblitz.gamesimulator.penalty;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.resolver.PlayOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import java.util.Optional;

/** Test fake: never draws a penalty. Used by tests that want to pin the penalty axis to zero. */
public final class NoPenaltyModel implements PenaltyModel {

  @Override
  public Optional<PenaltyDraw.PreSnap> preSnap(
      GameState state,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      Coach offenseCoach,
      Coach defenseCoach,
      RandomSource rng) {
    return Optional.empty();
  }

  @Override
  public Optional<PenaltyDraw.LiveBall> duringPlay(
      PlayCaller.PlayCall call,
      PlayOutcome outcome,
      GameState state,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      RandomSource rng) {
    return Optional.empty();
  }

  @Override
  public Optional<PenaltyDraw.PostPlay> postPlay(
      Side offenseSide, OffensivePersonnel offense, DefensivePersonnel defense, RandomSource rng) {
    return Optional.empty();
  }
}
