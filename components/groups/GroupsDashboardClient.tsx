"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ListChecks } from "lucide-react";
import { GroupSection } from "@/components/groups/GroupSection";
import {
  PoolContextPanel,
  type PoolSummary,
} from "@/components/pools/PoolContextPanel";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { TeamFlag } from "@/components/groups/TeamFlag";
import type { GroupWithTeamsAndMatches } from "@/types/group";
import type { MatchGoal, MatchWithTeams } from "@/types/match";
import type { Prediction } from "@/types/prediction";

type GroupsDashboardClientProps = {
  groups: GroupWithTeamsAndMatches[];
  initialPredictions: Prediction[];
  poolId: string;
  poolName: string;
  pools: PoolSummary[];
  canViewPoolPredictions: boolean;
  userId: string;
};

function isFilledPrediction(prediction: Prediction) {
  return prediction.homeScore !== null && prediction.awayScore !== null;
}

function isInLiveRefreshWindow(match: MatchWithTeams, now: Date) {
  if (!match.kickoffAt) {
    return false;
  }

  const kickoff = new Date(match.kickoffAt);
  const windowStart = new Date(kickoff.getTime() - 5 * 60 * 1000);
  const windowEnd = new Date(kickoff.getTime() + 240 * 60 * 1000);

  return now >= windowStart && now <= windowEnd;
}

function isFinishedMatch(match: MatchWithTeams) {
  return ["FT", "AET", "PEN"].includes(match.statusShort ?? "");
}

function isLiveOrHalftimeMatch(match: MatchWithTeams) {
  return ["1H", "2H", "LIVE", "ET", "BT", "P", "HT"].includes(
    match.statusShort ?? "",
  );
}

function mapGoal(row: Record<string, unknown>): MatchGoal {
  return {
    id: String(row.id),
    minute: typeof row.minute === "number" ? row.minute : null,
    teamName: typeof row.team_name === "string" ? row.team_name : null,
    playerName: typeof row.player_name === "string" ? row.player_name : null,
    goalType: typeof row.goal_type === "string" ? row.goal_type : null,
    isPenalty: row.is_penalty === true,
    isOwnGoal: row.is_own_goal === true,
  };
}

function formatMatchTime(kickoffAt: string | null) {
  if (!kickoffAt) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(kickoffAt));
}

