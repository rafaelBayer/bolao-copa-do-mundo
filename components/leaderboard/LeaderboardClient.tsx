"use client";

import { useMemo, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { LeaderboardEntry } from "@/lib/scoring/buildLeaderboard";

type RankingMode = "general" | "round";

type RoundLeaderboard = {
  entries: LeaderboardEntry[];
  hasResult: boolean;
};

type LeaderboardClientProps = {
  poolName: string;
  generalEntries: LeaderboardEntry[];
  hasGeneralResult: boolean;
  roundLeaderboards: Record<number, RoundLeaderboard>;
};

const rounds = [1, 2, 3];
const emptyLeaderboardEntries: LeaderboardEntry[] = [];
const columnTooltips = {
  pts: "Pontos",
  pe: "Placares exatos",
  rc: "Resultados corretos",
  jp: "Jogos pontuados",
  pf: "Palpites feitos",
};

function participantInitial(entry: Pick<LeaderboardEntry, "name">) {
  return entry.name.trim().charAt(0).toUpperCase() || "U";
}

function ParticipantAvatar({
  entry,
  size = "md",
}: {
  entry: Pick<LeaderboardEntry, "avatarUrl" | "name">;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "h-16 w-16 text-xl" : size === "sm" ? "h-9 w-9" : "h-11 w-11";

  return (
    <span
      className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-900 font-black text-slate-200 light:border-slate-200 light:bg-white light:text-slate-700`}
    >
      {entry.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        participantInitial(entry)
      )}
    </span>
  );
}

function PodiumCard({
  entry,
  highlight = false,
}: {
  entry: LeaderboardEntry;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? "border-emerald-400/30 bg-emerald-400/10 light:border-emerald-200 light:bg-emerald-50"
          : "border-slate-800 bg-slate-950/35 light:border-slate-200 light:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-emerald-300 light:bg-white light:text-emerald-700">
          {entry.position}o
        </div>
        <ParticipantAvatar entry={entry} size={highlight ? "lg" : "md"} />
        <div className="min-w-0">
          <p className="truncate font-black text-slate-50 light:text-slate-950">
            {entry.name}
          </p>
          <p className="mt-1 text-sm font-bold text-emerald-300 light:text-emerald-700">
            {entry.totalPoints} pts
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-slate-400 light:text-slate-500">
        <span>PE: {entry.exactScores}</span>
        <span>RC: {entry.correctResults}</span>
      </div>
    </div>
  );
}

function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 light:border-slate-200">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500 light:border-slate-200">
              <th className="px-4 py-3">Pos</th>
              <th className="px-4 py-3">Participante</th>
              <th
                className="px-4 py-3 text-right"
                title={columnTooltips.pts}
                aria-label={columnTooltips.pts}
              >
                Pts
              </th>
              <th
                className="px-4 py-3 text-right"
                title={columnTooltips.pe}
                aria-label={columnTooltips.pe}
              >
                PE
              </th>
              <th
                className="px-4 py-3 text-right"
                title={columnTooltips.rc}
                aria-label={columnTooltips.rc}
              >
                RC
              </th>
              <th
                className="px-4 py-3 text-right"
                title={columnTooltips.jp}
                aria-label={columnTooltips.jp}
              >
                JP
              </th>
              <th
                className="px-4 py-3 text-right"
                title={columnTooltips.pf}
                aria-label={columnTooltips.pf}
              >
                PF
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.userId}
                className="border-b border-slate-800/70 light:border-slate-200/80"
              >
                <td className="px-4 py-3 text-lg font-black text-slate-50 light:text-slate-950">
                  {entry.position}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ParticipantAvatar entry={entry} size="sm" />
                    <p className="font-bold text-slate-100 light:text-slate-950">
                      {entry.name}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-black text-emerald-300 light:text-emerald-700">
                  {entry.totalPoints}
                </td>
                <td className="px-4 py-3 text-right text-slate-300 light:text-slate-700">
                  {entry.exactScores}
                </td>
                <td className="px-4 py-3 text-right text-slate-300 light:text-slate-700">
                  {entry.correctResults}
                </td>
                <td className="px-4 py-3 text-right text-slate-300 light:text-slate-700">
                  {entry.scoredMatches}
                </td>
                <td className="px-4 py-3 text-right text-slate-300 light:text-slate-700">
                  {entry.filledPredictions}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-800 md:hidden light:divide-slate-200">
        {entries.map((entry) => (
          <div key={entry.userId} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-lg font-black text-slate-50 light:text-slate-950">
                  {entry.position}
                </span>
                <ParticipantAvatar entry={entry} size="sm" />
                <p className="truncate font-bold text-slate-100 light:text-slate-950">
                  {entry.name}
                </p>
              </div>
              <p className="text-lg font-black text-emerald-300 light:text-emerald-700">
                {entry.totalPoints} pts
              </p>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-xs font-bold text-slate-400 light:text-slate-500">
              <span title={columnTooltips.pe} aria-label={columnTooltips.pe}>
                PE {entry.exactScores}
              </span>
              <span title={columnTooltips.rc} aria-label={columnTooltips.rc}>
                RC {entry.correctResults}
              </span>
              <span title={columnTooltips.jp} aria-label={columnTooltips.jp}>
                JP {entry.scoredMatches}
              </span>
              <span title={columnTooltips.pf} aria-label={columnTooltips.pf}>
                PF {entry.filledPredictions}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function modeButtonClass(isActive: boolean) {
  return `rounded-lg px-3 py-2 text-sm font-bold transition ${
    isActive
      ? "bg-emerald-400 text-slate-950 light:bg-emerald-600 light:text-white"
      : "text-slate-400 hover:text-slate-100 light:text-slate-500 light:hover:text-slate-950"
  }`;
}

export function LeaderboardClient({
  poolName,
  generalEntries,
  hasGeneralResult,
  roundLeaderboards,
}: LeaderboardClientProps) {
  const [mode, setMode] = useState<RankingMode>("general");
  const [selectedRound, setSelectedRound] = useState(1);
  const [showScoringInfo, setShowScoringInfo] = useState(false);
  const selectedRoundLeaderboard = roundLeaderboards[selectedRound];
  const activeEntries =
    mode === "general"
      ? generalEntries
      : selectedRoundLeaderboard?.entries ?? emptyLeaderboardEntries;
  const activeHasResult =
    mode === "general"
      ? hasGeneralResult
      : Boolean(selectedRoundLeaderboard?.hasResult);
  const podiumEntries = useMemo(
    () => activeEntries.filter((entry) => entry.totalPoints > 0).slice(0, 3),
    [activeEntries],
  );
  const podiumTitle =
    mode === "general" ? "Top 3 geral" : `Top 3 da Rodada ${selectedRound}`;
  const tableTitle =
    mode === "general" ? "Ranking geral" : `Ranking da Rodada ${selectedRound}`;
  const emptyMessage =
    mode === "general"
      ? "A classificacao sera atualizada quando os primeiros resultados forem cadastrados."
      : `A Rodada ${selectedRound} ainda nao possui jogos com resultado.`;
  const noScoreMessage =
    mode === "general"
      ? "Nenhum participante pontuou ainda."
      : `Nenhum participante pontuou na Rodada ${selectedRound} ainda.`;

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300 light:text-emerald-700">
            {poolName}
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-50 light:text-slate-950">
            Classificacao
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400 light:text-slate-500">
            Ranking dos participantes com base nos jogos que ja possuem resultado.
          </p>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowScoringInfo((current) => !current)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-2 text-sm font-bold text-slate-200 transition hover:border-slate-700 hover:bg-slate-900 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:bg-slate-50"
            aria-expanded={showScoringInfo}
          >
            <HelpCircle size={16} aria-hidden="true" />
            Como pontua?
          </button>

          {showScoringInfo ? (
            <div className="absolute right-0 z-10 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-xl light:border-slate-200 light:bg-white">
              <p className="text-sm font-black text-slate-50 light:text-slate-950">
                Como funciona a pontuacao
              </p>
              <p className="mt-3 text-sm font-bold text-slate-300 light:text-slate-700">
                Placar exato: 3 pts
              </p>
              <p className="mt-1 text-sm font-bold text-slate-300 light:text-slate-700">
                Resultado correto: 1 pt
              </p>
              <p className="mt-1 text-sm font-bold text-slate-300 light:text-slate-700">
                Erro: 0 pts
              </p>
              <p className="mt-3 text-sm text-slate-400 light:text-slate-500">
                Resultado correto significa acertar se o jogo terminou com
                vitoria do mandante, empate ou vitoria do visitante.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex w-fit rounded-xl border border-slate-800 bg-slate-950/45 p-1 light:border-slate-200 light:bg-slate-50">
          <button
            type="button"
            onClick={() => setMode("general")}
            className={modeButtonClass(mode === "general")}
          >
            Ranking geral
          </button>
          <button
            type="button"
            onClick={() => setMode("round")}
            className={modeButtonClass(mode === "round")}
          >
            Por rodada
          </button>
        </div>

        {mode === "round" ? (
          <div className="inline-flex w-fit rounded-xl border border-slate-800 bg-slate-950/45 p-1 light:border-slate-200 light:bg-slate-50">
            {rounds.map((round) => (
              <button
                key={round}
                type="button"
                onClick={() => setSelectedRound(round)}
                className={modeButtonClass(selectedRound === round)}
              >
                Rodada {round}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
              {podiumTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-400 light:text-slate-500">
              {mode === "general"
                ? "Melhores participantes considerando todos os jogos com resultado."
                : `Desempenho considerando apenas jogos da Rodada ${selectedRound}.`}
            </p>
          </div>
        </div>

        {!activeHasResult ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3 text-sm text-slate-400 light:border-slate-200 light:bg-slate-50 light:text-slate-500">
            {emptyMessage}
          </div>
        ) : podiumEntries.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3 text-sm text-slate-400 light:border-slate-200 light:bg-slate-50 light:text-slate-500">
            {noScoreMessage}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {podiumEntries.map((entry, index) => (
              <PodiumCard
                key={entry.userId}
                entry={entry}
                highlight={index === 0}
              />
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="mb-3">
          <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
            {tableTitle}
          </h2>
        </div>

        {!activeHasResult ? (
          <div className="mb-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm font-medium text-amber-200 light:border-amber-200 light:bg-amber-50 light:text-amber-800">
            {emptyMessage}
          </div>
        ) : null}

        <LeaderboardTable entries={activeEntries} />
      </Card>
    </div>
  );
}
