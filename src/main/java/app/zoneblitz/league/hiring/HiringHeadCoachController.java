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
 * Web controller for the HIRING_HEAD_COACH page and its HTMX fragment endpoints. Follows project
 * convention: separate URLs for full pages vs fragments; fragments return {@code text/html}; page
 * template composes the same fragments returned by the fragment endpoints.
 */
@Controller
public class HiringHeadCoachController {

  private static final Logger log = LoggerFactory.getLogger(HiringHeadCoachController.class);

  private final ViewHeadCoachHiring viewHiring;
  private final ManageHeadCoachShortlist shortlist;
  private final StartInterview startInterview;
  private final MakeOffer makeOffer;

  public HiringHeadCoachController(
      ViewHeadCoachHiring viewHiring,
      ManageHeadCoachShortlist shortlist,
      StartInterview startInterview,
      MakeOffer makeOffer) {
    this.viewHiring = viewHiring;
    this.shortlist = shortlist;
    this.startInterview = startInterview;
    this.makeOffer = makeOffer;
  }

  @GetMapping("/leagues/{id}/hiring/head-coach")
  String page(@AuthenticationPrincipal OAuth2User principal, @PathVariable long id, Model model) {
    var view = resolveView(principal, id);
    model.addAttribute("view", view);
    return "league/hiring/head-coach";
  }

  @GetMapping("/leagues/{id}/hiring/head-coach/pool")
  String poolFragment(
      @AuthenticationPrincipal OAuth2User principal, @PathVariable long id, Model model) {
    model.addAttribute("view", resolveView(principal, id));
    return "league/hiring/head-coach-fragments :: pool";
  }

  @GetMapping("/leagues/{id}/hiring/head-coach/interviews")
  String interviewsFragment(
      @AuthenticationPrincipal OAuth2User principal, @PathVariable long id, Model model) {
    model.addAttribute("view", resolveView(principal, id));
    return "league/hiring/head-coach-fragments :: interviews";
  }

  @PostMapping("/leagues/{id}/hiring/head-coach/interview/{candidateId}")
  String startInterview(
      @AuthenticationPrincipal OAuth2User principal,
      @PathVariable long id,
      @PathVariable long candidateId,
      Model model) {
    var result = startInterview.start(id, candidateId, principal.getAttribute("sub"));
    return renderInterview(result, model);
  }

  @GetMapping("/leagues/{id}/hiring/head-coach/shortlist")
  String shortlistFragment(
      @AuthenticationPrincipal OAuth2User principal, @PathVariable long id, Model model) {
    model.addAttribute("view", resolveView(principal, id));
    return "league/hiring/head-coach-fragments :: shortlist";
  }

  @PostMapping("/leagues/{id}/hiring/head-coach/shortlist/{candidateId}")
  String addToShortlist(
      @AuthenticationPrincipal OAuth2User principal,
      @PathVariable long id,
      @PathVariable long candidateId,
      Model model) {
    var result = shortlist.add(id, candidateId, principal.getAttribute("sub"));
    return renderMutation(result, model);
  }

  @DeleteMapping("/leagues/{id}/hiring/head-coach/shortlist/{candidateId}")
  String removeFromShortlist(
      @AuthenticationPrincipal OAuth2User principal,
      @PathVariable long id,
      @PathVariable long candidateId,
      Model model) {
    var result = shortlist.remove(id, candidateId, principal.getAttribute("sub"));
    return renderMutation(result, model);
  }

  @PostMapping("/leagues/{id}/hiring/head-coach/offer/{candidateId}")
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
            "offer submitted leagueId={} candidateId={} offerId={}",
            id,
            candidateId,
            created.offer().id());
        model.addAttribute("view", resolveView(principal, id));
        yield "league/hiring/head-coach-fragments :: combined";
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

  private HeadCoachHiringView resolveView(OAuth2User principal, long id) {
    return viewHiring
        .view(id, principal.getAttribute("sub"))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
  }

  private String renderInterview(InterviewResult result, Model model) {
    return switch (result) {
      case InterviewResult.Started started -> {
        model.addAttribute("view", started.view());
        log.info(
            "interview started leagueId={} interviewsThisWeek={}",
            started.view().league().leagueId(),
            started.view().interviewsThisWeek());
        yield "league/hiring/head-coach-fragments :: combined";
      }
      case InterviewResult.NotFound ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
      case InterviewResult.UnknownCandidate ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
      case InterviewResult.CapacityReached capacity ->
          throw new ResponseStatusException(
              HttpStatus.CONFLICT,
              "Weekly interview capacity of %d already reached".formatted(capacity.capacity()));
    };
  }

  private String renderMutation(ShortlistResult result, Model model) {
    return switch (result) {
      case ShortlistResult.Updated updated -> {
        model.addAttribute("view", updated.view());
        log.info(
            "shortlist updated leagueId={} size={}",
            updated.view().league().leagueId(),
            updated.view().shortlist().size());
        yield "league/hiring/head-coach-fragments :: combined";
      }
      case ShortlistResult.NotFound ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
      case ShortlistResult.UnknownCandidate ignored ->
          throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    };
  }
}
