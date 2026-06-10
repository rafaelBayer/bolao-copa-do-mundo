export type Team = {
  id: string;
  name: string;
  code: string | null;
  flagUrl: string | null;
};

export type MatchWithTeams = {
  id: string;
  groupId: string;
  fifaMatchNumber: number | null;
  roundNumber: number;
  matchDate: string | null;
  kickoffAt: string | null;
  stadium: string | null;
  city: string | null;
  country: string | null;
  homeScore: number | null;
  awayScore: number | null;
  apiFootballFixtureId: number | null;
  statusShort: string | null;
  statusLong: string | null;
  elapsed: number | null;
  homeScoreLive: number | null;
  awayScoreLive: number | null;
  scoreUpdatedAt: string | null;
  homeTeam: Team;
  awayTeam: Team;
};
