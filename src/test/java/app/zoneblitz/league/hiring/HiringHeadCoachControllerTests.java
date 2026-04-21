package app.zoneblitz.league.hiring;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.view;

import app.zoneblitz.config.SecurityConfig;
import app.zoneblitz.league.LeagueSummary;
import app.zoneblitz.league.franchise.Franchise;
import app.zoneblitz.league.geography.City;
import app.zoneblitz.league.geography.State;
import app.zoneblitz.league.phase.LeaguePhase;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.security.autoconfigure.SecurityAutoConfiguration;
import org.springframework.boot.security.autoconfigure.web.servlet.ServletWebSecurityAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(HiringHeadCoachController.class)
@Import(SecurityConfig.class)
@ImportAutoConfiguration({
  SecurityAutoConfiguration.class,
  ServletWebSecurityAutoConfiguration.class
})
class HiringHeadCoachControllerTests {

  @Autowired MockMvc mvc;

  @MockitoBean ViewHeadCoachHiring viewHiring;
  @MockitoBean StartInterview startInterview;
  @MockitoBean MakeOffer makeOffer;
  @MockitoBean HireCandidate hireCandidate;
  @MockitoBean MatchCounterOffer matchCounterOffer;
  @MockitoBean DeclineCounterOffer declineCounterOffer;
  @MockitoBean ClientRegistrationRepository clientRegistrationRepository;

  @Test
  void page_whenFound_rendersPageTemplate() throws Exception {
    given(viewHiring.view(42L, "sub-1")).willReturn(Optional.of(sampleView()));

    mvc.perform(
            get("/leagues/42/hiring/head-coach")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isOk())
        .andExpect(view().name("league/hiring/head-coach"));
  }

  @Test
  void page_whenMissing_returns404() throws Exception {
    given(viewHiring.view(42L, "sub-1")).willReturn(Optional.empty());

    mvc.perform(
            get("/leagues/42/hiring/head-coach")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isNotFound());
  }

  @Test
  void poolFragment_returnsFragment() throws Exception {
    given(viewHiring.view(42L, "sub-1")).willReturn(Optional.of(sampleView()));

    mvc.perform(
            get("/leagues/42/hiring/head-coach/pool")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isOk())
        .andExpect(view().name("league/hiring/head-coach-fragments :: pool"));
  }

  @Test
  void candidatesFragment_returnsFragment() throws Exception {
    given(viewHiring.view(42L, "sub-1")).willReturn(Optional.of(sampleView()));

    mvc.perform(
            get("/leagues/42/hiring/head-coach/candidates")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isOk())
        .andExpect(view().name("league/hiring/head-coach-fragments :: candidates"));
  }

  @Test
  void startInterview_whenStarted_rendersCombinedFragment() throws Exception {
    given(viewHiring.view(42L, "sub-1")).willReturn(Optional.of(sampleView()));
    given(startInterview.start(42L, 7L, "sub-1")).willReturn(new InterviewResult.Started(7L));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/interview/7")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isOk())
        .andExpect(view().name("league/hiring/head-coach-fragments :: combined"));

    verify(startInterview).start(42L, 7L, "sub-1");
  }

  @Test
  void startInterview_whenCapacityReached_returns409() throws Exception {
    given(startInterview.start(42L, 7L, "sub-1"))
        .willReturn(new InterviewResult.CapacityReached(3));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/interview/7")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isConflict());
  }

  @Test
  void startInterview_whenNotFound_returns404() throws Exception {
    given(startInterview.start(42L, 7L, "sub-1")).willReturn(new InterviewResult.NotFound(42L));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/interview/7")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isNotFound());
  }

  @Test
  void startInterview_requiresCsrf() throws Exception {
    mvc.perform(
            post("/leagues/42/hiring/head-coach/interview/7")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isForbidden());
  }

