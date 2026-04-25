package app.zoneblitz.gamesimulator.scoring;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;

/**
 * Decides whether the scoring team should attempt a two-point conversion or kick the extra point
 * after a touchdown. Implementations may consult the scoring coach (for {@link
 * Coach#quality()}-driven chart adherence) and the supplied {@link RandomSource}, so two
 * invocations with equal inputs but different RNG draws may disagree — callers should pass a
 * deterministic split from the root RNG if reproducibility is required.
 */
public interface TwoPointDecisionPolicy {

  /**
   * @param scoreBeforeTry the running score with the touchdown's six points already applied but no
   *     try-point applied yet
   * @param scoringSide the side that just scored the touchdown
   * @param clockAfterTd clock snapshot taken immediately after the touchdown
   * @param scoringCoach the coach of the scoring team (consulted for decision-quality blending)
   * @param rng deterministic RNG; consulted when the policy probabilistically blends chart
   *     adherence against coach quality
   * @return {@code true} iff the scoring team should go for two; {@code false} means kick the PAT
   */
  boolean goForTwo(
      Score scoreBeforeTry,
      Side scoringSide,
      GameClock clockAfterTd,
      Coach scoringCoach,
      RandomSource rng);
}
