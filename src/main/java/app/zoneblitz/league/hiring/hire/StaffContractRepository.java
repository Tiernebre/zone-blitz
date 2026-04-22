package app.zoneblitz.league.hiring.hire;

import app.zoneblitz.league.hiring.StaffContract;
import java.util.List;

/** Feature-internal persistence seam for {@link StaffContract}. */
public interface StaffContractRepository {

  /**
   * Insert a new signed contract. All fields on {@link NewStaffContract} must satisfy the DB CHECK
   * constraints (positive APY, non-negative guarantee, positive years, end season {@code >=} start
   * season); violation raises the underlying DB exception.
   *
   * @return the persisted {@link StaffContract} with its generated id.
   */
  StaffContract insert(NewStaffContract contract);

  /**
   * All contracts for a team that have not been terminated. Terminated contracts are excluded even
   * if their original {@code endSeason} is still in the future (dead-cap accounting is separate).
   */
  List<StaffContract> findActiveForTeam(long teamId);

  /**
   * Mark the given contract as terminated at {@code atSeason}. No-op if the contract is already
   * terminated. {@code atSeason} must lie within {@code [startSeason, endSeason]}; violation raises
   * the underlying DB CHECK.
   */
  void terminate(long contractId, int atSeason);
}
