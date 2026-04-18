package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
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

  @Test
  void singleArgRun_defaultsFormationToSingleback() {
    var call = new PlayCaller.PlayCall("run");

    assertThat(call.formation()).isEqualTo(OffensiveFormation.SINGLEBACK);
  }

  @Test
  void singleArgPass_defaultsFormationToShotgun() {
    var call = new PlayCaller.PlayCall("pass");

    assertThat(call.formation()).isEqualTo(OffensiveFormation.SHOTGUN);
  }

  @Test
  void canonicalConstructor_carriesFormationThrough() {
    var call = new PlayCaller.PlayCall("run", RunConcept.POWER, OffensiveFormation.I_FORM);

    assertThat(call.formation()).isEqualTo(OffensiveFormation.I_FORM);
  }

  @Test
  void nullFormation_throws() {
    assertThatThrownBy(() -> new PlayCaller.PlayCall("run", RunConcept.INSIDE_ZONE, null))
        .isInstanceOf(NullPointerException.class);
  }
}
