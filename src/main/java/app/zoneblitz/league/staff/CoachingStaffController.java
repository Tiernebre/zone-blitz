package app.zoneblitz.league.staff;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.server.ResponseStatusException;

/** Web entry for the viewer-team coaching staff org-chart page. */
@Controller
public class CoachingStaffController {

  private final ViewCoachingStaffOrgChart viewChart;

  public CoachingStaffController(ViewCoachingStaffOrgChart viewChart) {
    this.viewChart = viewChart;
  }

  @GetMapping("/leagues/{id}/coaching-staff")
  String page(@AuthenticationPrincipal OAuth2User principal, @PathVariable long id, Model model) {
    var view =
        viewChart
            .view(id, principal.getAttribute("sub"))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    model.addAttribute("view", view);
    return "league/coaching-staff";
  }
}
