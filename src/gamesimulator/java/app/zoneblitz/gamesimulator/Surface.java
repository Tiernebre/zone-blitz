package app.zoneblitz.gamesimulator;

/**
 * Playing surface. Turf is slightly faster than natural grass and carries a slightly higher
 * non-contact injury rate in real tracking data; the full injury coupling lives in a separate model
 * (see issue #585).
 */
public enum Surface {
  GRASS,
  TURF
}
