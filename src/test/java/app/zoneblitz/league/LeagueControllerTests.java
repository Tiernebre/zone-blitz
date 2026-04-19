package app.zoneblitz.league;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.model;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.view;

import app.zoneblitz.config.SecurityConfig;
import app.zoneblitz.league.franchise.Franchise;
import app.zoneblitz.league.franchise.ListFranchises;
import app.zoneblitz.league.geography.City;
import app.zoneblitz.league.geography.State;
import app.zoneblitz.league.phase.AdvancePhase;
import app.zoneblitz.league.phase.AdvancePhaseResult;
import app.zoneblitz.league.phase.LeaguePhase;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.hamcrest.Matchers;
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

@WebMvcTest(LeagueController.class)
@Import(SecurityConfig.class)
@ImportAutoConfiguration({
  SecurityAutoConfiguration.class,
  ServletWebSecurityAutoConfiguration.class
})
class LeagueControllerTests {

  @Autowired MockMvc mvc;

  @MockitoBean ListLeaguesForUser listLeagues;
  @MockitoBean ListFranchises listFranchises;
  @MockitoBean CreateLeague createLeague;
  @MockitoBean GetLeague getLeague;
  @MockitoBean DeleteLeague deleteLeague;
  @MockitoBean AdvancePhase advancePhase;
  @MockitoBean ClientRegistrationRepository clientRegistrationRepository;

  @Test
  void home_whenUnauthenticated_rendersIndexWithEmptyLeagues() throws Exception {
    mvc.perform(get("/"))
        .andExpect(status().isOk())
        .andExpect(view().name("index"))
        .andExpect(model().attribute("leagues", List.of()));
  }

  @Test
  void home_whenAuthenticated_loadsLeaguesForSubject() throws Exception {
    given(listLeagues.listFor("google-sub-abc")).willReturn(List.of());

    mvc.perform(get("/").with(oauth2Login().attributes(a -> a.put("sub", "google-sub-abc"))))
        .andExpect(status().isOk())
        .andExpect(view().name("index"));

    verify(listLeagues).listFor("google-sub-abc");
  }

  @Test
  void newLeagueForm_requiresAuthentication() throws Exception {
    mvc.perform(get("/leagues/new")).andExpect(status().is3xxRedirection());
  }

  @Test
  void newLeagueForm_whenAuthenticated_rendersForm() throws Exception {
    given(listFranchises.list()).willReturn(List.of());

    mvc.perform(get("/leagues/new").with(oauth2Login()))
        .andExpect(status().isOk())
        .andExpect(view().name("league/new"))
        .andExpect(model().attributeExists("form", "franchises"));
  }

  @Test
  void create_whenValid_delegatesAndRedirectsToDashboard() throws Exception {
    var league =
        new League(
            42L,
            "Dynasty",
            "sub-1",
            LeaguePhase.INITIAL_SETUP,
            1,
            LeagueSettings.defaults(),
            Instant.now());
    given(createLeague.create(eq("sub-1"), eq("Dynasty"), anyLong()))
        .willReturn(new CreateLeagueResult.Created(league));

    mvc.perform(
            post("/leagues")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf())
                .param("name", "Dynasty")
                .param("franchiseId", "3"))
        .andExpect(status().is3xxRedirection())
        .andExpect(redirectedUrl("/leagues/42"));

