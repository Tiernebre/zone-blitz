package app.zoneblitz.league.hiring.view;

import app.zoneblitz.league.LeagueSummary;
import app.zoneblitz.league.hiring.LeagueHire;
import java.util.List;
import java.util.Objects;

/**
 * View-model for the post-hire summary page. {@code hires} contains one row per team in the league
 * with the team's HC hire attached, ordered with the viewer's team first.
 */
public record HeadCoachHiringSummaryView(LeagueSummary league, List<LeagueHire> hires) {

  public HeadCoachHiringSummaryView {
    Objects.requireNonNull(league, "league");
    hires = List.copyOf(hires);
  }

  public int filledCount() {
    return (int) hires.stream().filter(h -> h.hire().isPresent()).count();
  }
}
