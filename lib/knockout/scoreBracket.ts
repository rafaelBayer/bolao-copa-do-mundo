import type { KnockoutMatch, KnockoutPick, KnockoutRound } from "./types";

export const KNOCKOUT_SCORE_WEIGHTS: Partial<Record<KnockoutRound, number>> = {
  round_of_32: 2,
  round_of_16: 4,
  quarterfinal: 6,
  semifinal: 10,
  final: 15,
};

export type KnockoutScoreSummary = {
  totalPoints: number;
  correctPicks: number;
  possiblePoints: number;
};

function officialWinnerKey(match: KnockoutMatch) {
  return `${match.round}:${match.position}`;
}

export function scoreKnockoutBracket(
  matches: KnockoutMatch[],
  picks: KnockoutPick[],
): KnockoutScoreSummary {
  const officialWinners = new Map<string, string>();

  matches.forEach((match) => {
    if (match.winnerTeam && match.round !== "final") {
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
      }

      return summary;
    },
    {
      totalPoints: 0,
      correctPicks: 0,
      possiblePoints: 0,
    },
  );
}
