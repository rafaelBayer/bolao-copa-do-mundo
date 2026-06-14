export type PlayoffStage =
  | "ROUND_OF_32"
  | "ROUND_OF_16"
  | "QUARTER_FINAL"
  | "SEMI_FINAL"
  | "FINAL";

export type PlayoffTeam = {
  id: string;
  name: string;
  code: string | null;
  flagUrl: string | null;
};

export type PlayoffMatch = {
  id: string;
  stage: PlayoffStage;
  position: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
  sourceHome: string | null;
  sourceAway: string | null;
  kickoffAt: string | null;
  nextMatchId: string | null;
  nextMatchSlot: "home" | "away" | null;
  homeTeam: PlayoffTeam | null;
  awayTeam: PlayoffTeam | null;
};

export type PlayoffPick = {
  id: string;
  playoffMatchId: string;
  selectedTeamId: string;
  createdAt: string;
  updatedAt: string;
};

export type PlayoffBracketState = {
  isOwner: boolean;
  isEnabled: boolean;
  canAccess: boolean;
  isLocked: boolean;
  lockAt: string | null;
  startedUsersCount: number;
  matches: PlayoffMatch[];
  picks: PlayoffPick[];
};
