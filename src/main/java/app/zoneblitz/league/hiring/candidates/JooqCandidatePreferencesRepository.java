package app.zoneblitz.league.hiring.candidates;

import static app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES;

import app.zoneblitz.league.geography.Climate;
import app.zoneblitz.league.geography.Geography;
import app.zoneblitz.league.geography.MarketSize;
import app.zoneblitz.league.hiring.CandidatePreferences;
import app.zoneblitz.league.hiring.CompetitiveWindow;
import app.zoneblitz.league.staff.RoleScope;
import app.zoneblitz.league.staff.StaffContinuity;
import java.util.Objects;
import java.util.Optional;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class JooqCandidatePreferencesRepository implements CandidatePreferencesRepository {

  private final DSLContext dsl;

  public JooqCandidatePreferencesRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public CandidatePreferences insert(CandidatePreferences prefs) {
    Objects.requireNonNull(prefs, "prefs");
    var record =
        dsl.insertInto(CANDIDATE_PREFERENCES)
            .set(CANDIDATE_PREFERENCES.CANDIDATE_ID, prefs.candidateId())
            .set(CANDIDATE_PREFERENCES.COMPENSATION_TARGET, prefs.compensationTarget())
            .set(CANDIDATE_PREFERENCES.COMPENSATION_WEIGHT, prefs.compensationWeight())
            .set(CANDIDATE_PREFERENCES.CONTRACT_LENGTH_TARGET, prefs.contractLengthTarget())
            .set(CANDIDATE_PREFERENCES.CONTRACT_LENGTH_WEIGHT, prefs.contractLengthWeight())
            .set(CANDIDATE_PREFERENCES.GUARANTEED_MONEY_TARGET, prefs.guaranteedMoneyTarget())
            .set(CANDIDATE_PREFERENCES.GUARANTEED_MONEY_WEIGHT, prefs.guaranteedMoneyWeight())
            .set(CANDIDATE_PREFERENCES.MARKET_SIZE_TARGET, prefs.marketSizeTarget().name())
            .set(CANDIDATE_PREFERENCES.MARKET_SIZE_WEIGHT, prefs.marketSizeWeight())
            .set(CANDIDATE_PREFERENCES.GEOGRAPHY_TARGET, prefs.geographyTarget().name())
            .set(CANDIDATE_PREFERENCES.GEOGRAPHY_WEIGHT, prefs.geographyWeight())
            .set(CANDIDATE_PREFERENCES.CLIMATE_TARGET, prefs.climateTarget().name())
            .set(CANDIDATE_PREFERENCES.CLIMATE_WEIGHT, prefs.climateWeight())
            .set(CANDIDATE_PREFERENCES.FRANCHISE_PRESTIGE_TARGET, prefs.franchisePrestigeTarget())
            .set(CANDIDATE_PREFERENCES.FRANCHISE_PRESTIGE_WEIGHT, prefs.franchisePrestigeWeight())
            .set(
                CANDIDATE_PREFERENCES.COMPETITIVE_WINDOW_TARGET,
                prefs.competitiveWindowTarget().name())
            .set(CANDIDATE_PREFERENCES.COMPETITIVE_WINDOW_WEIGHT, prefs.competitiveWindowWeight())
            .set(CANDIDATE_PREFERENCES.ROLE_SCOPE_TARGET, prefs.roleScopeTarget().name())
            .set(CANDIDATE_PREFERENCES.ROLE_SCOPE_WEIGHT, prefs.roleScopeWeight())
            .set(
                CANDIDATE_PREFERENCES.STAFF_CONTINUITY_TARGET, prefs.staffContinuityTarget().name())
            .set(CANDIDATE_PREFERENCES.STAFF_CONTINUITY_WEIGHT, prefs.staffContinuityWeight())
            .set(CANDIDATE_PREFERENCES.SCHEME_ALIGNMENT_TARGET, prefs.schemeAlignmentTarget())
            .set(CANDIDATE_PREFERENCES.SCHEME_ALIGNMENT_WEIGHT, prefs.schemeAlignmentWeight())
            .set(CANDIDATE_PREFERENCES.OWNER_STABILITY_TARGET, prefs.ownerStabilityTarget())
            .set(CANDIDATE_PREFERENCES.OWNER_STABILITY_WEIGHT, prefs.ownerStabilityWeight())
            .set(CANDIDATE_PREFERENCES.FACILITY_QUALITY_TARGET, prefs.facilityQualityTarget())
            .set(CANDIDATE_PREFERENCES.FACILITY_QUALITY_WEIGHT, prefs.facilityQualityWeight())
            .returning(CANDIDATE_PREFERENCES.fields())
            .fetchOne();
    return map(record);
  }

  @Override
  public Optional<CandidatePreferences> findByCandidateId(long candidateId) {
    return dsl.selectFrom(CANDIDATE_PREFERENCES)
        .where(CANDIDATE_PREFERENCES.CANDIDATE_ID.eq(candidateId))
        .fetchOptional(this::map);
  }

  private CandidatePreferences map(org.jooq.Record r) {
    return new CandidatePreferences(
        r.get(CANDIDATE_PREFERENCES.CANDIDATE_ID),
        r.get(CANDIDATE_PREFERENCES.COMPENSATION_TARGET),
        r.get(CANDIDATE_PREFERENCES.COMPENSATION_WEIGHT),
        r.get(CANDIDATE_PREFERENCES.CONTRACT_LENGTH_TARGET),
        r.get(CANDIDATE_PREFERENCES.CONTRACT_LENGTH_WEIGHT),
        r.get(CANDIDATE_PREFERENCES.GUARANTEED_MONEY_TARGET),
        r.get(CANDIDATE_PREFERENCES.GUARANTEED_MONEY_WEIGHT),
        MarketSize.valueOf(r.get(CANDIDATE_PREFERENCES.MARKET_SIZE_TARGET)),
        r.get(CANDIDATE_PREFERENCES.MARKET_SIZE_WEIGHT),
        Geography.valueOf(r.get(CANDIDATE_PREFERENCES.GEOGRAPHY_TARGET)),
        r.get(CANDIDATE_PREFERENCES.GEOGRAPHY_WEIGHT),
        Climate.valueOf(r.get(CANDIDATE_PREFERENCES.CLIMATE_TARGET)),
        r.get(CANDIDATE_PREFERENCES.CLIMATE_WEIGHT),
        r.get(CANDIDATE_PREFERENCES.FRANCHISE_PRESTIGE_TARGET),
        r.get(CANDIDATE_PREFERENCES.FRANCHISE_PRESTIGE_WEIGHT),
        CompetitiveWindow.valueOf(r.get(CANDIDATE_PREFERENCES.COMPETITIVE_WINDOW_TARGET)),
        r.get(CANDIDATE_PREFERENCES.COMPETITIVE_WINDOW_WEIGHT),
        RoleScope.valueOf(r.get(CANDIDATE_PREFERENCES.ROLE_SCOPE_TARGET)),
        r.get(CANDIDATE_PREFERENCES.ROLE_SCOPE_WEIGHT),
        StaffContinuity.valueOf(r.get(CANDIDATE_PREFERENCES.STAFF_CONTINUITY_TARGET)),
        r.get(CANDIDATE_PREFERENCES.STAFF_CONTINUITY_WEIGHT),
        r.get(CANDIDATE_PREFERENCES.SCHEME_ALIGNMENT_TARGET),
        r.get(CANDIDATE_PREFERENCES.SCHEME_ALIGNMENT_WEIGHT),
        r.get(CANDIDATE_PREFERENCES.OWNER_STABILITY_TARGET),
        r.get(CANDIDATE_PREFERENCES.OWNER_STABILITY_WEIGHT),
        r.get(CANDIDATE_PREFERENCES.FACILITY_QUALITY_TARGET),
        r.get(CANDIDATE_PREFERENCES.FACILITY_QUALITY_WEIGHT));
  }
}
