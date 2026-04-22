package app.zoneblitz.league.phase;

import app.zoneblitz.league.hiring.CandidateGenerator;
import app.zoneblitz.league.hiring.CandidatePoolType;
import app.zoneblitz.league.hiring.GenerateCandidatePool;
import app.zoneblitz.league.team.TeamHiringState;
import app.zoneblitz.league.team.TeamHiringStateRepository;
import app.zoneblitz.league.team.TeamLookup;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Phase-entry hook for {@link LeaguePhase#HIRING_DIRECTOR_OF_SCOUTING}. Mirrors {@link
 * HiringHeadCoachTransitionHandler}: generate the league-wide DoS candidate pool (if not already
 * present) via {@link GenerateCandidatePool}, and initialize each team's hiring sub-state to {@link
 * HiringStep#SEARCHING} with empty shortlist/interview lists.
 *
 * <p>Idempotent: re-entry of a phase that already has a pool is a no-op.
 */
@Component
public class HiringDirectorOfScoutingTransitionHandler implements PhaseTransitionHandler {

  private static final Logger log =
      LoggerFactory.getLogger(HiringDirectorOfScoutingTransitionHandler.class);

  /** Per {@code docs/technical/league-phases.md}: pool size is 2–3× team count. */
  private static final int POOL_SIZE_PER_TEAM = 3;

  private final TeamLookup teams;
  private final GenerateCandidatePool generatePool;
  private final TeamHiringStateRepository hiringStates;
  private final CandidateGenerator generator;

  public HiringDirectorOfScoutingTransitionHandler(
      TeamLookup teams,
      GenerateCandidatePool generatePool,
      TeamHiringStateRepository hiringStates,
      @org.springframework.beans.factory.annotation.Qualifier("directorOfScoutingGenerator")
          CandidateGenerator generator) {
    this.teams = teams;
    this.generatePool = generatePool;
    this.hiringStates = hiringStates;
    this.generator = generator;
  }

  @Override
  public LeaguePhase phase() {
    return LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING;
  }

  @Override
  public void onEntry(long leagueId) {
    var teamIds = teams.teamIdsForLeague(leagueId);
    var poolSize = Math.max(1, teamIds.size() * POOL_SIZE_PER_TEAM);
    var created =
        generatePool.generateIfAbsent(
            leagueId, phase(), CandidatePoolType.DIRECTOR_OF_SCOUTING, generator, poolSize);
    if (!created) {
      log.debug("DoS pool already present for league={}; entry is a no-op", leagueId);
      return;
    }
    for (var teamId : teamIds) {
      hiringStates.upsert(
          new TeamHiringState(0L, teamId, phase(), HiringStep.SEARCHING, List.of()));
    }
    log.info(
        "hiring director-of-scouting entry completed leagueId={} teams={}",
        leagueId,
        teamIds.size());
  }
}
