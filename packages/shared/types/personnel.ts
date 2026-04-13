export interface Player {
  id: string;
  leagueId: string;
  teamId: string | null;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Coach {
  id: string;
  leagueId: string;
  teamId: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Scout {
  id: string;
  leagueId: string;
  teamId: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FrontOfficeStaff {
  id: string;
  leagueId: string;
  teamId: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DraftProspect {
  id: string;
  seasonId: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}
