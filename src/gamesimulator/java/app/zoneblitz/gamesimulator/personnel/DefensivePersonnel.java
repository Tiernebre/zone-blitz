package app.zoneblitz.gamesimulator.personnel;

import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import java.util.List;
import java.util.Objects;

/**
 * The 11 defensive players on the field for a single snap, together with the {@link
 * DefensivePackage} grouping that describes their front and secondary. The compact constructor
 * rejects any player list that violates the package's expected counts, so downstream resolvers can
 * read {@link #defensiveLine()}, {@link #linebackers()}, {@link #cornerbacks()}, {@link
 * #safeties()}, and {@link #defensiveBacks()} without re-validating anything.
 *
 * <p>Defensive backs are the union of cornerbacks and safeties. Offensive positions and specialists
 * are rejected outright.
 */
public record DefensivePersonnel(DefensivePackage pkg, List<Player> players) {

  public DefensivePersonnel {
    Objects.requireNonNull(pkg, "pkg");
    Objects.requireNonNull(players, "players");
    if (players.size() != 11) {
      throw new IllegalArgumentException(
          "Defensive personnel must have exactly 11 players; got " + players.size());
    }
    players = List.copyOf(players);
    validate(pkg, players);
  }

  public List<Player> defensiveLine() {
    return filterByPosition(Position.DL);
  }

  public List<Player> linebackers() {
    return filterByPosition(Position.LB);
  }

  public List<Player> cornerbacks() {
    return filterByPosition(Position.CB);
  }

  public List<Player> safeties() {
    return filterByPosition(Position.S);
  }

  public List<Player> defensiveBacks() {
    return players.stream()
        .filter(p -> p.position() == Position.CB || p.position() == Position.S)
        .toList();
  }

  private List<Player> filterByPosition(Position position) {
    return players.stream().filter(p -> p.position() == position).toList();
  }

  private static void validate(DefensivePackage pkg, List<Player> players) {
    var dl = 0;
    var lb = 0;
    var dbs = 0;
    for (var p : players) {
      switch (p.position()) {
        case DL -> dl++;
        case LB -> lb++;
        case CB, S -> dbs++;
        default ->
            throw new IllegalArgumentException(
                "Defensive personnel contains ineligible position "
                    + p.position()
                    + " for player "
                    + p.displayName());
      }
    }
    require(pkg, "DL", pkg.defensiveLinemen(), dl);
    require(pkg, "LB", pkg.linebackers(), lb);
    require(pkg, "DB", pkg.defensiveBacks(), dbs);
  }

  private static void require(DefensivePackage pkg, String label, int expected, int actual) {
    if (expected != actual) {
      throw new IllegalArgumentException(
          "%s personnel requires %d %s; got %d".formatted(pkg.name(), expected, label, actual));
    }
  }
}
