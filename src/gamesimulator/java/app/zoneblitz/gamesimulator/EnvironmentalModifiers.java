package app.zoneblitz.gamesimulator;

import java.util.Objects;

/**
 * Derives scalar resolver modifiers from a {@link GameInputs.PreGameContext}. Pure and
 * deterministic — the same context produces the same modifiers every call.
 *
 * <p>Scalars are small, intentionally. Weather is a flavor layer in the sim; it shifts outcomes
 * directionally without dominating them. An enclosed roof short-circuits weather entirely and
 * returns {@link #neutral()}.
 *
 * <p>Sign conventions:
 *
 * <ul>
 *   <li>{@code kickAccuracyPenalty} / {@code puntDistancePenalty} / {@code
 *       deepPassCompletionPenalty} are non-negative — subtract from a baseline probability or
 *       multiply a baseline distance by {@code 1 - penalty}.
 *   <li>{@code fumbleRateBonus} is additive on top of the baseline fumble rate.
 *   <li>{@code kickerRangeYardsLost} is non-negative — subtract from the baseline max-makeable
 *       distance.
 *   <li>{@code speedMultiplier} is centered at 1.0; values above favour the ball-carrier.
 *   <li>{@code injuryRateMultiplier} is centered at 1.0; values above 1.0 increase non-contact
 *       injury probability.
 * </ul>
 */
public record EnvironmentalModifiers(
    double kickAccuracyPenalty,
    double puntDistancePenalty,
    double deepPassCompletionPenalty,
    double fumbleRateBonus,
    int kickerRangeYardsLost,
    double speedMultiplier,
    double injuryRateMultiplier) {

  /** No-op modifier set. Equivalent to perfect indoor conditions on grass. */
  public static EnvironmentalModifiers neutral() {
    return new EnvironmentalModifiers(0.0, 0.0, 0.0, 0.0, 0, 1.0, 1.0);
  }

  /**
   * Derive modifiers from the supplied context. Enclosed roofs zero out weather contributions;
   * surface contributions apply regardless of roof.
   */
  public static EnvironmentalModifiers from(GameInputs.PreGameContext context) {
    Objects.requireNonNull(context, "context");
    var weather = context.roof().isEnclosed() ? Weather.indoor() : context.weather();
    var surface = context.surface();

    var wind = Math.max(0, weather.windMph());
    var kickAccuracyPenalty = Math.min(0.45, wind * 0.012);
    var puntDistancePenalty = Math.min(0.35, wind * 0.008);
    var deepPassCompletionPenalty = Math.min(0.30, wind * 0.006);

    var precipFumble =
        switch (weather.precipitation()) {
          case NONE -> 0.0;
          case LIGHT_RAIN -> 0.004;
          case HEAVY_RAIN -> 0.010;
          case SNOW -> 0.012;
        };
    var precipCompletionPenalty =
        switch (weather.precipitation()) {
          case NONE -> 0.0;
          case LIGHT_RAIN -> 0.02;
          case HEAVY_RAIN -> 0.06;
          case SNOW -> 0.05;
        };
    deepPassCompletionPenalty = Math.min(0.40, deepPassCompletionPenalty + precipCompletionPenalty);

    var coldFumble = weather.isCold() ? 0.004 : 0.0;
    var fumbleRateBonus = precipFumble + coldFumble;

    var kickerRangeYardsLost =
        weather.isCold() ? Math.min(5, (32 - weather.temperatureF()) / 10) : 0;

    var speedMultiplier = surface == Surface.TURF ? 1.01 : 1.0;
    var injuryRateMultiplier = surface == Surface.TURF ? 1.10 : 1.0;

    return new EnvironmentalModifiers(
        kickAccuracyPenalty,
        puntDistancePenalty,
        deepPassCompletionPenalty,
        fumbleRateBonus,
        kickerRangeYardsLost,
        speedMultiplier,
        injuryRateMultiplier);
  }
}
