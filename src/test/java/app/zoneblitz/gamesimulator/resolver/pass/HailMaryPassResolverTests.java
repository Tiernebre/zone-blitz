package app.zoneblitz.gamesimulator.resolver.pass;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.PlayerBuilder;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.SkillBuilder;
import org.junit.jupiter.api.Test;

class HailMaryPassResolverTests {

  private static final int TRIALS = 10_000;
  private static final PlayCaller.PlayCall HAIL_MARY =
      new PlayCaller.PlayCall("pass", PassConcept.HAIL_MARY);

  private final ClasspathBandRepository repo = new ClasspathBandRepository();
  private final DefaultBandSampler sampler = new DefaultBandSampler();

  @Test
  void resolve_averageAttributes_outcomeRatesTrackBaseHailMaryBand() {
    var resolver = HailMaryPassResolver.load(repo, sampler);
    var counts =
        sampleCounts(
            resolver, 99L, TestPersonnel.baselineOffense(), TestPersonnel.baselineDefense());

    assertThat(counts.completes)
        .as("baseline hail-mary completion rate ~12.5% over 10k trials")
        .isBetween(800, 1700);
    assertThat(counts.interceptions)
        .as("baseline hail-mary INT rate ~28% over 10k trials")
        .isBetween(2200, 3300);
  }

  @Test
  void resolve_eliteOffense_raisesCompletionsAndDropsPicksRelativeToBaseline() {
    var resolver = HailMaryPassResolver.load(repo, sampler);
    var baseline =
        sampleCounts(
            resolver, 7L, TestPersonnel.baselineOffense(), TestPersonnel.baselineDefense());
    var eliteQb =
        new PlayerBuilder()
            .atPosition(Position.QB)
            .withSkill(SkillBuilder.aSkill().withArmStrength(99).withDeepAccuracy(99))
            .build();
    var eliteWr =
        new PlayerBuilder()
            .atPosition(Position.WR)
            .withSkill(SkillBuilder.aSkill().withContestedCatch(99).withHands(99))
            .build();
    var stackedOffense =
        TestPersonnel.offenseWith(eliteQb, eliteWr, eliteContested(), eliteContested());
    var elite = sampleCounts(resolver, 7L, stackedOffense, TestPersonnel.baselineDefense());

    assertThat(elite.completes)
        .as("elite arm + elite contested-catch must raise hail-mary completions")
        .isGreaterThan(baseline.completes);
    assertThat(elite.interceptions)
        .as("elite arm + elite contested-catch must reduce hail-mary picks")
        .isLessThan(baseline.interceptions);
  }

  @Test
  void resolve_eliteDefense_dropsCompletionsAndRaisesPicksRelativeToBaseline() {
    var resolver = HailMaryPassResolver.load(repo, sampler);
    var baseline =
        sampleCounts(
            resolver, 13L, TestPersonnel.baselineOffense(), TestPersonnel.baselineDefense());
    var eliteSafety =
        new PlayerBuilder()
            .atPosition(Position.S)
            .withSkill(SkillBuilder.aSkill().withBallSkills(99).withCoverageTechnique(99))
            .build();
    var stackedDefense =
        TestPersonnel.defenseWith(
            eliteSafety,
            eliteBallSkills(Position.S),
            eliteBallSkills(Position.CB),
            eliteBallSkills(Position.CB));
    var elite = sampleCounts(resolver, 13L, TestPersonnel.baselineOffense(), stackedDefense);

    assertThat(elite.interceptions)
        .as("elite ball-hawk safeties must raise hail-mary INT rate over baseline")
        .isGreaterThan(baseline.interceptions);
    assertThat(elite.completes)
        .as("elite ball-hawk safeties must reduce hail-mary completions vs baseline")
        .isLessThan(baseline.completes);
  }

  private static Counts sampleCounts(
      PassResolver resolver, long seed, OffensivePersonnel offense, DefensivePersonnel defense) {
    var rng = new SplittableRandomSource(seed);
    var counts = new Counts();
    for (var i = 0; i < TRIALS; i++) {
      switch (resolver.resolve(HAIL_MARY, GameState.initial(), offense, defense, rng)) {
        case PassOutcome.PassComplete ignored -> counts.completes++;
        case PassOutcome.Interception ignored -> counts.interceptions++;
        case PassOutcome.PassIncomplete ignored -> counts.incompletes++;
        case PassOutcome.Sack ignored -> counts.other++;
        case PassOutcome.Scramble ignored -> counts.other++;
      }
    }
    return counts;
  }

  private static app.zoneblitz.gamesimulator.roster.Player eliteContested() {
    return new PlayerBuilder()
        .atPosition(Position.WR)
        .withSkill(SkillBuilder.aSkill().withContestedCatch(99).withHands(99))
        .build();
  }

  private static app.zoneblitz.gamesimulator.roster.Player eliteBallSkills(Position position) {
    return new PlayerBuilder()
        .atPosition(position)
        .withSkill(SkillBuilder.aSkill().withBallSkills(99).withCoverageTechnique(99))
        .build();
  }

  private static final class Counts {
    int completes;
    int interceptions;
    int incompletes;
    int other;
  }
}
