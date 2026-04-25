package app.zoneblitz.gamesimulator.roster;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;

/**
 * Generates a full roster for a single team. Wraps a {@link PlayerGenerator} with per-position
 * counts and consistent player-id seeding so two calls with the same RNG and roster shape produce
 * identical rosters.
 *
 * <p>Default position counts target a 53-man NFL roster: 2 QB, 3 RB, 1 FB, 5 WR, 3 TE, 8 OL, 6 DL,
 * 5 LB, 4 CB, 3 S, 1 K, 1 P, 1 LS — totaling 43 (the gap is for special-teams flex / IR /
 * practice-squad-call-up slots that the sim doesn't model). Callers can supply a custom {@code
 * positionCounts} map for non-default depth.
 */
public final class RosterGenerator {

  private static final java.util.EnumMap<Position, Integer> DEFAULT_COUNTS = defaultCounts();

  private final PlayerGenerator playerGenerator;
  private final java.util.Map<Position, Integer> positionCounts;

  public RosterGenerator(PlayerGenerator playerGenerator) {
    this(playerGenerator, DEFAULT_COUNTS);
  }

  public RosterGenerator(
      PlayerGenerator playerGenerator, java.util.Map<Position, Integer> positionCounts) {
    this.playerGenerator = java.util.Objects.requireNonNull(playerGenerator, "playerGenerator");
    java.util.Objects.requireNonNull(positionCounts, "positionCounts");
    this.positionCounts =
        java.util.Map.copyOf(new java.util.EnumMap<Position, Integer>(positionCounts));
  }

  public List<Player> generate(
      long teamSeed, RandomSource rng, Function<RandomSource, String> nameFactory) {
    java.util.Objects.requireNonNull(rng, "rng");
    java.util.Objects.requireNonNull(nameFactory, "nameFactory");
    var roster = new java.util.ArrayList<Player>();
    var slotIndex = 0;
    for (var entry : positionCounts.entrySet()) {
      var position = entry.getKey();
      var count = entry.getValue();
      for (var i = 0; i < count; i++) {
        var id = new PlayerId(new UUID(teamSeed, slotIndex++));
        var name = nameFactory.apply(rng);
        roster.add(playerGenerator.generate(id, position, name, rng));
      }
    }
    return List.copyOf(roster);
  }

  private static java.util.EnumMap<Position, Integer> defaultCounts() {
    var counts = new java.util.EnumMap<Position, Integer>(Position.class);
    counts.put(Position.QB, 2);
    counts.put(Position.RB, 3);
    counts.put(Position.FB, 1);
    counts.put(Position.WR, 5);
    counts.put(Position.TE, 3);
    counts.put(Position.OL, 8);
    counts.put(Position.DL, 6);
    counts.put(Position.LB, 5);
    counts.put(Position.CB, 4);
    counts.put(Position.S, 3);
    counts.put(Position.K, 1);
    counts.put(Position.P, 1);
    counts.put(Position.LS, 1);
    return counts;
  }
}
