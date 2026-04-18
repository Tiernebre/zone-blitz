package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.personnel.PersonnelSelector;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.resolver.PlayOutcome;
import app.zoneblitz.gamesimulator.resolver.PlayResolver;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * Walking-skeleton implementation of {@link SimulateGame}. Loops a fixed number of snaps from the
 * supplied {@link PlayCaller}, selects on-field personnel via the supplied {@link
 * PersonnelSelector}, resolves each via the supplied {@link PlayResolver}, and emits one event per
 * snap. Matchup math and the model cluster (clock, penalty, fatigue, injury) are not yet wired.
 */
final class GameSimulator implements SimulateGame {

  private static final int DEFAULT_SNAPS = 130;

  private final PlayCaller caller;
  private final PersonnelSelector personnel;
  private final PlayResolver resolver;
  private final int snaps;

  GameSimulator(PlayCaller caller, PersonnelSelector personnel, PlayResolver resolver) {
    this(caller, personnel, resolver, DEFAULT_SNAPS);
  }

  GameSimulator(PlayCaller caller, PersonnelSelector personnel, PlayResolver resolver, int snaps) {
    this.caller = Objects.requireNonNull(caller, "caller");
    this.personnel = Objects.requireNonNull(personnel, "personnel");
    this.resolver = Objects.requireNonNull(resolver, "resolver");
    this.snaps = snaps;
  }

  @Override
  public Stream<PlayEvent> simulate(GameInputs inputs) {
    Objects.requireNonNull(inputs, "inputs");
    var seed = inputs.seed().orElse(0L);
    var root = new SplittableRandomSource(seed);
    var gameKey = (long) inputs.gameId().value().hashCode();
    return Stream.iterate(0, i -> i + 1)
        .limit(snaps)
        .map(
            i -> {
              var snapRng = root.split(gameKey ^ ((long) i << 32));
              var state = GameState.initial();
              var offense = state.possession() == Side.HOME ? inputs.home() : inputs.away();
              var defense = state.possession() == Side.HOME ? inputs.away() : inputs.home();
              var call = caller.call(state);
              var offPersonnel = personnel.selectOffense(call, state, offense);
              var defPersonnel = personnel.selectDefense(call, offPersonnel, state, defense);
              var outcome = resolver.resolve(call, state, offPersonnel, defPersonnel, snapRng);
              return toEvent(outcome, state, inputs.gameId(), i);
            });
  }

  private static PlayEvent toEvent(
      PlayOutcome outcome, GameState state, GameId gameId, int sequence) {
    var id = new PlayId(new UUID(gameId.value().getMostSignificantBits(), sequence));
    var preSnap = state.downAndDistance();
    var preSnapSpot = state.spot();
    var clockBefore = state.clock();
    var clockAfter = state.clock();
    var scoreAfter = state.score();
    return switch (outcome) {
      case PassOutcome.PassComplete c ->
          new PlayEvent.PassComplete(
              id,
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clockBefore,
              clockAfter,
              scoreAfter,
              c.qb(),
              c.target(),
              c.airYards(),
              c.yardsAfterCatch(),
              c.totalYards(),
              new FieldPosition(preSnapSpot.yardLine() + c.totalYards()),
              c.tackler(),
              c.defendersInCoverage(),
              c.touchdown(),
              c.firstDown());
      case PassOutcome.PassIncomplete i ->
          new PlayEvent.PassIncomplete(
              id,
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clockBefore,
              clockAfter,
              scoreAfter,
              i.qb(),
              i.target(),
              i.airYards(),
              i.reason(),
              i.defender());
      case PassOutcome.Sack s ->
          new PlayEvent.Sack(
              id,
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clockBefore,
              clockAfter,
              scoreAfter,
              s.qb(),
              s.sackers(),
              s.yardsLost(),
              s.fumble());
      case PassOutcome.Scramble s ->
          new PlayEvent.Scramble(
              id,
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clockBefore,
              clockAfter,
              scoreAfter,
              s.qb(),
              s.yards(),
              new FieldPosition(preSnapSpot.yardLine() + s.yards()),
              s.tackler(),
              s.slideOrOob(),
              s.touchdown());
      case PassOutcome.Interception x ->
          new PlayEvent.Interception(
              id,
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clockBefore,
              clockAfter,
              scoreAfter,
              x.qb(),
              x.intendedTarget(),
              x.interceptor(),
              x.returnYards(),
              preSnapSpot,
              x.touchdown());
      case RunOutcome.Run r ->
          new PlayEvent.Run(
              id,
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clockBefore,
              clockAfter,
              scoreAfter,
              r.carrier(),
              r.concept(),
              r.yards(),
              new FieldPosition(preSnapSpot.yardLine() + r.yards()),
              r.tackler(),
              r.fumble(),
              r.touchdown(),
              r.firstDown(),
              0L);
    };
  }
}
