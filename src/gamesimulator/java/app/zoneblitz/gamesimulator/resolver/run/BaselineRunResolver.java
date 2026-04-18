package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.band.BandSampler;
import app.zoneblitz.gamesimulator.band.DistributionalBand;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Baseline run resolver: samples rushing yardage from {@code bands.overall} in {@code
 * rushing-plays.json} with {@code matchupShift = 0}.
 *
 * <p>Carrier selection uses placeholder first-matching-position logic (RB → FB → QB). Fumble,
 * touchdown, and first-down are constants ({@code empty}/{@code false}) — field advancement, fumble
 * probability, and TD/first-down math are deferred until field-position state is wired. All runs
 * are stamped with a single baseline {@link RunConcept}; concept-specific distributions will follow
 * when offensive scheme attributes land.
 */
public final class BaselineRunResolver implements RunResolver {

  private static final String RUSHING_PLAYS = "rushing-plays.json";

  private final BandSampler sampler;
  private final DistributionalBand overallYards;

  public BaselineRunResolver(BandSampler sampler, DistributionalBand overallYards) {
    this.sampler = Objects.requireNonNull(sampler, "sampler");
    this.overallYards = Objects.requireNonNull(overallYards, "overallYards");
  }

  /** Load a resolver from {@code rushing-plays.json} on the classpath. */
  public static BaselineRunResolver load(BandRepository repo, BandSampler sampler) {
    var overallYards = repo.loadDistribution(RUSHING_PLAYS, "bands.overall");
    return new BaselineRunResolver(sampler, overallYards);
  }

  @Override
  public RunOutcome resolve(
      PlayCaller.PlayCall call,
      GameState state,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      RandomSource rng) {
    Objects.requireNonNull(call, "call");
    Objects.requireNonNull(state, "state");
    Objects.requireNonNull(offense, "offense");
    Objects.requireNonNull(defense, "defense");
    Objects.requireNonNull(rng, "rng");

    var carrier = pickCarrier(offense.players());
    var yards = sampler.sampleDistribution(overallYards, 0.0, rng);
    return new RunOutcome.Run(
        carrier, call.runConcept(), yards, Optional.empty(), Optional.empty(), false, false);
  }

  private static PlayerId pickCarrier(List<Player> players) {
    for (var pos : new Position[] {Position.RB, Position.FB, Position.QB}) {
      var p = firstWithPosition(players, pos);
      if (p.isPresent()) {
        return p.get();
      }
    }
    throw new IllegalStateException("no rushing-eligible player in personnel");
  }

  private static Optional<PlayerId> firstWithPosition(List<Player> players, Position position) {
    return players.stream().filter(p -> p.position() == position).map(Player::id).findFirst();
  }
}
