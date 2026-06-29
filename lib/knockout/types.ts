export type KnockoutRound =
  | "round_of_32"
  | "round_of_16"
  | "quarterfinal"
  | "semifinal"
  | "final"
  | "third_place"
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
  lockAt: string | null;
  statusShort: string | null;
  statusLong: string | null;
  elapsed: number | null;
  homeScoreLive: number | null;
  awayScoreLive: number | null;
  homeScore: number | null;
  awayScore: number | null;
  scoreUpdatedAt: string | null;
  isLocked: boolean;
  canPick: boolean;
  userPick: string | null;
  pointsIfCorrect: number;
  isFinished: boolean;
  isPickCorrect: boolean | null;
  pickPoints: number;
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

export type KnockoutRankingPickDetail = {
  round: KnockoutRound;
  position: number;
  teamA: string | null;
  teamB: string | null;
  selectedTeam: string;
  winnerTeam: string | null;
  points: number;
  isCorrect: boolean | null;
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
  picks: KnockoutRankingPickDetail[];
};

export type KnockoutSlot = {
  team: string | null;
  code: string | null;
  flagUrl: string | null;
  label: string;
};

export type KnockoutBracketMatch = {
  id: string | null;
  round: KnockoutRound;
  position: number;
  teamA: KnockoutSlot;
  teamB: KnockoutSlot;
  startsAt: string | null;
  lockAt: string | null;
  statusShort: string | null;
  statusLong: string | null;
  elapsed: number | null;
  homeScoreLive: number | null;
  awayScoreLive: number | null;
  homeScore: number | null;
  awayScore: number | null;
  scoreUpdatedAt: string | null;
  isLocked: boolean;
  canPick: boolean;
  pointsIfCorrect: number;
  isFinished: boolean;
  isPickCorrect: boolean | null;
  pickPoints: number;
  winnerTeam: string | null;
  selectedTeam: string | null;
  invalidSelectedTeam: string | null;
  pointsInfo: {
    basePoints: number;
    bonusPoints: number;
    totalPossiblePoints: number;
    bonusAvailable: boolean;
    bonusPending: boolean;
    bonusBlockedReason: string | null;
    ancestorMatchesCount: number;
    correctAncestorMatchesCount: number;
    pendingAncestorMatchesCount: number;
  };
};

export type KnockoutCommunityPickUser = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  isCurrentUser: boolean;
};

export type KnockoutCommunityPickOption = {
  teamName: string;
  teamCode: string | null;
  teamFlagUrl: string | null;
  count: number;
  percentage: number;
  users: KnockoutCommunityPickUser[];
};

export type KnockoutCommunityPicksSummary = {
  matchKey: string;
  isLocked: boolean;
  totalPicks: number;
  userPick: string | null;
  options: KnockoutCommunityPickOption[];
};

export type KnockoutRoundState = {
  round: KnockoutRound;
  matches: KnockoutBracketMatch[];
};
