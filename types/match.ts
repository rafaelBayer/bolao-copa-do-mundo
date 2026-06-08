export type Team = {
  id: string;
  name: string;
  code: string | null;
  flagUrl: string | null;
};

export type MatchWithTeams = {
  id: string;
  groupId: string;
  roundNumber: number;
  matchDate: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: Team;
  awayTeam: Team;
};
