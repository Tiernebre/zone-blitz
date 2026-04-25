package app.zoneblitz.gamesimulator.resolver;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.resolver.pass.PassResolver;
import app.zoneblitz.gamesimulator.resolver.run.RunResolver;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class DispatchingPlayResolverTests {

  private RecordingPassResolver pass;
  private RecordingRunResolver run;
  private PlayResolver resolver;

  @BeforeEach
  void setUp() {
    pass = new RecordingPassResolver();
    run = new RecordingRunResolver();
    resolver = new DispatchingPlayResolver(pass, run);
  }

  @Test
  void resolve_passCall_delegatesToPassResolver() {
    var outcome = resolver.resolve(new PlayCaller.PlayCall("pass"), null, null, null, null);

    assertThat(outcome).isSameAs(pass.outcome);
    assertThat(pass.calls).isEqualTo(1);
    assertThat(run.calls).isZero();
  }

  @Test
  void resolve_runCall_delegatesToRunResolver() {
    var outcome =
        resolver.resolve(new PlayCaller.PlayCall("run", RunConcept.POWER), null, null, null, null);

    assertThat(outcome).isSameAs(run.outcome);
    assertThat(run.calls).isEqualTo(1);
    assertThat(pass.calls).isZero();
  }

  @Test
  void resolve_kindIsCaseInsensitive() {
    resolver.resolve(new PlayCaller.PlayCall("PASS"), null, null, null, null);
    resolver.resolve(
        new PlayCaller.PlayCall("Run", RunConcept.INSIDE_ZONE), null, null, null, null);

    assertThat(pass.calls).isEqualTo(1);
    assertThat(run.calls).isEqualTo(1);
  }

  @Test
  void resolve_unknownKind_throwsIllegalArgumentException() {
    var call = new PlayCaller.PlayCall("punt", RunConcept.INSIDE_ZONE);

    assertThatThrownBy(() -> resolver.resolve(call, null, null, null, null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("punt");
  }

  @Test
  void resolve_nullCall_throwsNullPointerException() {
    assertThatNullPointerException()
        .isThrownBy(() -> resolver.resolve(null, null, null, null, null))
        .withMessageContaining("call");
  }

  @Test
  void constructor_nullPass_throwsNullPointerException() {
    assertThatNullPointerException()
        .isThrownBy(() -> new DispatchingPlayResolver(null, run))
        .withMessageContaining("pass");
  }

  @Test
  void constructor_nullRun_throwsNullPointerException() {
    assertThatNullPointerException()
        .isThrownBy(() -> new DispatchingPlayResolver(pass, null))
        .withMessageContaining("run");
  }

  private static final class RecordingPassResolver implements PassResolver {
    final PassOutcome outcome =
        new PassOutcome.PassIncomplete(
            new PlayerId(UUID.randomUUID()),
            new PlayerId(UUID.randomUUID()),
            0,
            app.zoneblitz.gamesimulator.event.IncompleteReason.THROWN_AWAY,
            Optional.empty());
    int calls;

    @Override
    public PassOutcome resolve(
        PlayCaller.PlayCall call,
        GameState state,
        OffensivePersonnel offense,
        DefensivePersonnel defense,
        RandomSource rng) {
      calls++;
      return outcome;
    }
  }

  private static final class RecordingRunResolver implements RunResolver {
    final RunOutcome outcome =
        new RunOutcome.Run(
            new PlayerId(UUID.randomUUID()),
            RunConcept.INSIDE_ZONE,
            3,
            Optional.empty(),
            Optional.empty(),
            false);
    int calls;

    @Override
    public RunOutcome resolve(
        PlayCaller.PlayCall call,
        GameState state,
        OffensivePersonnel offense,
        DefensivePersonnel defense,
        RandomSource rng) {
      calls++;
      return outcome;
    }
  }
}
