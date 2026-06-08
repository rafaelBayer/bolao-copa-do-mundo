"use client";

import { useMemo, useState } from "react";
import { MatchPredictionInput } from "./MatchPredictionInput";
import { RoundNavigator } from "./RoundNavigator";
import type { MatchWithTeams } from "@/types/match";
import type { Prediction } from "@/types/prediction";

type GroupMatchesProps = {
  poolId: string;
  userId: string;
  matches: MatchWithTeams[];
  predictions: Prediction[];
};

export function GroupMatches({
  poolId,
  userId,
  matches,
  predictions,
}: GroupMatchesProps) {
  const rounds = useMemo(
    () => Array.from(new Set(matches.map((match) => match.roundNumber))).sort(),
    [matches],
  );
  const [roundIndex, setRoundIndex] = useState(0);
  const currentRound = rounds[roundIndex] ?? 1;
  const currentMatches = matches.filter(
    (match) => match.roundNumber === currentRound,
  );

  function findPrediction(matchId: string) {
    return predictions.find((prediction) => prediction.matchId === matchId);
  }

  return (
    <div className="space-y-4">
      <RoundNavigator
        currentRound={currentRound}
        minRound={rounds[0] ?? 1}
        maxRound={rounds[rounds.length - 1] ?? 1}
        onPrevious={() => setRoundIndex((value) => Math.max(0, value - 1))}
        onNext={() =>
          setRoundIndex((value) => Math.min(rounds.length - 1, value + 1))
        }
      />

      <div className="space-y-3">
        {currentMatches.slice(0, 2).map((match) => (
          <MatchPredictionInput
            key={match.id}
            poolId={poolId}
            userId={userId}
            match={match}
            prediction={findPrediction(match.id)}
          />
        ))}
      </div>
    </div>
  );
}
