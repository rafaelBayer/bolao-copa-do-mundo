import { calculatePredictionScore } from "@/lib/scoring/calculatePredictionScore";

export type LeaderboardDataRow = {
  user_id: string;
  profile_name: string | null;
  avatar_url: string | null;
  match_id: string | null;
  round_number: number | null;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  actual_home_score: number | null;
  actual_away_score: number | null;
};

export type LeaderboardEntry = {
  position: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalPoints: number;
  exactScores: number;
  correctResults: number;
  scoredMatches: number;
  filledPredictions: number;
};

function participantName(row: LeaderboardDataRow) {
  const profileName = row.profile_name?.trim();

  return profileName || "Visitante";
}

function sortEntries(entries: LeaderboardEntry[]) {
  return entries.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
    if (b.correctResults !== a.correctResults) {
      return b.correctResults - a.correctResults;
    }
    if (b.filledPredictions !== a.filledPredictions) {
      return b.filledPredictions - a.filledPredictions;
    }

    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export function buildLeaderboard(
  rows: LeaderboardDataRow[],
  roundNumber?: number,
) {
  const entriesByUserId = new Map<string, LeaderboardEntry>();

  rows.forEach((row) => {
    if (roundNumber && row.round_number !== roundNumber) {
      return;
    }

    const entry =
      entriesByUserId.get(row.user_id) ??
      ({
        position: 0,
        userId: row.user_id,
        name: participantName(row),
        avatarUrl: row.avatar_url,
        totalPoints: 0,
        exactScores: 0,
        correctResults: 0,
        scoredMatches: 0,
        filledPredictions: 0,
      } satisfies LeaderboardEntry);

    const score = calculatePredictionScore({
      predictedHomeScore: row.predicted_home_score,
      predictedAwayScore: row.predicted_away_score,
      actualHomeScore: row.actual_home_score,
      actualAwayScore: row.actual_away_score,
    });

    const hasCompletePrediction =
      row.predicted_home_score !== null && row.predicted_away_score !== null;
    const hasResult =
      row.actual_home_score !== null && row.actual_away_score !== null;

    if (hasCompletePrediction) {
      entry.filledPredictions += 1;
    }

    if (hasCompletePrediction && hasResult) {
      entry.scoredMatches += 1;
    }

    entry.totalPoints += score.points;

    if (score.reason === "exact_score") {
      entry.exactScores += 1;
    }

    if (score.reason === "correct_result") {
      entry.correctResults += 1;
    }

    entriesByUserId.set(row.user_id, entry);
  });

  return sortEntries(Array.from(entriesByUserId.values())).map(
    (entry, index) => ({
      ...entry,
      position: index + 1,
    }),
  );
}

export function hasRealResult(
  rows: LeaderboardDataRow[],
  roundNumber?: number,
) {
  return rows.some((row) => {
    if (roundNumber && row.round_number !== roundNumber) {
      return false;
    }

    return row.actual_home_score !== null && row.actual_away_score !== null;
  });
}
