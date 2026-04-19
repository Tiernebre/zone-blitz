package app.zoneblitz.league.hiring;

import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

@WebMvcTest(HiringDirectorOfScoutingController.class)
@Import(SecurityConfig.class)
@ImportAutoConfiguration({
  SecurityAutoConfiguration.class,
  ServletWebSecurityAutoConfiguration.class
})
class HiringDirectorOfScoutingControllerTests {

  @Autowired MockMvc mvc;

  @MockitoBean ViewDirectorOfScoutingHiring viewHiring;
  @MockitoBean StartInterview startInterview;
  @MockitoBean MakeOffer makeOffer;
  @MockitoBean HireCandidate hireCandidate;
  @MockitoBean ClientRegistrationRepository clientRegistrationRepository;

  @Test
  void page_whenFound_rendersPageTemplate() throws Exception {
    given(viewHiring.view(42L, "sub-1")).willReturn(Optional.of(sampleView()));

    mvc.perform(
            get("/leagues/42/hiring/director-of-scouting")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isOk())
        .andExpect(view().name("league/hiring/director-of-scouting"));
  }

  @Test
  void page_whenMissing_returns404() throws Exception {
    given(viewHiring.view(42L, "sub-1")).willReturn(Optional.empty());

    mvc.perform(
            get("/leagues/42/hiring/director-of-scouting")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isNotFound());
  }

  @Test
  void poolFragment_returnsFragment() throws Exception {
    given(viewHiring.view(42L, "sub-1")).willReturn(Optional.of(sampleView()));

    mvc.perform(
            get("/leagues/42/hiring/director-of-scouting/pool")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isOk())
        .andExpect(view().name("league/hiring/director-of-scouting-fragments :: pool"));
  }

  @Test
  void candidatesFragment_returnsFragment() throws Exception {
    given(viewHiring.view(42L, "sub-1")).willReturn(Optional.of(sampleView()));

    mvc.perform(
            get("/leagues/42/hiring/director-of-scouting/candidates")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isOk())
        .andExpect(view().name("league/hiring/director-of-scouting-fragments :: candidates"));
  }

  private DirectorOfScoutingHiringView sampleView() {
    var franchise =
        new Franchise(
            1L,
            "Minutemen",
            new City(1L, "Boston", new State(1L, "MA", "Massachusetts")),
            "#000000",
            "#ffffff");
    var league =
        new LeagueSummary(
            42L,
            "Dynasty",
            LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING,
            1,
            Instant.now(),
            100L,
            franchise);
    return new DirectorOfScoutingHiringView(league, List.of(), List.of(), List.of(), 0, 5);
  }
}
