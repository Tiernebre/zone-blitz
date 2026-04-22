package app.zoneblitz.league.cap;

import app.zoneblitz.league.LeagueSummary;
import java.util.List;

/**
 * Read-model for the staff salary cap page. {@code budgetCents} is the team's cap ceiling;
 * committed totals are derived by summing the line-item groups. All monetary fields are in cents.
 */
public record StaffCapView(
    LeagueSummary league,
    long budgetCents,
    List<ContractLine> contracts,
    List<OfferLine> offers,
    List<DeadCapLine> deadCap) {

  public long contractsTotalCents() {
    return contracts.stream().mapToLong(ContractLine::apyCents).sum();
  }

  public long offersTotalCents() {
    return offers.stream().mapToLong(OfferLine::apyCents).sum();
  }

  public long deadCapTotalCents() {
    return deadCap.stream().mapToLong(DeadCapLine::annualCents).sum();
  }

  public long committedCents() {
    return contractsTotalCents() + offersTotalCents() + deadCapTotalCents();
  }

  public long availableCents() {
    return budgetCents - committedCents();
  }

  /** Share of the cap ceiling currently committed, in the range {@code [0.0, 1.0+]}. */
  public double utilization() {
    if (budgetCents <= 0) {
      return 0.0;
    }
    return (double) committedCents() / (double) budgetCents;
  }

  public record ContractLine(
      String staffName,
      String roleDisplay,
      long apyCents,
      long guaranteeCents,
      int contractYears,
      int startSeason,
      int endSeason) {}

  public record OfferLine(
      String candidateName, String kindDisplay, long apyCents, int contractYears) {}

  public record DeadCapLine(
      String staffName,
      String roleDisplay,
      long annualCents,
      int terminatedAtSeason,
      int endSeason) {}
}
