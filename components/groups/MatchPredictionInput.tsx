"use client";

import { useEffect, useRef, useState } from "react";
import { savePrediction } from "@/lib/predictions/savePrediction";
import type { MatchWithTeams } from "@/types/match";
import type { Prediction } from "@/types/prediction";

type MatchPredictionInputProps = {
  poolId: string;
  userId: string;
  match: MatchWithTeams;
  prediction?: Prediction;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

function toInputValue(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function toScore(value: string) {
  if (value === "") return null;
  return Number(value);
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
}: MatchPredictionInputProps) {
  const [homeScore, setHomeScore] = useState(toInputValue(prediction?.homeScore));
  const [awayScore, setAwayScore] = useState(toInputValue(prediction?.awayScore));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setStatus("saving");

      try {
        await savePrediction({
          poolId,
          userId,
          matchId: match.id,
          homeScore: toScore(homeScore),
          awayScore: toScore(awayScore),
        });
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [awayScore, homeScore, match.id, poolId, userId]);

  const statusLabel = {
    idle: "",
    saving: "Salvando...",
    saved: "Salvo",
    error: "Erro ao salvar",
  }[status];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-[1fr_4rem] items-center gap-3">
        <span className="truncate text-sm font-medium text-slate-800">
          {match.homeTeam.name}
        </span>
        <input
          type="number"
          min={0}
          max={99}
          inputMode="numeric"
          value={homeScore}
          onChange={(event) => setHomeScore(sanitizeScore(event.target.value))}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-center text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          aria-label={`Palpite de gols para ${match.homeTeam.name}`}
        />
      </div>

      <div className="mt-2 grid grid-cols-[1fr_4rem] items-center gap-3">
        <span className="truncate text-sm font-medium text-slate-800">
          {match.awayTeam.name}
        </span>
        <input
          type="number"
          min={0}
          max={99}
          inputMode="numeric"
          value={awayScore}
          onChange={(event) => setAwayScore(sanitizeScore(event.target.value))}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-center text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          aria-label={`Palpite de gols para ${match.awayTeam.name}`}
        />
      </div>

      <div className="mt-2 min-h-4 text-right text-xs text-slate-500">
        {statusLabel}
      </div>
    </div>
  );
}
