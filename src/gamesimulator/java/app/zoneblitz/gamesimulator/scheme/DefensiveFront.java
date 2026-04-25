package app.zoneblitz.gamesimulator.scheme;

/**
 * The base front a defensive scheme runs from. {@code MULTIPLE} is the modern hybrid that blends
 * three- and four-down looks per personnel package; many real coordinators (Fangio, Belichick,
 * Macdonald) live in this category. {@code NICKEL_BASE} captures schemes whose default personnel is
 * already a five-defensive-back set — the "nickel is base" lineage.
 */
public enum DefensiveFront {
  FOUR_THREE,
  THREE_FOUR,
  NICKEL_BASE,
  MULTIPLE
}
