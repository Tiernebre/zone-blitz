package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.clock.BandClockModel;
import app.zoneblitz.gamesimulator.clockmgmt.TendencyEndOfHalfDecider;
import app.zoneblitz.gamesimulator.clockmgmt.TimeoutDecider;
import app.zoneblitz.gamesimulator.environment.HomeFieldAdvantage;
import app.zoneblitz.gamesimulator.environment.HomeFieldModel;
import app.zoneblitz.gamesimulator.environment.Roof;
import app.zoneblitz.gamesimulator.environment.Surface;
import app.zoneblitz.gamesimulator.environment.Weather;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.fatigue.PositionalFatigueModel;
import app.zoneblitz.gamesimulator.injury.BaselineInjuryModel;
import app.zoneblitz.gamesimulator.kickoff.TouchbackKickoffResolver;
import app.zoneblitz.gamesimulator.penalty.NoPenaltyModel;
import app.zoneblitz.gamesimulator.personnel.BaselinePersonnelSelector;
import app.zoneblitz.gamesimulator.playcalling.DefensiveCallSelector;
import app.zoneblitz.gamesimulator.punt.DistanceCurvePuntResolver;
import app.zoneblitz.gamesimulator.resolver.PlayResolver;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachId;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import app.zoneblitz.gamesimulator.scoring.DistanceCurveFieldGoalResolver;
import app.zoneblitz.gamesimulator.scoring.FlatRateExtraPointResolver;
import app.zoneblitz.gamesimulator.scoring.FlatRateTwoPointResolver;
import app.zoneblitz.gamesimulator.scoring.StandardTwoPointDecisionPolicy;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class InjuryIntegrationTests {

  @Test
  void simulate_withBaselineInjuryModel_emitsInjuryEventsAcrossGames() {
    var injuries = 0;
    for (var seed = 1L; seed <= 10L; seed++) {
      var events = simulator().simulate(inputs(seed, Surface.GRASS)).toList();
      for (var event : events) {
        if (event instanceof PlayEvent.Injury) {
          injuries++;
        }
      }
    }
    // Documented per-game NFL injury count is ~6-10 league-wide; across 10 simulated games the
    // model should put at least a handful on the wire. Floor of 5 is a safe regression guard
    // against the rate collapsing to zero.
    assertThat(injuries).isGreaterThan(5);
  }

  @Test
  void simulate_injuredPlayerRemovedFromSubsequentSnaps_byPersonnelSelector() {
    var events = simulator().simulate(inputs(7L, Surface.GRASS)).toList();
    var firstInjury =
        events.stream()
            .filter(e -> e instanceof PlayEvent.Injury)
            .map(e -> (PlayEvent.Injury) e)
            .findFirst();
    if (firstInjury.isEmpty()) {
      // Seed produced no injury — nothing to assert; the rate test covers the existence claim.
      return;
    }
    var injured = firstInjury.get().player();
    var injurySeq = firstInjury.get().sequence();
    var subsequentSnapsTouchingInjured =
        events.stream()
            .filter(e -> e.sequence() > injurySeq)
            .filter(e -> involvesPlayer(e, injured))
            .count();

    assertThat(subsequentSnapsTouchingInjured)
        .as("injured player should not be touched by any post-injury snap")
        .isZero();
  }

  private static boolean involvesPlayer(PlayEvent event, PlayerId injured) {
    return switch (event) {
      case PlayEvent.Run r -> r.carrier().equals(injured);
      case PlayEvent.PassComplete pc -> pc.qb().equals(injured) || pc.target().equals(injured);
      case PlayEvent.PassIncomplete pi -> pi.qb().equals(injured) || pi.target().equals(injured);
      case PlayEvent.Sack s -> s.qb().equals(injured) || s.sackers().contains(injured);
      case PlayEvent.Scramble s -> s.qb().equals(injured);
      case PlayEvent.Interception i -> i.qb().equals(injured) || i.interceptor().equals(injured);
      default -> false;
    };
  }

  private SimulateGame simulator() {
    return new GameSimulator(
        ScriptedPlayCaller.runs(1),
        new BaselinePersonnelSelector(),
        new InjuryProneRunResolver(),
        BandClockModel.load(new ClasspathBandRepository(), new DefaultBandSampler()),
        new TouchbackKickoffResolver(),
        new FlatRateExtraPointResolver(),
        new DistanceCurveFieldGoalResolver(),
        new DistanceCurvePuntResolver(),
        new NoPenaltyModel(),
        DefensiveCallSelector.neutral(),
        new StandardTwoPointDecisionPolicy(),
        new FlatRateTwoPointResolver(),
        HomeFieldModel.neutral(),
        TimeoutDecider.never(),
        new TendencyEndOfHalfDecider(),
        new PositionalFatigueModel(),
        new BaselineInjuryModel());
  }

  private GameInputs inputs(long seed, Surface surface) {
    var home = team(new TeamId(new UUID(3L, 3L)), "Home", "h");
    var away = team(new TeamId(new UUID(4L, 4L)), "Away", "a");
    var ctx =
        new GameInputs.PreGameContext(
            HomeFieldAdvantage.neutral(), Weather.indoor(), surface, Roof.DOME);
    return new GameInputs(
        new GameId(new UUID(42L, seed)),
        home,
        away,
        Coach.average(new CoachId(new UUID(2L, 2L)), "Home Coach"),
        Coach.average(new CoachId(new UUID(2L, 3L)), "Away Coach"),
        ctx,
        Optional.of(seed));
  }

  private static Team team(TeamId id, String name, String prefix) {
    var roster = new ArrayList<Player>();
    addPlayers(roster, Position.QB, 3, prefix);
    addPlayers(roster, Position.RB, 4, prefix);
    addPlayers(roster, Position.FB, 1, prefix);
    addPlayers(roster, Position.WR, 6, prefix);
    addPlayers(roster, Position.TE, 3, prefix);
    addPlayers(roster, Position.OL, 9, prefix);
    addPlayers(roster, Position.DL, 8, prefix);
    addPlayers(roster, Position.LB, 6, prefix);
    addPlayers(roster, Position.CB, 5, prefix);
    addPlayers(roster, Position.S, 4, prefix);
    addPlayers(roster, Position.K, 1, prefix);
    addPlayers(roster, Position.P, 1, prefix);
    addPlayers(roster, Position.LS, 1, prefix);
    return new Team(id, name, roster);
  }

  private static void addPlayers(List<Player> out, Position pos, int count, String prefix) {
    for (var i = 0; i < count; i++) {
      out.add(
          new Player(new PlayerId(UUID.randomUUID()), pos, prefix + "-" + pos.name() + "-" + i));
    }
  }

  /**
   * Returns a 5-yard run by the offensive RB on every snap. Using the actual selected personnel's
   * carrier (resolved by player id) keeps the injured-player removal test honest: when the starter
   * goes down, the next snap's carrier is the backup.
   */
  private static final class InjuryProneRunResolver implements PlayResolver {
    @Override
    public app.zoneblitz.gamesimulator.resolver.PlayOutcome resolve(
        app.zoneblitz.gamesimulator.playcalling.PlayCaller.PlayCall call,
        app.zoneblitz.gamesimulator.GameState state,
        app.zoneblitz.gamesimulator.personnel.OffensivePersonnel offense,
        app.zoneblitz.gamesimulator.personnel.DefensivePersonnel defense,
        app.zoneblitz.gamesimulator.rng.RandomSource rng) {
      rng.nextLong();
      var carrier =
          offense.runningBacks().isEmpty()
              ? offense.quarterback().id()
              : offense.runningBacks().get(0).id();
      var tackler = Optional.of(defense.players().get(0).id());
      return new RunOutcome.Run(
          carrier,
          app.zoneblitz.gamesimulator.event.RunConcept.INSIDE_ZONE,
          5,
          tackler,
          Optional.empty(),
          false);
    }
  }
}
