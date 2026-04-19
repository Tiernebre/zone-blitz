package app.zoneblitz.league.phase;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.CreateLeague;
import app.zoneblitz.league.CreateLeagueResult;
import app.zoneblitz.league.CreateLeagueUseCase;
import app.zoneblitz.league.FakeRandomSource;
import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.League;
import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.hiring.Candidate;
import app.zoneblitz.league.hiring.CandidateArchetype;
import app.zoneblitz.league.hiring.CandidateKind;
import app.zoneblitz.league.hiring.CandidateOffer;
import app.zoneblitz.league.hiring.CandidatePoolType;
import app.zoneblitz.league.hiring.CandidateRandomSources;
import app.zoneblitz.league.hiring.CandidateTestData;
import app.zoneblitz.league.hiring.JooqCandidateOfferRepository;
import app.zoneblitz.league.hiring.JooqCandidatePoolRepository;
import app.zoneblitz.league.hiring.JooqCandidatePreferencesRepository;
import app.zoneblitz.league.hiring.JooqCandidateRepository;
import app.zoneblitz.league.hiring.NewCandidate;
import app.zoneblitz.league.hiring.OfferStatus;
import app.zoneblitz.league.staff.JooqTeamStaffRepository;
import app.zoneblitz.league.staff.SpecialtyPosition;
import app.zoneblitz.league.staff.StaffRole;
import app.zoneblitz.league.staff.TeamStaffMember;
import app.zoneblitz.league.team.JooqTeamHiringStateRepository;
import app.zoneblitz.league.team.JooqTeamLookup;
import app.zoneblitz.league.team.JooqTeamRepository;
import app.zoneblitz.league.team.TeamHiringState;
import app.zoneblitz.support.PostgresTestcontainer;
import java.util.List;
import java.util.Optional;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;

