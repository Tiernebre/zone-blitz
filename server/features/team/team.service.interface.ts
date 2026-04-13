import type { Team } from "@zone-blitz/shared";

export interface TeamService {
  getAll(): Promise<Team[]>;
  getById(id: string): Promise<Team>;
}
