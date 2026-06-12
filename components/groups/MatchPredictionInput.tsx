"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { savePrediction } from "@/lib/predictions/savePrediction";
import { getMatchDisplayScore } from "@/lib/groups/getMatchDisplayScore";
import {
  isFinalMatchStatus,
  isHalftimeStatus,
  isLiveMatchStatus,
} from "@/lib/scores/liveScoreStatus";
import { TeamFlag } from "./TeamFlag";
import type { MatchWithTeams } from "@/types/match";
import type { Prediction } from "@/types/prediction";

type MatchPredictionInputProps = {
  poolId: string;
  userId: string;
  match: MatchWithTeams;
  prediction?: Prediction;
  onSaved?: (prediction: Prediction) => void;
};

export type MatchPredictionInputHandle = {
  flushPendingSave: () => Promise<void>;
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

function formatKickoff(kickoffAt: string | null) {
  if (!kickoffAt) {
    return "Horario a definir";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(kickoffAt));
}

function matchStatusLabel(match: MatchWithTeams) {
  const displayScore = getMatchDisplayScore(match);
  const scoreLabel =
    displayScore.homeScore !== null && displayScore.awayScore !== null
      ? `${match.homeTeam.name} ${displayScore.homeScore} x ${displayScore.awayScore} ${match.awayTeam.name}`
      : null;
  const hasStartedByKickoff = Boolean(
    match.kickoffAt && new Date(match.kickoffAt) <= new Date(),
  );

  if (isFinalMatchStatus(match.statusShort)) {
    return {
      tone: "default" as const,
      title: "Finalizado",
      detail: scoreLabel ?? "Resultado final indisponivel",
    };
  }

  if (isHalftimeStatus(match.statusShort)) {
    return {
      tone: "amber" as const,
      title: "Intervalo",
      detail: scoreLabel ?? "Placar ao vivo indisponivel",
    };
  }

  if (isLiveMatchStatus(match.statusShort)) {
    return {
      tone: "live" as const,
      title: "AO VIVO",
      detail: `${scoreLabel ?? "Placar ao vivo indisponivel"}${
        match.elapsed !== null ? ` · ${match.elapsed}'` : ""
      }`,
    };
  }

  if (hasStartedByKickoff) {
    return {
      tone: "live" as const,
      title: "AO VIVO",
      detail: scoreLabel ?? "Aguardando placar da API",
    };
  }

  return {
    tone: "default" as const,
    title: match.statusLong ?? "Nao iniciado",
    detail: formatKickoff(match.kickoffAt),
  };
}

export const MatchPredictionInput = forwardRef<
  MatchPredictionInputHandle,
  MatchPredictionInputProps
>(function MatchPredictionInput(
  { poolId, userId, match, prediction, onSaved },
  ref,
) {
  const liveStatus = matchStatusLabel(match);
  const isLocked = Boolean(
    match.kickoffAt && new Date(match.kickoffAt) <= new Date(),
  );
  const [homeScore, setHomeScore] = useState(toInputValue(prediction?.homeScore));
  const [awayScore, setAwayScore] = useState(toInputValue(prediction?.awayScore));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [, setHasExistingPrediction] = useState(Boolean(prediction?.id));
  const lastSavedRef = useRef<SavedScores>(scoresFromPrediction(prediction));
  const currentScoresRef = useRef<SavedScores>(scoresFromPrediction(prediction));
  const hasUserEditedRef = useRef(false);
  const hasExistingPredictionRef = useRef(Boolean(prediction?.id));
  const timeoutRef = useRef<number | null>(null);

  const currentScores = useMemo(
    () => ({
      homeScore: toScore(homeScore),
      awayScore: toScore(awayScore),
    }),
    [awayScore, homeScore],
  );

  const shouldSave = useCallback((scores: SavedScores) => {
    if (isLocked) {
      return false;
    }

    const changed = !scoresAreEqual(scores, lastSavedRef.current);

    if (!changed) {
      return false;
    }

    if (scoresAreEmpty(scores) && !hasExistingPredictionRef.current) {
      return false;
    }

    return true;
  }, [isLocked]);

  const saveScores = useCallback(
    async (submittedScores: SavedScores) => {
      if (!shouldSave(submittedScores)) {
        return;
      }

      setStatus("saving");

      try {
        const savedPrediction = await savePrediction({
          poolId,
          userId,
          matchId: match.id,
          homeScore: submittedScores.homeScore,
          awayScore: submittedScores.awayScore,
        });

        lastSavedRef.current = submittedScores;
        onSaved?.(savedPrediction);
        hasExistingPredictionRef.current = true;
        setHasExistingPrediction(true);

        if (scoresAreEqual(currentScoresRef.current, submittedScores)) {
          hasUserEditedRef.current = false;
          setHasUserEdited(false);
          setStatus("saved");
        } else {
          setStatus("idle");
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro ao salvar";
        const isLockedError = message.includes(
          "Prediction locked because match already started",
        );

        if (isLockedError) {
          lastSavedRef.current = scoresFromPrediction(prediction);
          hasUserEditedRef.current = false;
          setHasUserEdited(false);
        }

        setStatus("error");
      }
    },
    [match.id, onSaved, poolId, prediction, shouldSave, userId],
  );

  function handleScoreChange(side: "home" | "away", value: string) {
    if (isLocked) {
      setStatus("error");
      return;
    }

    const nextValue = sanitizeScore(value);
    const nextScores = {
      homeScore: side === "home" ? toScore(nextValue) : toScore(homeScore),
      awayScore: side === "away" ? toScore(nextValue) : toScore(awayScore),
    };

    currentScoresRef.current = nextScores;
    hasUserEditedRef.current = true;
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

  useImperativeHandle(
    ref,
    () => ({
      async flushPendingSave() {
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        const latestScores = currentScoresRef.current;

        if (!hasUserEditedRef.current || !shouldSave(latestScores)) {
          return;
        }

        await saveScores(latestScores);
      },
    }),
    [saveScores, shouldSave],
  );

  useEffect(() => {
    if (isLocked || !hasUserEdited || !shouldSave(currentScores)) {
      return;
    }

    const submittedScores = currentScores;

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      void saveScores(submittedScores);
    }, 1200);

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [
    awayScore,
    currentScores,
    hasUserEdited,
    isLocked,
    saveScores,
    shouldSave,
  ]);

  const statusLabel = isLocked
    ? "Palpite bloqueado"
    : {
        idle: "",
        saving: "Salvando...",
        saved: "Salvo",
        error: "Erro ao salvar",
      }[status];
  const statusClass = isLocked
    ? "text-amber-300 light:text-amber-700"
    : {
        idle: "text-slate-500",
        saving: "text-amber-300 light:text-amber-600",
        saved: "text-emerald-300 light:text-emerald-700",
        error: "text-red-300 light:text-red-600",
      }[status];

  return (
    <div
      className={`rounded-2xl border border-slate-800 bg-slate-900/75 p-3.5 shadow-sm transition hover:border-slate-700 light:border-slate-200 light:bg-white light:hover:border-slate-300 ${
        isLocked ? "opacity-75" : ""
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-wide ${
            liveStatus.tone === "live"
              ? "bg-red-500 text-white shadow-sm shadow-red-950/30"
              : liveStatus.tone === "amber"
                ? "bg-amber-400/15 text-amber-200 light:bg-amber-100 light:text-amber-800"
                : "bg-slate-800 text-slate-300 light:bg-slate-100 light:text-slate-600"
          }`}
        >
          {liveStatus.title}
        </span>
        <span className="text-xs font-bold text-slate-400 light:text-slate-500">
          {liveStatus.detail}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
        <span className="flex min-w-0 items-center justify-center gap-2 whitespace-normal break-words text-center text-sm font-bold leading-snug text-slate-100 light:text-slate-800 sm:justify-start sm:text-left">
          <TeamFlag
            code={match.homeTeam.code}
            name={match.homeTeam.name}
            flagUrl={match.homeTeam.flagUrl}
          />
          <span className="min-w-0">{match.homeTeam.name}</span>
        </span>
        <div className="flex items-center justify-center gap-2">
          <input
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            value={homeScore}
            disabled={isLocked}
            onChange={(event) => handleScoreChange("home", event.target.value)}
            className="h-12 w-16 rounded-xl border border-slate-700 bg-slate-950 text-center text-lg font-black text-slate-50 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 light:border-slate-200 light:bg-slate-50 light:text-slate-950 light:disabled:bg-slate-100 light:disabled:text-slate-400 light:focus:border-emerald-600 light:focus:ring-emerald-600/10"
            aria-label={`Palpite de gols para ${match.homeTeam.name}`}
          />
          <span className="w-5 text-center text-sm font-black text-slate-400 light:text-slate-500">
            x
          </span>
          <input
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            value={awayScore}
            disabled={isLocked}
            onChange={(event) => handleScoreChange("away", event.target.value)}
            className="h-12 w-16 rounded-xl border border-slate-700 bg-slate-950 text-center text-lg font-black text-slate-50 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 light:border-slate-200 light:bg-slate-50 light:text-slate-950 light:disabled:bg-slate-100 light:disabled:text-slate-400 light:focus:border-emerald-600 light:focus:ring-emerald-600/10"
            aria-label={`Palpite de gols para ${match.awayTeam.name}`}
          />
        </div>
        <span className="flex min-w-0 items-center justify-center gap-2 whitespace-normal break-words text-center text-sm font-bold leading-snug text-slate-100 light:text-slate-800 sm:justify-end sm:text-right">
          <span className="min-w-0">{match.awayTeam.name}</span>
          <TeamFlag
            code={match.awayTeam.code}
            name={match.awayTeam.name}
            flagUrl={match.awayTeam.flagUrl}
          />
        </span>
      </div>

      <div className={`mt-2 min-h-4 text-center text-xs font-bold ${statusClass}`}>
        {statusLabel}
      </div>
    </div>
  );
});
