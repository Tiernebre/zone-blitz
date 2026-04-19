package app.zoneblitz.league;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.view;

import app.zoneblitz.config.SecurityConfig;
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
  @MockitoBean ManageHeadCoachShortlist shortlist;
  @MockitoBean StartInterview startInterview;
  @MockitoBean MakeOffer makeOffer;
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
  void shortlistFragment_returnsFragment() throws Exception {
    given(viewHiring.view(42L, "sub-1")).willReturn(Optional.of(sampleView()));

    mvc.perform(
            get("/leagues/42/hiring/head-coach/shortlist")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isOk())
        .andExpect(view().name("league/hiring/head-coach-fragments :: shortlist"));
  }

  @Test
  void addToShortlist_whenUpdated_rendersCombinedFragment() throws Exception {
    given(shortlist.add(42L, 7L, "sub-1")).willReturn(new ShortlistResult.Updated(sampleView()));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/shortlist/7")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isOk())
        .andExpect(view().name("league/hiring/head-coach-fragments :: combined"));

    verify(shortlist).add(42L, 7L, "sub-1");
  }

  @Test
  void addToShortlist_whenNotFound_returns404() throws Exception {
    given(shortlist.add(42L, 7L, "sub-1")).willReturn(new ShortlistResult.NotFound(42L));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/shortlist/7")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isNotFound());
  }

  @Test
  void addToShortlist_whenUnknownCandidate_returns404() throws Exception {
    given(shortlist.add(42L, 7L, "sub-1")).willReturn(new ShortlistResult.UnknownCandidate(7L));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/shortlist/7")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isNotFound());
  }

  @Test
  void removeFromShortlist_whenUpdated_rendersCombinedFragment() throws Exception {
    given(shortlist.remove(42L, 7L, "sub-1")).willReturn(new ShortlistResult.Updated(sampleView()));

    mvc.perform(
            delete("/leagues/42/hiring/head-coach/shortlist/7")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isOk())
        .andExpect(view().name("league/hiring/head-coach-fragments :: combined"));

    verify(shortlist).remove(42L, 7L, "sub-1");
  }

  @Test
  void startInterview_whenStarted_rendersCombinedFragment() throws Exception {
    given(startInterview.start(42L, 7L, "sub-1"))
        .willReturn(new InterviewResult.Started(sampleView()));

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
  void startInterview_whenUnknownCandidate_returns404() throws Exception {
    given(startInterview.start(42L, 7L, "sub-1"))
        .willReturn(new InterviewResult.UnknownCandidate(7L));

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
  void interviewsFragment_returnsFragment() throws Exception {
    given(viewHiring.view(42L, "sub-1")).willReturn(Optional.of(sampleView()));

    mvc.perform(
            get("/leagues/42/hiring/head-coach/interviews")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isOk())
        .andExpect(view().name("league/hiring/head-coach-fragments :: interviews"));
  }

  @Test
  void submitOffer_whenCreated_rendersCombinedFragment() throws Exception {
    given(viewHiring.view(42L, "sub-1")).willReturn(Optional.of(sampleView()));
    given(makeOffer.offer(eq(42L), eq(7L), eq("sub-1"), any()))
        .willReturn(
            new MakeOfferResult.Created(
                new CandidateOffer(1L, 7L, 99L, "{}", 1, OfferStatus.ACTIVE)));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/offer/7")
                .param("compensation", "8500000")
                .param("contractLengthYears", "5")
                .param("guaranteedMoneyPct", "0.85")
                .param("roleScope", "HIGH")
                .param("staffContinuity", "BRING_OWN")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isOk())
        .andExpect(view().name("league/hiring/head-coach-fragments :: combined"));
  }

  @Test
  void submitOffer_whenActiveOfferExists_returns409() throws Exception {
    given(makeOffer.offer(eq(42L), eq(7L), eq("sub-1"), any()))
        .willReturn(new MakeOfferResult.ActiveOfferExists(7L, 1L));

    mvc.perform(
            post("/leagues/42/hiring/head-coach/offer/7")
                .param("compensation", "8500000")
                .param("contractLengthYears", "5")
                .param("guaranteedMoneyPct", "0.85")
                .param("roleScope", "HIGH")
                .param("staffContinuity", "BRING_OWN")
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
                .param("guaranteedMoneyPct", "0.85")
                .param("roleScope", "HIGH")
                .param("staffContinuity", "BRING_OWN")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isNotFound());
  }

  @Test
  void submitOffer_requiresCsrf() throws Exception {
    mvc.perform(
            post("/leagues/42/hiring/head-coach/offer/7")
                .param("compensation", "8500000")
                .param("contractLengthYears", "5")
                .param("guaranteedMoneyPct", "0.85")
                .param("roleScope", "HIGH")
                .param("staffContinuity", "BRING_OWN")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isForbidden());
  }

  @Test
  void addToShortlist_requiresCsrf() throws Exception {
    mvc.perform(
            post("/leagues/42/hiring/head-coach/shortlist/7")
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
            42L, "Dynasty", LeaguePhase.HIRING_HEAD_COACH, 1, Instant.now(), 100L, franchise);
    return new HeadCoachHiringView(league, List.of(), List.of(), List.of(), 0, 3);
  }
}
