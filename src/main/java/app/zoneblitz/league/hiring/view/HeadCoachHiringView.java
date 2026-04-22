package app.zoneblitz.league.hiring.view;

import app.zoneblitz.league.LeagueSummary;
import app.zoneblitz.league.hiring.LeagueHire;
import app.zoneblitz.league.hiring.MakeOffer;
import app.zoneblitz.league.hiring.StaffBudget;
import java.util.List;
import java.util.Objects;

/** Composite page/fragment view-model for the HIRING_HEAD_COACH page. */
public record HeadCoachHiringView(
    LeagueSummary league,
    List<HeadCoachCandidateView> pool,
    List<HeadCoachCandidateView> activeInterviews,
    List<LeagueHire> leagueHires,
    int interviewsToday,
    int interviewCapacity,
    StaffBudget budget) {

  public HeadCoachHiringView {
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
