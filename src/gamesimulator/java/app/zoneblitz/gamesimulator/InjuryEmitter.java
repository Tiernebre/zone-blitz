package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.injury.InjuryModel;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.resolver.PlayOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Draws injuries from the supplied {@link InjuryModel} for a completed snap and emits {@link
 * PlayEvent.Injury} events, folding each injury into the returned {@link GameState}.
 */
final class InjuryEmitter {

  private final InjuryModel model;

  InjuryEmitter(InjuryModel model) {
    this.model = Objects.requireNonNull(model, "model");
  }

  GameState emit(
      List<PlayEvent> out,
      GameState state,
      PlayOutcome outcome,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      Side offenseSide,
      GameInputs inputs,
      PlayEvent triggering,
      GameClock clockAfter,
      int[] seq,
      RandomSource rng) {
    var draws =
        model.draw(outcome, offense, defense, offenseSide, inputs.preGameContext().surface(), rng);
    if (draws.isEmpty()) {
      return state;
    }
    for (var draw : draws) {
      var sequence = seq[0]++;
      var id =
          new PlayId(
              new UUID(
                  inputs.gameId().value().getMostSignificantBits(), 0x1B00L | (long) sequence));
      out.add(
          new PlayEvent.Injury(
              id,
              inputs.gameId(),
              sequence,
              triggering.preSnap(),
              triggering.preSnapSpot(),
              triggering.clockBefore(),
              clockAfter,
              triggering.scoreAfter(),
              draw.player(),
              draw.side(),
              draw.severity()));
      state = state.withInjury(draw.player());
    }
    return state;
  }
}
