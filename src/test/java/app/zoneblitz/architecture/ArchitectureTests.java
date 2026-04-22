package app.zoneblitz.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
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
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;

/**
 * Executable architecture guardrails — see {@code docs/technical/agent-friendliness-audit.md}
 * section "Install ArchUnit as an executable architecture guard".
 *
 * <p>Rules only stay live if they already pass on {@code main}. When a rule needs to be added but
 * cannot yet pass, prefer to keep the code in main clean and bring the rule in with the refactor
 * that makes it pass, rather than committing a {@code @Disabled} annotation.
 */
class ArchitectureTests {

  private static final JavaClasses PRODUCTION_CLASSES =
      new ClassFileImporter()
          .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
          .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_JARS)
          .importPackages("app.zoneblitz..");

  private static final JavaClasses TEST_CLASSES =
      new ClassFileImporter()
          .withImportOption(ImportOption.Predefined.ONLY_INCLUDE_TESTS)
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
   * Generated jOOQ types must stay inside the repository layer. Any production class outside {@code
   * app.zoneblitz.jooq..} whose name does not start with {@code Jooq} is banned from importing
   * {@code app.zoneblitz.jooq.*}. The generated code itself is excluded (generated classes
   * reference each other).
   */
  @Test
  void generatedJooq_isOnlyImportedByJooqPrefixedClasses() {
    var rule =
        noClasses()
            .that()
            .resideInAPackage("app.zoneblitz..")
            .and()
            .resideOutsideOfPackage("app.zoneblitz.jooq..")
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
   * *Result} unions, and shared records. The {@code view/} sub-package is fully internal: its
   * controllers, view models, and page use-case interfaces are consumed only inside {@code view/}
   * itself.
   *
   * <p>Cross-feature consumers reach hiring through public seams at the package root: {@link
   * app.zoneblitz.league.hiring.OfferResolver}, {@link
   * app.zoneblitz.league.hiring.GenerateCandidatePool}, {@link
   * app.zoneblitz.league.hiring.FindCandidate}, and {@link
   * app.zoneblitz.league.hiring.AssembleStaff} — never into {@code candidates/}, {@code offer/},
   * {@code hire/}, or the other sub-packages.
   */
  @Test
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

  /** CLAUDE.md hard ceiling: 500 LOC per production Java file. Extract freely. */
  @Test
  void productionFiles_stayUnderLineCountCeiling() throws IOException {
    var ceiling = 500L;
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

  /**
   * Test methods follow {@code methodUnderTest_condition_expectedOutcome} (at minimum an identifier
   * with at least one underscore). This is a floor, not a ceiling — {@code foo_bar} passes, but the
   * intent is three underscore-separated segments. The floor still flags the worst offenders
   * (camelCase sentences), which was the pattern before the audit.
   *
   * <p>Applies to {@code @Test}, {@code @ParameterizedTest}, and {@code @RepeatedTest}. See
   * CLAUDE.md "Test naming" and {@code docs/technical/agent-friendliness-audit.md} item 6.
   */
  @Test
  void testMethods_followUnderscoreNamingConvention() {
    var rule =
        methods()
            .that()
            .areAnnotatedWith(Test.class)
            .or()
            .areAnnotatedWith(ParameterizedTest.class)
            .or()
            .areAnnotatedWith(RepeatedTest.class)
            .should()
            .haveNameMatching("^[a-z][a-zA-Z0-9]+_[a-zA-Z0-9_]+$")
            .because(
                "Test method names must follow methodUnderTest_condition_expectedOutcome."
                    + " See CLAUDE.md 'Test naming'.");
    rule.check(TEST_CLASSES);
  }

  @Test
  void classFileImporter_findsTestClasses() {
    assertThat(TEST_CLASSES).isNotEmpty();
  }
}
