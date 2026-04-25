package app.zoneblitz.gamesimulator.punt;

import app.zoneblitz.gamesimulator.environment.EnvironmentalModifiers;
import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.Objects;

/**
 * Weather-aware {@link PuntResolver} decorator. Shortens the delegate's gross yardage by {@link
 * EnvironmentalModifiers#puntDistancePenalty()} and re-spots the receiving team's takeover yard
 * line accordingly — a 30 mph wind shaves roughly a quarter off every punt.
 *
 * <p>Outcome kind (TOUCHBACK / FAIR_CATCH / DOWNED / OOB / RETURNED / BLOCKED) is preserved
 * verbatim from the delegate; only the reported gross and landing spot shift. Returned-punt return
 * yardage is preserved as well — the adjustment is a kicker-side effect.
 */
public final class EnvironmentalPuntResolver implements PuntResolver {

  private final PuntResolver delegate;
  private final EnvironmentalModifiers modifiers;

  public EnvironmentalPuntResolver(PuntResolver delegate, EnvironmentalModifiers modifiers) {
    this.delegate = Objects.requireNonNull(delegate, "delegate");
    this.modifiers = Objects.requireNonNull(modifiers, "modifiers");
  }

  @Override
  public Resolved resolve(
      Team kickingTeam,
      Team receivingTeam,
      Side kickingSide,
      GameId gameId,
      int sequence,
      FieldPosition preSnapSpot,
      DownAndDistance preSnap,
      GameClock clock,
      Score scoreAfter,
      RandomSource rng) {
    var base =
        delegate.resolve(
            kickingTeam,
            receivingTeam,
            kickingSide,
            gameId,
            sequence,
            preSnapSpot,
            preSnap,
            clock,
            scoreAfter,
            rng);

    var penalty = modifiers.puntDistancePenalty();
    if (penalty <= 0.0) {
      return base;
    }
    var baseEvent = base.event();
    if (baseEvent.grossYards() <= 0) {
      return base;
    }
    var scaledGross = Math.max(1, (int) Math.round(baseEvent.grossYards() * (1.0 - penalty)));
    if (scaledGross == baseEvent.grossYards()) {
      return base;
    }
    var losYardLine = preSnapSpot.yardLine();
    var clippedGross = Math.min(scaledGross, 99 - losYardLine);
    var landingInReceivingFrame = Math.max(1, 100 - (losYardLine + clippedGross));
    var takeover = Math.min(99, Math.max(1, landingInReceivingFrame + baseEvent.returnYards()));

    var adjusted =
        new PlayEvent.Punt(
            baseEvent.id(),
            baseEvent.gameId(),
            baseEvent.sequence(),
            baseEvent.preSnap(),
            baseEvent.preSnapSpot(),
            baseEvent.clockBefore(),
            baseEvent.clockAfter(),
            baseEvent.scoreAfter(),
            baseEvent.punter(),
            clippedGross,
            baseEvent.returner(),
            baseEvent.returnYards(),
            baseEvent.result());
    // Weather shortens the kick; if the kicking team recovered a muff upstream, preserve that
    // possession decision and just adjust the reported gross. Otherwise receiving takes over at the
    // weather-adjusted takeover spot.
    var receivingSide = kickingSide == Side.HOME ? Side.AWAY : Side.HOME;
    if (base.nextPossession() != receivingSide) {
      return new Resolved(adjusted, base.nextPossession(), base.nextSpotYardLine());
    }
    return new Resolved(adjusted, receivingSide, takeover);
  }
}