    verify(createLeague).create("sub-1", "Dynasty", 3L);
  }

  @Test
  void dashboard_whenLeagueFound_rendersDashboard() throws Exception {
    var summary =
        new LeagueSummary(
            42L,
            "Dynasty",
            LeaguePhase.INITIAL_SETUP,
            1,
            Instant.now(),
            100L,
            new Franchise(
                1L,
                "Minutemen",
                new City(1L, "Boston", new State(1L, "MA", "Massachusetts")),
                "#000000",
                "#ffffff"));
    given(getLeague.get(42L, "sub-1")).willReturn(Optional.of(summary));

    mvc.perform(get("/leagues/42").with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isOk())
        .andExpect(view().name("league/dashboard"))
        .andExpect(model().attribute("league", summary))
        .andExpect(content().string(Matchers.containsString("All Leagues")))
        .andExpect(content().string(Matchers.containsString("id=\"profile-toggle\"")))
        .andExpect(content().string(Matchers.containsString("id=\"profile-menu\"")));
  }

  @Test
  void dashboard_whenLeagueMissing_returns404() throws Exception {
    given(getLeague.get(42L, "sub-1")).willReturn(Optional.empty());

    mvc.perform(get("/leagues/42").with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isNotFound());
  }

  @Test
  void create_whenNameBlank_reRendersFormWithErrors() throws Exception {
    given(listFranchises.list()).willReturn(List.of());

    mvc.perform(
            post("/leagues")
                .with(oauth2Login())
                .with(csrf())
                .param("name", "")
                .param("franchiseId", "3"))
        .andExpect(status().isOk())
        .andExpect(view().name("league/new"))
        .andExpect(model().attributeHasFieldErrors("form", "name"));
  }

  @Test
  void settings_whenLeagueFound_rendersSettingsPage() throws Exception {
    var summary =
        new LeagueSummary(
            42L,
            "Dynasty",
            LeaguePhase.INITIAL_SETUP,
            1,
            Instant.now(),
            100L,
            new Franchise(
                1L,
                "Minutemen",
                new City(1L, "Boston", new State(1L, "MA", "Massachusetts")),
                "#000000",
                "#ffffff"));
    given(getLeague.get(42L, "sub-1")).willReturn(Optional.of(summary));

    mvc.perform(
            get("/leagues/42/settings").with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isOk())
        .andExpect(view().name("league/settings"))
        .andExpect(model().attribute("league", summary));
  }

  @Test
  void settings_whenLeagueMissing_returns404() throws Exception {
    given(getLeague.get(42L, "sub-1")).willReturn(Optional.empty());

    mvc.perform(
            get("/leagues/42/settings").with(oauth2Login().attributes(a -> a.put("sub", "sub-1"))))
        .andExpect(status().isNotFound());
  }

  @Test
  void delete_whenOwned_redirectsHome() throws Exception {
    given(deleteLeague.delete(42L, "sub-1")).willReturn(new DeleteLeagueResult.Deleted(42L));

    mvc.perform(
            post("/leagues/42/delete")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().is3xxRedirection())
        .andExpect(redirectedUrl("/"));

    verify(deleteLeague).delete(42L, "sub-1");
  }

  @Test
  void delete_whenNotFound_returns404() throws Exception {
    given(deleteLeague.delete(42L, "sub-1")).willReturn(new DeleteLeagueResult.NotFound(42L));

    mvc.perform(
            post("/leagues/42/delete")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isNotFound());
  }

  @Test
  void delete_requiresCsrf() throws Exception {
    mvc.perform(post("/leagues/42/delete").with(oauth2Login())).andExpect(status().isForbidden());
  }

  @Test
  void advancePhase_whenAdvancedToHeadCoach_redirectsToHeadCoachHiring() throws Exception {
    given(advancePhase.advance(42L, "sub-1"))
        .willReturn(
            new AdvancePhaseResult.Advanced(
                42L, LeaguePhase.INITIAL_SETUP, LeaguePhase.HIRING_HEAD_COACH));

    mvc.perform(
            post("/leagues/42/phase/advance")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().is3xxRedirection())
        .andExpect(redirectedUrl("/leagues/42/hiring/head-coach"));

    verify(advancePhase).advance(42L, "sub-1");
  }

  @Test
  void advancePhase_whenAdvancedToDirectorOfScouting_redirectsToDirectorHiring() throws Exception {
    given(advancePhase.advance(42L, "sub-1"))
        .willReturn(
            new AdvancePhaseResult.Advanced(
                42L, LeaguePhase.HIRING_HEAD_COACH, LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING));

    mvc.perform(
            post("/leagues/42/phase/advance")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().is3xxRedirection())
        .andExpect(redirectedUrl("/leagues/42/hiring/director-of-scouting"));
  }

  @Test
  void advancePhase_whenAdvancedToAssemblingStaff_redirectsToStaffRecap() throws Exception {
    given(advancePhase.advance(42L, "sub-1"))
        .willReturn(
            new AdvancePhaseResult.Advanced(
                42L, LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING, LeaguePhase.ASSEMBLING_STAFF));

    mvc.perform(
            post("/leagues/42/phase/advance")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().is3xxRedirection())
        .andExpect(redirectedUrl("/leagues/42/staff-recap"));
  }

  @Test
  void advancePhase_whenAdvancedToComplete_redirectsToDashboard() throws Exception {
    given(advancePhase.advance(42L, "sub-1"))
        .willReturn(
            new AdvancePhaseResult.Advanced(
                42L, LeaguePhase.ASSEMBLING_STAFF, LeaguePhase.COMPLETE));

    mvc.perform(
            post("/leagues/42/phase/advance")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().is3xxRedirection())
        .andExpect(redirectedUrl("/leagues/42"));
  }

  @Test
  void advancePhase_whenNotFound_returns404() throws Exception {
    given(advancePhase.advance(42L, "sub-1")).willReturn(new AdvancePhaseResult.NotFound(42L));

    mvc.perform(
            post("/leagues/42/phase/advance")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isNotFound());
  }

  @Test
  void advancePhase_whenNoNextPhase_returns409() throws Exception {
    given(advancePhase.advance(42L, "sub-1"))
        .willReturn(new AdvancePhaseResult.NoNextPhase(42L, LeaguePhase.HIRING_HEAD_COACH));

    mvc.perform(
            post("/leagues/42/phase/advance")
                .with(oauth2Login().attributes(a -> a.put("sub", "sub-1")))
                .with(csrf()))
        .andExpect(status().isConflict());
  }

  @Test
  void advancePhase_requiresCsrf() throws Exception {
    mvc.perform(post("/leagues/42/phase/advance").with(oauth2Login()))
        .andExpect(status().isForbidden());
  }

  @Test
  void create_whenNameTaken_surfacesError() throws Exception {
    given(createLeague.create(anyString(), anyString(), anyLong()))
        .willReturn(new CreateLeagueResult.NameTaken("Dynasty"));
    given(listFranchises.list()).willReturn(List.of());

    mvc.perform(
            post("/leagues")
                .with(oauth2Login())
                .with(csrf())
                .param("name", "Dynasty")
                .param("franchiseId", "3"))
        .andExpect(status().isOk())
        .andExpect(view().name("league/new"))
        .andExpect(model().attributeHasFieldErrors("form", "name"));
  }
}
