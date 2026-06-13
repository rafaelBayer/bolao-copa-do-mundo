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
import { ChevronDown, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getMatchDisplayScore } from "@/lib/groups/getMatchDisplayScore";
import { savePrediction } from "@/lib/predictions/savePrediction";
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
type CrowdPrediction = {
  userId: string;
  participantName: string;
  participantAvatarUrl: string | null;
  isCurrentUser: boolean;
  homeScore: number;
  awayScore: number;
  updatedAt: string;
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

function scoreLabelFromMatch(match: MatchWithTeams, fallback = "- x -") {
  const displayScore = getMatchDisplayScore(match);

  if (displayScore.homeScore === null || displayScore.awayScore === null) {
    return fallback;
  }

  return `${displayScore.homeScore} x ${displayScore.awayScore}`;
}

function currentMatchScores(match: MatchWithTeams): SavedScores {
  const displayScore = getMatchDisplayScore(match);

  return {
    homeScore: displayScore.homeScore,
    awayScore: displayScore.awayScore,
  };
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

function isPredictionLocked(kickoffAt: string | null) {
  if (!kickoffAt) {
    return false;
  }

  return Date.now() >= new Date(kickoffAt).getTime() - 60 * 60 * 1000;
}

function matchStatusLabel(match: MatchWithTeams) {
  const scoreLabel = scoreLabelFromMatch(match);
  const hasStartedByKickoff = Boolean(
    match.kickoffAt && new Date(match.kickoffAt) <= new Date(),
  );

  if (isFinalMatchStatus(match.statusShort)) {
    return {
      tone: "default" as const,
      title: "Encerrado",
      detail: `Resultado: ${scoreLabel}`,
    };
  }

  if (isHalftimeStatus(match.statusShort)) {
    return {
      tone: "amber" as const,
      title: "Intervalo",
      detail: scoreLabel,
    };
  }

  if (isLiveMatchStatus(match.statusShort)) {
    return {
      tone: "live" as const,
      title: "Ao vivo",
      detail: scoreLabel,
    };
  }

  if (hasStartedByKickoff) {
    return {
      tone: "live" as const,
      title: "Ao vivo",
      detail: scoreLabelFromMatch(match, "0 x 0"),
    };
  }

  return {
    tone: "default" as const,
    title: "Em breve",
    detail: formatKickoff(match.kickoffAt),
  };
}

function mapCrowdPrediction(row: Record<string, unknown>): CrowdPrediction {
  return {
    userId: String(row.user_id),
    participantName:
      typeof row.participant_name === "string"
        ? row.participant_name
        : "Participante",
    participantAvatarUrl:
      typeof row.participant_avatar_url === "string"
        ? row.participant_avatar_url
        : null,
    isCurrentUser: row.is_current_user === true,
    homeScore: typeof row.home_score === "number" ? row.home_score : 0,
    awayScore: typeof row.away_score === "number" ? row.away_score : 0,
    updatedAt: String(row.updated_at),
  };
}

function scoreOutcome(homeScore: number, awayScore: number) {
  if (homeScore > awayScore) return "home";
  if (homeScore < awayScore) return "away";
  return "draw";
}

function pointsForPrediction(
  prediction: CrowdPrediction,
  match: MatchWithTeams,
) {
  const shouldScore =
    isFinalMatchStatus(match.statusShort) ||
    isLiveMatchStatus(match.statusShort) ||
    isHalftimeStatus(match.statusShort);

  if (!shouldScore) {
    return null;
  }

  const matchScores = isFinalMatchStatus(match.statusShort)
    ? {
        homeScore: match.homeScore,
        awayScore: match.awayScore,
      }
    : currentMatchScores(match);

  if (matchScores.homeScore === null || matchScores.awayScore === null) {
    return null;
  }

  if (
    prediction.homeScore === matchScores.homeScore &&
    prediction.awayScore === matchScores.awayScore
  ) {
    return 3;
  }

  return scoreOutcome(prediction.homeScore, prediction.awayScore) ===
    scoreOutcome(matchScores.homeScore, matchScores.awayScore)
    ? 1
    : 0;
}

function sortedCrowdPredictions(
  predictions: CrowdPrediction[],
  match: MatchWithTeams,
) {
  return [...predictions].sort((left, right) => {
    const leftPoints = pointsForPrediction(left, match);
    const rightPoints = pointsForPrediction(right, match);
    const scoreDifference = (rightPoints ?? -1) - (leftPoints ?? -1);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    return left.participantName.localeCompare(right.participantName, "pt-BR");
  });
}

function predictionResultClass(points: number | null) {
  if (points === 3) {
    return "border-emerald-400/45 bg-emerald-400/10 text-emerald-100 light:border-emerald-300 light:bg-emerald-50 light:text-emerald-800";
  }

  if (points === 1) {
    return "border-amber-400/45 bg-amber-400/10 text-amber-100 light:border-amber-300 light:bg-amber-50 light:text-amber-900";
  }

  if (points === 0) {
    return "border-red-400/45 bg-red-500/10 text-red-100 light:border-red-300 light:bg-red-50 light:text-red-800";
  }

  return "border-slate-700 bg-slate-950/40 text-slate-100 light:border-slate-200 light:bg-white light:text-slate-800";
}

function pointsBadgeClass(points: number | null) {
  if (points === 3) {
    return "bg-emerald-400 text-slate-950 light:bg-emerald-600 light:text-white";
  }

  if (points === 1) {
    return "bg-amber-400 text-slate-950 light:bg-amber-500 light:text-slate-950";
  }

  if (points === 0) {
    return "bg-red-500 text-white light:bg-red-600";
  }

  return "bg-slate-800 text-slate-200 light:bg-slate-200 light:text-slate-700";
}

export const MatchPredictionInput = forwardRef<
  MatchPredictionInputHandle,
  MatchPredictionInputProps
>(function MatchPredictionInput(
  { poolId, userId, match, prediction, onSaved },
  ref,
) {
  const liveStatus = matchStatusLabel(match);
  const isLocked = isPredictionLocked(match.kickoffAt);
  const isLive = isLiveMatchStatus(match.statusShort);
  const isHalftime = isHalftimeStatus(match.statusShort);
  const hasProvisionalCrowdPoints = isLive || isHalftime;
  const [homeScore, setHomeScore] = useState(toInputValue(prediction?.homeScore));
  const [awayScore, setAwayScore] = useState(toInputValue(prediction?.awayScore));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [isCrowdOpen, setIsCrowdOpen] = useState(false);
  const [crowdPredictions, setCrowdPredictions] = useState<CrowdPrediction[]>([]);
  const [crowdStatus, setCrowdStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [goalFlash, setGoalFlash] = useState(false);
  const [, setHasExistingPrediction] = useState(Boolean(prediction?.id));
  const lastSavedRef = useRef<SavedScores>(scoresFromPrediction(prediction));
  const currentScoresRef = useRef<SavedScores>(scoresFromPrediction(prediction));
  const previousLiveScoreRef = useRef<SavedScores>(currentMatchScores(match));
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
  const orderedCrowdPredictions = useMemo(
    () => sortedCrowdPredictions(crowdPredictions, match),
    [crowdPredictions, match],
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
          "Prediction locked because match starts within one hour",
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

  const loadCrowdPredictions = useCallback(async () => {
    if (!isLocked || crowdStatus === "loading" || crowdStatus === "loaded") {
      return;
    }

    setCrowdStatus("loading");

    const supabase = createClient();
    const { data, error } = await supabase.rpc(
      "get_match_predictions_after_lock",
      {
        target_pool_id: poolId,
        target_match_id: match.id,
      },
    );

    if (error) {
      setCrowdStatus("error");
      return;
    }

    setCrowdPredictions(
      ((data ?? []) as Record<string, unknown>[]).map(mapCrowdPrediction),
    );
    setCrowdStatus("loaded");
  }, [crowdStatus, isLocked, match.id, poolId]);

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

  function toggleCrowdPredictions() {
    setIsCrowdOpen((current) => !current);
    void loadCrowdPredictions();
  }

  useEffect(() => {
    currentScoresRef.current = currentScores;
  }, [currentScores]);

  useEffect(() => {
    const previous = previousLiveScoreRef.current;
    const current = currentMatchScores(match);
    const homeGoal =
      typeof previous.homeScore === "number" &&
      typeof current.homeScore === "number" &&
      current.homeScore > previous.homeScore;
    const awayGoal =
      typeof previous.awayScore === "number" &&
      typeof current.awayScore === "number" &&
      current.awayScore > previous.awayScore;

    if (homeGoal || awayGoal) {
      setGoalFlash(true);
      const timeoutId = window.setTimeout(() => setGoalFlash(false), 4500);
      previousLiveScoreRef.current = current;

      return () => window.clearTimeout(timeoutId);
    }

    previousLiveScoreRef.current = current;
  }, [match]);

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
    ? ""
    : {
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
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/75 p-3.5 shadow-sm transition hover:border-slate-700 light:border-slate-200 light:bg-white light:hover:border-slate-300 ${
        goalFlash
          ? "border-emerald-300 bg-emerald-400/10 shadow-lg shadow-emerald-950/30 light:border-emerald-300 light:bg-emerald-50"
          : ""
      }`}
    >
      {goalFlash ? (
        <div className="absolute right-3 top-3 z-10 rounded-full bg-emerald-400 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-emerald-950/30 animate-pulse">
          GOL!
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-wide ${
            liveStatus.tone === "live"
              ? "bg-red-500 text-white shadow-sm shadow-red-950/30"
              : liveStatus.tone === "amber"
                ? "bg-amber-400/15 text-amber-200 light:bg-amber-100 light:text-amber-800"
                : "bg-slate-800 text-slate-300 light:bg-slate-100 light:text-slate-600"
          }`}
        >
          {isLive ? (
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          ) : null}
          {liveStatus.title}
        </span>
        <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 light:text-slate-500">
          <span>{liveStatus.detail}</span>
          {isLive && match.elapsed !== null ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-red-200 light:bg-red-50 light:text-red-700">
              <span className="h-1.5 w-1.5 rounded-full bg-red-300 light:bg-red-600 animate-pulse" />
              {match.elapsed}&apos;
            </span>
          ) : null}
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

      {isLocked ? (
        <div className="mt-3 border-t border-slate-800 pt-3 light:border-slate-200">
          <button
            type="button"
            onClick={toggleCrowdPredictions}
            className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-2 text-left text-sm font-black text-slate-200 transition hover:border-emerald-400/40 hover:text-emerald-200 light:border-slate-200 light:bg-slate-50 light:text-slate-700 light:hover:border-emerald-300 light:hover:text-emerald-700"
          >
            <span className="inline-flex items-center gap-2">
              <Users size={16} aria-hidden="true" />
              Ver palpites da galera
            </span>
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={`transition ${isCrowdOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isCrowdOpen ? (
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/35 p-3 light:border-slate-200 light:bg-white">
              {crowdStatus === "loading" ? (
                <p className="text-sm font-bold text-slate-400 light:text-slate-500">
                  Carregando palpites...
                </p>
              ) : null}

              {crowdStatus === "error" ? (
                <p className="text-sm font-bold text-red-300 light:text-red-600">
                  Nao foi possivel carregar agora.
                </p>
              ) : null}

              {crowdStatus === "loaded" && crowdPredictions.length === 0 ? (
                <p className="text-sm font-bold text-slate-400 light:text-slate-500">
                  Ninguem palpitou neste jogo.
                </p>
              ) : null}

              {crowdStatus === "loaded" && crowdPredictions.length > 0 ? (
                <div className="space-y-2">
                  {hasProvisionalCrowdPoints ? (
                    <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200 light:bg-amber-50 light:text-amber-800">
                      Pontuacao parcial, pode mudar ate o fim do jogo.
                    </p>
                  ) : null}

                  {orderedCrowdPredictions.map((item) => {
                    const points = pointsForPrediction(item, match);

                    return (
                      <div
                        key={item.userId}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/65 px-3 py-2 light:border-slate-200 light:bg-slate-50"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-xs font-black text-slate-200 light:bg-slate-200 light:text-slate-700">
                            {item.participantAvatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.participantAvatarUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              item.participantName.charAt(0).toUpperCase()
                            )}
                          </span>
                          <span className="truncate text-sm font-bold text-slate-100 light:text-slate-800">
                            {item.participantName}
                            {item.isCurrentUser ? " (voce)" : ""}
                          </span>
                        </div>
                        <span className="flex shrink-0 items-center gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-sm font-black ${predictionResultClass(points)}`}
                          >
                            {item.homeScore} x {item.awayScore}
                          </span>
                          {points !== null ? (
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-black ${pointsBadgeClass(points)}`}
                            >
                              +{points}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
