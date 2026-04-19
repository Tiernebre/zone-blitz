package app.zoneblitz.league;

import app.zoneblitz.league.franchise.ListFranchises;
import app.zoneblitz.league.phase.LeaguePhase;
import jakarta.validation.Valid;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;

@Controller
public class LeagueController {

  private static final Logger log = LoggerFactory.getLogger(LeagueController.class);

  private final ListLeaguesForUser listLeagues;
  private final ListFranchises listFranchises;
  private final CreateLeague createLeague;
  private final GetLeague getLeague;
  private final DeleteLeague deleteLeague;
  private final AdvanceDay advanceDay;

  public LeagueController(
      ListLeaguesForUser listLeagues,
      ListFranchises listFranchises,
      CreateLeague createLeague,
      GetLeague getLeague,
      DeleteLeague deleteLeague,
      AdvanceDay advanceDay) {
    this.listLeagues = listLeagues;
    this.listFranchises = listFranchises;
    this.createLeague = createLeague;
    this.getLeague = getLeague;
    this.deleteLeague = deleteLeague;
    this.advanceDay = advanceDay;
  }

  @GetMapping("/")
  String home(
      @AuthenticationPrincipal OAuth2User principal,
      @RequestParam(name = "q", required = false) String q,
      @RequestParam(name = "name", required = false) String name,
      @RequestParam(name = "franchise", required = false) String franchise,
      @RequestParam(name = "phase", required = false) String phase,
      @RequestParam(name = "sort", required = false) LeagueTableQuery.SortKey sort,
      @RequestParam(name = "dir", required = false) LeagueTableQuery.SortDir dir,
      @RequestParam(name = "page", required = false, defaultValue = "1") int page,
      @RequestParam(name = "pageSize", required = false, defaultValue = "10") int pageSize,
      Model model) {
    var query = new LeagueTableQuery(q, name, franchise, phase, sort, dir, page, pageSize);
    model.addAttribute("tablePage", resolveTablePage(principal, query));
    return "index";
  }

  @GetMapping("/leagues/rows")
  String leaguesTableFragment(
      @AuthenticationPrincipal OAuth2User principal,
      @RequestParam(name = "q", required = false) String q,
      @RequestParam(name = "name", required = false) String name,
      @RequestParam(name = "franchise", required = false) String franchise,
      @RequestParam(name = "phase", required = false) String phase,
      @RequestParam(name = "sort", required = false) LeagueTableQuery.SortKey sort,
      @RequestParam(name = "dir", required = false) LeagueTableQuery.SortDir dir,
      @RequestParam(name = "page", required = false, defaultValue = "1") int page,
      @RequestParam(name = "pageSize", required = false, defaultValue = "10") int pageSize,
      Model model) {
    var query = new LeagueTableQuery(q, name, franchise, phase, sort, dir, page, pageSize);
    model.addAttribute("tablePage", resolveTablePage(principal, query));
    return "leagues-table-fragments :: table";
  }

  private LeagueTablePage resolveTablePage(OAuth2User principal, LeagueTableQuery query) {
    List<LeagueSummary> leagues =
        principal == null ? List.of() : listLeagues.listFor(principal.getAttribute("sub"));
    return LeagueTableFilter.apply(leagues, query);
  }

  @GetMapping("/leagues/{id}")
  String dashboard(
      @AuthenticationPrincipal OAuth2User principal, @PathVariable long id, Model model) {
    var league =
        getLeague
            .get(id, principal.getAttribute("sub"))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    model.addAttribute("league", league);
    return "league/dashboard";
  }

  @GetMapping("/leagues/{id}/settings")
  String settings(
      @AuthenticationPrincipal OAuth2User principal, @PathVariable long id, Model model) {
    var league =
        getLeague
            .get(id, principal.getAttribute("sub"))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    model.addAttribute("league", league);
    return "league/settings";
  }

  @PostMapping("/leagues/{id}/advance")
  String advance(@AuthenticationPrincipal OAuth2User principal, @PathVariable long id) {
    var ownerSubject = principal.<String>getAttribute("sub");
    var result = advanceDay.advance(id, ownerSubject);
    return switch (result) {
      case AdvanceDayResult.Ticked ticked -> {
        log.info(
            "league day advanced id={} phase={} day={} transitionedTo={}",
            ticked.leagueId(),
            ticked.phase(),
            ticked.phaseDay(),
            ticked.transitionedTo().map(Enum::name).orElse("none"));
        yield "redirect:" + landingPathFor(id, ticked.phase());
      }
      case AdvanceDayResult.NotFound ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    };
  }

  private static String landingPathFor(long id, LeaguePhase phase) {
    return switch (phase) {
      case HIRING_HEAD_COACH -> "/leagues/" + id + "/hiring/head-coach";
      case HIRING_DIRECTOR_OF_SCOUTING -> "/leagues/" + id + "/hiring/director-of-scouting";
      case ASSEMBLING_STAFF -> "/leagues/" + id + "/staff-recap";
      case INITIAL_SETUP, COMPLETE -> "/leagues/" + id;
    };
  }

  @PostMapping("/leagues/{id}/delete")
  String delete(@AuthenticationPrincipal OAuth2User principal, @PathVariable long id) {
    var ownerSubject = principal.<String>getAttribute("sub");
    var result = deleteLeague.delete(id, ownerSubject);
    return switch (result) {
      case DeleteLeagueResult.Deleted deleted -> {
        log.info("league deleted id={} owner={}", deleted.leagueId(), ownerSubject);
        yield "redirect:/";
      }
      case DeleteLeagueResult.NotFound ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    };
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
        yield "redirect:/leagues/" + created.league().id();
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
