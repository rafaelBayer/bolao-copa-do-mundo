import type { MatchWithTeams, Team } from "./match";

export type GroupWithTeamsAndMatches = {
  id: string;
  name: string;
  teams: Team[];
  matches: MatchWithTeams[];
};

export type GroupTableRow = {
  team: Team;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};
