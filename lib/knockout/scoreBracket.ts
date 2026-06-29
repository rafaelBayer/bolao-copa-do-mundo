import {
  KNOCKOUT_ROUNDS,
  sourcePositionsForNextRound,
} from "./bracketStructure";
import type { KnockoutMatch, KnockoutPick, KnockoutRound } from "./types";

export const KNOCKOUT_BASE_POINTS = 2;

export type KnockoutScoreBreakdown = {
  roundOf32: number;
  roundOf16: number;
  quarterfinal: number;
  semifinal: number;
  final: number;
  total: number;
};

export type KnockoutCorrectBreakdown = {
  roundOf32Correct: number;
  roundOf16Correct: number;
  quarterfinalCorrect: number;
  semifinalCorrect: number;
  finalCorrect: number;
};

export type KnockoutScoreSummary = {
  totalPoints: number;
  correctPicks: number;
  possiblePoints: number;
  breakdown: KnockoutScoreBreakdown;
  correctBreakdown: KnockoutCorrectBreakdown;
};

export type KnockoutMatchPointsInfo = {
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

export type KnockoutMatchScore = KnockoutMatchPointsInfo & {
  totalPoints: number;
  isCorrect: boolean;
};

function matchKey(match: Pick<KnockoutMatch, "round" | "position">) {
  return `${match.round}:${match.position}`;
}

function pickKey(round: KnockoutRound, position: number) {
  return `${round}:${position}`;
}

function selectedTeamBelongsToMatch(match: KnockoutMatch, selectedTeam: string) {
  return selectedTeam === match.teamA || selectedTeam === match.teamB;
}

function pickMap(picks: KnockoutPick[]) {
  return new Map(
    picks.map((pick) => [pickKey(pick.round, pick.position), pick]),
  );
}

function matchMap(matches: KnockoutMatch[]) {
  return new Map(matches.map((match) => [matchKey(match), match]));
}

function previousRound(round: KnockoutRound) {
  const roundIndex = KNOCKOUT_ROUNDS.indexOf(round);

  if (roundIndex <= 0) {
    return null;
  }

  return KNOCKOUT_ROUNDS[roundIndex - 1] ?? null;
}

function isCorrectPick(match: KnockoutMatch, pick: KnockoutPick | undefined) {
  return Boolean(
    match.winnerTeam &&
      pick?.selectedTeam === match.winnerTeam &&
      selectedTeamBelongsToMatch(match, pick.selectedTeam),
  );
}

export function getKnockoutMatchAncestors(
  match: KnockoutMatch,
  matches: KnockoutMatch[],
): KnockoutMatch[] {
  const ancestorRound = previousRound(match.round);

  if (!ancestorRound) {
    return [];
  }

  const matchesByKey = matchMap(matches);
  const directPositions = sourcePositionsForNextRound(match.position);
  const directAncestors = directPositions
    .map((position) => matchesByKey.get(pickKey(ancestorRound, position)))
    .filter((ancestor): ancestor is KnockoutMatch => Boolean(ancestor));

  return directAncestors.flatMap((ancestor) => [
    ...getKnockoutMatchAncestors(ancestor, matches),
    ancestor,
  ]);
}

export function getKnockoutMatchPotentialPoints(
  match: KnockoutMatch,
  matches: KnockoutMatch[],
  picks: KnockoutPick[],
): KnockoutMatchPointsInfo {
  const ancestors = getKnockoutMatchAncestors(match, matches);
  const picksByKey = pickMap(picks);
  const pendingAncestorMatchesCount = ancestors.filter(
    (ancestor) => !ancestor.winnerTeam,
  ).length;
  const correctAncestorMatchesCount = ancestors.filter((ancestor) =>
    isCorrectPick(ancestor, picksByKey.get(matchKey(ancestor))),
  ).length;
  const hasWrongFinishedAncestor = ancestors.some(
    (ancestor) =>
      ancestor.winnerTeam &&
      !isCorrectPick(ancestor, picksByKey.get(matchKey(ancestor))),
  );
  const bonusPoints = ancestors.length;
  const bonusAvailable =
    ancestors.length > 0 &&
    pendingAncestorMatchesCount === 0 &&
    !hasWrongFinishedAncestor;

  if (ancestors.length === 0) {
    return {
      basePoints: KNOCKOUT_BASE_POINTS,
      bonusPoints: 0,
      totalPossiblePoints: KNOCKOUT_BASE_POINTS,
      bonusAvailable: false,
      bonusPending: false,
      bonusBlockedReason: null,
      ancestorMatchesCount: 0,
      correctAncestorMatchesCount: 0,
      pendingAncestorMatchesCount: 0,
    };
  }

  if (hasWrongFinishedAncestor) {
    return {
      basePoints: KNOCKOUT_BASE_POINTS,
      bonusPoints: 0,
      totalPossiblePoints: KNOCKOUT_BASE_POINTS,
      bonusAvailable: false,
      bonusPending: false,
      bonusBlockedReason: "broken_sequence",
      ancestorMatchesCount: ancestors.length,
      correctAncestorMatchesCount,
      pendingAncestorMatchesCount,
    };
  }

  if (pendingAncestorMatchesCount > 0) {
    return {
      basePoints: KNOCKOUT_BASE_POINTS,
      bonusPoints,
      totalPossiblePoints: KNOCKOUT_BASE_POINTS,
      bonusAvailable: false,
      bonusPending: true,
      bonusBlockedReason: "pending_ancestors",
      ancestorMatchesCount: ancestors.length,
      correctAncestorMatchesCount,
      pendingAncestorMatchesCount,
    };
  }

  return {
    basePoints: KNOCKOUT_BASE_POINTS,
    bonusPoints,
    totalPossiblePoints: KNOCKOUT_BASE_POINTS + bonusPoints,
    bonusAvailable,
    bonusPending: false,
    bonusBlockedReason: null,
    ancestorMatchesCount: ancestors.length,
    correctAncestorMatchesCount,
    pendingAncestorMatchesCount,
  };
}

export function calculateKnockoutMatchScore(
  match: KnockoutMatch,
  matches: KnockoutMatch[],
  picks: KnockoutPick[],
): KnockoutMatchScore {
  const pointsInfo = getKnockoutMatchPotentialPoints(match, matches, picks);
  const picksByKey = pickMap(picks);
  const isCorrect = isCorrectPick(match, picksByKey.get(matchKey(match)));
  const totalPoints = isCorrect
    ? pointsInfo.basePoints +
      (pointsInfo.bonusAvailable ? pointsInfo.bonusPoints : 0)
    : 0;

  return {
    ...pointsInfo,
    totalPoints,
    isCorrect,
  };
}

function emptyBreakdown(): KnockoutScoreBreakdown {
  return {
    roundOf32: 0,
    roundOf16: 0,
    quarterfinal: 0,
    semifinal: 0,
    final: 0,
    total: 0,
  };
}

function emptyCorrectBreakdown(): KnockoutCorrectBreakdown {
  return {
    roundOf32Correct: 0,
    roundOf16Correct: 0,
    quarterfinalCorrect: 0,
    semifinalCorrect: 0,
    finalCorrect: 0,
  };
}

function addRoundScore(
  breakdown: KnockoutScoreBreakdown,
  correctBreakdown: KnockoutCorrectBreakdown,
  round: KnockoutRound,
  points: number,
) {
  breakdown.total += points;

  if (round === "round_of_32") {
    breakdown.roundOf32 += points;
    correctBreakdown.roundOf32Correct += 1;
  } else if (round === "round_of_16") {
    breakdown.roundOf16 += points;
    correctBreakdown.roundOf16Correct += 1;
  } else if (round === "quarterfinal") {
    breakdown.quarterfinal += points;
    correctBreakdown.quarterfinalCorrect += 1;
  } else if (round === "semifinal") {
    breakdown.semifinal += points;
    correctBreakdown.semifinalCorrect += 1;
  } else if (round === "final") {
    breakdown.final += points;
    correctBreakdown.finalCorrect += 1;
  }
}

export function scoreKnockoutBracket(
  matches: KnockoutMatch[],
  picks: KnockoutPick[],
): KnockoutScoreSummary {
  return matches.reduce<KnockoutScoreSummary>(
    (summary, match) => {
      if (!KNOCKOUT_ROUNDS.includes(match.round) || !match.winnerTeam) {
        return summary;
      }

      const matchScore = calculateKnockoutMatchScore(match, matches, picks);

      summary.possiblePoints += matchScore.basePoints +
        (matchScore.bonusAvailable ? matchScore.bonusPoints : 0);

      if (matchScore.isCorrect) {
        summary.totalPoints += matchScore.totalPoints;
        summary.correctPicks += 1;
        addRoundScore(
          summary.breakdown,
          summary.correctBreakdown,
          match.round,
          matchScore.totalPoints,
        );
      }

      return summary;
    },
    {
      totalPoints: 0,
      correctPicks: 0,
      possiblePoints: 0,
      breakdown: emptyBreakdown(),
      correctBreakdown: emptyCorrectBreakdown(),
    },
  );
}
