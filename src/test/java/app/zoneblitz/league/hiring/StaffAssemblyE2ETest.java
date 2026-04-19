package app.zoneblitz.league.hiring;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import app.zoneblitz.league.AdvanceDay;
import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.staff.TeamStaffRepository;
import app.zoneblitz.league.team.TeamLookup;
import app.zoneblitz.support.E2ETestAuth;
import app.zoneblitz.support.PostgresTestcontainer;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.AriaRole;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;

/**
 * End-to-end happy-path journey from league creation through the staff-assembly phase. Exercises
 * the full phase ladder: {@code INITIAL_SETUP → HIRING_HEAD_COACH → HIRING_DIRECTOR_OF_SCOUTING →
 * ASSEMBLING_STAFF → COMPLETE}.
 *
 * <p>Each hiring phase is driven through the real UI for the actions it currently exposes
 * (shortlist, interview, offer) and then ticked to completion via {@link AdvanceDay}. The week-tick
 * affordance does not yet live on any page; injecting the use case keeps this test UI-driven
 * wherever UI exists and server-driven exactly where the UI does not, without smuggling in new
 * production surface for a test-only PR.
 *
 * <p>Determinism is inherited from {@link SplittableCandidateRandomSources}, the production {@link
 * CandidateRandomSources} bean: per-league seeds derived from {@code (leagueId, phase)} so
 * candidate pools, CPU decisions, and autofill tie-breaks are reproducible run-to-run.
 */
@Tag("e2e")
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@Import({PostgresTestcontainer.class, E2ETestAuth.class})
class StaffAssemblyE2ETest {

  private static Playwright playwright;
  private static Browser browser;

  @LocalServerPort int port;
  @Autowired AdvanceDay advanceDay;
  @Autowired LeagueRepository leagues;
  @Autowired TeamStaffRepository staff;
  @Autowired TeamLookup teams;

  private BrowserContext context;
  private Page page;

  @BeforeAll
  static void launchBrowser() {
    playwright = Playwright.create();
    browser = playwright.chromium().launch();
  }

  @AfterAll
  static void closeBrowser() {
    if (browser != null) browser.close();
    if (playwright != null) playwright.close();
  }

  @BeforeEach
  void openContext() {
    context =
        browser.newContext(new Browser.NewContextOptions().setBaseURL("http://localhost:" + port));
    page = context.newPage();
  }

  @AfterEach
  void closeContext() {
    if (context != null) context.close();
  }

  @Test
  void userWalksStaffAssemblyJourney_fromInitialSetupToCompleteWithFullyPopulatedStaff() {
    var subject = "e2e-staff-" + System.nanoTime();
    signIn(subject);

    var leagueName = "Dynasty " + System.nanoTime();
    var leagueUrl = createLeague(leagueName);
    var leagueId = extractLeagueId(leagueUrl);

    // INITIAL_SETUP: dashboard intro card; advance into HIRING_HEAD_COACH via the rendered form.
    assertThat(page.getByRole(AriaRole.HEADING, new Page.GetByRoleOptions().setName(leagueName)))
        .isVisible();
    page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Advance")).click();

    // HIRING_HEAD_COACH: shortlist, interview, offer on the first candidate, then tick to hire.
    assertThat(page).hasURL(Pattern.compile(".*/leagues/\\d+/hiring/head-coach$"));
    assertThat(
            page.getByRole(AriaRole.HEADING, new Page.GetByRoleOptions().setName("Staff Hiring")))
        .isVisible();

    var hcRow = firstCandidateRow();
    var hcCandidateId = hcRow.getAttribute("data-candidate-id");
    // htmx attaches listeners on DOMContentLoaded; wait until it is ready before clicking, so the
    // first click is processed as an hx-post rather than a no-op plain button.
    waitForHtmxReady();
    hcRow.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Shortlist")).click();
    assertThat(buttonInRow(hcCandidateId, "Shortlisted")).isVisible();
    buttonInRow(hcCandidateId, "Interview").click();
    assertThat(reInterviewButton(hcCandidateId)).isVisible();

    submitOfferForm(leagueUrl + "/hiring/head-coach/offer/" + hcCandidateId, headCoachOfferBody());

    tickUntilPhaseLeaves(leagueId, subject, LeaguePhase.HIRING_HEAD_COACH);

    // HIRING_DIRECTOR_OF_SCOUTING: same UI-driven shortlist/interview/offer, then tick.
    page.navigate(leagueUrl);
    assertThat(page).hasURL(Pattern.compile(".*/leagues/\\d+/hiring/director-of-scouting$"));

    var dosRow = firstCandidateRow();
    var dosCandidateId = dosRow.getAttribute("data-candidate-id");
    waitForHtmxReady();
    dosRow.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Shortlist")).click();
    assertThat(buttonInRow(dosCandidateId, "Shortlisted")).isVisible();
    buttonInRow(dosCandidateId, "Interview").click();
    assertThat(reInterviewButton(dosCandidateId)).isVisible();

    submitOfferForm(
        leagueUrl + "/hiring/director-of-scouting/offer/" + dosCandidateId,
        directorOfScoutingOfferBody());

    tickUntilPhaseLeaves(leagueId, subject, LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING);

    // ASSEMBLING_STAFF: the recap page lists the viewer franchise expanded with a full staff tree.
    page.navigate(leagueUrl);
    assertThat(page).hasURL(Pattern.compile(".*/leagues/\\d+/staff-recap$"));
    assertThat(page.getByText(Pattern.compile("Assembling Staff · Week"))).isVisible();
    assertThat(page.locator("details[open]").locator("li")).hasCount(EXPECTED_SEATS_PER_FRANCHISE);
    assertThat(page.locator("details[open] summary").getByText("22 staff")).isVisible();

    // Advance out of ASSEMBLING_STAFF into COMPLETE through the header form.
    page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Advance")).click();

    assertThat(page).hasURL(Pattern.compile(".*/leagues/\\d+$"));
    assertThat(page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Advance")))
        .hasCount(0);

    // Assert franchise staff is fully populated for every franchise in the league.
    for (var franchiseId : teams.teamIdsForLeague(leagueId)) {
      org.assertj.core.api.Assertions.assertThat(staff.findAllForTeam(franchiseId))
          .as(
              "franchise %d in league %d should have all %d seats filled",
              franchiseId, leagueId, EXPECTED_SEATS_PER_FRANCHISE)
          .hasSize(EXPECTED_SEATS_PER_FRANCHISE);
    }
  }

  /** 1 HC + 1 DoS + 3 coordinators + 9 position coaches + 5 college + 3 pro scouts. */
  private static final int EXPECTED_SEATS_PER_FRANCHISE = 22;

  /**
   * Waits for htmx to load, then forces a process pass over the document body so that any {@code
   * hx-*} attributes on pre-navigation elements have bound click handlers before the test issues
   * its first click.
   */
  private void waitForHtmxReady() {
    page.waitForLoadState();
    page.waitForFunction("() => typeof window.htmx !== 'undefined'");
    page.evaluate("() => window.htmx.process(document.body)");
  }

  private Locator firstCandidateRow() {
    return page.locator("tr[data-candidate-id]").first();
  }

  private Locator buttonInRow(String candidateId, String name) {
    return page.locator("tr[data-candidate-id='" + candidateId + "']")
        .getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(name));
  }

