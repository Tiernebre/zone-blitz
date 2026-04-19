package app.zoneblitz.league;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.support.PostgresTestcontainer;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;

@JooqTest
@Import(PostgresTestcontainer.class)
class ManageHeadCoachShortlistUseCaseTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private CreateLeague createLeague;
  private JooqCandidateRepository candidates;
  private HiringHeadCoachTransitionHandler entryHandler;
  private ManageHeadCoachShortlist useCase;

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    var teams = new JooqTeamLookup(dsl);
    var pools = new JooqCandidatePoolRepository(dsl);
    candidates = new JooqCandidateRepository(dsl);
    var preferences = new JooqCandidatePreferencesRepository(dsl);
    var hiringStates = new JooqFranchiseHiringStateRepository(dsl);
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
    var interviews = new JooqFranchiseInterviewRepository(dsl);
    useCase =
        new ManageHeadCoachShortlistUseCase(
            leagues, pools, candidates, preferences, hiringStates, interviews);
  }

  @Test
  void add_whenValid_putsCandidateOnShortlistAndFlagsRow() {
    var ctx = seedLeagueInPhase("sub-1");

    var result = useCase.add(ctx.leagueId, ctx.firstCandidateId, "sub-1");

    assertThat(result).isInstanceOf(ShortlistResult.Updated.class);
    var view = ((ShortlistResult.Updated) result).view();
    assertThat(view.shortlist()).hasSize(1);
    assertThat(view.shortlist().getFirst().id()).isEqualTo(ctx.firstCandidateId);
    assertThat(view.pool())
        .anySatisfy(
            row -> {
              if (row.id() == ctx.firstCandidateId) {
                assertThat(row.shortlisted()).isTrue();
              }
            });
  }

  @Test
  void add_isIdempotent() {
    var ctx = seedLeagueInPhase("sub-1");
    useCase.add(ctx.leagueId, ctx.firstCandidateId, "sub-1");
    var second = useCase.add(ctx.leagueId, ctx.firstCandidateId, "sub-1");

    assertThat(second).isInstanceOf(ShortlistResult.Updated.class);
    assertThat(((ShortlistResult.Updated) second).view().shortlist()).hasSize(1);
  }

  @Test
  void remove_whenPresent_clearsIt() {
    var ctx = seedLeagueInPhase("sub-1");
    useCase.add(ctx.leagueId, ctx.firstCandidateId, "sub-1");

    var result = useCase.remove(ctx.leagueId, ctx.firstCandidateId, "sub-1");

    assertThat(result).isInstanceOf(ShortlistResult.Updated.class);
    assertThat(((ShortlistResult.Updated) result).view().shortlist()).isEmpty();
  }

  @Test
  void remove_isIdempotent_whenCandidateAbsent() {
    var ctx = seedLeagueInPhase("sub-1");

    var result = useCase.remove(ctx.leagueId, ctx.firstCandidateId, "sub-1");

    assertThat(result).isInstanceOf(ShortlistResult.Updated.class);
    assertThat(((ShortlistResult.Updated) result).view().shortlist()).isEmpty();
  }

  @Test
  void add_whenLeagueNotOwned_returnsNotFound() {
    var ctx = seedLeagueInPhase("owner");

    var result = useCase.add(ctx.leagueId, ctx.firstCandidateId, "someone-else");

    assertThat(result).isInstanceOf(ShortlistResult.NotFound.class);
  }

  @Test
  void add_whenPhaseNotHiringHeadCoach_returnsNotFound() {
    var league = createLeagueFor("sub-1");

    var result = useCase.add(league.id(), 1L, "sub-1");

    assertThat(result).isInstanceOf(ShortlistResult.NotFound.class);
  }

  @Test
  void add_whenCandidateUnknown_returnsUnknownCandidate() {
    var ctx = seedLeagueInPhase("sub-1");

    var result = useCase.add(ctx.leagueId, 999_999L, "sub-1");

    assertThat(result).isInstanceOf(ShortlistResult.UnknownCandidate.class);
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
    var firstCandidate = candidates.findAllByPoolId(pool.id()).getFirst();
    return new Ctx(league.id(), firstCandidate.id());
  }

  private League createLeagueFor(String ownerSubject) {
    var franchiseId = new JooqFranchiseRepository(dsl).listAll().getFirst().id();
    var result = createLeague.create(ownerSubject, "Dynasty", franchiseId);
    return ((CreateLeagueResult.Created) result).league();
  }

  private record Ctx(long leagueId, long firstCandidateId) {}
}
