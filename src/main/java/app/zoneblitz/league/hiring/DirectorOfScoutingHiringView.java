package app.zoneblitz.league.hiring;

import app.zoneblitz.league.LeagueSummary;
import java.util.List;
import java.util.Objects;

/** Composite page/fragment view-model for the HIRING_DIRECTOR_OF_SCOUTING page. */
public record DirectorOfScoutingHiringView(
    LeagueSummary league,
    List<DirectorOfScoutingCandidateView> pool,
    List<DirectorOfScoutingCandidateView> activeInterviews,
    List<LeagueHire> leagueHires,
    int interviewsToday,
    int interviewCapacity,
    StaffBudget budget) {

  public DirectorOfScoutingHiringView {
    Objects.requireNonNull(league, "league");
    Objects.requireNonNull(budget, "budget");
    pool = List.copyOf(pool);
    activeInterviews = List.copyOf(activeInterviews);
    leagueHires = List.copyOf(leagueHires);
  }

  public boolean offersOpen() {
    return league.phaseDay() >= MakeOffer.OFFERS_OPEN_ON_DAY;
  }

  public int offersOpenOnDay() {
    return MakeOffer.OFFERS_OPEN_ON_DAY;
  }
}
