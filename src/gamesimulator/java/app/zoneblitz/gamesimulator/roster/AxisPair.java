package app.zoneblitz.gamesimulator.roster;

import app.zoneblitz.gamesimulator.role.AttributeAxis;
import java.util.Objects;

/**
 * Unordered pair of attribute axes used as a key in correlation maps. Canonicalizes ordering by
 * {@link AttributeAxis#code()} so {@code (speed, agility)} and {@code (agility, speed)} hash and
 * compare as the same pair.
 */
record AxisPair(AttributeAxis a, AttributeAxis b) {

  AxisPair {
    Objects.requireNonNull(a, "a");
    Objects.requireNonNull(b, "b");
    if (a.code().compareTo(b.code()) > 0) {
      var tmp = a;
      a = b;
      b = tmp;
    }
  }

  static AxisPair of(AttributeAxis a, AttributeAxis b) {
    return new AxisPair(a, b);
  }
}
