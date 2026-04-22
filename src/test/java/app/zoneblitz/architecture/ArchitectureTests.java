package app.zoneblitz.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.assertj.core.api.Assertions.assertThat;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

/**
 * Executable architecture guardrails — see {@code docs/technical/agent-friendliness-audit.md}
 * section "Install ArchUnit as an executable architecture guard".
 *
 * <p>Rules only stay live if they already pass on {@code main}. Rules we want eventually but that
 * fail today are kept visible via {@link Disabled} with a {@code TODO} pointing at the refactor
 * that unblocks them, so the intent does not get lost.
 */
class ArchitectureTests {

  private static final JavaClasses PRODUCTION_CLASSES =
      new ClassFileImporter()
          .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
          .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_JARS)
          .importPackages("app.zoneblitz..");

  @Test
  void productionCode_doesNotUseUnseededRandom() {
    var rule =
        noClasses()
            .that()
            .resideInAPackage("app.zoneblitz..")
            .should()
            .dependOnClassesThat()
            .haveFullyQualifiedName("java.util.Random")
            .because(
                "RNG must flow through RandomSource / SplittableRandomSource. See"
                    + " docs/technical/agent-friendliness-audit.md.");
    rule.check(PRODUCTION_CLASSES);
  }

  @Test
  void productionCode_doesNotUseThreadLocalRandom() {
    var rule =
        noClasses()
            .that()
            .resideInAPackage("app.zoneblitz..")
            .should()
            .dependOnClassesThat()
            .haveFullyQualifiedName("java.util.concurrent.ThreadLocalRandom")
            .because(
                "RNG must flow through RandomSource / SplittableRandomSource. See"
                    + " docs/technical/agent-friendliness-audit.md.");
    rule.check(PRODUCTION_CLASSES);
  }

  @Test
  void productionCode_doesNotCallMathRandom() {
    var rule =
        noClasses()
            .that()
            .resideInAPackage("app.zoneblitz..")
            .should()
            .callMethod(Math.class, "random")
            .because(
                "Math.random() bypasses RandomSource. See"
                    + " docs/technical/agent-friendliness-audit.md.");
    rule.check(PRODUCTION_CLASSES);
  }

  @Test
  void splittableRandom_isConfinedToRngPackage() {
    var rule =
        noClasses()
            .that()
            .resideInAPackage("app.zoneblitz..")
            .and()
            .resideOutsideOfPackage("app.zoneblitz.gamesimulator.rng..")
            .should()
            .dependOnClassesThat()
            .haveFullyQualifiedName("java.util.SplittableRandom")
            .because(
                "Only SplittableRandomSource (in gamesimulator.rng) may touch SplittableRandom"
                    + " directly; everyone else goes through RandomSource.");
    rule.check(PRODUCTION_CLASSES);
  }

  @Test
  void controllers_doNotImportGeneratedJooqPackage() {
    var rule =
        noClasses()
            .that()
            .areAnnotatedWith("org.springframework.stereotype.Controller")
            .or()
            .areAnnotatedWith("org.springframework.web.bind.annotation.RestController")
            .or()
            .haveSimpleNameEndingWith("Controller")
            .should()
            .dependOnClassesThat()
            .resideInAPackage("app.zoneblitz.jooq..")
            .because(
                "Controllers must not reference persistence types. See CLAUDE.md 'Layer"
                    + " discipline'.");
    rule.check(PRODUCTION_CLASSES);
  }

  /**
   * TODO(audit#5): two legitimate non-{@code Jooq*} classes currently reach into generated jOOQ —
   * {@code ViewStaffRecapUseCase} (raw DSL JOIN) and {@code CityTeamProfiles} (seed lookup). Enable
   * once those queries are extracted behind repository interfaces.
   */
  @Test
  @Disabled(
      "TODO(audit#5): enable after ViewStaffRecapUseCase and CityTeamProfiles are refactored"
          + " behind repository interfaces")
  void generatedJooq_isOnlyImportedByJooqPrefixedClasses() {
    var rule =
        noClasses()
            .that()
            .resideInAPackage("app.zoneblitz..")
            .and()
            .haveSimpleNameNotStartingWith("Jooq")
            .should()
            .dependOnClassesThat()
            .resideInAPackage("app.zoneblitz.jooq..")
            .because(
                "Generated jOOQ types must not escape the Jooq*Repository boundary. See CLAUDE.md"
                    + " 'Persistence'.");
    rule.check(PRODUCTION_CLASSES);
  }

  /**
   * Hiring sub-packages ({@code candidates}, {@code generation}, {@code interview}, {@code offer},
   * {@code hire}, {@code view}) are feature-internal. Only the outer {@code
   * app.zoneblitz.league.hiring} package is the public API — use-case interfaces, sealed {@code
   * *Result} unions, and shared records.
   *
   * <p>The hiring sub-package split and visibility reduction landed (see {@code
   * docs/technical/agent-friendliness-audit.md}). The rule is kept disabled because several
   * legitimate cross-feature consumers still import hiring-internal repositories directly, and
   * refactoring those to go through use-case interfaces is out of scope for this pass:
   *
   * <ul>
   *   <li>{@code league.AdvanceDayUseCase} depends on {@code offer.OfferResolver}.
   *   <li>{@code league.phase.Hiring*TransitionHandler} (HeadCoach, DirectorOfScouting,
   *       AssemblingStaff) depends on {@code candidates.CandidatePoolRepository}, {@code
   *       CandidateRepository}, {@code CandidatePreferencesRepository} for phase-entry pool
   *       generation and candidate persistence.
   *   <li>{@code league.phase.BestFitHiringAutofill} pulls in {@code offer.InterestScoring /
   *       OfferScoring / OfferStance / OfferTermsJson / PreferenceScoringOfferResolver} (original
   *       audit smell).
   *   <li>{@code league.staff.ViewStaffRecapUseCase} and {@code ViewCoachingStaffOrgChartUseCase}
   *       use {@code candidates.CandidateRepository} directly to fetch hired candidates.
   * </ul>
   *
   * Follow-up: promote hiring-public use cases for "generate candidate pool for phase" and "fetch
   * hired candidate by id," then enable this rule.
   */
  @Test
  @Disabled(
      "TODO(audit#1-2): enable after phase handlers + staff view use cases stop importing"
          + " hiring-internal repositories directly (see Javadoc for the full list).")
  void hiringInternals_areNotImportedByOtherPackages() {
    var rule =
        noClasses()
            .that()
            .resideInAPackage("app.zoneblitz..")
            .and()
            .resideOutsideOfPackage("app.zoneblitz.league.hiring..")
            .should()
            .dependOnClassesThat()
            .resideInAPackage(
                "app.zoneblitz.league.hiring.(candidates|generation|interview|offer|hire|view)..")
            .because(
                "Only the outer hiring package is the feature's public API. Sub-package types"
                    + " (candidates/, generation/, interview/, offer/, hire/, view/) are"
                    + " feature-internal and must not be imported from outside hiring.");
    rule.check(PRODUCTION_CLASSES);
  }

  /**
   * CLAUDE.md hard ceiling is 500 LOC, but {@code GameSimulator.java} is 540 and {@code
   * GameState.java} is 414. Threshold sits at 550 until those two are split — see {@code
   * docs/technical/agent-friendliness-audit.md}.
   */
  // TODO(audit#5): drop ceiling to 500 once GameSimulator.java is split.
  @Test
  void productionFiles_stayUnderLineCountCeiling() throws IOException {
    var ceiling = 550L;
    var sourceRoots =
        List.of(
            Path.of("src/main/java/app/zoneblitz"),
            Path.of("src/gamesimulator/java/app/zoneblitz"));
    var oversized = new ArrayList<String>();
    for (var root : sourceRoots) {
      if (!Files.exists(root)) {
        continue;
      }
      try (Stream<Path> stream = Files.walk(root)) {
        stream
            .filter(p -> p.toString().endsWith(".java"))
            .forEach(
                p -> {
                  try (Stream<String> lines = Files.lines(p)) {
                    var count = lines.count();
                    if (count > ceiling) {
                      oversized.add("%s (%d LOC)".formatted(p, count));
                    }
                  } catch (IOException e) {
                    throw new RuntimeException("Failed to read " + p, e);
                  }
                });
      }
    }
    assertThat(oversized)
        .as(
            "Production Java files above %d LOC (CLAUDE.md 500 hard ceiling; temporary buffer for"
                + " pending GameSimulator split)",
            ceiling)
        .isEmpty();
  }

  @Test
  void classFileImporter_findsProductionClasses() {
    assertThat(PRODUCTION_CLASSES).isNotEmpty();
  }
}
