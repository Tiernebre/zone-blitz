import type { Franchise } from "@zone-blitz/shared";

export interface FranchiseService {
  getAll(): Promise<Franchise[]>;
  getById(id: string): Promise<Franchise>;
}
