package app.zoneblitz.league.cap;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.server.ResponseStatusException;

@Controller
class StaffCapController {

  private final ViewStaffCap viewStaffCap;

  StaffCapController(ViewStaffCap viewStaffCap) {
    this.viewStaffCap = viewStaffCap;
  }

  @GetMapping("/leagues/{id}/staff-cap")
  String page(@AuthenticationPrincipal OAuth2User principal, @PathVariable long id, Model model) {
    var view =
        viewStaffCap
            .view(id, principal.getAttribute("sub"))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    model.addAttribute("view", view);
    return "league/staff-cap";
  }
}
