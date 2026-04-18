package app.zoneblitz.gamesimulator;

import org.springframework.context.annotation.Configuration;

/**
 * Spring wiring for the simulation engine. Intentionally empty today — bean definitions will be
 * added as concrete {@link PlayCaller} / {@link PlayResolver} implementations come online.
 *
 * <p>This class lives in {@code src/main/java} (not the {@code gamesimulator} source set) because
 * it needs Spring on the classpath; the core sim source set stays framework-free.
 */
@Configuration
class SimConfiguration {}
