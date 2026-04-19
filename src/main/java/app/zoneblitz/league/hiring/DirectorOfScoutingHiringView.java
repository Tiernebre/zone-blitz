package app.zoneblitz.league.hiring;

import app.zoneblitz.league.LeagueSummary;
import java.util.List;
import java.util.Objects;

/** Composite page/fragment view-model for the HIRING_DIRECTOR_OF_SCOUTING page. */
public record DirectorOfScoutingHiringView(
    LeagueSummary league,
    List<DirectorOfScoutingCandidateView> pool,
    List<DirectorOfScoutingCandidateView> activeInterviews,
    int interviewsThisWeek,
    int interviewCapacity) {

  public DirectorOfScoutingHiringView {
    Objects.requireNonNull(league, "league");
    pool = List.copyOf(pool);
    activeInterviews = List.copyOf(activeInterviews);
  }
}
