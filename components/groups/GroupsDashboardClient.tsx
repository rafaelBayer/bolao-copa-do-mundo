"use client";

import { useCallback, useMemo, useState } from "react";
import { GroupSection } from "@/components/groups/GroupSection";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { GroupWithTeamsAndMatches } from "@/types/group";
import type { Prediction } from "@/types/prediction";

type GroupsDashboardClientProps = {
  groups: GroupWithTeamsAndMatches[];
  initialPredictions: Prediction[];
  poolId: string;
  poolName: string;
  userId: string;
};

function isFilledPrediction(prediction: Prediction) {
  return prediction.homeScore !== null || prediction.awayScore !== null;
}

export function GroupsDashboardClient({
  groups,
  initialPredictions,
  poolId,
  poolName,
  userId,
}: GroupsDashboardClientProps) {
  const [predictions, setPredictions] = useState(initialPredictions);
  const totalMatches = useMemo(
    () => groups.reduce((total, group) => total + group.matches.length, 0),
    [groups],
  );
  const filledPredictions = useMemo(
    () => predictions.filter(isFilledPrediction).length,
    [predictions],
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

  return (
    <main className="mx-auto w-full max-w-[1800px] px-3 py-8 sm:px-5 sm:py-10 lg:px-6">
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
                {groups.length}
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
                palpites
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-5">
        {groups.map((group) => (
          <GroupSection
            key={group.id}
            group={group}
            predictions={predictions}
            poolId={poolId}
            userId={userId}
            onPredictionSaved={handlePredictionSaved}
          />
        ))}
      </div>
    </main>
  );
}