  @Test
  void submitOffer_whenCreated_rendersCombinedFragment() throws Exception {
    given(viewHiring.view(42L, "sub-1")).willReturn(Optional.of(sampleView()));
    given(makeOffer.offer(eq(42L), eq(7L), eq("sub-1"), any()))
        .willReturn(
            new MakeOfferResult.Created(
                new CandidateOffer(
                    1L,
                    7L,
                    99L,
                    "{}",
                    1,
                    OfferStatus.ACTIVE,
                    Optional.of(OfferStance.PENDING),
                    0,
                    Optional.empty(),
                    Optional.empty())));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/offer/7")
                .param("compensation", "8500000")
                .param("contractLengthYears", "5")
                .param("guaranteedMoneyPct", "85")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isOk())
        .andExpect(view().name("league/hiring/head-coach-fragments :: combined"));
  }

  @Test
  void submitOffer_whenRevisionCapReached_returns409() throws Exception {
    given(makeOffer.offer(eq(42L), eq(7L), eq("sub-1"), any()))
        .willReturn(new MakeOfferResult.RevisionCapReached(7L, 3));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/offer/7")
                .param("compensation", "8500000")
                .param("contractLengthYears", "5")
                .param("guaranteedMoneyPct", "85")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isConflict());
  }

  @Test
  void submitOffer_whenUnknownCandidate_returns404() throws Exception {
    given(makeOffer.offer(eq(42L), eq(7L), eq("sub-1"), any()))
        .willReturn(new MakeOfferResult.UnknownCandidate(7L));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/offer/7")
                .param("compensation", "8500000")
                .param("contractLengthYears", "5")
                .param("guaranteedMoneyPct", "85")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isNotFound());
  }

  @Test
  void hire_whenHired_redirectsToSummary() throws Exception {
    given(hireCandidate.hire(42L, 7L, "sub-1")).willReturn(new HireCandidateResult.Hired(7L, 100L));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/hire/7")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isOk())
        .andExpect(header().string("HX-Redirect", "/leagues/42/hiring/head-coach/summary"));

    verify(hireCandidate).hire(42L, 7L, "sub-1");
  }

  @Test
  void hire_whenNoAgreedOffer_returns409() throws Exception {
    given(hireCandidate.hire(42L, 7L, "sub-1"))
        .willReturn(new HireCandidateResult.NoAgreedOffer(7L));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/hire/7")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isConflict());
  }

  @Test
  void submitOffer_requiresCsrf() throws Exception {
    mvc.perform(
            post("/leagues/42/hiring/head-coach/offer/7")
                .param("compensation", "8500000")
                .param("contractLengthYears", "5")
                .param("guaranteedMoneyPct", "85")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isForbidden());
  }

  private static HeadCoachHiringView sampleView() {
    var franchise =
        new Franchise(
            1L,
            "Minutemen",
            new City(1L, "Boston", new State(1L, "MA", "Massachusetts")),
            "#000000",
            "#ffffff");
    var league =
        new LeagueSummary(
            42L, "Dynasty", LeaguePhase.HIRING_HEAD_COACH, 1, 1, Instant.now(), 100L, franchise);
    return new HeadCoachHiringView(
        league,
        List.of(),
        List.of(),
        List.of(),
        0,
        5,
        new StaffBudget(100L, 1, 25_000_000_00L, 0L));
  }

  @Test
  void matchCounter_whenValid_rendersCombinedFragment() throws Exception {
    given(viewHiring.view(42L, "sub-1")).willReturn(Optional.of(sampleView()));
    given(matchCounterOffer.match(42L, 9L, "sub-1"))
        .willReturn(
            new MatchCounterOfferResult.Matched(
                new CandidateOffer(
                    9L,
                    7L,
                    100L,
                    "{}",
                    1,
                    OfferStatus.ACTIVE,
                    Optional.of(OfferStance.PENDING),
                    1,
                    Optional.empty(),
                    Optional.empty())));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/counter/9/match")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isOk())
        .andExpect(view().name("league/hiring/head-coach-fragments :: combined"));

    verify(matchCounterOffer).match(42L, 9L, "sub-1");
  }

  @Test
  void matchCounter_whenInsufficientBudget_returns409() throws Exception {
    given(matchCounterOffer.match(42L, 9L, "sub-1"))
        .willReturn(new MatchCounterOfferResult.InsufficientBudget(100L, 0L, 100_000_00L));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/counter/9/match")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isConflict());
  }

  @Test
  void matchCounter_whenNotCounterPending_returns409() throws Exception {
    given(matchCounterOffer.match(42L, 9L, "sub-1"))
        .willReturn(new MatchCounterOfferResult.NotCounterPending(9L));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/counter/9/match")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isConflict());
  }

  @Test
  void matchCounter_whenDeadlineExpired_returns422() throws Exception {
    given(matchCounterOffer.match(42L, 9L, "sub-1"))
        .willReturn(new MatchCounterOfferResult.DeadlineExpired(9L, 4, 6));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/counter/9/match")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  void matchCounter_whenNotFound_returns404() throws Exception {
    given(matchCounterOffer.match(42L, 9L, "sub-1"))
        .willReturn(new MatchCounterOfferResult.NotFound(42L));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/counter/9/match")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isNotFound());
  }

  @Test
  void declineCounter_whenValid_rendersCombinedFragment() throws Exception {
    given(viewHiring.view(42L, "sub-1")).willReturn(Optional.of(sampleView()));
    given(declineCounterOffer.decline(42L, 9L, "sub-1"))
        .willReturn(new DeclineCounterOfferResult.Declined(9L));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/counter/9/decline")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isOk())
        .andExpect(view().name("league/hiring/head-coach-fragments :: combined"));

    verify(declineCounterOffer).decline(42L, 9L, "sub-1");
  }

  @Test
  void declineCounter_whenNotCounterPending_returns409() throws Exception {
    given(declineCounterOffer.decline(42L, 9L, "sub-1"))
        .willReturn(new DeclineCounterOfferResult.NotCounterPending(9L));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/counter/9/decline")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isConflict());
  }

  @Test
  void declineCounter_whenNotFound_returns404() throws Exception {
    given(declineCounterOffer.decline(42L, 9L, "sub-1"))
        .willReturn(new DeclineCounterOfferResult.NotFound(42L));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/counter/9/decline")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isNotFound());
  }
}
