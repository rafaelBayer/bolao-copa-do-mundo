"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import {
  KNOCKOUT_ROUND_LABELS,
  KNOCKOUT_ROUNDS,
  buildBracket,
  championFromPicks,
} from "@/lib/knockout/buildBracket";
import {
  pruneInvalidKnockoutPicks,
  validateKnockoutBracket,
} from "@/lib/knockout/validateBracket";
import type {
  KnockoutMatch,
  KnockoutPick,
  KnockoutRankingEntry,
  KnockoutRound,
  KnockoutSettings,
  UserKnockoutBracket,
} from "@/lib/knockout/types";
import { KnockoutChampionCard } from "./KnockoutChampionCard";
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
  isLocked: boolean;
  deadlineLabel: string;
  submittedAtLabel: string | null;
};

type SaveStatus = "idle" | "saving" | "draft" | "complete" | "error" | "locked";

function toRpcPick(pick: KnockoutPick) {
  return {
    round: pick.round,
    position: pick.position,
    selected_team: pick.selectedTeam,
  };
}

function mapSavedPick(value: unknown): KnockoutPick {
  const row = value as Record<string, unknown>;

  return {
    id: typeof row.id === "string" ? row.id : undefined,
    round: String(row.round) as KnockoutRound,
    position: Number(row.position),
    selectedTeam: String(row.selectedTeam),
    createdAt: typeof row.createdAt === "string" ? row.createdAt : undefined,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : undefined,
  };
}

function statusLabel(status: SaveStatus, complete: boolean) {
  if (status === "locked") {
    return "Prazo encerrado";
  }

  if (status === "saving") {
    return "Salvando...";
  }

  if (status === "error") {
    return "Erro ao salvar";
  }

  if (status === "complete" || complete) {
    return "Mata-mata completo";
  }

  if (status === "draft") {
    return "Rascunho salvo";
  }

  return "Rascunho";
}

export function KnockoutBracket({
  tournamentKey,
  settings,
  matches,
  initialBracket,
  initialPicks,
  rankingEntries,
  isLocked,
  deadlineLabel,
  submittedAtLabel,
}: KnockoutBracketProps) {
  const [activeRound, setActiveRound] = useState<KnockoutRound>("round_of_32");
  const [picks, setPicks] = useState(() =>
    pruneInvalidKnockoutPicks(matches, initialPicks),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(
    isLocked ? "locked" : "idle",
  );
  const requestIdRef = useRef(0);
  const supabase = useMemo(() => createClient(), []);
  const bracket = useMemo(() => buildBracket(matches, picks), [matches, picks]);
  const champion = championFromPicks(picks);
  const completeValidation = useMemo(
    () => validateKnockoutBracket(matches, picks),
    [matches, picks],
  );
  const isComplete = completeValidation.isValid;
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

  const persistPicks = useCallback(
    (nextPicks: KnockoutPick[]) => {
      if (isLocked) {
        setSaveStatus("locked");
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const complete = validateKnockoutBracket(matches, nextPicks).isValid;

      setSaveStatus("saving");

      void (async () => {
        const { data, error } = await supabase.rpc("save_knockout_bracket", {
          target_tournament_key: tournamentKey,
          target_picks: nextPicks.map(toRpcPick),
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (error) {
          setSaveStatus(
            error.message.includes("locked") ? "locked" : "error",
          );
          return;
        }

        const row = Array.isArray(data) ? data[0] : data;
        const savedPicks = Array.isArray(row?.picks)
          ? (row.picks as unknown[]).map(mapSavedPick)
          : nextPicks;

        setPicks(pruneInvalidKnockoutPicks(matches, savedPicks));
        setSaveStatus(complete ? "complete" : "draft");
      })();
    },
    [isLocked, matches, supabase, tournamentKey],
  );

  function updatePick(round: KnockoutRound, position: number, team: string) {
    if (isLocked) {
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
    persistPicks(nextPicks);
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <KnockoutStatus
              isLocked={isLocked}
              deadlineLabel={deadlineLabel}
              submittedAtLabel={submittedAtLabel}
            />
            <h1 className="mt-4 text-3xl font-black text-slate-50 light:text-slate-950">
              Mata-mata
            </h1>
            <p className="mt-2 text-sm font-semibold text-slate-400 light:text-slate-600">
              {settings.name}
            </p>
            <p className="mt-3 max-w-xl text-sm text-slate-500 light:text-slate-500">
              Clique nos vencedores de cada confronto para montar sua simulacao.
            </p>
          </div>

          <div className="rounded-full border border-slate-800 bg-slate-900/55 px-3 py-1.5 text-xs font-black text-slate-300 light:border-slate-200 light:bg-slate-50 light:text-slate-600">
            {statusLabel(saveStatus, isComplete)}
          </div>
        </div>

        <div className="mt-4 min-h-6 text-sm font-bold text-slate-500 light:text-slate-500">
          {isComplete
            ? "Chave completa. Voce ainda pode editar ate o prazo."
            : "Suas escolhas parciais sao salvas automaticamente."}
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

      {isLocked ? (
        <Card className="p-4 text-sm font-bold text-amber-200 light:text-amber-700">
          O prazo para editar seu mata-mata ja encerrou.
        </Card>
      ) : null}

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
                disabled={isLocked}
                onSelect={updatePick}
              />
            </div>
          ))}
          <section className="min-w-[15rem]">
            <h2 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-400 light:text-slate-500">
              {KNOCKOUT_ROUND_LABELS.champion}
            </h2>
            <KnockoutChampionCard champion={champion} />
          </section>
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
                disabled={isLocked}
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
                    disabled={isLocked}
                    side="center"
                    onSelect={(team) =>
                      updatePick(finalMatch.round, finalMatch.position, team)
                    }
                  />
                </div>
              ) : null}
              <div className="mt-8">
                <KnockoutChampionCard champion={champion} />
              </div>
            </section>

            {rightRounds.map((roundConfig) => (
              <KnockoutRoundColumn
                key={`right-${roundConfig.round}`}
                round={roundConfig.round}
                matches={roundConfig.matches}
                disabled={isLocked}
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
