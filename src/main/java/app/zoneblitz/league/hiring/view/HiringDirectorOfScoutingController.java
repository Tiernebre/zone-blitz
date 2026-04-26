package app.zoneblitz.league.hiring.view;

import app.zoneblitz.league.hiring.DeclineCounterOffer;
import app.zoneblitz.league.hiring.DeclineCounterOfferResult;
import app.zoneblitz.league.hiring.HireCandidate;
import app.zoneblitz.league.hiring.HireCandidateResult;
import app.zoneblitz.league.hiring.InterviewResult;
import app.zoneblitz.league.hiring.MakeOffer;
import app.zoneblitz.league.hiring.MakeOfferResult;
import app.zoneblitz.league.hiring.MatchCounterOffer;
import app.zoneblitz.league.hiring.MatchCounterOfferResult;
import app.zoneblitz.league.hiring.StartInterview;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;

/**
 * Web controller for the HIRING_DIRECTOR_OF_SCOUTING page. Mirrors {@link
 * HiringHeadCoachController}. The underlying interview / offer / hire use cases are phase-agnostic
 * (they route on {@code league.phase()}), so this controller reuses them and re-renders the DoS
 * view after each mutation.
 */
@Controller
class HiringDirectorOfScoutingController {

  private static final Logger log =
      LoggerFactory.getLogger(HiringDirectorOfScoutingController.class);

  private final ViewDirectorOfScoutingHiring viewHiring;
  private final StartInterview startInterview;
  private final MakeOffer makeOffer;
  private final HireCandidate hireCandidate;
  private final MatchCounterOffer matchCounterOffer;
  private final DeclineCounterOffer declineCounterOffer;

  public HiringDirectorOfScoutingController(
      ViewDirectorOfScoutingHiring viewHiring,
      StartInterview startInterview,
      MakeOffer makeOffer,
      HireCandidate hireCandidate,
      MatchCounterOffer matchCounterOffer,
      DeclineCounterOffer declineCounterOffer) {
    this.viewHiring = viewHiring;
    this.startInterview = startInterview;
    this.makeOffer = makeOffer;
    this.hireCandidate = hireCandidate;
    this.matchCounterOffer = matchCounterOffer;
    this.declineCounterOffer = declineCounterOffer;
  }

  @ModelAttribute("poolQuery")
  DirectorOfScoutingPoolQuery poolQuery(
      @RequestParam(name = "q", required = false) String q,
      @RequestParam(name = "archetype", required = false) String archetype,
      @RequestParam(name = "specialty", required = false) String specialty,
      @RequestParam(name = "status", required = false) String status,
      @RequestParam(name = "sort", required = false) DirectorOfScoutingPoolQuery.SortKey sort,
      @RequestParam(name = "dir", required = false) DirectorOfScoutingPoolQuery.SortDir dir,
      @RequestParam(name = "page", required = false, defaultValue = "1") int page,
      @RequestParam(name = "pageSize", required = false, defaultValue = "10") int pageSize) {
    return new DirectorOfScoutingPoolQuery(
        q, archetype, specialty, status, sort, dir, page, pageSize);
  }

  @GetMapping("/leagues/{id}/hiring/director-of-scouting")
  String page(
      @AuthenticationPrincipal OAuth2User principal,
      @PathVariable long id,
      @ModelAttribute("poolQuery") DirectorOfScoutingPoolQuery poolQuery,
      Model model) {
    var view = resolveView(principal, id);
    if (userHasHired(view)) {
      return "redirect:/leagues/" + id + "/hiring/director-of-scouting/summary";
    }
    addPoolModel(model, view, poolQuery);
    return "league/hiring/director-of-scouting";
  }

  private static boolean userHasHired(DirectorOfScoutingHiringView view) {
    var userTeamId = view.league().userTeamId();
    return view.leagueHires().stream()
        .anyMatch(h -> h.teamId() == userTeamId && h.hire().isPresent());
  }

  @GetMapping("/leagues/{id}/hiring/director-of-scouting/pool")
  String poolFragment(
      @AuthenticationPrincipal OAuth2User principal,
      @PathVariable long id,
      @ModelAttribute("poolQuery") DirectorOfScoutingPoolQuery poolQuery,
      Model model) {
    addPoolModel(model, resolveView(principal, id), poolQuery);
    return "league/hiring/director-of-scouting-fragments :: pool";
  }

