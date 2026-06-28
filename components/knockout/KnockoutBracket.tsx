"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import {
  KNOCKOUT_ROUND_LABELS,
  KNOCKOUT_ROUNDS,
  buildBracket,
} from "@/lib/knockout/buildBracket";
import { pruneInvalidKnockoutPicks } from "@/lib/knockout/validateBracket";
import type {
  KnockoutMatch,
  KnockoutPick,
  KnockoutRankingEntry,
  KnockoutRound,
  KnockoutSettings,
  UserKnockoutBracket,
} from "@/lib/knockout/types";
import { KnockoutMatchCard } from "./KnockoutMatchCard";
import { KnockoutRanking } from "./KnockoutRanking";
import { KnockoutRound as KnockoutRoundColumn } from "./KnockoutRound";
import { KnockoutStatus } from "./KnockoutStatus";

type KnockoutBracketProps = {
  tournamentKey: string;
  settings: KnockoutSettings;
  matches: KnockoutMatch[];
  initialBracket: UserKnockoutBracket | null;
  initialPicks: KnockoutPick[];
  rankingEntries: KnockoutRankingEntry[];
  availableMatchesCount: number;
  openPicksCount: number;
  submittedOpenPicksCount: number;
  missingOpenPicksCount: number;
  nextLockLabel: string;
  submittedAtLabel: string | null;
};

type SaveStatus = "idle" | "saving" | "draft" | "error" | "locked";

function mapSavedPick(value: unknown): KnockoutPick {
  const row = value as Record<string, unknown>;

  return {
    id: typeof row.id === "string" ? row.id : undefined,
    round: String(row.round) as KnockoutRound,
    position: Number(row.position),
    selectedTeam:
      typeof row.selectedTeam === "string" ? row.selectedTeam : "",
    createdAt: typeof row.createdAt === "string" ? row.createdAt : undefined,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : undefined,
  };
}

function statusLabel(status: SaveStatus) {
  if (status === "locked") {
    return "Palpite bloqueado";
  }

  if (status === "saving") {
    return "Salvando...";
  }

  if (status === "error") {
    return "Erro ao salvar";
  }

  if (status === "draft") {
    return "Palpite salvo";
  }

  return "Palpites abertos";
}

