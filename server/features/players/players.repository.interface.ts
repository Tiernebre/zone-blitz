import type { PlayerDetail } from "@zone-blitz/shared";

export interface PlayersRepository {
  /**
   * Full public record for one player: header identity, current team,
   * and origin (draft slot, drafting team, college, hometown). Never
   * surfaces hidden attributes, potential, or scout grades — those
   * belong behind the scouting wall.
   *
   * Returns undefined when the id does not resolve.
   */
  getDetailById(playerId: string): Promise<PlayerDetail | undefined>;
}
