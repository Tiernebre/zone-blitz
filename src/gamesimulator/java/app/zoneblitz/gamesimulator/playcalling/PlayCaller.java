package app.zoneblitz.gamesimulator.playcalling;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import java.util.Objects;

/**
 * Decides what play the offense runs at a given game state. Implementations range from scripted
 * (tests) to tendency-driven (production).
 */
public interface PlayCaller {

  /**
   * Return the offensive play call for the supplied state.
   *
   * @param state current game state
   * @param offensiveCoach the coach whose tendencies drive this call — implementations are free to
   *     ignore it (scripted/alternating callers) or consult {@link Coach#offense()} (the
   *     tendency-driven production caller)
   * @param rng randomness source for probabilistic callers; scripted implementations may ignore it
   */
  PlayCall call(GameState state, Coach offensiveCoach, RandomSource rng);

  /**
   * Opaque play-call placeholder — will be replaced with a sealed hierarchy.
   *
   * <p>{@code runConcept} carries coach intent into the run resolver's matchup shift and is stamped
   * onto the resulting {@code RunOutcome.Run}. {@code passConcept} does the same for passes via
   * each scheme's per-(role, concept) demand entries in {@link
   * app.zoneblitz.gamesimulator.scheme.RoleDemandTable}. {@code formation} feeds the pre-snap
   * box-count and coverage-shell samplers. All fields are required. Convenience constructors
   * default the missing fields:
   *
   * <ul>
   *   <li>run kind → {@link RunConcept#INSIDE_ZONE}, {@link PassConcept#DROPBACK} (placeholder,
   *       ignored for runs), {@link OffensiveFormation#SINGLEBACK}
   *   <li>pass kind → {@link RunConcept#INSIDE_ZONE} (placeholder, ignored for passes), {@link
   *       PassConcept#DROPBACK}, {@link OffensiveFormation#SHOTGUN} (except {@link
   *       PassConcept#PLAY_ACTION} which modally runs from SINGLEBACK)
   * </ul>
   */
  record PlayCall(
      String kind, RunConcept runConcept, PassConcept passConcept, OffensiveFormation formation) {
    public PlayCall {
      Objects.requireNonNull(kind, "kind");
      Objects.requireNonNull(runConcept, "runConcept");
      Objects.requireNonNull(passConcept, "passConcept");
      Objects.requireNonNull(formation, "formation");
    }

    public PlayCall(String kind, RunConcept runConcept) {
      this(kind, runConcept, PassConcept.DROPBACK, defaultFormation(kind, PassConcept.DROPBACK));
    }

    public PlayCall(String kind, PassConcept passConcept) {
      this(kind, RunConcept.INSIDE_ZONE, passConcept, defaultFormation(kind, passConcept));
    }

    public PlayCall(String kind, RunConcept runConcept, OffensiveFormation formation) {
      this(kind, runConcept, PassConcept.DROPBACK, formation);
    }

    public PlayCall(String kind, PassConcept passConcept, OffensiveFormation formation) {
      this(kind, RunConcept.INSIDE_ZONE, passConcept, formation);
    }

    public PlayCall(String kind) {
      this(
          kind,
          RunConcept.INSIDE_ZONE,
          PassConcept.DROPBACK,
          defaultFormation(kind, PassConcept.DROPBACK));
    }

    private static OffensiveFormation defaultFormation(String kind, PassConcept passConcept) {
      if ("run".equalsIgnoreCase(kind)) {
        return OffensiveFormation.SINGLEBACK;
      }
      return switch (passConcept) {
        case PLAY_ACTION -> OffensiveFormation.SINGLEBACK;
        case QUICK_GAME, DROPBACK, SCREEN, RPO, HAIL_MARY -> OffensiveFormation.SHOTGUN;
      };
    }
  }
}
