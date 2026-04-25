package app.zoneblitz.gamesimulator.role;

import app.zoneblitz.gamesimulator.roster.Position;

/**
 * Offensive per-snap roles. Finer than {@link Position} so the resolver can distinguish a pocket-
 * vs. movement-style QB, an X (boundary) vs. Z (movement) vs. SLOT receiver, an inline TE vs. flex,
 * etc. Eligibility is gated by {@link #basePosition()}: only QBs play QB roles, only WRs play WR
 * roles. The five OL roles all share {@link Position#OL} — the distinction is alignment, not
 * eligibility.
 */
public enum OffensiveRole implements Role {
  QB_POCKET(Position.QB),
  QB_MOVEMENT(Position.QB),
  RB_RUSH(Position.RB),
  RB_RECEIVE(Position.RB),
  RB_PROTECT(Position.RB),
  FB_LEAD(Position.FB),
  X_WR(Position.WR),
  Z_WR(Position.WR),
  SLOT_WR(Position.WR),
  INLINE_TE(Position.TE),
  FLEX_TE(Position.TE),
  H_BACK(Position.TE),
  LT(Position.OL),
  LG(Position.OL),
  C(Position.OL),
  RG(Position.OL),
  RT(Position.OL);

  private final Position basePosition;

  OffensiveRole(Position basePosition) {
    this.basePosition = basePosition;
  }

  @Override
  public String code() {
    return name();
  }

  @Override
  public Position basePosition() {
    return basePosition;
  }
}