export function KnockoutBracket({
  tournamentKey,
  settings,
  matches,
  initialBracket,
  initialPicks,
  rankingEntries,
  availableMatchesCount,
  openPicksCount,
  submittedOpenPicksCount,
  missingOpenPicksCount,
  nextLockLabel,
  submittedAtLabel,
}: KnockoutBracketProps) {
  const [activeRound, setActiveRound] = useState<KnockoutRound>("round_of_32");
  const [picks, setPicks] = useState(() =>
    pruneInvalidKnockoutPicks(matches, initialPicks),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const requestIdRef = useRef(0);
  const supabase = useMemo(() => createClient(), []);
  const bracket = useMemo(() => buildBracket(matches, picks), [matches, picks]);
  const hasOpenMatches = openPicksCount > 0;
  const hasRoundOf32 =
    matches.filter((match) => match.round === "round_of_32").length === 16;
  const roundState = (round: KnockoutRound) =>
    bracket.find((item) => item.round === round);
  const leftRounds = [
    {
      round: "round_of_32" as const,
      matches: roundState("round_of_32")?.matches.slice(0, 8) ?? [],
    },
    {
      round: "round_of_16" as const,
      matches: roundState("round_of_16")?.matches.slice(0, 4) ?? [],
    },
    {
      round: "quarterfinal" as const,
      matches: roundState("quarterfinal")?.matches.slice(0, 2) ?? [],
    },
    {
      round: "semifinal" as const,
      matches: roundState("semifinal")?.matches.slice(0, 1) ?? [],
    },
  ];
  const rightRounds = [
    {
      round: "semifinal" as const,
      matches: roundState("semifinal")?.matches.slice(1, 2) ?? [],
    },
    {
      round: "quarterfinal" as const,
      matches: roundState("quarterfinal")?.matches.slice(2, 4) ?? [],
    },
    {
      round: "round_of_16" as const,
      matches: roundState("round_of_16")?.matches.slice(4, 8) ?? [],
    },
    {
      round: "round_of_32" as const,
      matches: roundState("round_of_32")?.matches.slice(8, 16) ?? [],
    },
  ];
  const finalMatch = roundState("final")?.matches[0] ?? null;
  const currentUserScore = initialBracket
    ? rankingEntries.find((entry) => entry.userId === initialBracket.userId)
    : null;

  const persistPick = useCallback(
    (round: KnockoutRound, position: number, team: string) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setSaveStatus("saving");

      void (async () => {
        const { data, error } = await supabase.rpc("save_knockout_pick", {
          target_tournament_key: tournamentKey,
          target_round: round,
          target_position: position,
          target_selected_team: team,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (error) {
          setSaveStatus(
            error.message.toLowerCase().includes("bloqueado") ||
              error.message.toLowerCase().includes("prazo") ||
              error.message.toLowerCase().includes("locked")
              ? "locked"
              : "error",
          );
          return;
        }

        const row = Array.isArray(data) ? data[0] : data;
        const savedPick = row?.pick ? mapSavedPick(row.pick) : null;

        if (savedPick) {
          setPicks((currentPicks) =>
            pruneInvalidKnockoutPicks(matches, [
              ...currentPicks.filter(
                (pick) =>
                  !(pick.round === savedPick.round && pick.position === savedPick.position),
              ),
              savedPick,
            ]),
          );
        }

        setSaveStatus("draft");
      })();
    },
    [matches, supabase, tournamentKey],
  );

  function updatePick(round: KnockoutRound, position: number, team: string) {
    const match = matches.find(
      (item) => item.round === round && item.position === position,
    );

    if (!match?.canPick) {
      setSaveStatus("locked");
      return;
    }

    const nextPicks = pruneInvalidKnockoutPicks(matches, [
      ...picks.filter(
        (pick) => !(pick.round === round && pick.position === position),
      ),
      {
        round,
        position,
        selectedTeam: team,
      },
    ]);

    setPicks(nextPicks);
    persistPick(round, position, team);
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <KnockoutStatus
              hasOpenMatches={hasOpenMatches}
              nextLockLabel={nextLockLabel}
              availableMatchesCount={availableMatchesCount}
              submittedOpenPicksCount={submittedOpenPicksCount}
              openPicksCount={openPicksCount}
              submittedAtLabel={submittedAtLabel}
            />
            <h1 className="mt-4 text-3xl font-black text-slate-50 light:text-slate-950">
              Palpites do mata-mata
            </h1>
            <p className="mt-2 text-sm font-semibold text-slate-400 light:text-slate-600">
              {settings.name}
            </p>
            <p className="mt-3 max-w-xl text-sm text-slate-500 light:text-slate-500">
              Voce pode preencher os palpites do mata-mata aos poucos. Cada jogo bloqueia 10 minutos antes do inicio.
            </p>
            <p className="mt-2 max-w-xl text-sm text-slate-500 light:text-slate-500">
              As proximas fases seguem os classificados reais da Copa. Se voce errar um classificado, ainda podera palpitar nos proximos confrontos oficiais.
            </p>
          </div>

          <div className="rounded-full border border-slate-800 bg-slate-900/55 px-3 py-1.5 text-xs font-black text-slate-300 light:border-slate-200 light:bg-slate-50 light:text-slate-600">
            {statusLabel(saveStatus)}
          </div>
        </div>

        <div className="mt-4 min-h-6 text-sm font-bold text-slate-500 light:text-slate-500">
          {missingOpenPicksCount > 0
            ? `Ainda faltam ${missingOpenPicksCount} jogos abertos para palpitar.`
            : "Todos os jogos abertos ja foram palpitados."}
          {saveStatus === "error" ? (
            <span className="ml-2 text-red-300 light:text-red-600">
              Erro ao salvar. Tente novamente.
            </span>
          ) : null}
        </div>
      </section>

      {!hasRoundOf32 ? (
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-300 light:text-slate-700">
            Os confrontos do mata-mata ainda serao divulgados.
          </p>
        </Card>
      ) : null}

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-50 light:text-slate-950">
              Pontuacao dos confrontos oficiais
            </h2>
            <p className="mt-2 text-sm text-slate-400 light:text-slate-600">
              16 avos: 2 pts; oitavas: 3; quartas: 5; semifinal: 8;
              final: 12. So contam jogos com vencedor oficial.
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/45 px-4 py-3 text-right light:border-slate-200 light:bg-slate-50">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 light:text-slate-500">
              Sua pontuacao
            </p>
            <p className="mt-1 text-2xl font-black text-emerald-300 light:text-emerald-700">
              {currentUserScore?.totalPoints ?? 0} pts
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500 light:text-slate-500">
              {currentUserScore
                ? `${currentUserScore.correctPicks} acertos em confrontos oficiais`
                : "Sera calculada conforme os jogos terminarem"}
            </p>
          </div>
        </div>
      </Card>

      <div className="flex max-w-full gap-2 overflow-x-auto pb-1 lg:hidden">
        {KNOCKOUT_ROUNDS.map((round) => (
          <Button
            key={round}
            type="button"
            variant={activeRound === round ? "primary" : "secondary"}
            className="shrink-0 px-3 py-2"
            onClick={() => setActiveRound(round)}
          >
            {KNOCKOUT_ROUND_LABELS[round]}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto pb-3 lg:hidden">
        <div className="flex min-w-max gap-4">
          {bracket.map((roundState) => (
            <div
              key={roundState.round}
              className={`${
                activeRound === roundState.round ? "block" : "hidden"
              } lg:block`}
            >
              <KnockoutRoundColumn
                round={roundState.round}
                matches={roundState.matches}
                disabled={false}
                onSelect={updatePick}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="hidden overflow-x-auto pb-4 lg:block">
        <div className="mx-auto min-w-[1280px] max-w-[1500px] rounded-lg border border-slate-800/75 bg-slate-950/38 px-6 py-6 light:border-slate-200 light:bg-slate-50">
          <div className="grid min-h-[44rem] grid-cols-[repeat(4,9.25rem)_13rem_repeat(4,9.25rem)] items-stretch justify-center gap-x-7">
            {leftRounds.map((roundConfig) => (
              <KnockoutRoundColumn
                key={`left-${roundConfig.round}`}
                round={roundConfig.round}
                matches={roundConfig.matches}
                disabled={false}
                side="left"
                compactTitle
                className="h-full"
                onSelect={updatePick}
              />
            ))}

            <section className="flex h-full min-w-[13rem] flex-col items-center justify-center">
              <h2 className="mb-4 text-center text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 light:text-slate-500">
                {KNOCKOUT_ROUND_LABELS.final}
              </h2>
              {finalMatch ? (
                <div className="relative">
                  <span className="pointer-events-none absolute right-full top-1/2 h-px w-7 bg-slate-700/75 light:bg-slate-300" />
                  <span className="pointer-events-none absolute left-full top-1/2 h-px w-7 bg-slate-700/75 light:bg-slate-300" />
                  <KnockoutMatchCard
                    match={finalMatch}
                    disabled={false}
                    side="center"
                    onSelect={(team) =>
                      updatePick(finalMatch.round, finalMatch.position, team)
                    }
                  />
                </div>
              ) : null}
            </section>

            {rightRounds.map((roundConfig) => (
              <KnockoutRoundColumn
                key={`right-${roundConfig.round}`}
                round={roundConfig.round}
                matches={roundConfig.matches}
                disabled={false}
                side="right"
                compactTitle
                className="h-full"
                onSelect={updatePick}
              />
            ))}
          </div>
        </div>
      </div>

      <KnockoutRanking entries={rankingEntries} />

      {initialBracket ? null : (
        <p className="text-xs font-semibold text-slate-500 light:text-slate-500">
          Seu mata-mata ainda nao foi salvo.
        </p>
      )}
    </div>
  );
}