  private Locator reInterviewButton(String candidateId) {
    return page.locator("tr[data-candidate-id='" + candidateId + "']")
        .getByRole(
            AriaRole.BUTTON,
            new Locator.GetByRoleOptions().setName(Pattern.compile("^Re-interview.*")));
  }

  private static String headCoachOfferBody() {
    return "compensation=8500000&contractLengthYears=5&guaranteedMoneyPct=0.85"
        + "&roleScope=HIGH&staffContinuity=BRING_OWN";
  }

  private static String directorOfScoutingOfferBody() {
    return "compensation=1200000&contractLengthYears=4&guaranteedMoneyPct=0.5"
        + "&roleScope=MEDIUM&staffContinuity=HYBRID";
  }

  /**
   * Submits a classic form POST from the current page using the rendered {@code _csrf} meta token.
   * Offer endpoints return an HTMX fragment (not a full page shell) so callers must navigate back
   * to a page-rendering URL before the next CSRF-dependent step.
   */
  private void submitOfferForm(String action, String formBody) {
    page.evaluate(
        """
        ({ action, formBody }) => {
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = action;
          const csrf = document.querySelector('meta[name="_csrf"]').content;
          const addField = (name, value) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            input.value = value;
            form.appendChild(input);
          };
          addField('_csrf', csrf);
          for (const pair of formBody.split('&')) {
            const [k, v] = pair.split('=');
            addField(decodeURIComponent(k), decodeURIComponent(v));
          }
          document.body.appendChild(form);
          form.submit();
        }
        """,
        java.util.Map.of("action", action, "formBody", formBody));
    page.waitForLoadState();
  }

  private void tickUntilPhaseLeaves(long leagueId, String subject, LeaguePhase phase) {
    for (var i = 0; i < 10; i++) {
      var current = leagues.findById(leagueId).orElseThrow().phase();
      if (current != phase) {
        return;
      }
      advanceDay.advance(leagueId, subject);
    }
    throw new IllegalStateException(
        "phase %s did not complete within 10 ticks for league %d".formatted(phase, leagueId));
  }

  private static long extractLeagueId(String leagueUrl) {
    var matcher = Pattern.compile(".*/leagues/(\\d+)$").matcher(leagueUrl);
    if (!matcher.matches()) {
      throw new IllegalStateException("unexpected league url: " + leagueUrl);
    }
    return Long.parseLong(matcher.group(1));
  }

  private String createLeague(String leagueName) {
    page.navigate("/leagues/new");
    page.getByLabel("League name").fill(leagueName);
    page.locator("input[name='franchiseId']")
        .first()
        .check(new Locator.CheckOptions().setForce(true));
    page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Create league")).click();
    assertThat(page).hasURL(Pattern.compile(".*/leagues/\\d+$"));
    return page.url();
  }

  private void signIn(String subject) {
    page.navigate("/test-auth/login?sub=" + URLEncoder.encode(subject, StandardCharsets.UTF_8));
  }
}
