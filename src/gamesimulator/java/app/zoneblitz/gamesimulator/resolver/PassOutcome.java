package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.event.FumbleOutcome;
import app.zoneblitz.gamesimulator.event.IncompleteReason;
import app.zoneblitz.gamesimulator.event.PlayerId;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/** Pass-shaped resolution results produced by a {@link PassResolver}. */
public sealed interface PassOutcome extends PlayOutcome
    permits PassOutcome.PassComplete,
        PassOutcome.PassIncomplete,
        PassOutcome.Sack,
        PassOutcome.Scramble,
        PassOutcome.Interception {

  /**
   * A completed pass. {@code totalYards = airYards + yardsAfterCatch}, raw from the resolver — the
   * engine clamps against the goal line and derives touchdowns. {@code firstDown} is provisional
   * and re-evaluated post-clamp.
   */
  record PassComplete(
      PlayerId qb,
      PlayerId target,
      int airYards,
      int yardsAfterCatch,
      int totalYards,
      Optional<PlayerId> tackler,
      List<PlayerId> defendersInCoverage,
      boolean firstDown)
      implements PassOutcome {
    public PassComplete {
      Objects.requireNonNull(qb, "qb");
      Objects.requireNonNull(target, "target");
      Objects.requireNonNull(tackler, "tackler");
      Objects.requireNonNull(defendersInCoverage, "defendersInCoverage");
      defendersInCoverage = List.copyOf(defendersInCoverage);
    }
  }

  /** An incomplete pass. */
  record PassIncomplete(
      PlayerId qb,
      PlayerId target,
      int airYards,
      IncompleteReason reason,
      Optional<PlayerId> defender)
      implements PassOutcome {
    public PassIncomplete {
      Objects.requireNonNull(qb, "qb");
      Objects.requireNonNull(target, "target");
      Objects.requireNonNull(reason, "reason");
      Objects.requireNonNull(defender, "defender");
    }
  }

  /**
   * A sack. {@code yardsLost} is a positive magnitude (yards lost behind the line of scrimmage).
   */
  record Sack(PlayerId qb, List<PlayerId> sackers, int yardsLost, Optional<FumbleOutcome> fumble)
      implements PassOutcome {
    public Sack {
      Objects.requireNonNull(qb, "qb");
      Objects.requireNonNull(sackers, "sackers");
      Objects.requireNonNull(fumble, "fumble");
      sackers = List.copyOf(sackers);
    }
  }

  /** A QB scramble. Raw {@code yards} — engine clamps and derives TD/safety. */
  record Scramble(PlayerId qb, int yards, Optional<PlayerId> tackler, boolean slideOrOob)
      implements PassOutcome {
    public Scramble {
      Objects.requireNonNull(qb, "qb");
      Objects.requireNonNull(tackler, "tackler");
    }
  }

  /**
   * A pass interception. {@code returnYards} are raw along the defender's direction (toward the
   * thrower's own goal); the engine clamps and detects pick-sixes.
   */
  record Interception(PlayerId qb, PlayerId intendedTarget, PlayerId interceptor, int returnYards)
      implements PassOutcome {
    public Interception {
      Objects.requireNonNull(qb, "qb");
      Objects.requireNonNull(intendedTarget, "intendedTarget");
      Objects.requireNonNull(interceptor, "interceptor");
    }
  }
}
