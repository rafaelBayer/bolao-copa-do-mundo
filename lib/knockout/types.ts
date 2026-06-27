export type KnockoutRound =
  | "round_of_32"
  | "round_of_16"
  | "quarterfinal"
  | "semifinal"
  | "final"
  | "champion";

export type KnockoutMatch = {
  id: string;
  tournamentKey: string;
  round: KnockoutRound;
  position: number;
  externalMatchId: string | null;
  teamASource: string | null;
  teamA: string | null;
  teamACode: string | null;
  teamAFlagUrl: string | null;
  teamBSource: string | null;
  teamB: string | null;
  teamBCode: string | null;
  teamBFlagUrl: string | null;
  startsAt: string | null;
  winnerTeam: string | null;
  winnerTeamCode: string | null;
};

export type KnockoutPick = {
  id?: string;
  round: KnockoutRound;
  position: number;
  selectedTeam: string;
  createdAt?: string;
  updatedAt?: string;
};

export type KnockoutSettings = {
  id: string;
  tournamentKey: string;
  name: string;
  deadlineAt: string;
  isActive: boolean;
};

export type UserKnockoutBracket = {
  id: string;
  userId: string;
  tournamentKey: string;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnockoutRankingEntry = {
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  totalPoints: number;
  correctPicks: number;
  submittedAt: string | null;
  completedAt: string | null;
  picksCount: number;
  isComplete: boolean;
  roundOf32Points: number;
  roundOf16Points: number;
  quarterfinalPoints: number;
  semifinalPoints: number;
  finalPoints: number;
  roundOf32Correct: number;
  roundOf16Correct: number;
  quarterfinalCorrect: number;
  semifinalCorrect: number;
  finalCorrect: number;
};

export type KnockoutSlot = {
  team: string | null;
  code: string | null;
  flagUrl: string | null;
  label: string;
};

export type KnockoutBracketMatch = {
  round: KnockoutRound;
  position: number;
  teamA: KnockoutSlot;
  teamB: KnockoutSlot;
  startsAt: string | null;
  winnerTeam: string | null;
  selectedTeam: string | null;
};

export type KnockoutRoundState = {
  round: KnockoutRound;
  matches: KnockoutBracketMatch[];
};
