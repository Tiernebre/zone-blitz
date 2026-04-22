/**
 * Play-level football simulation engine. Per-snap pipeline over seeded RNG, calibrated against
 * real-NFL distributions (bundled under {@code data/bands/}), emitting a deterministic {@link
 * app.zoneblitz.gamesimulator.event.PlayEvent} stream. Bundled into the Spring Boot JAR; kept in
 * its own source set so web-layer code cannot leak into it. Imports nothing from {@code
 * app.zoneblitz.league}.
 *
 * <p>See {@code README.md} in this directory for public API, seam interfaces, and extension points.
 *
 * <p>Design docs: {@code docs/technical/sim-engine.md}.
 */
package app.zoneblitz.gamesimulator;
