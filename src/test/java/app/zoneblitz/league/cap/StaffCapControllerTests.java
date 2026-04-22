package app.zoneblitz.league.cap;

import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.view;

import app.zoneblitz.config.SecurityConfig;
import app.zoneblitz.league.LeagueSummary;
import app.zoneblitz.league.cap.StaffCapView.ContractLine;
import app.zoneblitz.league.cap.StaffCapView.DeadCapLine;
import app.zoneblitz.league.cap.StaffCapView.OfferLine;
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

@WebMvcTest(StaffCapController.class)
@Import(SecurityConfig.class)
@ImportAutoConfiguration({
  SecurityAutoConfiguration.class,
  ServletWebSecurityAutoConfiguration.class
})
class StaffCapControllerTests {

  @Autowired MockMvc mvc;

  @MockitoBean ViewStaffCap viewStaffCap;
  @MockitoBean ClientRegistrationRepository clientRegistrationRepository;

  @Test
  void page_whenFound_rendersPageAndLineItems() throws Exception {
    given(viewStaffCap.view(42L, "sub-1")).willReturn(Optional.of(sampleView()));

    mvc.perform(
            get("/leagues/42/staff-cap").with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isOk())
        .andExpect(view().name("league/staff-cap"))
        .andExpect(content().string(org.hamcrest.Matchers.containsString("Staff Salary Cap")))
        .andExpect(content().string(org.hamcrest.Matchers.containsString("Chip Kelly")))
        .andExpect(content().string(org.hamcrest.Matchers.containsString("Nick Saban")))
        .andExpect(content().string(org.hamcrest.Matchers.containsString("Dan Campbell")));
  }

  @Test
  void page_whenMissing_returns404() throws Exception {
    given(viewStaffCap.view(42L, "sub-1")).willReturn(Optional.empty());

    mvc.perform(
            get("/leagues/42/staff-cap").with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isNotFound());
  }

  private static StaffCapView sampleView() {
    var franchise =
        new Franchise(
            1L,
            "Minutemen",
            new City(1L, "Boston", new State(1L, "MA", "Massachusetts")),
            "#000000",
            "#ffffff");
    var league =
        new LeagueSummary(
            42L, "Dynasty", LeaguePhase.INITIAL_SETUP, 1, 1, Instant.now(), 100L, franchise);
    return new StaffCapView(
        league,
        25_000_000_00L,
        List.of(
            new ContractLine("Chip Kelly", "Head Coach", 8_500_000_00L, 8_500_000_00L, 5, 1, 5)),
        List.of(new OfferLine("Nick Saban", "Offensive Coordinator", 3_000_000_00L, 3)),
        List.of(new DeadCapLine("Dan Campbell", "Head Coach", 2_000_000_00L, 1, 5)));
  }
}
