package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.event.FumbleOutcome;
import app.zoneblitz.gamesimulator.event.IncompleteReason;
import app.zoneblitz.gamesimulator.event.PlayerId;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Intermediate resolution result produced by a {@link PlayResolver}, before penalty decisions,
 * clock advancement, and {@link app.zoneblitz.gamesimulator.event.PlayEvent} assembly.
 *
 * <p>Mirrors the pass-related variants of {@link app.zoneblitz.gamesimulator.event.PlayEvent} minus
 * the common headers (id, gameId, sequence, pre-snap state, clock, score). The engine stamps those
 * headers when lifting the outcome into a {@code PlayEvent}.
 *
 * <p>R1 introduces only pass-related variants; run, kick, and special-teams outcomes are added in
 * later tasks.
 */
public sealed interface PlayOutcome
    permits PlayOutcome.PassComplete,
        PlayOutcome.PassIncomplete,
        PlayOutcome.Sack,
        PlayOutcome.Scramble,
        PlayOutcome.Interception {

  /** A completed pass. {@code totalYards = airYards + yardsAfterCatch}. */
  record PassComplete(
      PlayerId qb,
      PlayerId target,
      int airYards,
      int yardsAfterCatch,
      int totalYards,
      Optional<PlayerId> tackler,
      List<PlayerId> defendersInCoverage,
      boolean touchdown,
      boolean firstDown)
      implements PlayOutcome {
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
      implements PlayOutcome {
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
      implements PlayOutcome {
    public Sack {
      Objects.requireNonNull(qb, "qb");
      Objects.requireNonNull(sackers, "sackers");
      Objects.requireNonNull(fumble, "fumble");
      sackers = List.copyOf(sackers);
    }
  }

  /** A QB scramble. */
  record Scramble(
      PlayerId qb, int yards, Optional<PlayerId> tackler, boolean slideOrOob, boolean touchdown)
      implements PlayOutcome {
    public Scramble {
      Objects.requireNonNull(qb, "qb");
      Objects.requireNonNull(tackler, "tackler");
    }
  }

  /** A pass interception. */
  record Interception(
      PlayerId qb,
      PlayerId intendedTarget,
      PlayerId interceptor,
      int returnYards,
      boolean touchdown)
      implements PlayOutcome {
    public Interception {
      Objects.requireNonNull(qb, "qb");
      Objects.requireNonNull(intendedTarget, "intendedTarget");
      Objects.requireNonNull(interceptor, "interceptor");
    }
  }
}