@JooqTest
@Import(PostgresTestcontainer.class)
class BestScoutedHiringAutofillTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private JooqCandidatePoolRepository pools;
  private JooqCandidateRepository candidates;
  private JooqCandidatePreferencesRepository preferences;
  private JooqCandidateOfferRepository offers;
  private JooqTeamHiringStateRepository hiringStates;
  private JooqTeamStaffRepository staff;
  private JooqTeamLookup teamLookup;
  private CreateLeague createLeague;
  private HiringPhaseAutofill autofill;
  private CandidateRandomSources rngs;

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    pools = new JooqCandidatePoolRepository(dsl);
    candidates = new JooqCandidateRepository(dsl);
    preferences = new JooqCandidatePreferencesRepository(dsl);
    offers = new JooqCandidateOfferRepository(dsl);
    hiringStates = new JooqTeamHiringStateRepository(dsl);
    staff = new JooqTeamStaffRepository(dsl);
    teamLookup = new JooqTeamLookup(dsl);
    rngs = (leagueId, phase) -> new FakeRandomSource(leagueId + phase.ordinal());
    createLeague = new CreateLeagueUseCase(leagues, franchises, teamRepo);
    autofill =
        new BestScoutedHiringAutofill(
            pools, candidates, preferences, offers, hiringStates, staff, teamLookup, rngs);
  }

  @Test
  void autofill_whenPhaseHasNoPool_isNoOp() {
    var league = createLeagueFor("sub-1");

    autofill.autofill(league.id(), LeaguePhase.HIRING_HEAD_COACH, 3);

    assertThat(hiringStates.findAllForLeaguePhase(league.id(), LeaguePhase.HIRING_HEAD_COACH))
        .isEmpty();
  }

  @Test
  void autofill_assignsUnresolvedFranchise_withBestScoutedCandidate() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    var pool =
        pools.insert(league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    // Top candidate: highest scouted overall; ranking should pick this regardless of hidden rating.
    var topScouted = insertCandidate(pool.id(), "{\"overall\": 55.00}", "{\"overall\": 95.00}");
    var strongHidden = insertCandidate(pool.id(), "{\"overall\": 80.00}", "{\"overall\": 60.00}");
    // Fill out enough candidates so every franchise gets hired without running out.
    seedFillerCandidates(pool.id(), 20, 40.00);

    var franchiseIds = teamLookup.teamIdsForLeague(league.id());
    var targetFranchise = franchiseIds.getFirst();
    markSearching(league.id(), targetFranchise, LeaguePhase.HIRING_HEAD_COACH);

    autofill.autofill(league.id(), LeaguePhase.HIRING_HEAD_COACH, 3);

    // The first-iterated franchise gets the highest scouted pick. Ranking is by SCOUTED only.
    assertThat(candidates.findById(topScouted.id()).orElseThrow().hiredByTeamId())
        .contains(targetFranchise);
    assertThat(candidates.findById(strongHidden.id()).orElseThrow().hiredByTeamId())
        .isPresent()
        .hasValueSatisfying(id -> assertThat(id).isNotEqualTo(targetFranchise));
    var state = hiringStates.find(targetFranchise, LeaguePhase.HIRING_HEAD_COACH).orElseThrow();
    assertThat(state.step()).isEqualTo(HiringStep.HIRED);
    assertThat(staff.findAllForTeam(targetFranchise))
        .extracting(TeamStaffMember::role, TeamStaffMember::candidateId)
        .containsExactly(
            org.assertj.core.api.Assertions.tuple(StaffRole.HEAD_COACH, topScouted.id()));
    assertThat(offers.findAllForCandidate(topScouted.id()))
        .extracting(CandidateOffer::status)
        .containsExactly(OfferStatus.ACCEPTED);
  }

  @Test
  void autofill_skipsFranchisesAlreadyHired() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    var pool =
        pools.insert(league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    insertCandidate(pool.id(), "{\"overall\": 70.00}", "{\"overall\": 70.00}");

    // Seed additional candidates so every pending franchise in the league gets filled.
    seedFillerCandidates(pool.id(), 20, 60.00);

    var franchiseIds = teamLookup.teamIdsForLeague(league.id());
    var alreadyHired = franchiseIds.get(0);
    var pending = franchiseIds.get(1);
    hiringStates.upsert(
        new TeamHiringState(
            0L,
            alreadyHired,
            LeaguePhase.HIRING_HEAD_COACH,
            HiringStep.HIRED,
            List.of(),
            List.of()));
    markSearching(league.id(), pending, LeaguePhase.HIRING_HEAD_COACH);

    autofill.autofill(league.id(), LeaguePhase.HIRING_HEAD_COACH, 3);

    assertThat(staff.findAllForTeam(alreadyHired)).isEmpty();
    assertThat(staff.findAllForTeam(pending))
        .extracting(TeamStaffMember::role)
        .containsExactly(StaffRole.HEAD_COACH);
  }

  @Test
  void autofill_neverReadsHiddenAttrs_picksByScoutedOnly() {
    // Regression guard: two candidates with inverted hidden vs scouted ratings — autofill must
    // pick the one with the higher scouted rating, proving hidden attrs never leak into the
    // decision. Aligns with the hidden-info guarantee in docs/technical/league-phases.md.
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    var pool =
        pools.insert(league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    var hiddenGem = insertCandidate(pool.id(), "{\"overall\": 95.00}", "{\"overall\": 40.00}");
    var publicFavorite = insertCandidate(pool.id(), "{\"overall\": 55.00}", "{\"overall\": 85.00}");
    // Fillers keep the hidden gem out of the top-1 by-scouted pick across other franchises so the
    // first-iterated franchise is the only one that could conceivably pick it up.
    seedFillerCandidates(pool.id(), 20, 70.00);

    var franchiseIds = teamLookup.teamIdsForLeague(league.id());
    var targetFranchise = franchiseIds.getFirst();
    markSearching(league.id(), targetFranchise, LeaguePhase.HIRING_HEAD_COACH);

    autofill.autofill(league.id(), LeaguePhase.HIRING_HEAD_COACH, 3);

    assertThat(candidates.findById(publicFavorite.id()).orElseThrow().hiredByTeamId())
        .contains(targetFranchise);
    // Hidden gem's scouted is below the filler band, so it stays unhired for this run — the
    // key invariant is that the target (highest scouted) franchise never received it.
    var hiddenGemOwner = candidates.findById(hiddenGem.id()).orElseThrow().hiredByTeamId();
    assertThat(hiddenGemOwner).isNotEqualTo(Optional.of(targetFranchise));
  }

  @Test
  void autofill_multipleFranchises_getsDistinctCandidates() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    var pool =
        pools.insert(league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    var topCandidate = insertCandidate(pool.id(), "{\"overall\": 80.00}", "{\"overall\": 85.00}");
    var secondCandidate =
        insertCandidate(pool.id(), "{\"overall\": 70.00}", "{\"overall\": 75.00}");
    seedFillerCandidates(pool.id(), 20, 50.00);

    var franchiseIds = teamLookup.teamIdsForLeague(league.id());
    for (var franchiseId : franchiseIds) {
      markSearching(league.id(), franchiseId, LeaguePhase.HIRING_HEAD_COACH);
    }

    autofill.autofill(league.id(), LeaguePhase.HIRING_HEAD_COACH, 3);

    var firstHire = candidates.findById(topCandidate.id()).orElseThrow().hiredByTeamId();
    var secondHire = candidates.findById(secondCandidate.id()).orElseThrow().hiredByTeamId();
    assertThat(firstHire).isPresent();
    assertThat(secondHire).isPresent();
    assertThat(firstHire.get()).isNotEqualTo(secondHire.get());
  }

  private void seedFillerCandidates(long poolId, int count, double scoutedOverall) {
    for (int i = 0; i < count; i++) {
      insertCandidate(
          poolId,
          "{\"overall\": 50.00}",
          "{\"overall\": " + String.format(java.util.Locale.ROOT, "%.2f", scoutedOverall) + "}");
    }
  }

  private Candidate insertCandidate(long poolId, String hiddenAttrs, String scoutedAttrs) {
    var saved =
        candidates.insert(
            new NewCandidate(
                poolId,
                CandidateKind.HEAD_COACH,
                SpecialtyPosition.QB,
                CandidateArchetype.OFFENSIVE_PLAY_CALLER,
                43,
                18,
                "{\"HC\":0}",
                hiddenAttrs,
                scoutedAttrs,
                Optional.empty()));
    preferences.insert(CandidateTestData.preferencesFor(saved.id()));
    return saved;
  }

  private void markSearching(long leagueId, long franchiseId, LeaguePhase phase) {
    hiringStates.upsert(
        new TeamHiringState(0L, franchiseId, phase, HiringStep.SEARCHING, List.of(), List.of()));
  }

  private League createLeagueFor(String ownerSubject) {
    var franchiseId = new JooqFranchiseRepository(dsl).listAll().getFirst().id();
    var result = createLeague.create(ownerSubject, "Dynasty-" + ownerSubject, franchiseId);
    return ((CreateLeagueResult.Created) result).league();
  }
}
