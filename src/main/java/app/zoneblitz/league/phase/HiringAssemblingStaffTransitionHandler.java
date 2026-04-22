package app.zoneblitz.league.phase;

import app.zoneblitz.league.hiring.AssembleStaff;
import java.util.Objects;
import org.springframework.stereotype.Component;

/**
 * Phase-entry hook for {@link LeaguePhase#ASSEMBLING_STAFF}. Delegates to {@link AssembleStaff}
 * which owns the subordinate-staff generation + hire logic; this handler keeps phase orchestration
 * in {@code phase/} and business logic in {@code hiring/}.
 *
 * <p>Idempotent: {@link AssembleStaff#assemble(long)} skips teams that already have at least one
 * non-HC / non-DoS staff member.
 */
@Component
public class HiringAssemblingStaffTransitionHandler implements PhaseTransitionHandler {

  private final AssembleStaff assembleStaff;

  public HiringAssemblingStaffTransitionHandler(AssembleStaff assembleStaff) {
    this.assembleStaff = Objects.requireNonNull(assembleStaff, "assembleStaff");
  }

  @Override
  public LeaguePhase phase() {
    return LeaguePhase.ASSEMBLING_STAFF;
  }

  @Override
  public void onEntry(long leagueId) {
    assembleStaff.assemble(leagueId);
  }
}
