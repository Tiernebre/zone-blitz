package app.zoneblitz.league.staff;

import app.zoneblitz.league.phase.LeaguePhase;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.server.ResponseStatusException;

/**
 * Web entry for the {@link LeaguePhase#ASSEMBLING_STAFF} recap page. The page is read-only; the
 * single user action — advance to the next phase — is wired through the shared {@code
 * /leagues/{id}/advance} endpoint in the league feature's controller, which every phase dashboard
 * shares.
 */
@Controller
public class StaffRecapController {

  private final ViewStaffRecap viewStaffRecap;

  public StaffRecapController(ViewStaffRecap viewStaffRecap) {
    this.viewStaffRecap = viewStaffRecap;
  }

  @GetMapping("/leagues/{id}/staff-recap")
  String page(@AuthenticationPrincipal OAuth2User principal, @PathVariable long id, Model model) {
    var view =
        viewStaffRecap
            .view(id, principal.getAttribute("sub"))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    model.addAttribute("view", view);
    return "league/staff-recap";
  }
}