  @GetMapping("/leagues/{id}/hiring/director-of-scouting/candidates")
  String candidatesFragment(
      @AuthenticationPrincipal OAuth2User principal, @PathVariable long id, Model model) {
    model.addAttribute("view", resolveView(principal, id));
    return "league/hiring/director-of-scouting-fragments :: candidates";
  }

  @PostMapping("/leagues/{id}/hiring/director-of-scouting/interview/{candidateId}")
  String startInterview(
      @AuthenticationPrincipal OAuth2User principal,
      @PathVariable long id,
      @PathVariable long candidateId,
      @ModelAttribute("poolQuery") DirectorOfScoutingPoolQuery poolQuery,
      Model model) {
    var result = startInterview.start(id, candidateId, principal.getAttribute("sub"));
    return switch (result) {
      case InterviewResult.Started ignored -> {
        log.info("dos interview started leagueId={} candidateId={}", id, candidateId);
        addPoolModel(model, resolveView(principal, id), poolQuery);
        yield "league/hiring/director-of-scouting-fragments :: combined";
      }
      case InterviewResult.NotFound ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
      case InterviewResult.UnknownCandidate ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
      case InterviewResult.CapacityReached capacity ->
          throw new ResponseStatusException(
              HttpStatus.CONFLICT,
              "Daily interview capacity of %d already reached".formatted(capacity.capacity()));
      case InterviewResult.AlreadyInterviewed ignored ->
          throw new ResponseStatusException(HttpStatus.CONFLICT, "Candidate already interviewed");
    };
  }

  @PostMapping("/leagues/{id}/hiring/director-of-scouting/offer/{candidateId}")
  String submitOffer(
      @AuthenticationPrincipal OAuth2User principal,
      @PathVariable long id,
      @PathVariable long candidateId,
      @ModelAttribute MakeOfferForm form,
      @ModelAttribute("poolQuery") DirectorOfScoutingPoolQuery poolQuery,
      Model model) {
    var result = makeOffer.offer(id, candidateId, principal.getAttribute("sub"), form.toTerms());
    return switch (result) {
      case MakeOfferResult.Created created -> {
        log.info(
            "dos offer submitted leagueId={} candidateId={} offerId={} revision={}",
            id,
            candidateId,
            created.offer().id(),
            created.offer().revisionCount());
        addPoolModel(model, resolveView(principal, id), poolQuery);
        yield "league/hiring/director-of-scouting-fragments :: combined";
      }
      case MakeOfferResult.NotFound ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
      case MakeOfferResult.UnknownCandidate ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
      case MakeOfferResult.AlreadyHired ignored ->
          throw new ResponseStatusException(HttpStatus.CONFLICT);
      case MakeOfferResult.CandidateNotInterested ignored ->
          throw new ResponseStatusException(
              HttpStatus.CONFLICT, "Candidate not interested — interview required first");
      case MakeOfferResult.RevisionCapReached capped ->
          throw new ResponseStatusException(
              HttpStatus.CONFLICT,
              "Candidate has walked — %d revisions exhausted".formatted(capped.revisionCount()));
      case MakeOfferResult.OffersNotYetOpen notYet ->
          throw new ResponseStatusException(
              HttpStatus.CONFLICT,
              "Offers open on day %d (currently day %d)"
                  .formatted(notYet.offersOpenOnDay(), notYet.phaseDay()));
      case MakeOfferResult.InsufficientBudget budget ->
          throw new ResponseStatusException(
              HttpStatus.CONFLICT,
              "Offer exceeds staff budget: $%d available, $%d required"
                  .formatted(budget.availableCents() / 100, budget.requiredCents() / 100));
      case MakeOfferResult.CounterPendingOutstanding ignored ->
          throw new ResponseStatusException(
              HttpStatus.CONFLICT,
              "Candidate has an outstanding counter — match or decline it before revising");
    };
  }

