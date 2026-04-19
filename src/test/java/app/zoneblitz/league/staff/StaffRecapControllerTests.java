package app.zoneblitz.league.staff;

import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.view;

import app.zoneblitz.config.SecurityConfig;
import app.zoneblitz.league.LeagueSummary;
import app.zoneblitz.league.franchise.Franchise;
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

@WebMvcTest(StaffRecapController.class)
@Import(SecurityConfig.class)
@ImportAutoConfiguration({
  SecurityAutoConfiguration.class,
  ServletWebSecurityAutoConfiguration.class
})
class StaffRecapControllerTests {

  @Autowired MockMvc mvc;

  @MockitoBean ViewStaffRecap viewStaffRecap;
  @MockitoBean ClientRegistrationRepository clientRegistrationRepository;

  @Test
  void page_whenFound_rendersStaffRecapTemplate() throws Exception {
    given(viewStaffRecap.view(42L, "sub-1")).willReturn(Optional.of(sampleView()));

    mvc.perform(
            get("/leagues/42/staff-recap")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isOk())
        .andExpect(view().name("league/staff-recap"));
  }

  @Test
  void page_whenMissing_returns404() throws Exception {
    given(viewStaffRecap.view(42L, "sub-1")).willReturn(Optional.empty());

    mvc.perform(
            get("/leagues/42/staff-recap")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isNotFound());
  }

  private static StaffRecapView sampleView() {
    var franchise = new Franchise(1L, "Patriots", null, "#000", "#FFF");
    var summary =
        new LeagueSummary(
            42L, "Dynasty", LeaguePhase.ASSEMBLING_STAFF, 1, Instant.EPOCH, 100L, franchise);
    return new StaffRecapView(
        summary, List.of(new StaffRecapView.TeamStaffTree(100L, franchise, true, List.of())));
  }
}
