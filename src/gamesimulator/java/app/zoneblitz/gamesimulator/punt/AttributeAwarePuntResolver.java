package app.zoneblitz.gamesimulator.punt;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.PuntResult;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.Objects;
import java.util.function.ToDoubleFunction;

/**
 * Punter-attribute-aware {@link PuntResolver} decorator. Re-runs the delegate and then applies
 * three independent post-hoc shifts driven by punter attributes:
 *
 * <ul>
 *   <li><b>Gross yards</b> scale by {@code (1 + puntPowerScore × {@value #GROSS_ENVELOPE})}. An
 *       elite leg lengthens punts ~15%, a weak leg shortens them the same.
 *   <li><b>Return yards</b> on {@link PuntResult#RETURNED} scale by {@code (1 − hangScore × {@value
 *       #RETURN_ENVELOPE})} — elite hang time roughly halves the return, weak hang doubles it.
 *   <li><b>Pin-vs-touchback flip</b>: a {@link PuntResult#TOUCHBACK} from an elite-accuracy punter
 *       has a small probability of flipping to {@link PuntResult#DOWNED} at the receiver's
 *       five-yard line; a low-accuracy punter sees the inverse on {@link PuntResult#DOWNED} /
 *       {@link PuntResult#FAIR_CATCH} outcomes.
 * </ul>
 *
 * <p>Outcomes that don't depend on leg quality ({@link PuntResult#BLOCKED}, {@link
 * PuntResult#MUFFED}) pass through unchanged. Compose this above {@link EnvironmentalPuntResolver}
 * so weather still shaves the attribute-aided gross.
 */
public final class AttributeAwarePuntResolver implements PuntResolver {

  /** Maximum gross-yards multiplier shift at extreme puntPower. */
  static final double GROSS_ENVELOPE = 0.15;

  /** Maximum return-yards multiplier shift at extreme puntHangTime. */
  static final double RETURN_ENVELOPE = 0.30;

  /** Maximum probability of a touchback↔pin flip at extreme puntAccuracy. */
  static final double FLIP_ENVELOPE = 0.30;

  /** Yard line (receiver frame) where a flipped touchback gets pinned. */
  static final int PIN_YARD_LINE = 5;

  private static final ToDoubleFunction<Skill> POWER_AGGREGATE = s -> (double) s.puntPower();
  private static final ToDoubleFunction<Skill> HANG_AGGREGATE = s -> (double) s.puntHangTime();
  private static final ToDoubleFunction<Skill> ACCURACY_AGGREGATE = s -> (double) s.puntAccuracy();

  private static final PuntAttributeWeights POWER_WEIGHTS =
      new PuntAttributeWeights(0, 0, 5, 10, 60, 0, 0, 25, POWER_AGGREGATE);
  private static final PuntAttributeWeights HANG_WEIGHTS =
      new PuntAttributeWeights(0, 0, 10, 5, 50, 0, 5, 30, HANG_AGGREGATE);
  private static final PuntAttributeWeights ACCURACY_WEIGHTS =
      new PuntAttributeWeights(0, 0, 20, 5, 40, 0, 5, 30, ACCURACY_AGGREGATE);

  private final PuntResolver delegate;
  private final PuntAttributeWeights powerWeights;
  private final PuntAttributeWeights hangWeights;
  private final PuntAttributeWeights accuracyWeights;

  public AttributeAwarePuntResolver(PuntResolver delegate) {
    this(delegate, POWER_WEIGHTS, HANG_WEIGHTS, ACCURACY_WEIGHTS);
  }