  @PostMapping("/leagues/{id}/hiring/director-of-scouting/hire/{candidateId}")
  String hire(
      @AuthenticationPrincipal OAuth2User principal,
      @PathVariable long id,
      @PathVariable long candidateId,
      Model model,
      HttpServletResponse response) {
    var result = hireCandidate.hire(id, candidateId, principal.getAttribute("sub"));
    return switch (result) {
      case HireCandidateResult.Hired hired -> {
        log.info(
            "dos user hire leagueId={} candidateId={} teamId={}",
            id,
            hired.candidateId(),
            hired.teamId());
        response.setHeader(
            "HX-Redirect", "/leagues/" + id + "/hiring/director-of-scouting/summary");
        yield "league/hiring/director-of-scouting-fragments :: redirecting";
      }
      case HireCandidateResult.NotFound ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
      case HireCandidateResult.UnknownCandidate ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
      case HireCandidateResult.NoAgreedOffer ignored ->
          throw new ResponseStatusException(
              HttpStatus.CONFLICT, "Candidate has not agreed to an offer yet");
      case HireCandidateResult.AlreadyHired ignored ->
          throw new ResponseStatusException(HttpStatus.CONFLICT);
    };
  }

  @PostMapping("/leagues/{id}/hiring/director-of-scouting/counter/{offerId}/match")
  String matchCounter(
      @AuthenticationPrincipal OAuth2User principal,
      @PathVariable long id,
      @PathVariable long offerId,
      @ModelAttribute("poolQuery") DirectorOfScoutingPoolQuery poolQuery,
      Model model) {
    var result = matchCounterOffer.match(id, offerId, principal.getAttribute("sub"));
    return switch (result) {
      case MatchCounterOfferResult.Matched matched -> {
        log.info(
            "dos counter matched leagueId={} offerId={} revision={}",
            id,
            matched.offer().id(),
            matched.offer().revisionCount());
        addPoolModel(model, resolveView(principal, id), poolQuery);
        yield "league/hiring/director-of-scouting-fragments :: combined";
      }
      case MatchCounterOfferResult.NotFound ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
      case MatchCounterOfferResult.NotCounterPending ignored ->
          throw new ResponseStatusException(
              HttpStatus.CONFLICT, "Offer is not in a counter-pending state");
      case MatchCounterOfferResult.InsufficientBudget budget ->
          throw new ResponseStatusException(
              HttpStatus.CONFLICT,
              "Match exceeds staff budget: $%d available, $%d required"
                  .formatted(budget.availableCents() / 100, budget.requiredCents() / 100));
      case MatchCounterOfferResult.DeadlineExpired expired ->
          throw new ResponseStatusException(
              HttpStatus.UNPROCESSABLE_ENTITY,
              "Counter deadline passed on day %d (currently day %d)"
                  .formatted(expired.deadlineDay(), expired.currentDay()));
    };
  }

  @PostMapping("/leagues/{id}/hiring/director-of-scouting/counter/{offerId}/decline")
  String declineCounter(
      @AuthenticationPrincipal OAuth2User principal,
      @PathVariable long id,
      @PathVariable long offerId,
      @ModelAttribute("poolQuery") DirectorOfScoutingPoolQuery poolQuery,
      Model model) {
    var result = declineCounterOffer.decline(id, offerId, principal.getAttribute("sub"));
    return switch (result) {
      case DeclineCounterOfferResult.Declined declined -> {
        log.info("dos counter declined leagueId={} offerId={}", id, declined.offerId());
        addPoolModel(model, resolveView(principal, id), poolQuery);
        yield "league/hiring/director-of-scouting-fragments :: combined";
      }
      case DeclineCounterOfferResult.NotFound ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
      case DeclineCounterOfferResult.NotCounterPending ignored ->
          throw new ResponseStatusException(
              HttpStatus.CONFLICT, "Offer is not in a counter-pending state");
    };
  }

  private DirectorOfScoutingHiringView resolveView(OAuth2User principal, long id) {
    return viewHiring
        .view(id, principal.getAttribute("sub"))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
  }

  private static void addPoolModel(
      Model model, DirectorOfScoutingHiringView view, DirectorOfScoutingPoolQuery query) {
    model.addAttribute("view", view);
    model.addAttribute("poolPage", DirectorOfScoutingPoolFilter.apply(view.pool(), query));
  }
}
