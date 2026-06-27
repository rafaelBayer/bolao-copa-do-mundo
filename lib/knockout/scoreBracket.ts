import type { KnockoutMatch, KnockoutPick, KnockoutRound } from "./types";

export const KNOCKOUT_SCORE_WEIGHTS: Partial<Record<KnockoutRound, number>> = {
  round_of_32: 2,
  round_of_16: 4,
  quarterfinal: 6,
  semifinal: 10,
  final: 15,
};

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

function officialWinnerKey(match: KnockoutMatch) {
  return `${match.round}:${match.position}`;
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
  const officialWinners = new Map<string, string>();

  matches.forEach((match) => {
    if (match.winnerTeam) {
      officialWinners.set(officialWinnerKey(match), match.winnerTeam);
    }
  });

  return picks.reduce<KnockoutScoreSummary>(
    (summary, pick) => {
      const weight = KNOCKOUT_SCORE_WEIGHTS[pick.round] ?? 0;
      const officialWinner = officialWinners.get(`${pick.round}:${pick.position}`);

      if (weight > 0 && officialWinner) {
        summary.possiblePoints += weight;
      }

      if (weight > 0 && officialWinner === pick.selectedTeam) {
        summary.totalPoints += weight;
        summary.correctPicks += 1;
        addRoundScore(
          summary.breakdown,
          summary.correctBreakdown,
          pick.round,
          weight,
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
