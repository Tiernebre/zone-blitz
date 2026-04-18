package app.zoneblitz.league;

public interface CreateLeague {

  /**
   * Create a new league owned by {@code ownerSubject}, with the 8 teams materialized — one owned by
   * the user (via {@code franchiseId}) and seven CPU.
   *
   * @return {@link CreateLeagueResult.Created} on success; {@link CreateLeagueResult.NameTaken} if
   *     the user already has a league with this name (case-insensitive); {@link
   *     CreateLeagueResult.UnknownFranchise} if {@code franchiseId} does not resolve.
   */
  CreateLeagueResult create(String ownerSubject, String name, long franchiseId);
}
