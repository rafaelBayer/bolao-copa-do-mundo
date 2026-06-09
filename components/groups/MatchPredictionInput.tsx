"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { savePrediction } from "@/lib/predictions/savePrediction";
import type { MatchWithTeams } from "@/types/match";
import type { Prediction } from "@/types/prediction";

type MatchPredictionInputProps = {
  poolId: string;
  userId: string;
  match: MatchWithTeams;
  prediction?: Prediction;
  onSaved?: (scores: SavedScores) => void;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";
type SavedScores = {
  homeScore: number | null;
  awayScore: number | null;
};

function toInputValue(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function toScore(value: string) {
  if (value === "") return null;
  return Number(value);
}

function scoresFromPrediction(prediction?: Prediction): SavedScores {
  return {
    homeScore: prediction?.homeScore ?? null,
    awayScore: prediction?.awayScore ?? null,
  };
}

function scoresAreEqual(left: SavedScores, right: SavedScores) {
  return (
    left.homeScore === right.homeScore && left.awayScore === right.awayScore
  );
}

function scoresAreEmpty(scores: SavedScores) {
  return scores.homeScore === null && scores.awayScore === null;
}

function sanitizeScore(value: string) {
  if (value === "") return "";

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) return "";
  if (numberValue < 0) return "0";
  if (numberValue > 99) return "99";

  return String(Math.trunc(numberValue));
}

export function MatchPredictionInput({
  poolId,
  userId,
  match,
  prediction,
  onSaved,
}: MatchPredictionInputProps) {
  const [homeScore, setHomeScore] = useState(toInputValue(prediction?.homeScore));
  const [awayScore, setAwayScore] = useState(toInputValue(prediction?.awayScore));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [hasExistingPrediction, setHasExistingPrediction] = useState(
    Boolean(prediction?.id),
  );
  const lastSavedRef = useRef<SavedScores>(scoresFromPrediction(prediction));
  const currentScoresRef = useRef<SavedScores>(scoresFromPrediction(prediction));

  const currentScores = useMemo(
    () => ({
      homeScore: toScore(homeScore),
      awayScore: toScore(awayScore),
    }),
    [awayScore, homeScore],
  );

  const shouldSave = useCallback((scores: SavedScores) => {
    const changed = !scoresAreEqual(scores, lastSavedRef.current);

    if (!changed) {
      return false;
    }

    if (scoresAreEmpty(scores) && !hasExistingPrediction) {
      return false;
    }

    return true;
  }, [hasExistingPrediction]);

  function handleScoreChange(side: "home" | "away", value: string) {
    const nextValue = sanitizeScore(value);
    const nextScores = {
      homeScore: side === "home" ? toScore(nextValue) : toScore(homeScore),
      awayScore: side === "away" ? toScore(nextValue) : toScore(awayScore),
    };

    currentScoresRef.current = nextScores;
    setHasUserEdited(true);

    if (!shouldSave(nextScores)) {
      setStatus("idle");
    }

    if (side === "home") {
      setHomeScore(nextValue);
    } else {
      setAwayScore(nextValue);
    }
  }

  useEffect(() => {
    currentScoresRef.current = currentScores;
  }, [currentScores]);

  useEffect(() => {
    if (!hasUserEdited || !shouldSave(currentScores)) {
      return;
    }

    const submittedScores = currentScores;

    const timeoutId = window.setTimeout(async () => {
      setStatus("saving");

      try {
        await savePrediction({
          poolId,
          userId,
          matchId: match.id,
          homeScore: submittedScores.homeScore,
          awayScore: submittedScores.awayScore,
        });

        lastSavedRef.current = submittedScores;
        onSaved?.(submittedScores);
        setHasExistingPrediction(true);

        if (scoresAreEqual(currentScoresRef.current, submittedScores)) {
          setHasUserEdited(false);
          setStatus("saved");
        } else {
          setStatus("idle");
        }
      } catch {
        setStatus("error");
      }
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [
    awayScore,
    currentScores,
    hasUserEdited,
    match.id,
    onSaved,
    poolId,
    shouldSave,
    userId,
  ]);

  const statusLabel = {
    idle: "",
    saving: "Salvando...",
    saved: "Salvo",
    error: "Erro ao salvar",
  }[status];
  const statusClass = {
    idle: "text-slate-500",
    saving: "text-amber-300 light:text-amber-600",
    saved: "text-emerald-300 light:text-emerald-700",
    error: "text-red-300 light:text-red-600",
  }[status];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-3 shadow-sm transition hover:border-slate-700 light:border-slate-200 light:bg-white light:hover:border-slate-300">
      <div className="grid grid-cols-[minmax(0,1fr)_3.75rem_1.5rem_3.75rem_minmax(0,1fr)] items-center gap-2">
        <span className="truncate text-sm font-bold text-slate-100 light:text-slate-800">
          {match.homeTeam.name}
        </span>
        <input
          type="number"
          min={0}
          max={99}
          inputMode="numeric"
          value={homeScore}
          onChange={(event) => handleScoreChange("home", event.target.value)}
          className="h-12 w-full rounded-xl border border-slate-700 bg-slate-950 text-center text-lg font-black text-slate-50 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 light:border-slate-200 light:bg-slate-50 light:text-slate-950 light:focus:border-emerald-600 light:focus:ring-emerald-600/10"
          aria-label={`Palpite de gols para ${match.homeTeam.name}`}
        />
        <span className="text-center text-sm font-black text-slate-500">x</span>
        <input
          type="number"
          min={0}
          max={99}
          inputMode="numeric"
          value={awayScore}
          onChange={(event) => handleScoreChange("away", event.target.value)}
          className="h-12 w-full rounded-xl border border-slate-700 bg-slate-950 text-center text-lg font-black text-slate-50 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 light:border-slate-200 light:bg-slate-50 light:text-slate-950 light:focus:border-emerald-600 light:focus:ring-emerald-600/10"
          aria-label={`Palpite de gols para ${match.awayTeam.name}`}
        />
        <span className="truncate text-right text-sm font-bold text-slate-100 light:text-slate-800">
          {match.awayTeam.name}
        </span>
      </div>

      <div className={`mt-2 min-h-4 text-right text-xs font-bold ${statusClass}`}>
        {statusLabel}
      </div>
    </div>
  );
}
