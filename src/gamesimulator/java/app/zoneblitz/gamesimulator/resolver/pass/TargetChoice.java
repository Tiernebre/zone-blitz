package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.event.PlayerId;
import java.util.Objects;

/**
 * What the QB does with the ball after reading the field. Output of {@link TargetSelector}.
 *
 * <p>Mirrors the design-doc sealed union (sim-engine.md lines 162-194). {@link Throw} carries the
 * selected receiver and the intended route depth in yards — the completion roll downstream samples
 * conditional on both. {@link Scramble}, {@link Throwaway}, and {@link Sack} are the non-target
 * branches, resolved from {@code passing-plays.json} yardage bands (no receiver needed).
 *
 * <p>R5 wires the selector for target-identity picks on throw-shaped outcomes; the pass-rush
 * sub-roll that distinguishes {@link Sack} / {@link Scramble} from coverage-driven throwaways lands
 * when the pressure resolver arrives.
 */
public sealed interface TargetChoice
    permits TargetChoice.Throw, TargetChoice.Scramble, TargetChoice.Throwaway, TargetChoice.Sack {

  /** QB throws to {@code receiverId} with intended air-yard {@code depth}. */
  record Throw(PlayerId receiverId, int depth) implements TargetChoice {
    public Throw {
      Objects.requireNonNull(receiverId, "receiverId");
    }
  }

  /** QB leaves the pocket — yardage sampled from {@code scramble_yards}. */
  record Scramble() implements TargetChoice {}

  /** QB throws the ball away — zero yards, no receiver charged. */
  record Throwaway() implements TargetChoice {}

  /** Coverage / protection breakdown drops the QB — yardage sampled from {@code sack_yards}. */
  record Sack() implements TargetChoice {}
}
