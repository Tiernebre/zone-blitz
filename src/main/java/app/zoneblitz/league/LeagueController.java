package app.zoneblitz.league;

import jakarta.validation.Valid;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;

@Controller
class LeagueController {

  private static final Logger log = LoggerFactory.getLogger(LeagueController.class);

  private final ListLeaguesForUser listLeagues;
  private final ListFranchises listFranchises;
  private final CreateLeague createLeague;

  LeagueController(
      ListLeaguesForUser listLeagues, ListFranchises listFranchises, CreateLeague createLeague) {
    this.listLeagues = listLeagues;
    this.listFranchises = listFranchises;
    this.createLeague = createLeague;
  }

  @GetMapping("/")
  String home(@AuthenticationPrincipal OAuth2User principal, Model model) {
    List<LeagueSummary> leagues =
        principal == null ? List.of() : listLeagues.listFor(principal.getAttribute("sub"));
    model.addAttribute("leagues", leagues);
    return "index";
  }

  @GetMapping("/leagues/new")
  String newLeagueForm(Model model) {
    if (!model.containsAttribute("form")) {
      model.addAttribute("form", new CreateLeagueRequest());
    }
    model.addAttribute("franchises", listFranchises.list());
    return "league/new";
  }

  @PostMapping("/leagues")
  String create(
      @AuthenticationPrincipal OAuth2User principal,
      @Valid @ModelAttribute("form") CreateLeagueRequest form,
      BindingResult binding,
      Model model) {
    if (binding.hasErrors()) {
      model.addAttribute("franchises", listFranchises.list());
      return "league/new";
    }

    var ownerSubject = principal.<String>getAttribute("sub");
    var result = createLeague.create(ownerSubject, form.name(), form.franchiseId());

    return switch (result) {
      case CreateLeagueResult.Created created -> {
        log.info("league created id={} owner={}", created.league().id(), ownerSubject);
        yield "redirect:/";
      }
      case CreateLeagueResult.NameTaken taken -> {
        binding.rejectValue("name", "name.taken", "You already have a league with that name.");
        model.addAttribute("franchises", listFranchises.list());
        yield "league/new";
      }
      case CreateLeagueResult.UnknownFranchise unknown -> {
        binding.rejectValue(
            "franchiseId", "franchise.unknown", "Please choose a franchise from the list.");
        model.addAttribute("franchises", listFranchises.list());
        yield "league/new";
      }
    };
  }
}