  AttributeAwarePuntResolver(
      PuntResolver delegate,
      PuntAttributeWeights powerWeights,
      PuntAttributeWeights hangWeights,
      PuntAttributeWeights accuracyWeights) {
    this.delegate = Objects.requireNonNull(delegate, "delegate");
    this.powerWeights = Objects.requireNonNull(powerWeights, "powerWeights");
    this.hangWeights = Objects.requireNonNull(hangWeights, "hangWeights");
    this.accuracyWeights = Objects.requireNonNull(accuracyWeights, "accuracyWeights");
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

    var baseEvent = base.event();
    var result = baseEvent.result();
    if (result == PuntResult.BLOCKED || result == PuntResult.MUFFED) {
      return base;
    }

    var punter = lookupPunter(kickingTeam, baseEvent.punter());
    var powerScore = powerWeights.skillScore(punter);
    var hangScore = hangWeights.skillScore(punter);
    var accuracyScore = accuracyWeights.skillScore(punter);

    var losYardLine = preSnapSpot.yardLine();

    var receivingSide = kickingSide == Side.HOME ? Side.AWAY : Side.HOME;
    var keepKickingPossession = base.nextPossession() != receivingSide;
    if (keepKickingPossession) {
      return base;
    }

    var scaledGross = scaleGross(baseEvent.grossYards(), powerScore, result, losYardLine);
    var scaledReturn = scaleReturn(baseEvent.returnYards(), hangScore, result);

    var flipped = maybeFlipPin(result, accuracyScore, rng);

    return rebuild(base, scaledGross, scaledReturn, flipped, losYardLine, receivingSide);
  }

  private static int scaleGross(int gross, double powerScore, PuntResult result, int losYardLine) {
    if (result == PuntResult.TOUCHBACK || gross <= 0) {
      return gross;
    }
    var multiplier = 1.0 + powerScore * GROSS_ENVELOPE;
    var scaled = (int) Math.round(gross * multiplier);
    return Math.max(1, Math.min(99 - losYardLine, scaled));
  }

  private static int scaleReturn(int returnYards, double hangScore, PuntResult result) {
    if (result != PuntResult.RETURNED || returnYards <= 0) {
      return returnYards;
    }
    var multiplier = Math.max(0.0, 1.0 - hangScore * RETURN_ENVELOPE);
    return (int) Math.round(returnYards * multiplier);
  }

  private static PuntResult maybeFlipPin(
      PuntResult result, double accuracyScore, RandomSource rng) {
    if (accuracyScore > 0 && result == PuntResult.TOUCHBACK) {
      if (rng.nextDouble() < accuracyScore * FLIP_ENVELOPE) {
        return PuntResult.DOWNED;
      }
    } else if (accuracyScore < 0
        && (result == PuntResult.DOWNED || result == PuntResult.FAIR_CATCH)) {
      if (rng.nextDouble() < -accuracyScore * FLIP_ENVELOPE) {
        return PuntResult.TOUCHBACK;
      }
    }
    return result;
  }

  private static Resolved rebuild(
      Resolved base,
      int scaledGross,
      int scaledReturn,
      PuntResult outcome,
      int losYardLine,
      Side receivingSide) {
    var baseEvent = base.event();

    int reportedGross;
    int reportedReturn;
    int takeover;

    switch (outcome) {
      case TOUCHBACK -> {
        reportedGross = Math.max(scaledGross, 100 - losYardLine);
        reportedReturn = 0;
        takeover = 20;
      }
      case DOWNED -> {
        if (baseEvent.result() == PuntResult.TOUCHBACK) {
          // Flipped from touchback to a tight pin — lock the takeover at the 5.
          reportedGross =
              Math.max(1, Math.min(99 - losYardLine, 100 - losYardLine - PIN_YARD_LINE));
          reportedReturn = 0;
          takeover = PIN_YARD_LINE;
        } else {
          reportedGross = scaledGross;
          reportedReturn = 0;
          takeover = Math.max(1, 100 - (losYardLine + scaledGross));
        }
      }
      case FAIR_CATCH -> {
        reportedGross = scaledGross;
        reportedReturn = 0;
        takeover = Math.max(1, 100 - (losYardLine + scaledGross));
      }
      case OUT_OF_BOUNDS -> {
        reportedGross = scaledGross;
        reportedReturn = 0;
        takeover = Math.max(1, 100 - (losYardLine + scaledGross));
      }
      case RETURNED -> {
        reportedGross = scaledGross;
        reportedReturn = scaledReturn;
        var landing = 100 - (losYardLine + scaledGross);
        takeover = Math.max(1, Math.min(99, landing + scaledReturn));
      }
      default -> {
        // BLOCKED/MUFFED handled before this branch is reached, but keep the switch exhaustive.
        return base;
      }
    }

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
            reportedGross,
            baseEvent.returner(),
            reportedReturn,
            outcome);
    return new Resolved(adjusted, receivingSide, takeover);
  }

  private static Player lookupPunter(Team team, PlayerId punterId) {
    return team.roster().stream()
        .filter(p -> p.id().equals(punterId))
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("punter not on roster: " + punterId));
  }
}
