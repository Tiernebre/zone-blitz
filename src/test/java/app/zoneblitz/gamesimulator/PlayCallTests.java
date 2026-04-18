package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import org.junit.jupiter.api.Test;

class PlayCallTests {

  @Test
  void singleArgRun_defaultsRunConceptToInsideZone() {
    var call = new PlayCaller.PlayCall("run");

    assertThat(call.runConcept())
        .as("single-arg constructor must default to the baseline-parity concept")
        .isEqualTo(RunConcept.INSIDE_ZONE);
  }

  @Test
  void singleArgPass_defaultsPassConceptToDropback() {
    var call = new PlayCaller.PlayCall("pass");

    assertThat(call.passConcept())
        .as("single-arg pass must default to the baseline-parity concept")
        .isEqualTo(PassConcept.DROPBACK);
  }

  @Test
  void canonicalConstructor_carriesRunConceptThrough() {
    var call = new PlayCaller.PlayCall("run", RunConcept.POWER);

    assertThat(call.runConcept()).isEqualTo(RunConcept.POWER);
  }

  @Test
  void canonicalConstructor_carriesPassConceptThrough() {
    var call = new PlayCaller.PlayCall("pass", PassConcept.PLAY_ACTION);

    assertThat(call.passConcept()).isEqualTo(PassConcept.PLAY_ACTION);
  }

  @Test
  void nullKind_throws() {
    assertThatThrownBy(
            () ->
                new PlayCaller.PlayCall(
                    null, RunConcept.INSIDE_ZONE, PassConcept.DROPBACK, OffensiveFormation.SHOTGUN))
        .isInstanceOf(NullPointerException.class);
  }

  @Test
  void nullRunConcept_throws() {
    assertThatThrownBy(
            () ->
                new PlayCaller.PlayCall(
                    "run", null, PassConcept.DROPBACK, OffensiveFormation.SHOTGUN))
        .isInstanceOf(NullPointerException.class);
  }

  @Test
  void nullPassConcept_throws() {
    assertThatThrownBy(
            () ->
                new PlayCaller.PlayCall(
                    "pass", RunConcept.INSIDE_ZONE, null, OffensiveFormation.SHOTGUN))
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
  void playActionPass_defaultsFormationToSingleback() {
    var call = new PlayCaller.PlayCall("pass", PassConcept.PLAY_ACTION);

    assertThat(call.formation())
        .as("play-action modally runs from under-center — default to singleback")
        .isEqualTo(OffensiveFormation.SINGLEBACK);
  }

  @Test
  void screenPass_defaultsFormationToShotgun() {
    var call = new PlayCaller.PlayCall("pass", PassConcept.SCREEN);

    assertThat(call.formation()).isEqualTo(OffensiveFormation.SHOTGUN);
  }

  @Test
  void hailMaryPass_defaultsFormationToShotgun() {
    var call = new PlayCaller.PlayCall("pass", PassConcept.HAIL_MARY);

    assertThat(call.formation()).isEqualTo(OffensiveFormation.SHOTGUN);
  }

  @Test
  void runFormationConstructor_carriesFormationThrough() {
    var call = new PlayCaller.PlayCall("run", RunConcept.POWER, OffensiveFormation.I_FORM);

    assertThat(call.formation()).isEqualTo(OffensiveFormation.I_FORM);
  }

  @Test
  void passFormationConstructor_carriesFormationThrough() {
    var call = new PlayCaller.PlayCall("pass", PassConcept.DROPBACK, OffensiveFormation.EMPTY);

    assertThat(call.formation()).isEqualTo(OffensiveFormation.EMPTY);
  }

  @Test
  void nullFormation_throws() {
    assertThatThrownBy(
            () ->
                new PlayCaller.PlayCall("run", RunConcept.INSIDE_ZONE, PassConcept.DROPBACK, null))
        .isInstanceOf(NullPointerException.class);
  }
}