function brazilDayKey(value: Date | string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function matchDisplayScore(match: MatchWithTeams) {
  const isFinal = isFinishedMatch(match);
  const homeScore =
    isFinal ? match.homeScore ?? match.homeScoreLive : match.homeScoreLive;
  const awayScore =
    isFinal ? match.awayScore ?? match.awayScoreLive : match.awayScoreLive;

  if (
    homeScore === null ||
    homeScore === undefined ||
    awayScore === null ||
    awayScore === undefined
  ) {
    return "- x -";
  }

  return `${homeScore} x ${awayScore}`;
}

function TodayMatchRow({
  match,
  onSelect,
}: {
  match: MatchWithTeams;
  onSelect: (match: MatchWithTeams) => void;
}) {
  const isLive = isLiveOrHalftimeMatch(match) && match.statusShort !== "HT";
  const isHalftime = match.statusShort === "HT";
  const statusLabel = isFinishedMatch(match)
    ? "Encerrado"
    : isHalftime
      ? "Intervalo"
      : match.elapsed !== null
        ? `Ao vivo • ${match.elapsed}'`
        : "Ao vivo";

  return (
    <button
      type="button"
      onClick={() => onSelect(match)}
      className="w-full rounded-xl border border-slate-800 bg-slate-950/35 p-3 text-left transition hover:border-emerald-400/45 hover:bg-slate-900/70 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-950 light:border-slate-200 light:bg-slate-50 light:hover:border-emerald-300 light:hover:bg-white light:focus:ring-emerald-600 light:focus:ring-offset-white"
      aria-label={`Ir para ${match.homeTeam.name} contra ${match.awayTeam.name}`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-black tabular-nums text-slate-400 light:text-slate-500">
          {formatMatchTime(match.kickoffAt)}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-wide ${
            isLive
              ? "bg-red-500 text-white"
              : isHalftime
                ? "bg-amber-400/15 text-amber-200 light:bg-amber-100 light:text-amber-800"
                : "bg-slate-800 text-slate-300 light:bg-white light:text-slate-600"
          }`}
        >
          {isLive ? (
            <span className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse" />
          ) : null}
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-100 light:text-slate-800">
          <TeamFlag
            code={match.homeTeam.code}
            flagUrl={match.homeTeam.flagUrl}
            name={match.homeTeam.name}
          />
          <span className="min-w-0 truncate">{match.homeTeam.name}</span>
        </span>
        <span className="rounded-lg bg-slate-950/45 px-3 py-1 text-center text-sm font-black tabular-nums text-slate-50 light:bg-white light:text-slate-950">
          {matchDisplayScore(match)}
        </span>
        <span className="flex min-w-0 items-center justify-end gap-2 text-right text-sm font-bold text-slate-100 light:text-slate-800">
          <span className="min-w-0 truncate">{match.awayTeam.name}</span>
          <TeamFlag
            code={match.awayTeam.code}
            flagUrl={match.awayTeam.flagUrl}
            name={match.awayTeam.name}
          />
        </span>
      </div>
    </button>
  );
}

function TodayMatchesBlock({
  liveMatches,
  finishedMatches,
  onMatchSelect,
}: {
  liveMatches: MatchWithTeams[];
  finishedMatches: MatchWithTeams[];
  onMatchSelect: (match: MatchWithTeams) => void;
}) {
  const hasMatches = liveMatches.length > 0 || finishedMatches.length > 0;

  return (
    <Card className="mb-6 p-4 sm:p-5">
      <div className="mb-3">
        <h2 className="text-lg font-black text-slate-50 light:text-slate-950">
          Jogos de hoje
        </h2>
        <p className="mt-1 text-xs text-slate-400 light:text-slate-500">
          Partidas ao vivo e encerradas no horario do Brasil.
        </p>
      </div>

      {!hasMatches ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3 light:border-slate-200 light:bg-slate-50">
          <p className="text-sm font-bold text-slate-400 light:text-slate-600">
            Nenhum jogo ao vivo ou finalizado hoje.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {liveMatches.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-red-200 light:text-red-700">
                Ao vivo
              </h3>
              <div className="grid gap-2 lg:grid-cols-2">
                {liveMatches.map((match) => (
                  <TodayMatchRow
                    key={match.id}
                    match={match}
                    onSelect={onMatchSelect}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {finishedMatches.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400 light:text-slate-500">
                Finalizados
              </h3>
              <div className="grid gap-2 lg:grid-cols-2">
                {finishedMatches.map((match) => (
                  <TodayMatchRow
                    key={match.id}
                    match={match}
                    onSelect={onMatchSelect}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </Card>
  );
}

export function GroupsDashboardClient({
  groups,
  initialPredictions,
  poolId,
  poolName,
  pools,
  canViewPoolPredictions,
  userId,
}: GroupsDashboardClientProps) {
  const [visibleGroups, setVisibleGroups] = useState(groups);
  const [predictions, setPredictions] = useState(initialPredictions);
  const [focusRequest, setFocusRequest] = useState<{
    matchId: string;
    requestId: number;
  } | null>(null);
  const totalMatches = useMemo(
    () =>
      visibleGroups.reduce((total, group) => total + group.matches.length, 0),
    [visibleGroups],
  );
  const filledPredictions = useMemo(
    () => predictions.filter(isFilledPrediction).length,
    [predictions],
  );
  const missingPredictions = Math.max(totalMatches - filledPredictions, 0);
  const progressPercentage =
    totalMatches > 0
      ? Math.round((filledPredictions / totalMatches) * 100)
      : 0;
  const matchIds = useMemo(
    () =>
      visibleGroups.flatMap((group) =>
        group.matches.map((match) => match.id),
      ),
    [visibleGroups],
  );
  const todayMatches = useMemo(() => {
    const todayKey = brazilDayKey(new Date());
    const matches = visibleGroups
      .flatMap((group) => group.matches)
      .filter((match) => match.kickoffAt && brazilDayKey(match.kickoffAt) === todayKey);
    const liveMatches = matches
      .filter(isLiveOrHalftimeMatch)
      .sort((left, right) => {
        const kickoffDifference =
          new Date(left.kickoffAt ?? 0).getTime() -
          new Date(right.kickoffAt ?? 0).getTime();

        if (kickoffDifference !== 0) {
          return kickoffDifference;
        }

        return left.id.localeCompare(right.id);
      });
    const finishedMatches = matches
      .filter(isFinishedMatch)
      .sort((left, right) => {
        const leftTime = new Date(left.scoreUpdatedAt ?? left.kickoffAt ?? 0).getTime();
        const rightTime = new Date(right.scoreUpdatedAt ?? right.kickoffAt ?? 0).getTime();

        if (rightTime !== leftTime) {
          return rightTime - leftTime;
        }

        return left.id.localeCompare(right.id);
      });

    return { liveMatches, finishedMatches };
  }, [visibleGroups]);
  const shouldRefreshLiveScores = useMemo(
    () => {
      const now = new Date();

      return visibleGroups.some((group) =>
        group.matches.some((match) => isInLiveRefreshWindow(match, now)),
      );
    },
    [visibleGroups],
  );

  const handlePredictionSaved = useCallback((savedPrediction: Prediction) => {
    setPredictions((currentPredictions) => {
      const existingIndex = currentPredictions.findIndex(
        (prediction) => prediction.matchId === savedPrediction.matchId,
      );

      if (existingIndex === -1) {
        return [...currentPredictions, savedPrediction];
      }

      return currentPredictions.map((prediction, index) =>
        index === existingIndex
          ? {
              ...prediction,
              ...savedPrediction,
            }
          : prediction,
      );
    });
  }, []);

  const handleTodayMatchSelect = useCallback((match: MatchWithTeams) => {
    setFocusRequest({
      matchId: match.id,
      requestId: Date.now(),
    });
  }, []);

  useEffect(() => {
    if (!shouldRefreshLiveScores || matchIds.length === 0) {
      return;
    }

    const supabase = createClient();

    async function refreshLiveScores() {
      const [matchesResult, goalsResult] = await Promise.all([
        supabase
          .from("matches")
          .select(
            "id, status_short, status_long, elapsed, home_score_live, away_score_live, home_score, away_score, score_updated_at",
          )
          .in("id", matchIds),
        supabase
          .from("match_goals")
          .select(
            "id, match_id, minute, team_name, player_name, goal_type, is_penalty, is_own_goal",
          )
          .in("match_id", matchIds)
          .order("minute", { ascending: true }),
      ]);
      const { data, error } = matchesResult;

      if (error || !data) {
        return;
      }

      const updateByMatchId = new Map(
        data.map((match) => [
          String(match.id),
          {
            statusShort:
              typeof match.status_short === "string"
                ? match.status_short
                : null,
            statusLong:
              typeof match.status_long === "string" ? match.status_long : null,
            elapsed: typeof match.elapsed === "number" ? match.elapsed : null,
            homeScoreLive:
              typeof match.home_score_live === "number"
                ? match.home_score_live
                : null,
            awayScoreLive:
              typeof match.away_score_live === "number"
                ? match.away_score_live
                : null,
            homeScore:
              typeof match.home_score === "number" ? match.home_score : null,
            awayScore:
              typeof match.away_score === "number" ? match.away_score : null,
            scoreUpdatedAt:
              typeof match.score_updated_at === "string"
                ? match.score_updated_at
                : null,
          },
        ]),
      );
      const goalsByMatchId = new Map<string, MatchGoal[]>();

      if (!goalsResult.error && goalsResult.data) {
        goalsResult.data.forEach((goal) => {
          const matchId = String(goal.match_id);
          const currentGoals = goalsByMatchId.get(matchId) ?? [];

          currentGoals.push(mapGoal(goal as Record<string, unknown>));
          goalsByMatchId.set(matchId, currentGoals);
        });
      }

      setVisibleGroups((currentGroups) =>
        currentGroups.map((group) => ({
          ...group,
          matches: group.matches.map((match) => ({
            ...match,
            ...(updateByMatchId.get(match.id) ?? {}),
            goals: goalsByMatchId.get(match.id) ?? match.goals,
          })),
        })),
      );
    }

    const intervalId = window.setInterval(() => {
      void refreshLiveScores();
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [matchIds, shouldRefreshLiveScores]);

  return (
    <main className="mx-auto w-full max-w-[1800px] px-3 py-8 sm:px-5 sm:py-10 lg:px-6">
      <PoolContextPanel pools={pools} selectedPoolId={poolId} />

      <Card className="mb-6 overflow-hidden p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Badge tone="emerald">{poolName}</Badge>
            <h1 className="mt-4 text-3xl font-black text-slate-50 light:text-slate-950 sm:text-4xl">
              Fase de grupos
            </h1>
            <p className="mt-3 max-w-2xl text-base text-slate-400 light:text-slate-500">
              Faca seus palpites da Copa do Mundo.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:min-w-[28rem]">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 light:border-slate-200 light:bg-slate-50">
              <p className="text-2xl font-black text-slate-50 light:text-slate-950">
                {visibleGroups.length}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400 light:text-slate-500">
                grupos
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 light:border-slate-200 light:bg-slate-50">
              <p className="text-2xl font-black text-slate-50 light:text-slate-950">
                {totalMatches}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400 light:text-slate-500">
                jogos
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 light:border-emerald-200 light:bg-emerald-50">
              <p className="text-2xl font-black text-emerald-300 light:text-emerald-700">
                {filledPredictions}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-emerald-200/80 light:text-emerald-700">
                preenchidos
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/45 p-4 light:border-slate-200 light:bg-slate-50 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ListChecks
                  size={18}
                  className="text-emerald-300 light:text-emerald-700"
                  aria-hidden="true"
                />
                <h2 className="text-lg font-black text-slate-50 light:text-slate-950">
                  Progresso dos palpites
                </h2>
              </div>
              <p className="mt-2 text-sm text-slate-400 light:text-slate-500">
                {filledPredictions} de {totalMatches} jogos preenchidos
              </p>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-2xl font-black text-slate-50 light:text-slate-950">
                {progressPercentage}%
              </p>
              <p className="mt-1 text-sm font-bold text-amber-300 light:text-amber-700">
                {missingPredictions === 0
                  ? "Tudo preenchido"
                  : `${missingPredictions} ${
                      missingPredictions === 1
                        ? "palpite faltando"
                        : "palpites faltando"
                    }`}
              </p>
            </div>
          </div>

          <div
            className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800 light:bg-slate-200"
            aria-label={`${progressPercentage}% dos palpites preenchidos`}
          >
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-500 light:bg-emerald-600"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {filledPredictions === 0 ? (
            <p className="mt-4 text-sm font-medium text-slate-300 light:text-slate-600">
              Voce ainda nao fez nenhum palpite. Comece pela Rodada 1.
            </p>
          ) : null}
        </div>
      </Card>

      <TodayMatchesBlock
        liveMatches={todayMatches.liveMatches}
        finishedMatches={todayMatches.finishedMatches}
        onMatchSelect={handleTodayMatchSelect}
      />

      <div className="space-y-5">
        {visibleGroups.map((group) => (
          <GroupSection
            key={group.id}
            group={group}
            predictions={predictions}
            poolId={poolId}
            userId={userId}
            canViewPoolPredictions={canViewPoolPredictions}
            focusRequest={focusRequest}
            onPredictionSaved={handlePredictionSaved}
          />
        ))}
      </div>
    </main>
  );
}
