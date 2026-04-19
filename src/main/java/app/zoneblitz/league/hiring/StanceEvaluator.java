package app.zoneblitz.league.hiring;

import app.zoneblitz.league.team.TeamProfile;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Derives a per-tick {@link OfferStance} for an {@link OfferTerms} against a candidate's {@link
 * CandidatePreferences}, and returns a directional hint naming the worst offer-controllable
 * dimension (what the user should bump on the next revision). Team-profile dimensions (market,
 * geography, climate, prestige, etc.) are not in the hint because the user can't change them inside
 * the hiring flow.
 */
public final class StanceEvaluator {

  /** Composite score at or above this bucket → AGREED. */
  static final double AGREE_THRESHOLD = 0.70;

  /** Maximum number of revisions before a stale offer is walked. */
  public static final int REVISION_CAP = 3;

  private StanceEvaluator() {}

  public static Evaluation evaluate(
      OfferTerms offer, TeamProfile team, CandidatePreferences prefs) {
    var composite = OfferScoring.score(offer, team, prefs);
    var stance = composite >= AGREE_THRESHOLD ? OfferStance.AGREED : OfferStance.RENEGOTIATE;
    var hint =
        stance == OfferStance.AGREED ? Optional.<String>empty() : worstDimensionHint(offer, prefs);
    return new Evaluation(stance, composite, hint);
  }

  private static Optional<String> worstDimensionHint(OfferTerms offer, CandidatePreferences prefs) {
    var comp = offer.compensation().doubleValue();
    var compTarget = prefs.compensationTarget().doubleValue();
    var compFit = compTarget <= 0 ? 1.0 : Math.min(1.0, comp / compTarget);

    var lengthDiff = Math.abs(offer.contractLengthYears() - prefs.contractLengthTarget());
    var lengthFit = lengthDiff == 0 ? 1.0 : (lengthDiff >= 3 ? 0.0 : 1.0 - lengthDiff / 3.0);

    var guar = offer.guaranteedMoneyPct().doubleValue();
    var guarTarget = prefs.guaranteedMoneyTarget().doubleValue();
    var guarFit = guarTarget <= 0 ? 1.0 : Math.min(1.0, guar / guarTarget);

    var roleFit = offer.roleScope() == prefs.roleScopeTarget() ? 1.0 : 0.0;
    var contFit = offer.staffContinuity() == prefs.staffContinuityTarget() ? 1.0 : 0.0;

    record Dim(String hint, double fit) {}
    var dims =
        List.of(
            new Dim(
                "I want at least $%,.0f".formatted(prefs.compensationTarget().doubleValue()),
                compFit),
            new Dim("I want a %d-year deal".formatted(prefs.contractLengthTarget()), lengthFit),
            new Dim(
                "I want at least %.0f%% guaranteed"
                    .formatted(prefs.guaranteedMoneyTarget().doubleValue() * 100.0),
                guarFit),
            new Dim(
                "I want a %s scope role".formatted(prefs.roleScopeTarget().name().toLowerCase()),
                roleFit),
            new Dim(staffContinuityHint(prefs.staffContinuityTarget()), contFit));

    return dims.stream()
        .filter(d -> d.fit() < 1.0)
        .min(Comparator.comparingDouble(Dim::fit))
        .map(Dim::hint);
  }

  private static String staffContinuityHint(app.zoneblitz.league.staff.StaffContinuity target) {
    return switch (target) {
      case BRING_OWN -> "I want to bring my own staff";
      case HYBRID -> "I want to keep some staff and bring in some of my own";
      case KEEP_EXISTING -> "I want to keep the existing staff";
    };
  }

  public record Evaluation(OfferStance stance, double score, Optional<String> hint) {}
}
