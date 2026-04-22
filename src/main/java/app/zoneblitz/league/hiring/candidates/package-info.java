/**
 * Feature-internal candidate, pool, and preferences persistence for {@link
 * app.zoneblitz.league.hiring}. Holds the repository seams ({@code CandidateRepository}, {@code
 * CandidatePoolRepository}, {@code CandidatePreferencesRepository}), their jOOQ adapters, the
 * preferences draft DTO, and the splittable {@code CandidateRandomSources} factory.
 *
 * <p>See the hiring feature's {@code README.md} in the parent directory for the full layout.
 */
package app.zoneblitz.league.hiring.candidates;
