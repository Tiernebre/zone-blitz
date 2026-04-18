package app.zoneblitz.names;

import app.zoneblitz.gamesimulator.rng.RandomSource;

/**
 * Generates human names by drawing from curated first- and last-name pools. Implementations must be
 * deterministic: given the same {@link RandomSource} stream, they produce the same sequence of
 * names.
 */
public interface NameGenerator {

  /**
   * Draw a single {@link Name}. Consumes randomness from {@code rng}; callers that need an
   * independent stream should pass a {@link RandomSource#split(long)} child.
   */
  Name generate(RandomSource rng);
}
