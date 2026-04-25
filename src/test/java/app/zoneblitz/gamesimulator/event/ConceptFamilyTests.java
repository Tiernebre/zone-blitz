package app.zoneblitz.gamesimulator.event;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ConceptFamilyTests {

  @Test
  void passConcept_isConceptFamily() {
    ConceptFamily concept = PassConcept.DROPBACK;

    assertThat(concept).isInstanceOf(PassConcept.class);
  }

  @Test
  void runConcept_isConceptFamily() {
    ConceptFamily concept = RunConcept.INSIDE_ZONE;

    assertThat(concept).isInstanceOf(RunConcept.class);
  }

  @Test
  void switchExpression_exhaustiveOverFamily() {
    ConceptFamily concept = PassConcept.PLAY_ACTION;

    var label =
        switch (concept) {
          case PassConcept p -> "pass:" + p.name();
          case RunConcept r -> "run:" + r.name();
        };

    assertThat(label).isEqualTo("pass:PLAY_ACTION");
  }
}
