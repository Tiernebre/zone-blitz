package app.zoneblitz.league;

import java.util.List;
import java.util.Objects;

/** Composite page/fragment view-model for the HIRING_HEAD_COACH page. */
public record HeadCoachHiringView(
    LeagueSummary league,
    List<HeadCoachCandidateView> pool,
    List<HeadCoachCandidateView> shortlist) {

  public HeadCoachHiringView {
    Objects.requireNonNull(league, "league");
    pool = List.copyOf(pool);
    shortlist = List.copyOf(shortlist);
  }
}
