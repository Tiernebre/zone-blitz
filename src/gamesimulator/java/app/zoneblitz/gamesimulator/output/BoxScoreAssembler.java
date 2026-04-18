package app.zoneblitz.gamesimulator.output;

import app.zoneblitz.gamesimulator.event.FieldGoalResult;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.FumbleOutcome;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.IncompleteReason;
import app.zoneblitz.gamesimulator.event.PatResult;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.PuntResult;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.TeamId;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Default {@link StatsAssembler} implementation. Pure fold over {@link PlayEvent}. Each {@link
 * StatsProjection#apply} returns a fresh immutable projection; in-event work is done on short-lived
 * mutable scratch that never escapes the fold step.
 */
public final class BoxScoreAssembler implements StatsAssembler {

  @Override
  public GameStats finalize(GameId game, TeamAssignment assignment, Stream<PlayEvent> events) {
    Objects.requireNonNull(game, "game");
    Objects.requireNonNull(assignment, "assignment");
    Objects.requireNonNull(events, "events");
    StatsProjection projection = incremental(game, assignment);
    var iterator = events.iterator();
    while (iterator.hasNext()) {
      projection = projection.apply(iterator.next());
    }
    return projection.snapshot();
  }

  @Override
  public StatsProjection incremental(GameId game, TeamAssignment assignment) {
    Objects.requireNonNull(game, "game");
    Objects.requireNonNull(assignment, "assignment");
    return Projection.empty(game, assignment);
  }

  record Projection(
      GameId game,
      TeamAssignment assignment,
      Map<PlayerId, PlayerGameStats> players,
      Score lastScore,
      List<DriveStats> completedDrives,
      Optional<DriveInProgress> openDrive,
      int homePlays,
      int awayPlays,
      int homeFirstDowns,
      int awayFirstDowns,
      int homeTurnovers,
      int awayTurnovers,
      int homeSacksFor,
      int awaySacksFor)
      implements StatsProjection {

    static Projection empty(GameId game, TeamAssignment assignment) {
      return new Projection(
          game,
          assignment,
          Map.of(),
          new Score(0, 0),
          List.of(),
          Optional.empty(),
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0);
    }

    @Override
    public StatsProjection apply(PlayEvent event) {
      Objects.requireNonNull(event, "event");
      return Folder.fold(this, event);
    }

    @Override
    public GameStats snapshot() {
      var allDrives = new ArrayList<>(completedDrives);
      openDrive.ifPresent(d -> allDrives.add(d.close(DriveResult.END_OF_GAME)));

      var homePass = 0;
      var awayPass = 0;
      var homeRush = 0;
      var awayRush = 0;
      var homePen = 0;
      var awayPen = 0;
      var homePenYds = 0;
      var awayPenYds = 0;
      var homeSacksAgainst = 0;
      var awaySacksAgainst = 0;
      for (var line : players.values()) {
        if (line.team().isEmpty()) {
          continue;
        }
        var tid = line.team().get();
        if (tid.equals(assignment.home())) {
          homePass += line.passYards();
          homeRush += line.rushYards();
          homePen += line.penalties();
          homePenYds += line.penaltyYards();
          homeSacksAgainst += line.sackYardsLost();
        } else if (tid.equals(assignment.away())) {
          awayPass += line.passYards();
          awayRush += line.rushYards();
          awayPen += line.penalties();
          awayPenYds += line.penaltyYards();
          awaySacksAgainst += line.sackYardsLost();
        }
      }

      var home =
          new TeamGameStats(
              assignment.home(),
              game,
              lastScore.home(),
              homePass + homeRush,
              homePass,
              homeRush,
              homeFirstDowns,
              0,
              0,
              0,
              0,
              homePen,
              homePenYds,
              homeTurnovers,
              homeSacksFor,
              homeSacksAgainst,
              Duration.ZERO,
              0,
              0,
              homePlays);
      var away =
          new TeamGameStats(
              assignment.away(),
              game,
              lastScore.away(),
              awayPass + awayRush,
              awayPass,
              awayRush,
              awayFirstDowns,
              0,
              0,
              0,
              0,
              awayPen,
              awayPenYds,
              awayTurnovers,
              awaySacksFor,
              awaySacksAgainst,
              Duration.ZERO,
              0,
              0,
              awayPlays);
      return new GameStats(game, home, away, players, List.copyOf(allDrives));
    }
  }

  record DriveInProgress(
      TeamId offense,
      GameId game,
      int startSequence,
      FieldPosition startSpot,
      int endSequence,
      FieldPosition endSpot,
      int plays,
      int yards) {

    DriveInProgress addPlay(int sequence, FieldPosition endSpot, int yards) {
      return new DriveInProgress(
          offense,
          game,
          startSequence,
          startSpot,
          sequence,
          endSpot,
          plays + 1,
          this.yards + yards);
    }

    DriveStats close(DriveResult result) {
      return new DriveStats(
          game,
          offense,
          startSequence,
          endSequence,
          startSpot,
          endSpot,
          plays,
          yards,
          Duration.ZERO,
          result);
    }
  }

  static final class Folder {
    private Folder() {}

    static Projection fold(Projection p, PlayEvent event) {
      var players = new HashMap<>(p.players());
      var acc = new Accumulator(players, p.game(), p.assignment());

      var offenseTeam = Optional.<TeamId>empty();
      var yardsGained = 0;
      var endSpot = event.preSnapSpot();
      var driveEnder = Optional.<DriveResult>empty();
      var countAsPlay = true;
      var firstDown = false;
      var sacksForHomeDelta = 0;
      var sacksForAwayDelta = 0;
      var turnoversHomeDelta = 0;
      var turnoversAwayDelta = 0;

      switch (event) {
        case PlayEvent.PassComplete pc -> {
          acc.passComplete(pc);
          offenseTeam = acc.teamOf(pc.qb());
          yardsGained = pc.totalYards();
          endSpot = pc.endSpot();
          firstDown = pc.firstDown();
          if (pc.touchdown()) {
            driveEnder = Optional.of(DriveResult.TD);
          }
        }
        case PlayEvent.PassIncomplete pi -> {
          acc.passIncomplete(pi);
          offenseTeam = acc.teamOf(pi.qb());
        }
        case PlayEvent.Sack s -> {
          acc.sack(s);
          offenseTeam = acc.teamOf(s.qb());
          yardsGained = -s.yardsLost();
          if (offenseTeam.isPresent()) {
            if (offenseTeam.get().equals(p.assignment().home())) {
              sacksForAwayDelta++;
            } else if (offenseTeam.get().equals(p.assignment().away())) {
              sacksForHomeDelta++;
            }
          }
          if (s.fumble().isPresent() && s.fumble().get().defenseRecovered()) {
            driveEnder = Optional.of(DriveResult.FUMBLE);
            if (offenseTeam.isPresent()) {
              if (offenseTeam.get().equals(p.assignment().home())) {
                turnoversHomeDelta++;
              } else if (offenseTeam.get().equals(p.assignment().away())) {
                turnoversAwayDelta++;
              }
            }
          }
        }
        case PlayEvent.Scramble sc -> {
          acc.scramble(sc);
          offenseTeam = acc.teamOf(sc.qb());
          yardsGained = sc.yards();
          endSpot = sc.endSpot();
          if (sc.touchdown()) {
            driveEnder = Optional.of(DriveResult.TD);
          }
        }
        case PlayEvent.Interception in -> {
          acc.interception(in);
          offenseTeam = acc.teamOf(in.qb());
          endSpot = in.endSpot();
          driveEnder = Optional.of(DriveResult.INT);
          if (offenseTeam.isPresent()) {
            if (offenseTeam.get().equals(p.assignment().home())) {
              turnoversHomeDelta++;
            } else if (offenseTeam.get().equals(p.assignment().away())) {
              turnoversAwayDelta++;
            }
          }
        }
        case PlayEvent.Run r -> {
          acc.run(r);
          offenseTeam = acc.teamOf(r.carrier());
          yardsGained = r.yards();
          endSpot = r.endSpot();
          firstDown = r.firstDown();
          if (r.touchdown()) {
            driveEnder = Optional.of(DriveResult.TD);
          } else if (r.fumble().isPresent() && r.fumble().get().defenseRecovered()) {
            driveEnder = Optional.of(DriveResult.FUMBLE);
            if (offenseTeam.isPresent()) {
              if (offenseTeam.get().equals(p.assignment().home())) {
                turnoversHomeDelta++;
              } else if (offenseTeam.get().equals(p.assignment().away())) {
                turnoversAwayDelta++;
              }
            }
          }
        }
        case PlayEvent.FieldGoalAttempt fg -> {
          acc.fieldGoal(fg);
          offenseTeam = acc.teamOf(fg.kicker());
          driveEnder =
              Optional.of(
                  fg.result() == FieldGoalResult.GOOD ? DriveResult.FG : DriveResult.MISSED_FG);
        }
        case PlayEvent.ExtraPoint xp -> {
          acc.extraPoint(xp);
          countAsPlay = false;
        }
        case PlayEvent.TwoPointAttempt tp -> countAsPlay = false;
        case PlayEvent.Punt pu -> {
          acc.punt(pu);
          offenseTeam = acc.teamOf(pu.punter());
          driveEnder = Optional.of(DriveResult.PUNT);
        }
        case PlayEvent.Kickoff ko -> {
          acc.kickoff(ko);
          countAsPlay = false;
        }
        case PlayEvent.Penalty pen -> {
          acc.penalty(pen);
          offenseTeam = Optional.of(p.assignment().teamFor(pen.against()));
          countAsPlay = false;
        }
        case PlayEvent.Kneel k -> countAsPlay = false;
        case PlayEvent.Spike sp -> countAsPlay = false;
        case PlayEvent.Timeout t -> countAsPlay = false;
        case PlayEvent.TwoMinuteWarning w -> countAsPlay = false;
        case PlayEvent.EndOfQuarter eq -> {
          countAsPlay = false;
          if (eq.quarter() == 2) {
            driveEnder = Optional.of(DriveResult.END_OF_HALF);
          } else if (eq.quarter() >= 4) {
            driveEnder = Optional.of(DriveResult.END_OF_GAME);
          }
        }
      }

      var completed = new ArrayList<>(p.completedDrives());
      var open = p.openDrive();
      if (countAsPlay && offenseTeam.isPresent()) {
        if (open.isEmpty() || !open.get().offense().equals(offenseTeam.get())) {
          if (open.isPresent()) {
            completed.add(open.get().close(DriveResult.TURNOVER_ON_DOWNS));
          }
          open =
              Optional.of(
                  new DriveInProgress(
                      offenseTeam.get(),
                      p.game(),
                      event.sequence(),
                      event.preSnapSpot(),
                      event.sequence(),
                      endSpot,
                      1,
                      yardsGained));
        } else {
          open = Optional.of(open.get().addPlay(event.sequence(), endSpot, yardsGained));
        }
      }
      if (driveEnder.isPresent() && open.isPresent()) {
        completed.add(open.get().close(driveEnder.get()));
        open = Optional.empty();
      }

      var homePlays = p.homePlays();
      var awayPlays = p.awayPlays();
      if (countAsPlay && offenseTeam.isPresent()) {
        if (offenseTeam.get().equals(p.assignment().home())) {
          homePlays++;
        } else if (offenseTeam.get().equals(p.assignment().away())) {
          awayPlays++;
        }
      }

      var homeFirstDowns = p.homeFirstDowns();
      var awayFirstDowns = p.awayFirstDowns();
      if (firstDown && offenseTeam.isPresent()) {
        if (offenseTeam.get().equals(p.assignment().home())) {
          homeFirstDowns++;
        } else if (offenseTeam.get().equals(p.assignment().away())) {
          awayFirstDowns++;
        }
      }

      return new Projection(
          p.game(),
          p.assignment(),
          Map.copyOf(players),
          event.scoreAfter(),
          List.copyOf(completed),
          open,
          homePlays,
          awayPlays,
          homeFirstDowns,
          awayFirstDowns,
          p.homeTurnovers() + turnoversHomeDelta,
          p.awayTurnovers() + turnoversAwayDelta,
          p.homeSacksFor() + sacksForHomeDelta,
          p.awaySacksFor() + sacksForAwayDelta);
    }
  }

  private static final class Accumulator {
    private final Map<PlayerId, PlayerGameStats> players;
    private final GameId game;
    private final TeamAssignment assignment;

    Accumulator(Map<PlayerId, PlayerGameStats> players, GameId game, TeamAssignment assignment) {
      this.players = players;
      this.game = game;
      this.assignment = assignment;
    }

    Optional<TeamId> teamOf(PlayerId pid) {
      return Optional.ofNullable(assignment.playerTeam().get(pid));
    }

    private PlayerGameStats line(PlayerId pid) {
      return players.computeIfAbsent(pid, id -> PlayerGameStats.empty(id, game, teamOf(id)));
    }

    private void update(PlayerId pid, LineUpdate update) {
      var before = line(pid);
      players.put(pid, update.apply(before));
    }

    void passComplete(PlayEvent.PassComplete pc) {
      update(
          pc.qb(),
          l ->
              with(
                  l,
                  b ->
                      b.passAttempts(l.passAttempts() + 1)
                          .passCompletions(l.passCompletions() + 1)
                          .passYards(l.passYards() + pc.totalYards())
                          .passTds(l.passTds() + (pc.touchdown() ? 1 : 0))
                          .longestCompletion(Math.max(l.longestCompletion(), pc.totalYards()))));
      update(
          pc.target(),
          l ->
              with(
                  l,
                  b ->
                      b.targets(l.targets() + 1)
                          .receptions(l.receptions() + 1)
                          .recYards(l.recYards() + pc.totalYards())
                          .recTds(l.recTds() + (pc.touchdown() ? 1 : 0))
                          .longestReception(Math.max(l.longestReception(), pc.totalYards()))
                          .yardsAfterCatch(l.yardsAfterCatch() + pc.yardsAfterCatch())));
    }

    void passIncomplete(PlayEvent.PassIncomplete pi) {
      update(pi.qb(), l -> with(l, b -> b.passAttempts(l.passAttempts() + 1)));
      update(
          pi.target(),
          l ->
              with(
                  l,
                  b ->
                      b.targets(l.targets() + 1)
                          .drops(l.drops() + (pi.reason() == IncompleteReason.DROPPED ? 1 : 0))));
      if (pi.reason() == IncompleteReason.BROKEN_UP && pi.defender().isPresent()) {
        update(pi.defender().get(), l -> with(l, b -> b.passesDefensed(l.passesDefensed() + 1)));
      }
    }

    void sack(PlayEvent.Sack s) {
      update(
          s.qb(),
          l ->
              with(
                  l,
                  b ->
                      b.sacksTaken(l.sacksTaken() + 1)
                          .sackYardsLost(l.sackYardsLost() + s.yardsLost())));
      var share = s.sackers().isEmpty() ? 0.0 : 1.0 / s.sackers().size();
      for (var sacker : s.sackers()) {
        update(sacker, l -> with(l, b -> b.sacks(l.sacks() + share)));
      }
      applyFumble(s.fumble(), s.qb());
    }

    void scramble(PlayEvent.Scramble sc) {
      update(
          sc.qb(),
          l ->
              with(
                  l,
                  b ->
                      b.rushAttempts(l.rushAttempts() + 1)
                          .rushYards(l.rushYards() + sc.yards())
                          .rushTds(l.rushTds() + (sc.touchdown() ? 1 : 0))
                          .longestRush(Math.max(l.longestRush(), sc.yards()))));
    }

    void interception(PlayEvent.Interception in) {
      update(
          in.qb(),
          l ->
              with(
                  l,
                  b -> b.passAttempts(l.passAttempts() + 1).interceptions(l.interceptions() + 1)));
      update(in.intendedTarget(), l -> with(l, b -> b.targets(l.targets() + 1)));
      update(
          in.interceptor(),
          l ->
              with(
                  l,
                  b ->
                      b.defInterceptions(l.defInterceptions() + 1)
                          .intReturnYards(l.intReturnYards() + in.returnYards())
                          .intTds(l.intTds() + (in.touchdown() ? 1 : 0))));
    }

    void run(PlayEvent.Run r) {
      update(
          r.carrier(),
          l ->
              with(
                  l,
                  b ->
                      b.rushAttempts(l.rushAttempts() + 1)
                          .rushYards(l.rushYards() + r.yards())
                          .rushTds(l.rushTds() + (r.touchdown() ? 1 : 0))
                          .longestRush(Math.max(l.longestRush(), r.yards()))));
      applyFumble(r.fumble(), r.carrier());
    }

    void fieldGoal(PlayEvent.FieldGoalAttempt fg) {
      var made = fg.result() == FieldGoalResult.GOOD;
      var blocked = fg.result() == FieldGoalResult.BLOCKED;
      update(
          fg.kicker(),
          l ->
              with(
                  l,
                  b ->
                      b.fgAttempts(l.fgAttempts() + 1)
                          .fgMade(l.fgMade() + (made ? 1 : 0))
                          .longestFg(made ? Math.max(l.longestFg(), fg.distance()) : l.longestFg())
                          .blockedKicks(l.blockedKicks() + (blocked ? 1 : 0))));
    }

    void extraPoint(PlayEvent.ExtraPoint xp) {
      var made = xp.result() == PatResult.GOOD;
      var blocked = xp.result() == PatResult.BLOCKED;
      update(
          xp.kicker(),
          l ->
              with(
                  l,
                  b ->
                      b.xpAttempts(l.xpAttempts() + 1)
                          .xpMade(l.xpMade() + (made ? 1 : 0))
                          .blockedKicks(l.blockedKicks() + (blocked ? 1 : 0))));
    }

    void punt(PlayEvent.Punt pu) {
      update(
          pu.punter(),
          l ->
              with(
                  l,
                  b ->
                      b.punts(l.punts() + 1)
                          .puntYards(l.puntYards() + pu.grossYards())
                          .puntTouchbacks(
                              l.puntTouchbacks() + (pu.result() == PuntResult.TOUCHBACK ? 1 : 0))));
      if (pu.returner().isPresent()) {
        var r = pu.returner().get();
        update(
            r,
            l ->
                with(
                    l,
                    b ->
                        b.puntReturns(l.puntReturns() + 1)
                            .puntReturnYards(l.puntReturnYards() + pu.returnYards())));
        if (pu.result() == PuntResult.MUFFED) {
          update(r, l -> with(l, b -> b.fumbles(l.fumbles() + 1)));
        }
      }
    }

    void kickoff(PlayEvent.Kickoff ko) {
      if (ko.returner().isPresent()) {
        update(
            ko.returner().get(),
            l ->
                with(
                    l,
                    b ->
                        b.kickReturns(l.kickReturns() + 1)
                            .kickReturnYards(l.kickReturnYards() + ko.returnYards())));
      }
    }

    void penalty(PlayEvent.Penalty pen) {
      update(
          pen.committedBy(),
          l ->
              with(
                  l,
                  b ->
                      b.penalties(l.penalties() + 1).penaltyYards(l.penaltyYards() + pen.yards())));
    }

    private void applyFumble(Optional<FumbleOutcome> maybe, PlayerId fumbler) {
      if (maybe.isEmpty()) {
        return;
      }
      var f = maybe.get();
      update(
          fumbler,
          l ->
              with(
                  l,
                  b ->
                      b.fumbles(l.fumbles() + 1)
                          .fumblesLost(l.fumblesLost() + (f.defenseRecovered() ? 1 : 0))));
      if (f.recoveredBy().isPresent()) {
        update(
            f.recoveredBy().get(),
            l ->
                with(
                    l,
                    b ->
                        b.fumbleRecoveries(l.fumbleRecoveries() + 1)
                            .fumbleReturnYards(l.fumbleReturnYards() + f.returnYards())));
      }
    }
  }

  @FunctionalInterface
  private interface LineUpdate {
    PlayerGameStats apply(PlayerGameStats before);
  }

  @FunctionalInterface
  private interface Change {
    LineBuilder apply(LineBuilder b);
  }

  private static PlayerGameStats with(PlayerGameStats line, Change change) {
    return change.apply(new LineBuilder(line)).build();
  }

  /** Mutable field-wise builder over an existing {@link PlayerGameStats}. Never leaves package. */
  private static final class LineBuilder {
    private final PlayerGameStats base;
    private int passAttempts;
    private int passCompletions;
    private int passYards;
    private int passTds;
    private int interceptions;
    private int sacksTaken;
    private int sackYardsLost;
    private int longestCompletion;
    private int rushAttempts;
    private int rushYards;
    private int rushTds;
    private int longestRush;
    private int fumbles;
    private int fumblesLost;
    private int targets;
    private int receptions;
    private int recYards;
    private int recTds;
    private int longestReception;
    private int yardsAfterCatch;
    private int drops;
    private double sacks;
    private int passesDefensed;
    private int defInterceptions;
    private int intReturnYards;
    private int intTds;
    private int fumbleRecoveries;
    private int fumbleReturnYards;
    private int fgAttempts;
    private int fgMade;
    private int longestFg;
    private int xpAttempts;
    private int xpMade;
    private int blockedKicks;
    private int punts;
    private int puntYards;
    private int puntTouchbacks;
    private int kickReturns;
    private int kickReturnYards;
    private int puntReturns;
    private int puntReturnYards;
    private int penalties;
    private int penaltyYards;

    LineBuilder(PlayerGameStats base) {
      this.base = base;
      this.passAttempts = base.passAttempts();
      this.passCompletions = base.passCompletions();
      this.passYards = base.passYards();
      this.passTds = base.passTds();
      this.interceptions = base.interceptions();
      this.sacksTaken = base.sacksTaken();
      this.sackYardsLost = base.sackYardsLost();
      this.longestCompletion = base.longestCompletion();
      this.rushAttempts = base.rushAttempts();
      this.rushYards = base.rushYards();
      this.rushTds = base.rushTds();
      this.longestRush = base.longestRush();
      this.fumbles = base.fumbles();
      this.fumblesLost = base.fumblesLost();
      this.targets = base.targets();
      this.receptions = base.receptions();
      this.recYards = base.recYards();
      this.recTds = base.recTds();
      this.longestReception = base.longestReception();
      this.yardsAfterCatch = base.yardsAfterCatch();
      this.drops = base.drops();
      this.sacks = base.sacks();
      this.passesDefensed = base.passesDefensed();
      this.defInterceptions = base.defInterceptions();
      this.intReturnYards = base.intReturnYards();
      this.intTds = base.intTds();
      this.fumbleRecoveries = base.fumbleRecoveries();
      this.fumbleReturnYards = base.fumbleReturnYards();
      this.fgAttempts = base.fgAttempts();
      this.fgMade = base.fgMade();
      this.longestFg = base.longestFg();
      this.xpAttempts = base.xpAttempts();
      this.xpMade = base.xpMade();
      this.blockedKicks = base.blockedKicks();
      this.punts = base.punts();
      this.puntYards = base.puntYards();
      this.puntTouchbacks = base.puntTouchbacks();
      this.kickReturns = base.kickReturns();
      this.kickReturnYards = base.kickReturnYards();
      this.puntReturns = base.puntReturns();
      this.puntReturnYards = base.puntReturnYards();
      this.penalties = base.penalties();
      this.penaltyYards = base.penaltyYards();
    }

    LineBuilder passAttempts(int v) {
      passAttempts = v;
      return this;
    }

    LineBuilder passCompletions(int v) {
      passCompletions = v;
      return this;
    }

    LineBuilder passYards(int v) {
      passYards = v;
      return this;
    }

    LineBuilder passTds(int v) {
      passTds = v;
      return this;
    }

    LineBuilder interceptions(int v) {
      interceptions = v;
      return this;
    }

    LineBuilder sacksTaken(int v) {
      sacksTaken = v;
      return this;
    }

    LineBuilder sackYardsLost(int v) {
      sackYardsLost = v;
      return this;
    }

    LineBuilder longestCompletion(int v) {
      longestCompletion = v;
      return this;
    }

    LineBuilder rushAttempts(int v) {
      rushAttempts = v;
      return this;
    }

    LineBuilder rushYards(int v) {
      rushYards = v;
      return this;
    }

    LineBuilder rushTds(int v) {
      rushTds = v;
      return this;
    }

    LineBuilder longestRush(int v) {
      longestRush = v;
      return this;
    }

    LineBuilder fumbles(int v) {
      fumbles = v;
      return this;
    }

    LineBuilder fumblesLost(int v) {
      fumblesLost = v;
      return this;
    }

    LineBuilder targets(int v) {
      targets = v;
      return this;
    }

    LineBuilder receptions(int v) {
      receptions = v;
      return this;
    }

    LineBuilder recYards(int v) {
      recYards = v;
      return this;
    }

    LineBuilder recTds(int v) {
      recTds = v;
      return this;
    }

    LineBuilder longestReception(int v) {
      longestReception = v;
      return this;
    }

    LineBuilder yardsAfterCatch(int v) {
      yardsAfterCatch = v;
      return this;
    }

    LineBuilder drops(int v) {
      drops = v;
      return this;
    }

    LineBuilder sacks(double v) {
      sacks = v;
      return this;
    }

    LineBuilder passesDefensed(int v) {
      passesDefensed = v;
      return this;
    }

    LineBuilder defInterceptions(int v) {
      defInterceptions = v;
      return this;
    }

    LineBuilder intReturnYards(int v) {
      intReturnYards = v;
      return this;
    }

    LineBuilder intTds(int v) {
      intTds = v;
      return this;
    }

    LineBuilder fumbleRecoveries(int v) {
      fumbleRecoveries = v;
      return this;
    }

    LineBuilder fumbleReturnYards(int v) {
      fumbleReturnYards = v;
      return this;
    }

    LineBuilder fgAttempts(int v) {
      fgAttempts = v;
      return this;
    }

    LineBuilder fgMade(int v) {
      fgMade = v;
      return this;
    }

    LineBuilder longestFg(int v) {
      longestFg = v;
      return this;
    }

    LineBuilder xpAttempts(int v) {
      xpAttempts = v;
      return this;
    }

    LineBuilder xpMade(int v) {
      xpMade = v;
      return this;
    }

    LineBuilder blockedKicks(int v) {
      blockedKicks = v;
      return this;
    }

    LineBuilder punts(int v) {
      punts = v;
      return this;
    }

    LineBuilder puntYards(int v) {
      puntYards = v;
      return this;
    }

    LineBuilder puntTouchbacks(int v) {
      puntTouchbacks = v;
      return this;
    }

    LineBuilder kickReturns(int v) {
      kickReturns = v;
      return this;
    }

    LineBuilder kickReturnYards(int v) {
      kickReturnYards = v;
      return this;
    }

    LineBuilder puntReturns(int v) {
      puntReturns = v;
      return this;
    }

    LineBuilder puntReturnYards(int v) {
      puntReturnYards = v;
      return this;
    }

    LineBuilder penalties(int v) {
      penalties = v;
      return this;
    }

    LineBuilder penaltyYards(int v) {
      penaltyYards = v;
      return this;
    }

    PlayerGameStats build() {
      return new PlayerGameStats(
          base.player(),
          base.game(),
          base.team(),
          passAttempts,
          passCompletions,
          passYards,
          passTds,
          interceptions,
          sacksTaken,
          sackYardsLost,
          longestCompletion,
          rushAttempts,
          rushYards,
          rushTds,
          longestRush,
          fumbles,
          fumblesLost,
          targets,
          receptions,
          recYards,
          recTds,
          longestReception,
          yardsAfterCatch,
          drops,
          base.tackles(),
          base.assists(),
          base.tacklesForLoss(),
          sacks,
          base.qbHits(),
          passesDefensed,
          defInterceptions,
          intReturnYards,
          intTds,
          base.forcedFumbles(),
          fumbleRecoveries,
          fumbleReturnYards,
          base.defTds(),
          fgAttempts,
          fgMade,
          longestFg,
          xpAttempts,
          xpMade,
          blockedKicks,
          punts,
          puntYards,
          base.puntsInside20(),
          puntTouchbacks,
          kickReturns,
          kickReturnYards,
          base.kickReturnTds(),
          puntReturns,
          puntReturnYards,
          base.puntReturnTds(),
          penalties,
          penaltyYards,
          base.snapsPlayed());
    }
  }
}
