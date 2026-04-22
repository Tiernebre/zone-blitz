/**
 * Candidate pool generation, interviews, offers, counter-offers, and the hire transaction for
 * coaches and scouts across the {@code HIRING_HEAD_COACH} and {@code HIRING_DIRECTOR_OF_SCOUTING}
 * phases. Enforces the hidden-info contract (true ratings never enter price signals or UI), owns
 * the per-tick offer resolver, and gates every offer and match against the staff salary cap.
 *
 * <p>See {@code README.md} in this directory for public API, internal seams, and extension points.
 * Sub-packages {@code candidates}, {@code generation}, {@code interview}, {@code offer}, {@code
 * hire}, and {@code view} are feature-internal and must not be imported from outside hiring.
 *
 * <p>Design docs: {@code docs/technical/staff-market-implementation.md} and {@code
 * docs/technical/league-phases.md}.
 */
package app.zoneblitz.league.hiring;
