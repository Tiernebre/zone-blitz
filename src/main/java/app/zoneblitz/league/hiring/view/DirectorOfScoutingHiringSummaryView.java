package app.zoneblitz.league.hiring.view;

import app.zoneblitz.league.LeagueSummary;
import app.zoneblitz.league.hiring.LeagueHire;
import java.util.List;
import java.util.Objects;

/**
 * View-model for the post-hire DoS summary page. {@code hires} contains one row per team in the
 * league with the team's DoS hire attached, ordered with the viewer's team first.
 */
public record DirectorOfScoutingHiringSummaryView(LeagueSummary league, List<LeagueHire> hires) {

  public DirectorOfScoutingHiringSummaryView {
    Objects.requireNonNull(league, "league");
    hires = List.copyOf(hires);
  }

  public int filledCount() {
    return (int) hires.stream().filter(h -> h.hire().isPresent()).count();
  }
}
