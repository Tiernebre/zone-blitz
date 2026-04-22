/**
 * Feature-internal hire transaction for {@link app.zoneblitz.league.hiring}. Holds {@code
 * HireCandidateUseCase} (the {@code HireCandidate} implementation), the {@code CpuHiringStrategy}
 * (a {@code CpuTeamStrategy} for hiring phases), {@code InterestScoring}, {@code
 * StaffContractFactory}, and the jOOQ adapters for {@code StaffContract}, {@code StaffBudget}, and
 * {@code LeagueHires}.
 *
 * <p>See the hiring feature's {@code README.md} in the parent directory for the full layout.
 */
package app.zoneblitz.league.hiring.hire;
