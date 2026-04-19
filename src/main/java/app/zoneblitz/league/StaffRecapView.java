package app.zoneblitz.league;

import java.util.List;
import java.util.Objects;

/**
 * View model for the {@link LeaguePhase#ASSEMBLING_STAFF} recap page. {@code franchises} is ordered
 * with the viewer's franchise first (flagged via {@link FranchiseStaffTree#isViewerFranchise()}),
 * so the template can render it expanded and the rest collapsed without extra logic.
 */
public record StaffRecapView(LeagueSummary league, List<FranchiseStaffTree> franchises) {

  public StaffRecapView {
    Objects.requireNonNull(league, "league");
    Objects.requireNonNull(franchises, "franchises");
    franchises = List.copyOf(franchises);
  }

  /** Full staff org chart for a franchise, paired with the candidate row per hired seat. */
  public record FranchiseStaffTree(
      Franchise franchise, boolean isViewerFranchise, List<StaffSeat> seats) {

    public FranchiseStaffTree {
      Objects.requireNonNull(franchise, "franchise");
      Objects.requireNonNull(seats, "seats");
      seats = List.copyOf(seats);
    }
  }

  /** A single filled seat — role, candidate snapshot, scout branch (when applicable). */
  public record StaffSeat(FranchiseStaffMember hire, Candidate candidate) {

    public StaffSeat {
      Objects.requireNonNull(hire, "hire");
      Objects.requireNonNull(candidate, "candidate");
    }
  }
}
