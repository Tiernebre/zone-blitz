package app.zoneblitz.league;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

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
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;

@Tag("e2e")
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@Import({PostgresTestcontainer.class, E2ETestAuth.class})
class CreateLeagueE2ETest {

  private static Playwright playwright;
  private static Browser browser;

  @LocalServerPort int port;

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
  void authenticatedUserCreatesLeagueAndLandsOnDashboard() {
    var subject = "e2e-user-" + System.nanoTime();
    signIn(subject);

    var leagueName = "Dynasty " + System.nanoTime();

    page.navigate("/leagues/new");
    assertThat(
            page.getByRole(AriaRole.HEADING, new Page.GetByRoleOptions().setName("Create league")))
        .isVisible();

    page.getByLabel("League name").fill(leagueName);
    page.locator("input[name='franchiseId']")
        .first()
        .check(new Locator.CheckOptions().setForce(true));
    page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Create league")).click();

    assertThat(page).hasURL(Pattern.compile(".*/leagues/\\d+$"));
    assertThat(page.getByRole(AriaRole.HEADING, new Page.GetByRoleOptions().setName(leagueName)))
        .isVisible();
    assertThat(page.getByRole(AriaRole.LINK, new Page.GetByRoleOptions().setName("Home")))
        .isVisible();
    assertThat(
            page.getByRole(
                AriaRole.LINK, new Page.GetByRoleOptions().setName("\u2190 All Leagues")))
        .isVisible();
  }

  private void signIn(String subject) {
    page.navigate("/test-auth/login?sub=" + URLEncoder.encode(subject, StandardCharsets.UTF_8));
  }
}
