package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ClasspathBandRepositoryTests {

  private final BandRepository repository = new ClasspathBandRepository();

  @Test
  void loadRate_passingPlays_outcomeMix_parses() {
    var band = repository.loadRate("passing-plays.json", "bands.outcome_mix", String.class);

    assertThat(band.baseProbabilities())
        .containsOnlyKeys("complete", "incomplete", "interception", "sack", "scramble");
    var sum = band.baseProbabilities().values().stream().mapToDouble(Double::doubleValue).sum();
    assertThat(sum).isCloseTo(1.0, org.assertj.core.data.Offset.offset(1e-3));
    assertThat(band.matchupCoefficients())
        .containsEntry("complete", 0.0)
        .containsEntry("incomplete", 0.0)
        .containsEntry("interception", 0.0)
        .containsEntry("sack", 0.0)
        .containsEntry("scramble", 0.0);
  }
}
