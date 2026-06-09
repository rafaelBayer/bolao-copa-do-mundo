export type WorldCupTeamSeed = {
  name: string;
  code: string;
  flagUrl?: string | null;
};

export type WorldCupMatchSeed = {
  fifaMatchNumber?: number;
  roundNumber: number;
  homeTeamCode: string;
  awayTeamCode: string;
  kickoffAt?: string | null;
  stadium?: string | null;
  city?: string | null;
  country?: string | null;
};

export type WorldCupGroupSeed = {
  name: string;
  teams: WorldCupTeamSeed[];
  matches: WorldCupMatchSeed[];
};

export type WorldCupSeedData = {
  tournament: string;
  source: string;
  updatedAt: string;
  groups: WorldCupGroupSeed[];
};
