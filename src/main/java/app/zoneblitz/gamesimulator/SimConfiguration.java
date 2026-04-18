package app.zoneblitz.gamesimulator;

import org.springframework.context.annotation.Configuration;

/**
 * Spring wiring for the simulation engine. Intentionally empty for F1 — later tasks add bean
 * definitions as concrete {@link PlayCaller} / {@link PlayResolver} implementations come online.
 *
 * <p>This class lives in {@code src/main/java} (not the {@code sim} source set) because it needs
 * Spring on the classpath; the core sim source set stays framework-free.
 */
@Configuration
class SimConfiguration {}
