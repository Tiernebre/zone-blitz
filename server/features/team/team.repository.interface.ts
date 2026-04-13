import type { Team } from "@zone-blitz/shared";

export interface TeamRepository {
  getAll(): Promise<Team[]>;
  getById(id: string): Promise<Team | undefined>;
}
