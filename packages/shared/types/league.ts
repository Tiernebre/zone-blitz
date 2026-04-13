export interface League {
  id: string;
  name: string;
  numberOfTeams: number;
  seasonLength: number;
  salaryCap: number;
  capFloorPercent: number;
  capGrowthRate: number;
  rosterSize: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewLeague {
  name: string;
}
