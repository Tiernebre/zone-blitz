package app.zoneblitz.league.hiring;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.server.ResponseStatusException;

/**
 * Web controller for the HIRING_DIRECTOR_OF_SCOUTING page and its HTMX fragment endpoints. Mirrors
 * {@link HiringHeadCoachController}. The underlying shortlist / interview / offer use cases are
 * phase-agnostic (they route on {@code league.phase()}), so this controller reuses them and
 * re-renders the DoS view from {@link ViewDirectorOfScoutingHiring} after each mutation.
 */
@Controller
public class HiringDirectorOfScoutingController {

  private static final Logger log =
      LoggerFactory.getLogger(HiringDirectorOfScoutingController.class);

  private final ViewDirectorOfScoutingHiring viewHiring;
  private final ManageHeadCoachShortlist shortlist;
  private final StartInterview startInterview;
  private final MakeOffer makeOffer;

  public HiringDirectorOfScoutingController(
      ViewDirectorOfScoutingHiring viewHiring,
      ManageHeadCoachShortlist shortlist,
      StartInterview startInterview,
      MakeOffer makeOffer) {
    this.viewHiring = viewHiring;
    this.shortlist = shortlist;
    this.startInterview = startInterview;
    this.makeOffer = makeOffer;
  }

  @GetMapping("/leagues/{id}/hiring/director-of-scouting")
  String page(@AuthenticationPrincipal OAuth2User principal, @PathVariable long id, Model model) {
    var view = resolveView(principal, id);
    model.addAttribute("view", view);
    return "league/hiring/director-of-scouting";
  }

  @GetMapping("/leagues/{id}/hiring/director-of-scouting/pool")
  String poolFragment(
      @AuthenticationPrincipal OAuth2User principal, @PathVariable long id, Model model) {
    model.addAttribute("view", resolveView(principal, id));
    return "league/hiring/director-of-scouting-fragments :: pool";
  }

  @GetMapping("/leagues/{id}/hiring/director-of-scouting/interviews")
  String interviewsFragment(
      @AuthenticationPrincipal OAuth2User principal, @PathVariable long id, Model model) {
    model.addAttribute("view", resolveView(principal, id));
    return "league/hiring/director-of-scouting-fragments :: interviews";
  }

  @PostMapping("/leagues/{id}/hiring/director-of-scouting/interview/{candidateId}")
  String startInterview(
      @AuthenticationPrincipal OAuth2User principal,
      @PathVariable long id,
      @PathVariable long candidateId,
      Model model) {
    var result = startInterview.start(id, candidateId, principal.getAttribute("sub"));
    return switch (result) {
      case InterviewResult.Started ignored -> {
        log.info("dos interview started leagueId={} candidateId={}", id, candidateId);
        model.addAttribute("view", resolveView(principal, id));
        yield "league/hiring/director-of-scouting-fragments :: combined";
      }
      case InterviewResult.NotFound ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
      case InterviewResult.UnknownCandidate ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
      case InterviewResult.CapacityReached capacity ->
          throw new ResponseStatusException(
              HttpStatus.CONFLICT,
              "Weekly interview capacity of %d already reached".formatted(capacity.capacity()));
      case InterviewResult.AlreadyInterviewed ignored ->
          throw new ResponseStatusException(HttpStatus.CONFLICT, "Candidate already interviewed");
    };
  }

  @GetMapping("/leagues/{id}/hiring/director-of-scouting/shortlist")
  String shortlistFragment(
      @AuthenticationPrincipal OAuth2User principal, @PathVariable long id, Model model) {
    model.addAttribute("view", resolveView(principal, id));
    return "league/hiring/director-of-scouting-fragments :: shortlist";
  }

  @PostMapping("/leagues/{id}/hiring/director-of-scouting/shortlist/{candidateId}")
  String addToShortlist(
      @AuthenticationPrincipal OAuth2User principal,
      @PathVariable long id,
      @PathVariable long candidateId,
      Model model) {
    var result = shortlist.add(id, candidateId, principal.getAttribute("sub"));
    return renderMutation(result, principal, id, model);
  }

  @DeleteMapping("/leagues/{id}/hiring/director-of-scouting/shortlist/{candidateId}")
  String removeFromShortlist(
      @AuthenticationPrincipal OAuth2User principal,
      @PathVariable long id,
      @PathVariable long candidateId,
      Model model) {
    var result = shortlist.remove(id, candidateId, principal.getAttribute("sub"));
    return renderMutation(result, principal, id, model);
  }

  @PostMapping("/leagues/{id}/hiring/director-of-scouting/offer/{candidateId}")
  String submitOffer(
      @AuthenticationPrincipal OAuth2User principal,
      @PathVariable long id,
      @PathVariable long candidateId,
      @ModelAttribute MakeOfferForm form,
      Model model) {
    var result = makeOffer.offer(id, candidateId, principal.getAttribute("sub"), form.toTerms());
    return switch (result) {
      case MakeOfferResult.Created created -> {
        log.info(
            "dos offer submitted leagueId={} candidateId={} offerId={}",
            id,
            candidateId,
            created.offer().id());
        model.addAttribute("view", resolveView(principal, id));
        yield "league/hiring/director-of-scouting-fragments :: combined";
      }
      case MakeOfferResult.NotFound ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
      case MakeOfferResult.UnknownCandidate ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
      case MakeOfferResult.AlreadyHired ignored ->
          throw new ResponseStatusException(HttpStatus.CONFLICT);
      case MakeOfferResult.ActiveOfferExists ignored ->
          throw new ResponseStatusException(HttpStatus.CONFLICT);
    };
  }

  private DirectorOfScoutingHiringView resolveView(OAuth2User principal, long id) {
    return viewHiring
        .view(id, principal.getAttribute("sub"))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
  }

  private String renderMutation(
      ShortlistResult result, OAuth2User principal, long leagueId, Model model) {
    return switch (result) {
      case ShortlistResult.Updated updated -> {
        log.info("dos shortlist updated leagueId={}", updated.view().league().leagueId());
        model.addAttribute("view", resolveView(principal, leagueId));
        yield "league/hiring/director-of-scouting-fragments :: combined";
      }
      case ShortlistResult.NotFound ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
      case ShortlistResult.UnknownCandidate ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    };
  }
}
