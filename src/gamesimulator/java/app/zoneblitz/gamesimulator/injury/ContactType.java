package app.zoneblitz.gamesimulator.injury;

/**
 * Internal classifier for the kind of contact that exposes a player to injury risk on a given snap.
 * Bucket drives the per-snap base rate inside {@link BaselineInjuryModel}; never leaks to consumer
 * outcome records.
 */
enum ContactType {
  /** Standard ball-carrier tackle (run, completed pass). */
  TACKLE,
  /** QB sack — quarterback exposed to direct hit, optionally piled on. */
  SACK,
  /** Pile-up at the goal line or short-yardage stack — multiple bodies. */
  PILE
}
