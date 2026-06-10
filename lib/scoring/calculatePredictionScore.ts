export type MatchOutcome = "home" | "away" | "draw";

export type ScoreInput = {
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
};

export type ScoreResult = {
  points: number;
  exactScore: boolean;
  correctResult: boolean;
  reason:
    | "exact_score"
    | "correct_result"
    | "wrong_result"
    | "incomplete_prediction"
    | "missing_result";
};

export function getMatchOutcome(
  homeScore: number,
  awayScore: number,
): MatchOutcome {
  if (homeScore > awayScore) {
    return "home";
  }

  if (awayScore > homeScore) {
    return "away";
  }

  return "draw";
}

export function calculatePredictionScore({
  predictedHomeScore,
  predictedAwayScore,
  actualHomeScore,
  actualAwayScore,
}: ScoreInput): ScoreResult {
  if (actualHomeScore === null || actualAwayScore === null) {
    return {
      points: 0,
      exactScore: false,
      correctResult: false,
      reason: "missing_result",
    };
  }

  if (predictedHomeScore === null || predictedAwayScore === null) {
    return {
      points: 0,
      exactScore: false,
      correctResult: false,
      reason: "incomplete_prediction",
    };
  }

  if (
    predictedHomeScore === actualHomeScore &&
    predictedAwayScore === actualAwayScore
  ) {
    return {
      points: 3,
      exactScore: true,
      correctResult: true,
      reason: "exact_score",
    };
  }

  const predictedOutcome = getMatchOutcome(
    predictedHomeScore,
    predictedAwayScore,
  );
  const actualOutcome = getMatchOutcome(actualHomeScore, actualAwayScore);

  if (predictedOutcome === actualOutcome) {
    return {
      points: 1,
      exactScore: false,
      correctResult: true,
      reason: "correct_result",
    };
  }

  return {
    points: 0,
    exactScore: false,
    correctResult: false,
    reason: "wrong_result",
  };
}
