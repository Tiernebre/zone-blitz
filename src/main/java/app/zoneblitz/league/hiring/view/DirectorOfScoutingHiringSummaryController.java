package app.zoneblitz.league.hiring.view;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.server.ResponseStatusException;

/**
 * Web entry for the "Initial Director of Scouting Hiring Summary" page, shown after the user hires
 * their DoS. Read-only; the only action is to advance the phase, which the shared header Advance
 * button handles.
 */
@Controller
class DirectorOfScoutingHiringSummaryController {

  private final ViewDirectorOfScoutingHiringSummary viewSummary;

  public DirectorOfScoutingHiringSummaryController(
      ViewDirectorOfScoutingHiringSummary viewSummary) {
    this.viewSummary = viewSummary;
  }

  @GetMapping("/leagues/{id}/hiring/director-of-scouting/summary")
  String page(@AuthenticationPrincipal OAuth2User principal, @PathVariable long id, Model model) {
    var view =
        viewSummary
            .view(id, principal.getAttribute("sub"))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    model.addAttribute("view", view);
    return "league/hiring/director-of-scouting-summary";
  }
}
