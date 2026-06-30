"use client";

import { useMemo, useState } from "react";
import { GroupMatches } from "./GroupMatches";
import { GroupTable } from "./GroupTable";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { calculateGroupStandings } from "@/lib/groups/calculateGroupStandings";
import { getMatchDisplayScore } from "@/lib/groups/getMatchDisplayScore";
import type { GroupWithTeamsAndMatches } from "@/types/group";
import type { Prediction } from "@/types/prediction";

type GroupSectionProps = {
  group: GroupWithTeamsAndMatches;
  predictions: Prediction[];
  poolId: string;
  userId: string;
  canViewPoolPredictions: boolean;
  focusRequest?: {
    matchId: string;
    requestId: number;
  } | null;
  onPredictionSaved: (prediction: Prediction) => void;
};

type TableMode = "simulation" | "real";

function isFilledPrediction(prediction: Prediction | undefined) {
  return (
    Boolean(prediction) &&
    prediction?.homeScore !== null &&
    prediction?.awayScore !== null
  );
}

export function GroupSection({
  group,
  predictions,
  poolId,
  userId,
  canViewPoolPredictions,
  focusRequest = null,
  onPredictionSaved,
}: GroupSectionProps) {
  const [tableMode, setTableMode] = useState<TableMode>("simulation");
  const filledMatches = group.matches.filter((match) =>
    isFilledPrediction(
      predictions.find((prediction) => prediction.matchId === match.id),
    ),
  ).length;
  const missingMatches = group.matches.length - filledMatches;
  const isComplete = group.matches.length > 0 && missingMatches === 0;
  const predictionByMatchId = useMemo(
    () =>
      new Map(
        predictions.map((prediction) => [
          prediction.matchId,
          {
            homeScore: prediction.homeScore,
            awayScore: prediction.awayScore,
          },
        ]),
      ),
    [predictions],
  );
  const realScoresByMatchId = useMemo(
    () =>
      new Map(
        group.matches.map((match) => [
          match.id,
          getMatchDisplayScore(match),
        ]),
      ),
    [group.matches],
  );
  const simulatedStandings = useMemo(
    () =>
      calculateGroupStandings({
        teams: group.teams,
        matches: group.matches,
        scoresByMatchId: predictionByMatchId,
      }),
    [group.matches, group.teams, predictionByMatchId],
  );
  const realStandings = useMemo(
    () =>
      calculateGroupStandings({
        teams: group.teams,
        matches: group.matches,
        scoresByMatchId: realScoresByMatchId,
      }),
    [group.matches, group.teams, realScoresByMatchId],
  );
  const selectedStandings =
    tableMode === "simulation" ? simulatedStandings : realStandings;
  const tableTitle =
    tableMode === "simulation"
      ? "Classificação simulada"
      : "Classificação real";
  const tableSubtitle =
    tableMode === "simulation"
      ? "Baseada nos seus palpites preenchidos."
      : "Baseada nos resultados finais e placares ao vivo.";
  const emptyMessage =
    tableMode === "simulation"
      ? "Preencha seus palpites para simular a classificação do grupo."
      : "Ainda não há resultados cadastrados para este grupo.";

  return (
    <Card className="overflow-hidden p-4 md:p-5 xl:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300 light:text-amber-600">
            Grupo
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-50 light:text-slate-950">
            {group.name}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="emerald">{group.teams.length} seleções</Badge>
          <Badge tone="amber">{group.matches.length} jogos</Badge>
          <Badge tone={isComplete ? "emerald" : "default"}>
            {isComplete
              ? "Completo"
              : missingMatches === 1
                ? "1 palpite faltando"
                : `${filledMatches}/${group.matches.length} preenchidos`}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(760px,1.15fr)_minmax(600px,0.85fr)]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-50 light:text-slate-950">
                {tableTitle}
              </h3>
              <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
                {tableSubtitle}
              </p>
            </div>

            <div className="inline-flex rounded-xl border border-slate-800 bg-slate-950/45 p-1 light:border-slate-200 light:bg-slate-50">
              <button
                type="button"
                onClick={() => setTableMode("simulation")}
                className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                  tableMode === "simulation"
                    ? "bg-emerald-400 text-slate-950 light:bg-emerald-600 light:text-white"
                    : "text-slate-400 hover:text-slate-100 light:text-slate-500 light:hover:text-slate-950"
                }`}
              >
                Minha simulação
              </button>
              <button
                type="button"
                onClick={() => setTableMode("real")}
                className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                  tableMode === "real"
                    ? "bg-emerald-400 text-slate-950 light:bg-emerald-600 light:text-white"
                    : "text-slate-400 hover:text-slate-100 light:text-slate-500 light:hover:text-slate-950"
                }`}
              >
                Classificação real
              </button>
            </div>
          </div>
          <GroupTable
            rows={selectedStandings.standings}
            countedMatches={selectedStandings.countedMatches}
            emptyMessage={emptyMessage}
          />
        </div>
        <aside className="min-w-0 border-t border-slate-800 pt-5 light:border-slate-200 2xl:border-l 2xl:border-t-0 2xl:pl-6 2xl:pt-0">
          <GroupMatches
            poolId={poolId}
            userId={userId}
            matches={group.matches}
            predictions={predictions}
            canViewPoolPredictions={canViewPoolPredictions}
            focusRequest={focusRequest}
            onPredictionSaved={onPredictionSaved}
          />
        </aside>
      </div>
    </Card>
  );
}
