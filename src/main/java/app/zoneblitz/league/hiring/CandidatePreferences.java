package app.zoneblitz.league.hiring;

import app.zoneblitz.league.geography.Climate;
import app.zoneblitz.league.geography.Geography;
import app.zoneblitz.league.geography.MarketSize;
import app.zoneblitz.league.staff.RoleScope;
import app.zoneblitz.league.staff.StaffContinuity;
import java.math.BigDecimal;
import java.util.Objects;

/**
 * Wide preferences row for one candidate. One paired (target, weight) per dimension listed in
 * {@code docs/technical/league-phases.md}. All 13 dimensions are mandatory so the scoring function
 * is total.
 *
 * <p>Weights are 0..1; generator normalizes them across dimensions per-candidate.
 */
public record CandidatePreferences(
    long candidateId,
    BigDecimal compensationTarget,
    BigDecimal compensationWeight,
    int contractLengthTarget,
    BigDecimal contractLengthWeight,
    BigDecimal guaranteedMoneyTarget,
    BigDecimal guaranteedMoneyWeight,
    MarketSize marketSizeTarget,
    BigDecimal marketSizeWeight,
    Geography geographyTarget,
    BigDecimal geographyWeight,
    Climate climateTarget,
    BigDecimal climateWeight,
    BigDecimal franchisePrestigeTarget,
    BigDecimal franchisePrestigeWeight,
    CompetitiveWindow competitiveWindowTarget,
    BigDecimal competitiveWindowWeight,
    RoleScope roleScopeTarget,
    BigDecimal roleScopeWeight,
    StaffContinuity staffContinuityTarget,
    BigDecimal staffContinuityWeight,
    String schemeAlignmentTarget,
    BigDecimal schemeAlignmentWeight,
    BigDecimal ownerStabilityTarget,
    BigDecimal ownerStabilityWeight,
    BigDecimal facilityQualityTarget,
    BigDecimal facilityQualityWeight) {

  public CandidatePreferences {
    Objects.requireNonNull(compensationTarget, "compensationTarget");
    Objects.requireNonNull(compensationWeight, "compensationWeight");
    Objects.requireNonNull(contractLengthWeight, "contractLengthWeight");
    Objects.requireNonNull(guaranteedMoneyTarget, "guaranteedMoneyTarget");
    Objects.requireNonNull(guaranteedMoneyWeight, "guaranteedMoneyWeight");
    Objects.requireNonNull(marketSizeTarget, "marketSizeTarget");
    Objects.requireNonNull(marketSizeWeight, "marketSizeWeight");
    Objects.requireNonNull(geographyTarget, "geographyTarget");
    Objects.requireNonNull(geographyWeight, "geographyWeight");
    Objects.requireNonNull(climateTarget, "climateTarget");
    Objects.requireNonNull(climateWeight, "climateWeight");
    Objects.requireNonNull(franchisePrestigeTarget, "franchisePrestigeTarget");
    Objects.requireNonNull(franchisePrestigeWeight, "franchisePrestigeWeight");
    Objects.requireNonNull(competitiveWindowTarget, "competitiveWindowTarget");
    Objects.requireNonNull(competitiveWindowWeight, "competitiveWindowWeight");
    Objects.requireNonNull(roleScopeTarget, "roleScopeTarget");
    Objects.requireNonNull(roleScopeWeight, "roleScopeWeight");
    Objects.requireNonNull(staffContinuityTarget, "staffContinuityTarget");
    Objects.requireNonNull(staffContinuityWeight, "staffContinuityWeight");
    Objects.requireNonNull(schemeAlignmentTarget, "schemeAlignmentTarget");
    Objects.requireNonNull(schemeAlignmentWeight, "schemeAlignmentWeight");
    Objects.requireNonNull(ownerStabilityTarget, "ownerStabilityTarget");
    Objects.requireNonNull(ownerStabilityWeight, "ownerStabilityWeight");
    Objects.requireNonNull(facilityQualityTarget, "facilityQualityTarget");
    Objects.requireNonNull(facilityQualityWeight, "facilityQualityWeight");
  }
}
