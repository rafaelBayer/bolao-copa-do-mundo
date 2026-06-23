"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MatchPredictionInput,
  type MatchPredictionInputHandle,
} from "./MatchPredictionInput";
import { RoundNavigator } from "./RoundNavigator";
import { isFinalMatchStatus } from "@/lib/scores/liveScoreStatus";
import type { MatchWithTeams } from "@/types/match";
import type { Prediction } from "@/types/prediction";

type GroupMatchesProps = {
  poolId: string;
  userId: string;
  matches: MatchWithTeams[];
  predictions: Prediction[];
  canViewPoolPredictions: boolean;
  focusRequest?: {
    matchId: string;
    requestId: number;
  } | null;
  onPredictionSaved: (prediction: Prediction) => void;
};

function isRoundFinished(matches: MatchWithTeams[], round: number) {
  const roundMatches = matches.filter((match) => match.roundNumber === round);

  return (
    roundMatches.length >= 2 &&
    roundMatches.every((match) => isFinalMatchStatus(match.statusShort))
  );
}

function defaultRoundIndex(matches: MatchWithTeams[], rounds: number[]) {
  if (rounds.length === 0) {
    return 0;
  }

  const firstOpenRound = rounds.find(
    (round) => !isRoundFinished(matches, round),
  );

  if (firstOpenRound === undefined) {
    return rounds.length - 1;
  }

  return Math.max(0, rounds.indexOf(firstOpenRound));
}

export function GroupMatches({
  poolId,
  userId,
  matches,
  predictions,
  canViewPoolPredictions,
  focusRequest = null,
  onPredictionSaved,
}: GroupMatchesProps) {
  const inputRefs = useRef(new Map<string, MatchPredictionInputHandle>());
  const userSelectedRoundRef = useRef(false);
  const lastFocusedRoundRequestIdRef = useRef<number | null>(null);
  const lastScrolledRequestIdRef = useRef<number | null>(null);
  const rounds = useMemo(
    () =>
      Array.from(new Set(matches.map((match) => match.roundNumber))).sort(
        (left, right) => left - right,
      ),
    [matches],
  );
  const [roundIndex, setRoundIndex] = useState(() =>
    defaultRoundIndex(matches, rounds),
  );
  const [isFlushing, setIsFlushing] = useState(false);
  const currentRound = rounds[roundIndex] ?? 1;
  const currentMatches = useMemo(
    () => matches.filter((match) => match.roundNumber === currentRound),
    [currentRound, matches],
  );

  function findPrediction(matchId: string) {
    return predictions.find((prediction) => prediction.matchId === matchId);
  }

  async function flushPendingPredictionSaves() {
    const currentInputs = currentMatches
      .slice(0, 2)
      .map((match) => inputRefs.current.get(match.id))
      .filter((input): input is MatchPredictionInputHandle => Boolean(input));

    if (currentInputs.length === 0) {
      return;
    }

    setIsFlushing(true);

    try {
      await Promise.all(
        currentInputs.map((input) => input.flushPendingSave()),
      );
    } finally {
      setIsFlushing(false);
    }
  }

  async function goToPreviousRound() {
    if (currentRound <= (rounds[0] ?? 1) || isFlushing) {
      return;
    }

    await flushPendingPredictionSaves();
    userSelectedRoundRef.current = true;
    setRoundIndex((value) => Math.max(0, value - 1));
  }

  async function goToNextRound() {
    if (
      currentRound >= (rounds[rounds.length - 1] ?? 1) ||
      isFlushing
    ) {
      return;
    }

    await flushPendingPredictionSaves();
    userSelectedRoundRef.current = true;
    setRoundIndex((value) => Math.min(rounds.length - 1, value + 1));
  }

  useEffect(() => {
    if (userSelectedRoundRef.current) {
      return;
    }

    setRoundIndex(defaultRoundIndex(matches, rounds));
  }, [matches, rounds]);

  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    if (lastFocusedRoundRequestIdRef.current === focusRequest.requestId) {
      return;
    }

    const targetMatch = matches.find(
      (match) => match.id === focusRequest.matchId,
    );

    if (!targetMatch) {
      return;
    }

    lastFocusedRoundRequestIdRef.current = focusRequest.requestId;

    const targetRoundIndex = rounds.indexOf(targetMatch.roundNumber);

    if (targetRoundIndex === -1 || targetRoundIndex === roundIndex) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      userSelectedRoundRef.current = true;
      setRoundIndex(targetRoundIndex);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [focusRequest, matches, roundIndex, rounds]);

  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    if (lastScrolledRequestIdRef.current === focusRequest.requestId) {
      return;
    }

    const targetMatch = currentMatches.find(
      (match) => match.id === focusRequest.matchId,
    );

    if (!targetMatch) {
      return;
    }

    lastScrolledRequestIdRef.current = focusRequest.requestId;

    const animationFrameId = window.requestAnimationFrame(() => {
      document
        .getElementById(`match-card-${targetMatch.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [currentMatches, focusRequest]);

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
        isBusy={isFlushing}
        onPrevious={() => void goToPreviousRound()}
        onNext={() => void goToNextRound()}
      />

      {isFlushing ? (
        <p className="mt-3 text-center text-xs font-bold text-amber-300 light:text-amber-700">
          Salvando palpites...
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {currentMatches.slice(0, 2).map((match) => {
          const prediction = findPrediction(match.id);

          return (
            <MatchPredictionInput
              key={match.id}
              ref={(input) => {
                if (input) {
                  inputRefs.current.set(match.id, input);
                } else {
                  inputRefs.current.delete(match.id);
                }
              }}
              poolId={poolId}
              userId={userId}
              match={match}
              prediction={prediction}
              isHighlighted={focusRequest?.matchId === match.id}
              canViewPoolPredictions={canViewPoolPredictions}
              onSaved={onPredictionSaved}
            />
          );
        })}
      </div>
    </div>
  );
}
