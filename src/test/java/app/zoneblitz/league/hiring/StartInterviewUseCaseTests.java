package app.zoneblitz.league.hiring;

import static app.zoneblitz.jooq.Tables.CANDIDATES;
import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.CreateLeague;
import app.zoneblitz.league.CreateLeagueResult;
import app.zoneblitz.league.CreateLeagueUseCase;
import app.zoneblitz.league.FakeRandomSource;
import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.League;
import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.phase.HiringHeadCoachTransitionHandler;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.team.JooqTeamHiringStateRepository;
import app.zoneblitz.league.team.JooqTeamLookup;
import app.zoneblitz.league.team.JooqTeamRepository;
import app.zoneblitz.league.team.TeamHiringStateRepository;
import app.zoneblitz.support.PostgresTestcontainer;
import java.util.regex.Pattern;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;

@JooqTest
@Import(PostgresTestcontainer.class)
class StartInterviewUseCaseTests {

  private static final Pattern HIDDEN_OVERALL =
      Pattern.compile("\"overall\"\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)");

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private CreateLeague createLeague;
  private JooqCandidateRepository candidates;
  private TeamInterviewRepository interviews;
  private TeamHiringStateRepository hiringStates;
  private HiringHeadCoachTransitionHandler entryHandler;
  private StartInterview useCase;

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    var teams = new JooqTeamLookup(dsl);
    var pools = new JooqCandidatePoolRepository(dsl);
    candidates = new JooqCandidateRepository(dsl);
    var preferences = new JooqCandidatePreferencesRepository(dsl);
    hiringStates = new JooqTeamHiringStateRepository(dsl);
    interviews = new JooqTeamInterviewRepository(dsl);
    createLeague = new CreateLeagueUseCase(leagues, franchises, teamRepo);
    entryHandler =
        new HiringHeadCoachTransitionHandler(
            leagues,
            teams,
            pools,
            candidates,
            preferences,
            hiringStates,
            new HeadCoachGenerator(),
            (leagueId, phase) -> new FakeRandomSource(leagueId + phase.ordinal()));
    useCase =
        new StartInterviewUseCase(
            leagues, pools, candidates, preferences, hiringStates, interviews);
  }

  @Test
  void start_firstInterview_recordsEventAndAppendsCandidateToHiringState() {
    var ctx = seedLeagueInPhase("sub-1");

    var result = useCase.start(ctx.leagueId, ctx.firstCandidateId, "sub-1");

    assertThat(result).isInstanceOf(InterviewResult.Started.class);
    var view = ((InterviewResult.Started) result).view();
    assertThat(view.activeInterviews()).hasSize(1);
    assertThat(view.activeInterviews().getFirst().id()).isEqualTo(ctx.firstCandidateId);
    assertThat(view.activeInterviews().getFirst().interviewCount()).isEqualTo(1);
    assertThat(view.interviewsThisWeek()).isEqualTo(1);

    var state = hiringStates.find(ctx.teamId, LeaguePhase.HIRING_HEAD_COACH).orElseThrow();
    assertThat(state.interviewingCandidateIds()).containsExactly(ctx.firstCandidateId);
  }

  @Test
  void start_multipleInterviewsOnSameCandidate_tightenSigmaMonotonically() {
    var ctx = seedLeagueInPhase("sub-1");

    for (var i = 0; i < 5; i++) {
      useCase.start(ctx.leagueId, ctx.firstCandidateId, "sub-1");
      leagues.incrementPhaseWeek(ctx.leagueId);
    }
    var history = interviews.findAllFor(ctx.teamId, LeaguePhase.HIRING_HEAD_COACH);
    assertThat(history).hasSize(5);
    assertThat(history).extracting(TeamInterview::interviewIndex).containsExactly(1, 2, 3, 4, 5);

    var sigmas =
        history.stream().map(h -> InterviewNoiseModel.headCoachSigma(h.interviewIndex())).toList();
    var previous = InterviewNoiseModel.HC_INITIAL_STD + 1.0;
    for (var sigma : sigmas) {
      assertThat(sigma).isLessThan(previous);
      assertThat(sigma).isGreaterThan(0.0);
      previous = sigma;
    }
  }

  @Test
  void start_hittingWeeklyCap_returnsCapacityReached() {
    var ctx = seedLeagueInPhase("sub-1");
    var secondId = secondCandidateId(ctx);
    var thirdId = thirdCandidateId(ctx);

    useCase.start(ctx.leagueId, ctx.firstCandidateId, "sub-1");
    useCase.start(ctx.leagueId, secondId, "sub-1");
    useCase.start(ctx.leagueId, thirdId, "sub-1");

    var capped = useCase.start(ctx.leagueId, ctx.firstCandidateId, "sub-1");

    assertThat(capped).isInstanceOf(InterviewResult.CapacityReached.class);
    assertThat(((InterviewResult.CapacityReached) capped).capacity())
        .isEqualTo(StartInterview.DEFAULT_WEEKLY_CAPACITY);
  }

  @Test
  void start_doesNotWriteTrueRatingIntoScoutedAttrs() {
    var ctx = seedLeagueInPhase("sub-1");
    var before =
        dsl.select(CANDIDATES.SCOUTED_ATTRS, CANDIDATES.HIDDEN_ATTRS)
            .from(CANDIDATES)
            .where(CANDIDATES.ID.eq(ctx.firstCandidateId))
            .fetchOne();
    var hiddenBefore = before.get(CANDIDATES.HIDDEN_ATTRS).data();
    var scoutedBefore = before.get(CANDIDATES.SCOUTED_ATTRS).data();
    var trueRating = extractOverall(hiddenBefore);

    for (var i = 0; i < 10; i++) {
      useCase.start(ctx.leagueId, ctx.firstCandidateId, "sub-1");
      // ensure we don't blow past weekly cap across multiple weeks
      leagues.incrementPhaseWeek(ctx.leagueId);
    }

    var after =
        dsl.select(CANDIDATES.SCOUTED_ATTRS, CANDIDATES.HIDDEN_ATTRS)
            .from(CANDIDATES)
            .where(CANDIDATES.ID.eq(ctx.firstCandidateId))
            .fetchOne();
    assertThat(after.get(CANDIDATES.SCOUTED_ATTRS).data()).isEqualTo(scoutedBefore);
    assertThat(after.get(CANDIDATES.HIDDEN_ATTRS).data()).isEqualTo(hiddenBefore);

    var perInterview = interviews.findAllFor(ctx.teamId, LeaguePhase.HIRING_HEAD_COACH);
    assertThat(perInterview).isNotEmpty();
    assertThat(perInterview)
        .allSatisfy(i -> assertThat(i.scoutedOverall().doubleValue()).isNotEqualTo(trueRating));
  }

  @Test
  void start_phaseNotHiringHeadCoach_returnsNotFound() {
    var league = createLeagueFor("sub-1");

    var result = useCase.start(league.id(), 1L, "sub-1");

    assertThat(result).isInstanceOf(InterviewResult.NotFound.class);
  }

  @Test
  void start_unknownCandidate_returnsUnknownCandidate() {
    var ctx = seedLeagueInPhase("sub-1");

    var result = useCase.start(ctx.leagueId, 999_999L, "sub-1");

    assertThat(result).isInstanceOf(InterviewResult.UnknownCandidate.class);
  }

  @Test
  void start_notOwnedByCaller_returnsNotFound() {
    var ctx = seedLeagueInPhase("owner");

    var result = useCase.start(ctx.leagueId, ctx.firstCandidateId, "someone-else");

    assertThat(result).isInstanceOf(InterviewResult.NotFound.class);
  }

  private long secondCandidateId(Ctx ctx) {
    return candidates.findAllByPoolId(ctx.poolId).get(1).id();
  }

  private long thirdCandidateId(Ctx ctx) {
    return candidates.findAllByPoolId(ctx.poolId).get(2).id();
  }

  private Ctx seedLeagueInPhase(String subject) {
    var league = createLeagueFor(subject);
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    entryHandler.onEntry(league.id());
    var pool =
        new JooqCandidatePoolRepository(dsl)
            .findByLeaguePhaseAndType(
                league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH)
            .orElseThrow();
    var summary = leagues.findSummaryByIdAndOwner(league.id(), subject).orElseThrow();
    var firstCandidate = candidates.findAllByPoolId(pool.id()).getFirst();
    return new Ctx(league.id(), summary.userTeamId(), pool.id(), firstCandidate.id());
  }

  private League createLeagueFor(String ownerSubject) {
    var franchiseId = new JooqFranchiseRepository(dsl).listAll().getFirst().id();
    var result = createLeague.create(ownerSubject, "Dynasty", franchiseId);
    return ((CreateLeagueResult.Created) result).league();
  }

  private static double extractOverall(String attrsJson) {
    var m = HIDDEN_OVERALL.matcher(attrsJson);
    return m.find() ? Double.parseDouble(m.group(1)) : Double.NaN;
  }

  private record Ctx(long leagueId, long teamId, long poolId, long firstCandidateId) {}
}
