package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.event.RunConcept;
import org.junit.jupiter.api.Test;

class PlayCallTests {

  @Test
  void singleArg_defaultsRunConceptToInsideZone() {
    var call = new PlayCaller.PlayCall("run");

    assertThat(call.runConcept())
        .as("single-arg constructor must default to the baseline-parity concept")
        .isEqualTo(RunConcept.INSIDE_ZONE);
  }

  @Test
  void canonicalConstructor_carriesConceptThrough() {
    var call = new PlayCaller.PlayCall("run", RunConcept.POWER);

    assertThat(call.runConcept()).isEqualTo(RunConcept.POWER);
  }

  @Test
  void nullKind_throws() {
    assertThatThrownBy(() -> new PlayCaller.PlayCall(null, RunConcept.INSIDE_ZONE))
        .isInstanceOf(NullPointerException.class);
  }

  @Test
  void nullRunConcept_throws() {
    assertThatThrownBy(() -> new PlayCaller.PlayCall("run", null))
        .isInstanceOf(NullPointerException.class);
  }
}
