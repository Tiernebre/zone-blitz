package app.zoneblitz.gamesimulator.event;

/**
 * Sealed marker bridging the pass-side and run-side concept enums so a single key — see {@code
 * RoleDemandTable} — can index demands across both families with exhaustive pattern-matching at the
 * type level.
 *
 * <p>Permits are colocated in the {@code event} package because Java sealed permits must share a
 * package in non-modular projects. {@link PassConcept} and {@link RunConcept} declare the
 * implementation; new concept families would extend the permits list here.
 */
public sealed interface ConceptFamily permits PassConcept, RunConcept {}
