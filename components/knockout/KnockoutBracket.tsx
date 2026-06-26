"use client";

import { useMemo, useState, useTransition } from "react";
import { Save } from "lucide-react";
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
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const supabase = useMemo(() => createClient(), []);
  const bracket = useMemo(() => buildBracket(matches, picks), [matches, picks]);
  const champion = championFromPicks(picks);
  const hasRoundOf32 =
    matches.filter((match) => match.round === "round_of_32").length === 16;

  function updatePick(round: KnockoutRound, position: number, team: string) {
    if (isLocked) {
      return;
    }

    const nextPicks = [
      ...picks.filter(
        (pick) => !(pick.round === round && pick.position === position),
      ),
      {
        round,
        position,
        selectedTeam: team,
      },
    ];

    setErrorMessage(null);
    setMessage(null);
    setPicks(pruneInvalidKnockoutPicks(matches, nextPicks));
  }

  function saveBracket() {
    const validation = validateKnockoutBracket(matches, picks);

    if (!validation.isValid) {
      setMessage(null);
      setErrorMessage(validation.message);
      setPicks(validation.picks);
      return;
    }

    setErrorMessage(null);
    setMessage("Salvando...");

    startTransition(async () => {
      const { data, error } = await supabase.rpc("save_knockout_bracket", {
        target_tournament_key: tournamentKey,
        target_picks: validation.picks.map(toRpcPick),
      });

      if (error) {
        setMessage(null);
        setErrorMessage(
          error.message.includes("locked")
            ? "O prazo para editar seu mata-mata ja encerrou."
            : "Nao foi possivel salvar o mata-mata agora.",
        );
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      const savedPicks = Array.isArray(row?.picks)
        ? (row.picks as unknown[]).map(mapSavedPick)
        : validation.picks;

      setPicks(savedPicks);
      setMessage("Mata-mata salvo com sucesso.");
      window.setTimeout(() => setMessage(null), 2400);
    });
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={saveBracket}
              disabled={isLocked || isPending || !hasRoundOf32}
            >
              <Save size={16} aria-hidden="true" />
              Salvar mata-mata
            </Button>
          </div>
        </div>

        <div className="mt-4 min-h-6 text-sm font-bold">
          {message ? (
            <span className="text-emerald-300 light:text-emerald-700">
              {message}
            </span>
          ) : null}
          {errorMessage ? (
            <span className="text-amber-300 light:text-amber-700">
              {errorMessage}
            </span>
          ) : null}
        </div>
      </section>

      {!hasRoundOf32 ? (
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-300 light:text-slate-700">
            Os confrontos dos 16 avos ainda nao foram cadastrados.
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

      <div className="overflow-x-auto pb-3">
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
                disabled={isLocked || isPending}
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

      <KnockoutRanking entries={rankingEntries} />

      {initialBracket ? null : (
        <p className="text-xs font-semibold text-slate-500 light:text-slate-500">
          Seu mata-mata ainda nao foi salvo.
        </p>
      )}
    </div>
  );
}
