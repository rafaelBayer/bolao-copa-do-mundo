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
  const [localPredictions, setLocalPredictions] = useState(
    () =>
      new Map(
        predictions.map((prediction) => [prediction.matchId, prediction]),
      ),
  );
  const [roundIndex, setRoundIndex] = useState(0);
  const currentRound = rounds[roundIndex] ?? 1;
  const currentMatches = matches.filter(
    (match) => match.roundNumber === currentRound,
  );

  function findPrediction(matchId: string) {
    return localPredictions.get(matchId);
  }

  function handlePredictionSaved(
    matchId: string,
    scores: Pick<Prediction, "homeScore" | "awayScore">,
  ) {
    setLocalPredictions((currentPredictions) => {
      const nextPredictions = new Map(currentPredictions);
      const existingPrediction = nextPredictions.get(matchId);
      const now = new Date().toISOString();

      nextPredictions.set(matchId, {
        id: existingPrediction?.id ?? `local-${matchId}`,
        poolId,
        userId,
        matchId,
        homeScore: scores.homeScore,
        awayScore: scores.awayScore,
        createdAt: existingPrediction?.createdAt ?? now,
        updatedAt: now,
      });

      return nextPredictions;
    });
  }

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/30 p-4 light:border-slate-200 light:bg-slate-50/70">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
          Jogos
        </p>
        <h3 className="mt-1 text-lg font-black text-slate-50 light:text-slate-950">
          Palpites da rodada
        </h3>
      </div>

      <RoundNavigator
        currentRound={currentRound}
        minRound={rounds[0] ?? 1}
        maxRound={rounds[rounds.length - 1] ?? 1}
        onPrevious={() => setRoundIndex((value) => Math.max(0, value - 1))}
        onNext={() =>
          setRoundIndex((value) => Math.min(rounds.length - 1, value + 1))
        }
      />

      <div className="mt-4 space-y-3">
        {currentMatches.slice(0, 2).map((match) => {
          const prediction = findPrediction(match.id);

          return (
            <MatchPredictionInput
              key={match.id}
              poolId={poolId}
              userId={userId}
              match={match}
              prediction={prediction}
              onSaved={(scores) => handlePredictionSaved(match.id, scores)}
            />
          );
        })}
      </div>
    </div>
  );
}
