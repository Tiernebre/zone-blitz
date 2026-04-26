package app.zoneblitz.gamesimulator.injury;

import app.zoneblitz.gamesimulator.environment.Surface;
import app.zoneblitz.gamesimulator.event.InjurySeverity;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.resolver.PlayOutcome;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Multi-attribute {@link InjuryModel} calibrated to ~6–10 documented injuries per league-wide game
 * (both teams combined). The per-snap injury rate for an exposed player is:
 *
 * <pre>
 * rate = baseRate(contact)
 *      × positionMultiplier(position)
 *      × toughnessMultiplier(toughness)
 *      × physicalMultiplier(agility, strength, footballIq, contact)
 *      × surfaceMultiplier(surface)
 * </pre>
 *
 * <p><b>Base rates per contact bucket:</b> TACKLE 0.50%, SACK 0.80%, PILE 0.70%.
 *
 * <p><b>Position multipliers</b> reflect documented NFL injury concentration: RBs/FBs and QBs
 * absorb the heaviest exposure, linemen take volume contact, specialists almost never appear in
 * injury reports.
 *
 * <p><b>Toughness multiplier</b> (from {@link Tendencies#toughness}): linear — 0 → ×1.5, 50 → ×1.0,
 * 100 → ×0.5.
 *
 * <p><b>Physical multiplier</b> introduces three additional attribute axes from {@link Physical}
 * and {@link Tendencies}:
 *
 * <ul>
 *   <li>{@link Physical#agility()} — balance and evasion under contact; weighted most heavily on
 *       TACKLE exposures where absorbing and shedding hits is the primary mechanism.
 *   <li>{@link Physical#strength()} — ability to shed blockers, escape piles, and resist being
 *       driven into the turf; weighted most heavily on SACK and PILE exposures.
 *   <li>{@link Tendencies#footballIq()} — awareness proxy (anticipating hits, avoiding blindside
 *       exposure); contributes equally across all contact types.
 * </ul>
 *
 * <p>Each axis is centered to {@code [-1, +1]} (50 → 0, 0 → −1, 100 → +1). An average player across
 * all three axes scores 0 and the physical multiplier is exactly ×1.0. The combined score is
 * bounded to {@code [-1, +1]} before applying the envelope, so an extreme physical profile shifts
 * injury rate by at most {@value #PHYSICAL_ENVELOPE} (±30%) in either direction. This keeps
 * per-game injury counts inside the ~6–10 calibration band regardless of attribute extremes.
 *
 * <p><b>Surface multiplier:</b> TURF → ×1.10 (GRASS → ×1.0).
 *
 * <p><b>Severity</b> is sampled from a fixed prior: 60% PLAY, 20% DRIVE, 15% GAME_ENDING, 5%
 * MULTI_GAME.
 *
 * <p>Exposed players per snap come from the resolver outcome — ball carrier and tackler on a
 * tackle, QB and sackers on a sack, plus a small extra "pile" exposure for short-yardage runs.
 */
public final class AttributeAwareInjuryModel implements InjuryModel {

  private static final double BASE_TACKLE = 0.0050;
  private static final double BASE_SACK = 0.0080;
  private static final double BASE_PILE = 0.0070;
  private static final double TURF_MULTIPLIER = 1.10;

  /**
   * Maximum absolute injury-rate shift from the combined physical score. Bounds an extreme
   * attribute profile to ±30% relative to the toughness-adjusted rate, keeping per-game injury
   * counts inside the ~6–10 calibration band.
   */
  static final double PHYSICAL_ENVELOPE = 0.30;

  private static final double SEVERITY_PLAY_CUTOFF = 0.60;
  private static final double SEVERITY_DRIVE_CUTOFF = 0.80;
  private static final double SEVERITY_GAME_CUTOFF = 0.95;

  @Override
  public List<InjuryDraw> draw(
      PlayOutcome outcome,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      Side offenseSide,
      Surface surface,
      RandomSource rng) {
    var exposures = exposures(outcome);
    if (exposures.isEmpty()) {
      return List.of();
    }
    var draws = new ArrayList<InjuryDraw>();
    for (var exposure : exposures) {
      maybeInjure(exposure, offense, defense, offenseSide, surface, rng).ifPresent(draws::add);
    }
    return List.copyOf(draws);
  }

  private static Optional<InjuryDraw> maybeInjure(
      Exposure exposure,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      Side offenseSide,
      Surface surface,
      RandomSource rng) {
    var player = lookup(exposure.player(), offense, defense);
    if (player.isEmpty()) {
      return Optional.empty();
    }
    var p = player.get();
    var rate = baseRate(exposure.contact()) * positionMultiplier(p.position());
    rate *= toughnessMultiplier(p.tendencies().toughness());
    rate *= physicalMultiplier(p.physical(), p.tendencies(), exposure.contact());
    if (surface == Surface.TURF) {
      rate *= TURF_MULTIPLIER;
    }
    var u = uniformDouble(rng);
    if (u >= rate) {
      return Optional.empty();
    }
    var severity = sampleSeverity(uniformDouble(rng));
    var side = offensive(p, offense) ? offenseSide : other(offenseSide);
    return Optional.of(new InjuryDraw(p.id(), side, p.position(), severity));
  }

  private static double baseRate(ContactType contact) {
    return switch (contact) {
      case TACKLE -> BASE_TACKLE;
      case SACK -> BASE_SACK;
      case PILE -> BASE_PILE;
    };
  }

  /**
   * Position multipliers reflect documented NFL injury concentration: RBs and QBs absorb the
   * heaviest exposure, linemen take volume contact, specialists almost never appear in injury
   * reports.
   */
  private static double positionMultiplier(Position position) {
    return switch (position) {
      case RB, FB -> 1.40;
      case QB -> 1.30;
      case WR, TE -> 1.10;
      case OL, DL, LB -> 1.00;
      case CB, S -> 0.90;
      case K, P, LS -> 0.20;
    };
  }

  /** Linear: toughness 0 → ×1.5, toughness 50 → ×1.0, toughness 100 → ×0.5. */
  private static double toughnessMultiplier(int toughness) {
    var t = Math.max(0, Math.min(100, toughness));
    return 1.5 - (t / 100.0);
  }

  /**
   * Multi-axis physical multiplier. Three axes are combined into a weighted score in {@code [-1,
   * +1]}, then applied via a bounded multiplicative envelope:
   *
   * <ul>
   *   <li>{@link Physical#agility()} — weighted at 60% for TACKLE, 20% for SACK/PILE.
   *   <li>{@link Physical#strength()} — weighted at 20% for TACKLE, 60% for SACK/PILE.
   *   <li>{@link Tendencies#footballIq()} — 20% across all contact types (awareness / blindside
   *       avoidance).
   * </ul>
   *
   * <p>A positive score (above-average physical profile) reduces injury rate; a negative score
   * increases it. The result is clamped to {@code [1 − PHYSICAL_ENVELOPE, 1 + PHYSICAL_ENVELOPE]}.
   */
  static double physicalMultiplier(Physical physical, Tendencies tendencies, ContactType contact) {
    var agility = centered(physical.agility());
    var strength = centered(physical.strength());
    var footballIq = centered(tendencies.footballIq());

    // Contact-aware axis weights (agility, strength); iqWeight = 1 − agility − strength.
    record Weights(double agility, double strength) {}
    var w =
        switch (contact) {
          case TACKLE -> new Weights(0.60, 0.20);
          case SACK, PILE -> new Weights(0.20, 0.60);
        };
    var iqWeight = 1.0 - w.agility() - w.strength();
    var score = w.agility() * agility + w.strength() * strength + iqWeight * footballIq;
    // Clamp to [-1, +1] before applying envelope.
    score = Math.max(-1.0, Math.min(1.0, score));
    // A higher score means a physically better player → LOWER injury rate.
    return 1.0 - score * PHYSICAL_ENVELOPE;
  }

  /** Centers a 0–100 attribute value to {@code [-1, +1]}: 50 → 0, 0 → −1, 100 → +1. */
  private static double centered(int value) {
    return (value / 100.0 - 0.5) * 2.0;
  }

  private static InjurySeverity sampleSeverity(double draw) {
    if (draw < SEVERITY_PLAY_CUTOFF) {
      return InjurySeverity.PLAY;
    }
    if (draw < SEVERITY_DRIVE_CUTOFF) {
      return InjurySeverity.DRIVE;
    }
    if (draw < SEVERITY_GAME_CUTOFF) {
      return InjurySeverity.GAME_ENDING;
    }
    return InjurySeverity.MULTI_GAME;
  }

  private static List<Exposure> exposures(PlayOutcome outcome) {
    return switch (outcome) {
      case RunOutcome.Run r -> {
        var list = new ArrayList<Exposure>();
        list.add(new Exposure(r.carrier(), ContactType.TACKLE));
        r.tackler().ifPresent(t -> list.add(new Exposure(t, ContactType.TACKLE)));
        if (Math.abs(r.yards()) <= 2) {
          list.add(new Exposure(r.carrier(), ContactType.PILE));
        }
        yield list;
      }
      case PassOutcome.PassComplete c -> {
        var list = new ArrayList<Exposure>();
        list.add(new Exposure(c.target(), ContactType.TACKLE));
        c.tackler().ifPresent(t -> list.add(new Exposure(t, ContactType.TACKLE)));
        yield list;
      }
      case PassOutcome.Sack s -> {
        var list = new ArrayList<Exposure>();
        list.add(new Exposure(s.qb(), ContactType.SACK));
        for (var sacker : s.sackers()) {
          list.add(new Exposure(sacker, ContactType.SACK));
        }
        yield list;
      }
      case PassOutcome.Scramble s -> {
        var list = new ArrayList<Exposure>();
        list.add(new Exposure(s.qb(), ContactType.TACKLE));
        s.tackler().ifPresent(t -> list.add(new Exposure(t, ContactType.TACKLE)));
        yield list;
      }
      case PassOutcome.Interception i -> List.of(new Exposure(i.interceptor(), ContactType.TACKLE));
      case PassOutcome.PassIncomplete ignored -> List.of();
    };
  }

  private static Optional<Player> lookup(
      PlayerId id, OffensivePersonnel offense, DefensivePersonnel defense) {
    for (var p : offense.players()) {
      if (p.id().equals(id)) {
        return Optional.of(p);
      }
    }
    for (var p : defense.players()) {
      if (p.id().equals(id)) {
        return Optional.of(p);
      }
    }
    return Optional.empty();
  }

  private static boolean offensive(Player player, OffensivePersonnel offense) {
    for (var p : offense.players()) {
      if (p.id().equals(player.id())) {
        return true;
      }
    }
    return false;
  }

  private static Side other(Side side) {
    return side == Side.HOME ? Side.AWAY : Side.HOME;
  }

  /**
   * Build a uniform {@code [0, 1)} double from {@link RandomSource#nextLong}. Some {@link
   * RandomSource} implementations bias their first {@code nextDouble()} samples on freshly-mixed
   * seeds in a way that under-represents very small probabilities; folding the high 53 bits of a
   * {@code nextLong} into the mantissa avoids that bias and makes sub-1% draws statistically
   * honest.
   */
  private static double uniformDouble(RandomSource rng) {
    return (rng.nextLong() >>> 11) * 0x1.0p-53;
  }

  private record Exposure(PlayerId player, ContactType contact) {}
}
