"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  Medal,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  KNOCKOUT_ROUND_LABELS,
  KNOCKOUT_ROUNDS,
} from "@/lib/knockout/bracketStructure";
import type { KnockoutRankingEntry } from "@/lib/knockout/types";

type KnockoutRankingProps = {
  entries: KnockoutRankingEntry[];
  hasError?: boolean;
};

function pickResultLabel(pick: KnockoutRankingEntry["picks"][number]) {
  if (pick.isCorrect === null) {
    return "Aguardando";
  }

  if (pick.isCorrect) {
    return `+${pick.points} pts`;
  }

  return "0 pts";
}

function pickStatusLabel(pick: KnockoutRankingEntry["picks"][number]) {
  if (pick.isCorrect === null) {
    return "Pendente";
  }

  return pick.isCorrect ? "Acertou" : "Errou";
}

function pickStatusClass(pick: KnockoutRankingEntry["picks"][number]) {
  if (pick.isCorrect === null) {
    return "border-amber-400/25 bg-amber-400/10 text-amber-200 light:border-amber-300 light:bg-amber-50 light:text-amber-800";
  }

  if (pick.isCorrect) {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200 light:border-emerald-300 light:bg-emerald-50 light:text-emerald-800";
  }

  return "border-slate-700 bg-slate-900/70 text-slate-400 light:border-slate-200 light:bg-white light:text-slate-500";
}

function groupPicksByRound(picks: KnockoutRankingEntry["picks"]) {
  return KNOCKOUT_ROUNDS.map((round) => ({
    round,
    picks: picks.filter((pick) => pick.round === round),
  })).filter((group) => group.picks.length > 0);
}

export function KnockoutRanking({ entries, hasError = false }: KnockoutRankingProps) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  return (
    <section>
      <h2 className="mb-3 text-lg font-black text-slate-50 light:text-slate-950">
        Ranking Mata-mata
      </h2>
      <Card className="overflow-hidden">
        {hasError ? (
          <p className="p-4 text-sm font-semibold text-amber-300 light:text-amber-700">
            Não foi possível calcular o ranking do mata-mata agora.
          </p>
        ) : entries.length === 0 ? (
          <p className="p-4 text-sm font-semibold text-slate-400 light:text-slate-600">
            Ranking indisponível até os primeiros resultados oficiais.
          </p>
        ) : (
          <div className="divide-y divide-slate-800 light:divide-slate-200">
            {entries.map((entry, index) => (
              <div
                key={entry.userId}
                className="px-4 py-3"
              >
                <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-slate-200 light:bg-slate-100 light:text-slate-700">
                    {index === 0 ? <Medal size={16} aria-hidden="true" /> : index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-100 light:text-slate-900">
                      {entry.name}
                    </p>
                    <p className="text-xs font-semibold text-slate-500 light:text-slate-500">
                      {entry.correctPicks} acertos oficiais | {entry.picks.length} palpites fechados
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-slate-600 light:text-slate-500">
                      16 avos {entry.roundOf32Points} | Oitavas{" "}
                      {entry.roundOf16Points} | Quartas{" "}
                      {entry.quarterfinalPoints} | Semi {entry.semifinalPoints} |
                      Final {entry.finalPoints}
                    </p>
                  </div>
                  <span className="text-lg font-black text-emerald-300 light:text-emerald-700">
                    {entry.totalPoints}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedUserId((current) =>
                      current === entry.userId ? null : entry.userId,
                    )
                  }
                  className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-800 px-2 py-1 text-[11px] font-black text-slate-300 transition hover:border-emerald-400/50 hover:text-emerald-200 light:border-slate-200 light:text-slate-600 light:hover:border-emerald-300 light:hover:text-emerald-700"
                  aria-expanded={expandedUserId === entry.userId}
                >
                  Ver palpites fechados
                  <ChevronDown
                    size={13}
                    aria-hidden="true"
                    className={`transition ${
                      expandedUserId === entry.userId ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {expandedUserId === entry.userId ? (
                  <div className="scrollbar-hidden mt-3 max-h-80 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/45 p-3 light:border-slate-200 light:bg-slate-50">
                    {entry.picks.length === 0 ? (
                      <p className="text-xs font-semibold text-slate-500 light:text-slate-500">
                        Nenhum palpite fechado ainda.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {groupPicksByRound(entry.picks).map((group) => (
                          <div key={group.round}>
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="text-[11px] font-black uppercase tracking-normal text-slate-400 light:text-slate-500">
                                {KNOCKOUT_ROUND_LABELS[group.round]}
                              </span>
                              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black text-slate-400 light:bg-white light:text-slate-500">
                                {group.picks.length} jogos
                              </span>
                            </div>
                            <div className="space-y-2">
                              {group.picks.map((pick) => (
                                <div
                                  key={`${pick.round}:${pick.position}:${pick.selectedTeam}`}
                                  className="rounded-md border border-slate-800 bg-slate-950/70 p-2 light:border-slate-200 light:bg-white"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="truncate text-xs font-black text-slate-100 light:text-slate-900">
                                        Jogo {pick.position}: {pick.teamA} x {pick.teamB}
                                      </p>
                                      <div className="mt-1 flex flex-wrap gap-1.5">
                                        <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-black text-emerald-200 light:bg-emerald-50 light:text-emerald-800">
                                          Palpite: {pick.selectedTeam}
                                        </span>
                                        {pick.winnerTeam ? (
                                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300 light:bg-slate-100 light:text-slate-600">
                                            Vencedor: {pick.winnerTeam}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                    <span
                                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${pickStatusClass(pick)}`}
                                    >
                                      {pick.isCorrect ? (
                                        <CheckCircle2 size={11} aria-hidden="true" />
                                      ) : pick.isCorrect === false ? (
                                        <XCircle size={11} aria-hidden="true" />
                                      ) : (
                                        <Clock3 size={11} aria-hidden="true" />
                                      )}
                                      {pickStatusLabel(pick)}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-800 pt-1.5 light:border-slate-100">
                                    <span className="text-[10px] font-semibold text-slate-500 light:text-slate-500">
                                      Resultado do palpite
                                    </span>
                                    <span className="text-xs font-black text-slate-100 light:text-slate-900">
                                      {pickResultLabel(pick)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
