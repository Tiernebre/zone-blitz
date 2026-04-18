package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;

/**
 * Test fake {@link TargetSelector} that always picks the first route runner at depth zero. Used by
 * the R5 byte-for-byte parity test to reproduce {@link BaselinePassResolver}'s "first route runner"
 * target pick without involving the scoring formula or any RNG draws.
 */
final class FirstRouteRunnerTargetSelector implements TargetSelector {

  @Override
  public TargetChoice select(PlayCaller.PlayCall call, Roles roles, Player qb, RandomSource rng) {
    if (roles.routeRunners().isEmpty()) {
      return new TargetChoice.Throwaway();
    }
    return new TargetChoice.Throw(roles.routeRunners().get(0).id(), 0);
  }
}
