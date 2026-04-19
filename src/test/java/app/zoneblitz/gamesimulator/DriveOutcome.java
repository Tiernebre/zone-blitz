package app.zoneblitz.gamesimulator;

/**
 * Bucketed drive outcome derived from the simulator's event stream. Buckets mirror the nflfastR
 * {@code fixed_drive_result} taxonomy used to source the calibration bands.
 */
public enum DriveOutcome {
  TOUCHDOWN,
  FIELD_GOAL,
  PUNT,
  TURNOVER,
  TURNOVER_ON_DOWNS,
  END_OF_HALF,
  OPP_TOUCHDOWN,
  OPP_SAFETY,
  MISSED_FIELD_GOAL
}
